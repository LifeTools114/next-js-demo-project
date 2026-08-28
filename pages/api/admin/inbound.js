/**
 * GET /api/admin/inbound?ref=<스캔 문자열> — 입고 소포 → 주문 매칭 (운영자)
 *
 * 라벨의 수령인 코드(주문번호 포함), 쿠팡 주문번호, 운송장 번호 무엇이든
 * ref 로 넣으면 해당 주문을 돌려줍니다. 창고에서 바코드 스캔 → 이 API →
 * 실측 등록(recordWeighing) 한 번이면 입고 처리가 끝납니다.
 */

import { findByInbound, orderView } from '../../../lib/order/store'
import { requireAdmin } from '../../../lib/auth'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e.status ?? 401).json({ error: e.message })
  }

  const order = findByInbound(req.query.ref)
  if (!order) {
    return res.status(404).json({ error: '스캔 값과 일치하는 주문이 없습니다.', ref: req.query.ref ?? null })
  }
  return res.status(200).json({ order: orderView(order) })
}
