/**
 * POST /api/orders/:id/link-coupang — [배송대행] 고객이 쿠팡 주문을 연결
 * body: { coupangOrderNo?, trackingNo? }
 *
 * 고객 본인이 결제한 쿠팡 주문번호(또는 운송장)를 등록하면 입고 매칭이
 * 자동화되고, 결제까지 끝난 주문은 상태도 자동으로 이어집니다.
 * 접근 제어는 주문 조회(GET /api/orders/:id)와 같은 수준입니다 —
 * 주문번호를 아는 사람 = 주문 당사자로 간주합니다.
 */

import { linkInbound, customerView } from '../../../../lib/order/store'
import { InvalidTransitionError } from '../../../../lib/order/states'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const { coupangOrderNo, trackingNo } = req.body ?? {}
  try {
    const order = linkInbound(req.query.id, {
      coupangOrderNo,
      trackingNo,
      by: null, // 고객 본인 — 운영자 식별자를 남기지 않습니다
    })
    return res.status(200).json({ order: customerView(order) })
  } catch (error) {
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({ error: error.message })
    }
    const status = error instanceof InvalidTransitionError ? 409 : 400
    return res.status(status).json({ error: error.message })
  }
}
