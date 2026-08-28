/**
 * 주문 저장소 + 상태 전이 액션
 *
 * ⚠️ 인메모리 구현입니다. 프로세스가 재시작되면 사라지고,
 *    서버리스에서는 인스턴스마다 분리됩니다.
 *    프로덕션에서는 이 파일의 read/write 만 DB(Postgres 등)로 교체하세요.
 *    상태 머신·원장·정산 로직은 그대로 재사용됩니다.
 *
 * 설계 원칙: 주문은 생성 시점의 견적을 **동결**합니다.
 * 쿠팡 가격은 계속 변하지만, 고객에게 청구한 금액은 변하면 안 됩니다.
 */

import { quote as buildQuote } from '../pricing/landed.js'
import { assertTransition, ORDER_STATES, PAYABLE_STATES } from './states.js'
import {
  emptyLedger, customerEntry, procurementEntry, summarize, recognizeRevenue,
} from './ledger.js'
import { computeSettlement, settlementEntries } from './settlement.js'
import { getMethod, DEFAULT_METHOD } from '../payment/methods.js'
import { PAYMENT } from '../../config/payment.js'
import { FX } from '../../config/fx.js'
import { SHIPPING } from '../../config/shipping.js'

const orders = new Map()
let counter = 0

const nowIso = () => new Date().toISOString()

function generateOrderNo() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const ymd = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`
  counter += 1
  return `HN${ymd}${String(counter).padStart(4, '0')}`
}

/** 고객에게 적용되는 실효 환율 (스프레드 포함) */
function effectiveFxRate() {
  return FX.krwToVnd * (1 + FX.spread)
}

function pushHistory(order, state, memo, by) {
  order.history.push({ state, at: nowIso(), memo: memo ?? null, by: by ?? null })
  order.state = state
  order.updatedAt = nowIso()
}

function addCustomerEntry(order, type, amountKrw, opts = {}) {
  order.ledger.customer.push(
    customerEntry(type, amountKrw, { ...opts, fxRate: order.fx.effectiveRate }),
  )
}

function addProcurementEntry(order, type, amountKrw, opts = {}) {
  order.ledger.procurement.push(procurementEntry(type, amountKrw, opts))
}

/**
 * 주문 생성 — 견적을 동결하고 환율을 고정한 뒤 청구서를 발행합니다.
 */
export function createOrder({ items, zone, customer, paymentMethod = DEFAULT_METHOD }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('주문할 상품이 없습니다.')
  }
  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  // 결제 수단이 사용 가능한지 먼저 확인합니다. (미설정 수단이면 여기서 실패)
  const method = getMethod(paymentMethod)

  const frozenQuote = buildQuote(items, { zone: zoneKey })
  const rate = effectiveFxRate()
  const issuedAt = nowIso()
  const expiresAt = new Date(
    Date.now() + PAYMENT.invoiceValidHours * 3600 * 1000,
  ).toISOString()

  const order = {
    id: `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    orderNo: generateOrderNo(),
    createdAt: issuedAt,
    updatedAt: issuedAt,
    state: 'REQUESTED',
    history: [{ state: 'REQUESTED', at: issuedAt, memo: '주문 접수', by: null }],

    customer: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
    },
    zone: zoneKey,
    items,
    quote: frozenQuote,

    // 환율 고정 — VND로 받아 KRW로 지출하는 사이의 변동을 차단합니다.
    fx: {
      baseRate: FX.krwToVnd,
      spread: FX.spread,
      effectiveRate: rate,
      lockedAt: issuedAt,
    },

    paymentMethod,
    invoice: {
      amountKrw: frozenQuote.total,
      amountVnd: Math.round(frozenQuote.total * rate),
      reference: null,
      issuedAt,
      expiresAt,
    },

    ledger: emptyLedger(),
    procurement: { coupangOrderNo: null, purchasedAt: null, actualWeightG: null, weighedAt: null },
    settlement: null,
    delivery: { trackingNo: null, shippedAt: null, deliveredAt: null },
  }

  // [거래 A] 고객에게 청구 — 원장에 기록
  addCustomerEntry(order, 'CHARGE', frozenQuote.total, { memo: '주문 청구 (예상 견적)' })

  const request = method.createRequest(order)
  order.invoice.reference = request.reference
  order.paymentRequest = request

  assertTransition('REQUESTED', 'AWAITING_PAYMENT')
  pushHistory(order, 'AWAITING_PAYMENT', '청구서 발행')

  orders.set(order.id, order)
  return order
}

export const getOrder = (id) =>
  orders.get(id) ?? [...orders.values()].find((o) => o.orderNo === id) ?? null

