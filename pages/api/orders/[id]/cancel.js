/**
 * POST /api/orders/:id/cancel   고객 셀프 취소 (입금 확인 전만)
 * body: { reason? }
 *
 * 주문번호를 아는 사람 = 주문자 본인이라는 기존 고객 조회 모델을 따릅니다.
 * 입금이 확인된 뒤에는 환불 계좌 확인이 필요하므로 운영자 경로
 * (POST /:id/action cancelOrder)로만 취소합니다 — 그 제한은
 * customerCancelOrder 안에서 강제됩니다.
 */

import { getOrder, customerCancelOrder, customerView } from '../../../../lib/order/store'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const order = getOrder(String(req.query.id ?? ''))
  if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' })

  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : ''
    const updated = customerCancelOrder(order.id, { reason })
    return res.status(200).json({ order: customerView(updated) })
  } catch (error) {
    return res.status(400).json({ error: error.message || '취소에 실패했습니다.' })
  }
}
