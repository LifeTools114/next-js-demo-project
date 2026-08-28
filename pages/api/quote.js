/**
 * POST /api/quote
 * body: { items: [{ productName, productPrice, quantity }], zone }
 *
 * 무게 산정 → 1kg당 배송비 → 관세/VAT 까지 계산한 랜딩코스트를 반환합니다.
 * 계산은 전부 서버에서 수행하므로 클라이언트가 요율을 바꿔 보낼 수 없습니다.
 */

import { quote } from '../../lib/pricing/landed'
import { SHIPPING } from '../../config/shipping'
import { normalizeOrderItems } from '../../lib/order/normalize-items'
import { DESTINATION } from '../../config/eligibility'
import { maintenanceStatus } from '../../lib/maintenance'

const MAX_ITEMS = 100

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const { items, zone, track } = req.body ?? {}

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items 는 배열이어야 합니다.' })
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `한 번에 최대 ${MAX_ITEMS}개까지 견적할 수 있습니다.` })
  }

  // 확장이 보낸 고시정보·배지·카테고리를 보존해야 서버 견적이 패널과 일치합니다.
  const sanitized = normalizeOrderItems(items)

  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  try {
    const trackKey = track === 'agent' ? 'agent' : 'forwarding'
    // 점검 중에도 계산은 해줍니다 — 이미 전달받은 가격으로 하는 계산이라 쿠팡에 의존하지 않습니다.
    // 다만 그 가격이 점검 페이지에서 잘못 읽혔을 수 있으므로 상태를 함께 내려보냅니다.
    return res.status(200).json({
      quote: quote(sanitized, { zone: zoneKey, track: trackKey }),
      zone: zoneKey,
      track: trackKey,
      maintenance: maintenanceStatus(new Date(), DESTINATION.country),
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || '견적 계산에 실패했습니다.' })
  }
}
