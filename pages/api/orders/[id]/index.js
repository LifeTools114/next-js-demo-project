/**
 * GET /api/orders/:id
 *
 * 기본은 고객용 뷰(매입 원가·마진 제외)이고,
 * 운영자 토큰이 있으면 전체 뷰를 반환합니다.
 */

import { getOrder, orderView, customerView } from '../../../../lib/order/store.js'
import { orderAccess, publicView } from '../../../../lib/order/access.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  const order = getOrder(req.query.id)
  if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' })

  // 주문번호만으로는 진행 상태만 — 상세는 신청한 브라우저·개인 링크·운영자 (lib/order/access.js)
  const access = orderAccess(req, order)
  const view = access === 'admin' ? orderView(order) : access === 'owner' ? customerView(order) : publicView(order)
  return res.status(200).json({ order: view, view: access === 'owner' ? 'customer' : access })
}
