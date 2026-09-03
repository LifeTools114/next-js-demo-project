/**
 * POST /api/orders  주문 생성 (고객)
 * GET  /api/orders  주문 목록 (운영자 전용 — 매입 원가·마진 포함)
 */

import {
  createOrder, listOrders, orderView, findDuplicateOrder, CUSTOMER_CANCELLABLE_STATES,
} from '../../../lib/order/store'
import { ORDER_STATES } from '../../../lib/order/states'
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

  const { items, zone, customer, paymentMethod, track, coupangOrderNo, force } = req.body ?? {}

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

  /**
   * 중복 접수 감지 — 더블클릭·뒤로가기 재제출로 같은 주문이 두 번 들어가는
   * 사고를 막습니다. force: true 는 고객이 "같은 상품을 일부러 한 번 더
   * 산다"고 화면에서 확인한 경우입니다. 같은 쿠팡 주문번호 중복은 의도적
   * 재구매가 있을 수 없으므로 force 로도 넘을 수 없습니다.
   */
  const dup = findDuplicateOrder({
    track: trackKey,
    customer,
    items: sanitized,
    coupangOrderNo: typeof coupangOrderNo === 'string' ? coupangOrderNo : undefined,
  })
  if (dup && (dup.kind === 'coupang-order-no' || force !== true)) {
    const o = dup.order
    const minutesAgo = Math.max(0, Math.round((Date.now() - Date.parse(o.createdAt)) / 60000))
    const openOrderNos = dup.openOrderNos ?? [o.orderNo]
    return res.status(409).json({
      error: dup.kind === 'coupang-order-no'
        ? `이 쿠팡 주문번호는 이미 접수된 주문 ${o.orderNo} 에 연결되어 있습니다.`
        : openOrderNos.length > 1
          ? `같은 상품 구성의 미결제 주문이 ${openOrderNos.length}건 남아 있습니다 (${openOrderNos.join(', ')}).`
          : `같은 상품 구성의 주문 ${o.orderNo} 이(가) ${minutesAgo}분 전에 이미 접수되어 있습니다.`,
      duplicate: {
        kind: dup.kind,
        orderNo: o.orderNo,
        // 같은 구성으로 열려 있는 주문 전부 — 화면이 한 번에 모두 취소할 수 있게
        openOrderNos,
        state: o.state,
        stateLabel: ORDER_STATES[o.state]?.label ?? o.state,
        createdAt: o.createdAt,
        minutesAgo,
        totalKrw: o.invoice?.amountKrw ?? o.quote?.total ?? null,
        // 입금 전이면 고객이 기존 주문을 직접 취소하고 새로 접수할 수 있습니다.
        cancellable: CUSTOMER_CANCELLABLE_STATES.includes(o.state),
        // 재구매 의사 확인(force) 으로 그대로 진행할 수 있는지
        forceable: dup.kind !== 'coupang-order-no',
      },
    })
  }

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
      // 필수 고지 동의 — 없으면 createOrder 가 거절합니다.
      consents: req.body?.consents,
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
