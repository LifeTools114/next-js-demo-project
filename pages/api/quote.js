/**
 * POST /api/quote
 * body: { items: [{ productName, productPrice, quantity }], zone }
 *
 * 무게 산정 → 1kg당 배송비 → 관세/VAT 까지 계산한 랜딩코스트를 반환합니다.
 * 계산은 전부 서버에서 수행하므로 클라이언트가 요율을 바꿔 보낼 수 없습니다.
 */

import { quote } from '../../lib/pricing/landed'
import { SHIPPING } from '../../config/shipping'

const MAX_ITEMS = 100

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const { items, zone } = req.body ?? {}

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items 는 배열이어야 합니다.' })
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `한 번에 최대 ${MAX_ITEMS}개까지 견적할 수 있습니다.` })
  }

  // 클라이언트 입력을 신뢰하지 않고 필요한 필드만 정규화합니다.
  const sanitized = items.map((i) => ({
    productId: String(i?.productId ?? ''),
    productName: String(i?.productName ?? '').slice(0, 300),
    productPrice: Math.max(0, Math.min(Number(i?.productPrice) || 0, 100_000_000)),
    quantity: Math.max(1, Math.min(Number.parseInt(i?.quantity, 10) || 1, 999)),
  }))

  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  try {
    return res.status(200).json({ quote: quote(sanitized, { zone: zoneKey }), zone: zoneKey })
  } catch (error) {
    return res.status(500).json({ error: error.message || '견적 계산에 실패했습니다.' })
  }
}
