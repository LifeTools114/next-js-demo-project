/**
 * 상태 전이 자동 알림 — "지금 어디까지 됐어요?" 문의를 없앱니다.
 *
 * 주문 상태가 바뀔 때마다:
 *   1. .data/notifications.jsonl 에 기록 (발송 채널과 무관한 원장)
 *   2. NOTIFY_WEBHOOK_URL 이 설정돼 있으면 운영자 채널로 전송
 *      (Slack/Discord/카카오워크 등 웹훅 하나면 사장님 폰에 뜹니다)
 *
 * 고객 채널(카카오 알림톡·Zalo·이메일)은 사업자 채널 승인 후
 * CHANNELS 에 어댑터만 추가하면 됩니다 — 기록에는 customerFacing 플래그가
 * 이미 있어, 채널이 생기는 즉시 어떤 알림을 보낼지 판단할 수 있습니다.
 *
 * 알림 실패는 주문 처리를 절대 막지 않습니다 (기록 후 무시).
 */

import { ORDER_STATES } from './order/states.js'
import { appendLog } from './order/persist.js'
import { TELEGRAM, telegramEnabled } from '../config/telegram.js'
import { sendMessage } from './telegram/api.js'

/** 고객에게 의미 있는 상태 — 내부 처리 단계는 소음이라 뺍니다 */
const CUSTOMER_STATES = new Set([
  'AWAITING_PAYMENT', 'PAID', 'PURCHASED', 'SETTLEMENT_DUE', 'SETTLED', 'SHIPPED', 'DELIVERED', 'CANCELLED',
])

const krw = (n) => `${Math.round(Math.abs(Number(n) || 0)).toLocaleString('ko-KR')}원`

/** 상태별 안내문 구성 (고객에게 보여도 되는 문구만) */
export function composeNotification(order, state) {
  const info = ORDER_STATES[state] ?? { label: state, description: '' }
  const extras = []
  if (state === 'SETTLEMENT_DUE' && order.settlement) {
    extras.push(`${order.settlement.label} ${krw(order.settlement.absKrw)}`)
  }
  if (state === 'SHIPPED' && order.delivery?.trackingNo) {
    extras.push(`운송장 ${order.delivery.trackingNo}`)
  }
  if (state === 'AWAITING_PAYMENT' && order.invoice) {
    extras.push(`청구액 ${krw(order.invoice.amountKrw)}`)
  }

  return {
    orderNo: order.orderNo,
    state,
    customerFacing: CUSTOMER_STATES.has(state),
    customerName: order.customer?.name ?? '',
    customerPhone: order.customer?.phone ?? '',
    customerEmail: order.customer?.email ?? '',
    title: `[하노이직구] ${order.orderNo} — ${info.label}`,
    message: [info.description, ...extras].filter(Boolean).join(' '),
  }
}

/** 운영자 웹훅 (선택) — 실패는 조용히 무시합니다 */
function fireOperatorWebhook(notification) {
  const url = process.env.NOTIFY_WEBHOOK_URL
  if (!url) return
  const text = `${notification.title}\n${notification.message}`
  // Slack(text)·Discord(content) 양쪽 필드를 모두 채워 아무 웹훅에나 붙습니다.
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text }),
  }).catch(() => { /* 알림은 부가 기능 — 주문 흐름을 막지 않습니다 */ })
}

/** store.js 의 상태 전이 지점에서 호출됩니다 */
export function notifyTransition(order, state) {
  try {
    const notification = composeNotification(order, state)
    appendLog('notifications.jsonl', notification)
    fireOperatorWebhook(notification)
    // 운영자 텔레그램 방 — 파트너 봇을 그대로 재사용합니다 (실패 무시)
    if (telegramEnabled() && TELEGRAM.operatorChatId) {
      sendMessage(TELEGRAM.operatorChatId, `${notification.title}\n${notification.message}`).catch(() => {})
    }
  } catch {
    /* 알림 실패가 주문 처리를 깨면 안 됩니다 */
  }
}
