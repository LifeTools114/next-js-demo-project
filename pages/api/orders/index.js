/**
 * POST /api/orders  주문 생성 (고객)
 * GET  /api/orders  주문 목록 (운영자 전용 — 매입 원가·마진 포함)
 */

import { createOrder, listOrders, orderView } from '../../../lib/order/store'
import { requireAdmin, UnauthorizedError } from '../../../lib/auth'
import { SHIPPING } from '../../../config/shipping'
import { DEFAULT_METHOD } from '../../../lib/payment/methods'

const MAX_ITEMS = 100

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      requireAdmin(req)
    } catch (e) {
      return res.status(e.status ?? 401).json({ error: e.message })
    }
    return res.status(200).json({ orders: listOrders().map(orderView) })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'GET 또는 POST 요청만 지원합니다.' })
  }

  const { items, zone, customer, paymentMethod, track } = req.body ?? {}

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '주문할 상품이 없습니다.' })
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `한 번에 최대 ${MAX_ITEMS}개까지 주문할 수 있습니다.` })
  }
  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: '수령인 이름과 연락처를 입력해 주세요.' })
  }

  // 클라이언트가 보낸 가격을 그대로 믿지 않고 필요한 필드만 정규화합니다.
  const sanitized = items.map((i) => ({
    productId: String(i?.productId ?? ''),
    productName: String(i?.productName ?? '').slice(0, 300),
    productPrice: Math.max(0, Math.min(Number(i?.productPrice) || 0, 100_000_000)),
    quantity: Math.max(1, Math.min(Number.parseInt(i?.quantity, 10) || 1, 999)),
  }))

  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  try {
    const order = createOrder({
      items: sanitized,
      zone: zoneKey,
      track: track === 'forwarding' ? 'forwarding' : 'agent',
      customer: {
        name: String(customer.name).slice(0, 100),
        phone: String(customer.phone).slice(0, 40),
        address: String(customer.address ?? '').slice(0, 300),
      },
      paymentMethod: paymentMethod || DEFAULT_METHOD,
    })
    // 생성 직후에도 고객에게는 고객용 뷰만 돌려줍니다.
    const { customerView } = await import('../../../lib/order/store')
    return res.status(201).json({ order: customerView(order) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return res.status(401).json({ error: error.message })
    return res.status(400).json({ error: error.message || '주문 생성에 실패했습니다.' })
  }
}
