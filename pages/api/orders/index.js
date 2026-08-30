/**
 * POST /api/orders  주문 생성 (고객)
 * GET  /api/orders  주문 목록 (운영자 전용 — 매입 원가·마진 포함)
 */

import { createOrder, listOrders, orderView } from '../../../lib/order/store'
import { requireAdmin, UnauthorizedError } from '../../../lib/auth'
import { SHIPPING } from '../../../config/shipping'
import { ORDER_MIN } from '../../../config/fees'
import { normalizeOrderItems } from '../../../lib/order/normalize-items'
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

  const { items, zone, customer, paymentMethod, track, coupangOrderNo } = req.body ?? {}

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '주문할 상품이 없습니다.' })
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `한 번에 최대 ${MAX_ITEMS}개까지 주문할 수 있습니다.` })
  }
  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: '수령인 이름과 연락처를 입력해 주세요.' })
  }

  // 확장이 보낸 고시정보·배지·카테고리를 보존해야 서버 견적이 패널과 일치합니다.
  const sanitized = normalizeOrderItems(items)

  // 최소 주문 금액 — 확장 팝업도 막지만, 최종 판정은 서버가 합니다.
  const goodsKrw = sanitized.reduce((sum, i) => sum + i.productPrice * i.quantity, 0)
  if (ORDER_MIN.goodsKrw > 0 && goodsKrw < ORDER_MIN.goodsKrw) {
    const fmt = (n) => `${n.toLocaleString('ko-KR')}원`
    return res.status(400).json({
      error: `최소 주문 금액은 상품가 합계 ${fmt(ORDER_MIN.goodsKrw)}입니다. ${fmt(ORDER_MIN.goodsKrw - goodsKrw)} 더 담아주세요.`,
      minOrder: { goodsKrw: ORDER_MIN.goodsKrw, shortfallKrw: ORDER_MIN.goodsKrw - goodsKrw },
    })
  }

  const trackKey = track === 'forwarding' ? 'forwarding' : 'agent'
  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  try {
    const order = createOrder({
      items: sanitized,
      zone: zoneKey,
      track: trackKey,
      customer: {
        name: String(customer.name).slice(0, 100),
        phone: String(customer.phone).slice(0, 40),
        address: String(customer.address ?? '').slice(0, 300),
        // 선택 — 알림 채널(이메일)이 열리면 바로 쓸 수 있게 미리 받습니다.
        email: String(customer.email ?? '').slice(0, 120),
      },
      paymentMethod: paymentMethod || DEFAULT_METHOD,
      // 쿠팡 결제 우선 흐름 — 고객이 이미 결제한 쿠팡 주문을 생성 시점에 연결
      coupangOrderNo: typeof coupangOrderNo === 'string' ? coupangOrderNo : undefined,
    })
    // 생성 직후에도 고객에게는 고객용 뷰만 돌려줍니다.
    const { customerView } = await import('../../../lib/order/store')
    return res.status(201).json({ order: customerView(order) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return res.status(401).json({ error: error.message })
    return res.status(400).json({ error: error.message || '주문 생성에 실패했습니다.' })
  }
}
