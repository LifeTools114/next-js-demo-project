/**
 * POST /api/admin/coupang-capture — 쿠팡 주문완료 자동 수집 (운영자 확장)
 * body: { coupangOrderNo, amountKrw }
 *
 * 운영자 모드 확장이 쿠팡 주문완료 화면에서 주문번호·결제액을 읽어
 * 쏘면, 매입 중(PURCHASING)인 주문이 정확히 하나일 때 매입 완료를
 * 자동 기록합니다. 0건이거나 여러 건이면 자동 기록하지 않고 검토
 * 큐(.data/coupang-capture-review.jsonl)에 남깁니다 — 잘못 매칭된
 * 매입 기록은 원장을 오염시키므로 애매하면 사람에게 넘깁니다.
 */

import { listOrders, recordPurchase, orderView } from '../../../lib/order/store.js'
import { requireAdmin, UnauthorizedError } from '../../../lib/auth.js'
import { appendLog } from '../../../lib/order/persist.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  let operator
  try {
    operator = requireAdmin(req).operator
  } catch (e) {
    return res.status(e instanceof UnauthorizedError ? e.status : 401).json({ error: e.message })
  }

  const coupangOrderNo = String(req.body?.coupangOrderNo ?? '').trim().slice(0, 40)
  const amountKrw = Number(req.body?.amountKrw)
  if (!coupangOrderNo || !Number.isFinite(amountKrw) || amountKrw <= 0) {
    return res.status(400).json({ error: '쿠팡 주문번호와 결제 금액이 필요합니다.' })
  }

  const purchasing = listOrders().filter((o) => o.track === 'agent' && o.state === 'PURCHASING')

  if (purchasing.length !== 1) {
    const reason = purchasing.length === 0 ? 'no-purchasing' : 'ambiguous'
    appendLog('coupang-capture-review.jsonl', {
      event: 'unmatched-capture', coupangOrderNo, amountKrw, reason,
      candidates: purchasing.map((o) => o.orderNo),
      by: operator,
    })
    return res.status(200).json({
      matched: false,
      reason,
      candidates: purchasing.map((o) => o.orderNo),
      hint: '확장 팝업의 발주 목록에서 해당 주문에 직접 기록하세요.',
    })
  }

  try {
    const order = recordPurchase(purchasing[0].id, { coupangOrderNo, amountKrw, by: operator })
    return res.status(200).json({ matched: true, order: orderView(order) })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
