/**
 * 파트너 메시지 실행기 — 해석(parseCommand)과 주문 처리를 잇습니다.
 *
 * 허용 액션은 물류 네 가지뿐입니다: 입고 실측 / 현황 / 배송일정 / 배달완료.
 * 입금 확인·취소 같은 돈이 걸린 액션은 텔레그램으로 절대 열지 않습니다.
 *
 * 반환값의 reply 를 봇이 그대로 파트너 방에 회신하므로, 파트너는 보낸
 * 즉시 처리 여부를 압니다. 고객 청구 금액 등은 회신에 넣지 않습니다.
 */

import {
  findByInbound, recordWeighing, linkInbound, addDeliveryMilestone,
  setDeliverySchedule, markDelivered,
} from '../order/store.js'
import { parseCommand, findOrderFromText, trackingTokenFrom } from './inbound.js'
import { appendLog } from '../order/persist.js'

const BY = 'telegram:partner'

export function handlePartnerMessage(text) {
  const cmd = parseCommand(text)
  const result = execute(cmd, text)
  appendLog('telegram.jsonl', { event: 'partner-message', text: String(text).slice(0, 200), action: cmd.action, ...result.log })
  return result
}

function execute(cmd, text) {
  if (!cmd.action) {
    return {
      ok: false,
      log: { outcome: 'ignored' },
      reply: null, // 잡담·인사에는 회신하지 않습니다
    }
  }

  const order = findOrderFromText(text, findByInbound)
  if (!order) {
    return {
      ok: false,
      log: { outcome: 'order-not-found' },
      reply: '⚠️ 주문을 찾지 못했습니다. YS-ECOM(이름)·주문번호(HN…)·운송장 중 하나를 함께 보내주세요.',
    }
  }

  try {
    switch (cmd.action) {
      case 'weigh': {
        let target = order
        // 미연결 배송대행(입금만 완료)은 메시지의 운송장으로 그 자리에서 연결
        if (target.track === 'forwarding' && target.state === 'PAID') {
          const tracking = trackingTokenFrom(text)
          if (!tracking) {
            return { ok: false, log: { outcome: 'needs-tracking', orderNo: target.orderNo },
              reply: `⚠️ ${target.orderNo} 는 아직 미연결 상태입니다. 운송장 번호를 함께 보내주세요.` }
          }
          target = linkInbound(target.id, { trackingNo: tracking, by: BY })
        }
        const after = recordWeighing(target.id, { actualWeightG: cmd.weightG, by: BY })
        return {
          ok: true,
          log: { outcome: 'weighed', orderNo: after.orderNo, weightG: cmd.weightG, state: after.state },
          reply: `✅ ${after.orderNo} 입고 완료 — 실측 ${(cmd.weightG / 1000).toFixed(2)}kg 처리했습니다.`,
        }
      }
      case 'schedule': {
        const after = setDeliverySchedule(order.id, cmd.scheduleText, BY)
        return {
          ok: true,
          log: { outcome: 'scheduled', orderNo: after.orderNo, scheduleText: cmd.scheduleText },
          reply: `✅ ${after.orderNo} 배달 예정 등록 — ${after.delivery.scheduledText}`,
        }
      }
      case 'milestone': {
        const after = addDeliveryMilestone(order.id, cmd.milestone, BY)
        return {
          ok: true,
          log: { outcome: 'milestone', orderNo: after.orderNo, milestone: cmd.milestone },
          reply: `✅ ${after.orderNo} 현황 갱신 — ${cmd.milestone}`,
        }
      }
      case 'delivered': {
        const after = markDelivered(order.id, BY)
        return {
          ok: true,
          log: { outcome: 'delivered', orderNo: after.orderNo },
          reply: `✅ ${after.orderNo} 배송 완료 처리했습니다. 감사합니다!`,
        }
      }
      default:
        return { ok: false, log: { outcome: 'unknown-action' }, reply: null }
    }
  } catch (error) {
    return {
      ok: false,
      log: { outcome: 'error', orderNo: order.orderNo, error: error.message },
      reply: `⚠️ ${order.orderNo} 처리 실패 — ${error.message}`,
    }
  }
}