export const listOrders = () =>
  [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

function mustGet(id) {
  const order = getOrder(id)
  if (!order) throw new Error('주문을 찾을 수 없습니다.')
  return order
}

/** [거래 A 완료] 입금 확인 */
export function confirmPayment(id, evidence = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'PAID')

  const method = getMethod(order.paymentMethod)
  const result = method.verify(order, evidence)
  if (!result.ok) throw new Error(result.reason)

  addCustomerEntry(order, 'PAYMENT', order.invoice.amountKrw, {
    memo: result.memo,
    ref: result.reference,
    at: result.paidAt,
  })
  pushHistory(order, 'PAID', '입금 확인', evidence.confirmedBy)
  return order
}

/** [거래 B 시작] 쿠팡 매입 착수 */
export function startPurchase(id, by) {
  const order = mustGet(id)
  assertTransition(order.state, 'PURCHASING')
  pushHistory(order, 'PURCHASING', '쿠팡 매입 착수', by)
  return order
}

/** [거래 B] 매입 완료 — 실제 지출을 매입 원장에 기록 */
export function recordPurchase(id, { coupangOrderNo, amountKrw, by } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'PURCHASED')
  if (!coupangOrderNo) throw new Error('쿠팡 주문번호가 필요합니다.')

  const spent = Number(amountKrw)
  if (!Number.isFinite(spent) || spent <= 0) {
    throw new Error('실제 매입 금액이 필요합니다.')
  }

  addProcurementEntry(order, 'COUPANG_PURCHASE', spent, { ref: coupangOrderNo })
  order.procurement.coupangOrderNo = coupangOrderNo
  order.procurement.purchasedAt = nowIso()
  pushHistory(order, 'PURCHASED', `쿠팡 주문 ${coupangOrderNo}`, by)
  return order
}

/**
 * 창고 입고 + 실측.
 * 실측 무게로 정산액을 계산하고, 실제 발생한 비용을 매입 원장에 기록합니다.
 */
export function recordWeighing(id, { actualWeightG, costs = {}, by } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'IN_WAREHOUSE')

  const weightG = Number(actualWeightG)
  if (!Number.isFinite(weightG) || weightG <= 0) {
    throw new Error('실측 무게가 필요합니다.')
  }

  // 실제 원가 (운송사 청구서, 세관 납부액 등)
  for (const [type, amount] of Object.entries(costs)) {
    if (Number(amount) > 0) addProcurementEntry(order, type, Number(amount), { memo: '실비' })
  }

  order.procurement.actualWeightG = weightG
  order.procurement.weighedAt = nowIso()
  order.settlement = computeSettlement(order, weightG)

  pushHistory(order, 'IN_WAREHOUSE', `실측 ${(weightG / 1000).toFixed(2)}kg`, by)
  return order
}

/**
 * 정산 적용 — 차액을 고객 원장에 반영합니다.
 * 차액이 허용오차 이내면 정산을 생략하고 바로 SETTLED 로 넘어갑니다.
 */
export function applySettlement(id, by) {
  const order = mustGet(id)
  if (!order.settlement) throw new Error('먼저 실측을 등록해야 합니다.')

  const entries = settlementEntries(order.settlement, order.fx.effectiveRate)
  for (const e of entries) {
    addCustomerEntry(order, e.type, e.amountKrw, { memo: e.memo })
  }

  if (order.settlement.action === 'none') {
    assertTransition(order.state, 'SETTLED')
    pushHistory(order, 'SETTLED', '차액 없음 (허용오차 이내)', by)
  } else {
    assertTransition(order.state, 'SETTLEMENT_DUE')
    pushHistory(
      order,
      'SETTLEMENT_DUE',
      `${order.settlement.label} ${order.settlement.absKrw.toLocaleString('ko-KR')}원`,
      by,
    )
  }
  return order
}

/** 차액 입금 확인 (추가 청구분) 또는 환불 지급 완료 */
export function closeSettlement(id, { by, memo } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'SETTLED')

  const balance = summarize(order.ledger, order.fx.effectiveRate).balanceKrw
  if (balance > 0) {
    addCustomerEntry(order, 'PAYMENT', balance, { memo: memo ?? '차액 입금' })
  } else if (balance < 0) {
    addCustomerEntry(order, 'REFUND', -balance, { memo: memo ?? '차액 환불 지급' })
  }

  pushHistory(order, 'SETTLED', '정산 완료', by)
  return order
}

export function markShipped(id, { trackingNo, by } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'SHIPPED')
  order.delivery.trackingNo = trackingNo ?? null
  order.delivery.shippedAt = nowIso()
  pushHistory(order, 'SHIPPED', trackingNo ? `송장 ${trackingNo}` : '발송', by)
  return order
}

export function markDelivered(id, by) {
  const order = mustGet(id)
  assertTransition(order.state, 'DELIVERED')
  order.delivery.deliveredAt = nowIso()
  pushHistory(order, 'DELIVERED', '배송 완료', by)
  return order
}

/** 취소 — 이미 입금된 금액은 전액 환불 처리합니다. */
export function cancelOrder(id, { reason, by } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'CANCELLED')

  const s = summarize(order.ledger, order.fx.effectiveRate)
  if (s.netReceivedKrw > 0) {
    addCustomerEntry(order, 'CREDIT', s.billedKrw, { memo: '주문 취소 - 청구 취소' })
    addCustomerEntry(order, 'REFUND', s.netReceivedKrw, { memo: '주문 취소 - 전액 환불' })
  }
  pushHistory(order, 'CANCELLED', reason ?? '주문 취소', by)
  return order
}

/** 매출이 확정되는 단계 — 정산이 끝나야 금액이 더 이상 변하지 않습니다. */
const REVENUE_FINAL_STATES = ['SETTLED', 'SHIPPED', 'DELIVERED', 'CANCELLED']

/** 화면 표시용 요약 (운영자 전용 — 매입 원가·마진 포함) */
export function orderView(order) {
  const fx = order.fx.effectiveRate
  const s = summarize(order.ledger, fx)
  const settled = REVENUE_FINAL_STATES.includes(order.state)
  return {
    ...order,
    stateInfo: ORDER_STATES[order.state],
    payable: PAYABLE_STATES.includes(order.state),
    ledgerSummary: s,
    revenue: recognizeRevenue(order.ledger, fx, { settled }),
  }
}

/**
 * 고객용 projection.
 *
 * ⚠️ 매입 원장·실지출·마진은 당사 영업정보입니다.
 *    고객 화면으로 절대 내보내면 안 됩니다.
 *    (상품을 얼마에 샀는지, 마진이 얼마인지가 드러납니다)
 */
export function customerView(order) {
  const fx = order.fx.effectiveRate
  const s = summarize(order.ledger, fx)

  return {
    orderNo: order.orderNo,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    state: order.state,
    stateInfo: ORDER_STATES[order.state],
    payable: PAYABLE_STATES.includes(order.state),

    customer: order.customer,
    zone: order.zone,
    items: order.items,
    quote: order.quote,
    fx: { effectiveRate: fx, lockedAt: order.fx.lockedAt },

    paymentMethod: order.paymentMethod,
    invoice: order.invoice,
    paymentRequest: order.paymentRequest ?? null,

    /**
     * 고객 원장만, 그중에서도 공개 가능한 필드만 화이트리스트로 투영합니다.
     * (전체 객체를 그대로 넘기면 내부 필드가 추가될 때마다 누출 위험이 생깁니다)
     */
    ledger: {
      customer: order.ledger.customer.map((e) => ({
        id: e.id,
        at: e.at,
        type: e.type,
        label: e.label,
        amountKrw: e.amountKrw,
        amountVnd: e.amountVnd,
        delta: e.delta,
        memo: e.memo,
      })),
    },
    balance: { krw: s.balanceKrw, vnd: s.balanceVnd },
    paid: { krw: s.netReceivedKrw },

    // 정산 결과 중 고객이 알아야 할 부분만
    settlement: order.settlement
      ? {
          action: order.settlement.action,
          label: order.settlement.label,
          diffKrw: order.settlement.diffKrw,
          absKrw: order.settlement.absKrw,
          estimatedWeightG: order.settlement.estimatedWeightG,
          actualWeightG: order.settlement.actualWeightG,
          quotedBillableKg: order.settlement.quotedBillableKg,
          finalBillableKg: order.settlement.finalBillableKg,
          quotedTotalKrw: order.settlement.quotedTotalKrw,
          finalTotalKrw: order.settlement.finalTotalKrw,
        }
      : null,

    delivery: order.delivery,

    /**
     * 내부 메모는 제외하고 상태의 공개 설명만 노출합니다.
     * 메모에는 쿠팡 주문번호·매입 정보 같은 내부 정보가 들어갑니다.
     */
    history: order.history.map(({ state, at }) => ({
      state,
      at,
      label: ORDER_STATES[state]?.label ?? state,
      description: ORDER_STATES[state]?.description ?? '',
    })),
  }
}

/** 테스트용 초기화 */
export function _reset() {
  orders.clear()
  counter = 0
}
