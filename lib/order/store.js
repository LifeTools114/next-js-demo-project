/**
 * 주문 저장소 + 상태 전이 액션
 *
 * 인메모리 Map + 파일 스냅샷 영속화(lib/order/persist.js) 구성입니다.
 * 재시작하면 스냅샷에서 복원됩니다. 서버리스는 파일이 남지 않으므로
 * 그 경우에만 read/write 를 DB(Postgres 등)로 교체하세요.
 * 상태 머신·원장·정산 로직은 그대로 재사용됩니다.
 *
 * ⚠️ 변경 액션을 새로 만들면 반드시 끝에서 persist() 를 호출하세요.
 *    빠뜨리면 그 액션만 재시작 시 사라집니다.
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
import { analyzeSourcing } from '../sourcing.js'
import { getMethod, DEFAULT_METHOD } from '../payment/methods.js'
import { loadSnapshot, saveSnapshot } from './persist.js'
import { WAREHOUSE, recipientCode } from '../../config/warehouse.js'
import { PAYMENT } from '../../config/payment.js'
import { FX } from '../../config/fx.js'
import { SHIPPING } from '../../config/shipping.js'

const orders = new Map()
let counter = 0

// 부팅 시 1회 복원 — 주문번호 연번(counter)도 함께 복원해야 번호가 겹치지 않습니다.
const snapshot = loadSnapshot()
if (snapshot) {
  for (const o of snapshot.orders) orders.set(o.id, o)
  counter = snapshot.counter
}

function persist() {
  saveSnapshot({ counter, orders: [...orders.values()] })
}

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
export function createOrder({ items, zone, customer, track = 'agent', paymentMethod = DEFAULT_METHOD }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('주문할 상품이 없습니다.')
  }
  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  // 결제 수단이 사용 가능한지 먼저 확인합니다. (미설정 수단이면 여기서 실패)
  const method = getMethod(paymentMethod)

  const trackKey = track === 'forwarding' ? 'forwarding' : 'agent'
  const frozenQuote = buildQuote(items, { zone: zoneKey, track: trackKey })
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
    track: trackKey,
    items,
    quote: frozenQuote,

    // 환율 고정 — VND로 받아 KRW로 지출하는 사이의 변동을 차단합니다.
    // usdToKrw 도 함께 동결합니다. 정산(실측 재계산)이 라이브 환율을 읽으면
    // 서버 재시작으로 환율이 바뀌었을 때 기존 주문의 배송비가 소급 변경됩니다.
    fx: {
      baseRate: FX.krwToVnd,
      spread: FX.spread,
      effectiveRate: rate,
      usdToKrw: FX.usdToKrw,
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

    /**
     * 배송대행 입고 정보 — 고객이 직접 주문한 쿠팡 주문번호·운송장.
     * 창고 입고 시 이 값(또는 수령인 코드의 주문번호)으로 자동 매칭합니다.
     * 구매대행은 당사 매입 정보(procurement)가 그 역할을 하므로 없습니다.
     */
    inbound: trackKey === 'forwarding'
      ? { coupangOrderNo: null, trackingNos: [], linkedAt: null }
      : null,
  }

  // [거래 A] 고객에게 청구 — 원장에 기록
  addCustomerEntry(order, 'CHARGE', frozenQuote.total, { memo: '주문 청구 (예상 견적)' })

  const request = method.createRequest(order)
  order.invoice.reference = request.reference
  order.paymentRequest = request

  assertTransition('REQUESTED', 'AWAITING_PAYMENT')
  pushHistory(order, 'AWAITING_PAYMENT', '청구서 발행')

  orders.set(order.id, order)
  persist()
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
  // 입금 전에 쿠팡 주문을 먼저 연결해 둔 배송대행은 여기서 바로 이어집니다.
  advanceForwardingInbound(order, evidence.confirmedBy)
  persist()
  return order
}

/**
 * 배송대행 자동 진행 — 결제가 끝났고 고객의 쿠팡 주문이 연결돼 있으면
 * 운영자 개입 없이 "구매 확인 → 창고로 배송 중"까지 상태를 넘깁니다.
 * (구매대행의 매입 단계에 해당하는 일을 고객이 이미 했기 때문입니다)
 */
function advanceForwardingInbound(order, by) {
  if (order.track !== 'forwarding' || order.state !== 'PAID') return
  const linked = order.inbound && (order.inbound.coupangOrderNo || order.inbound.trackingNos.length > 0)
  if (!linked) return
  pushHistory(order, 'PURCHASING', '고객이 쿠팡에서 직접 주문', by)
  pushHistory(order, 'PURCHASED', '한국 창고로 배송 중', by)
}

/**
 * [배송대행] 고객의 쿠팡 주문번호·운송장 연결.
 * 결제까지 끝난 상태면 상태 전이도 자동으로 이어집니다.
 */
export function linkInbound(id, { coupangOrderNo, trackingNo, by } = {}) {
  const order = mustGet(id)
  if (order.track !== 'forwarding') {
    throw new Error('배송대행 주문만 입고 정보를 연결할 수 있습니다.')
  }
  const coupangNo = String(coupangOrderNo ?? '').trim().slice(0, 40)
  const tracking = String(trackingNo ?? '').trim().slice(0, 40)
  if (!coupangNo && !tracking) {
    throw new Error('쿠팡 주문번호 또는 운송장 번호가 필요합니다.')
  }

  order.inbound ??= { coupangOrderNo: null, trackingNos: [], linkedAt: null }
  if (coupangNo) order.inbound.coupangOrderNo = coupangNo
  if (tracking && !order.inbound.trackingNos.includes(tracking) && order.inbound.trackingNos.length < 10) {
    order.inbound.trackingNos.push(tracking)
  }
  order.inbound.linkedAt = nowIso()

  const memo = [coupangNo && `쿠팡 ${coupangNo}`, tracking && `송장 ${tracking}`].filter(Boolean).join(' · ')
  if (order.state === 'PAID') {
    advanceForwardingInbound(order, by)
  } else {
    // 상태가 안 바뀌어도 연결 사실은 이력에 남깁니다 (같은 상태로 기록).
    pushHistory(order, order.state, `입고 정보 연결 — ${memo}`, by)
  }
  persist()
  return order
}

/**
 * 입고 스캔 매칭 — 라벨의 수령인 코드(주문번호 포함 문자열), 쿠팡 주문번호,
 * 운송장 번호 무엇이든 넣으면 주문을 찾습니다. 창고 입고 화면이 씁니다.
 */
export function findByInbound(ref) {
  const needle = String(ref ?? '').trim().toUpperCase()
  if (!needle) return null
  for (const o of orders.values()) {
    if (needle.includes(o.orderNo)) return o
    if (o.inbound?.coupangOrderNo && needle === o.inbound.coupangOrderNo.toUpperCase()) return o
    if (o.inbound?.trackingNos?.some((t) => t.toUpperCase() === needle)) return o
    // 구매대행은 당사 쿠팡 주문번호가 상자에 찍혀 들어옵니다.
    if (o.procurement?.coupangOrderNo && needle === String(o.procurement.coupangOrderNo).toUpperCase()) return o
  }
  return null
}

/** [거래 B 시작] 쿠팡 매입 착수 */
export function startPurchase(id, by) {
  const order = mustGet(id)
  assertTransition(order.state, 'PURCHASING')
  pushHistory(order, 'PURCHASING', '쿠팡 매입 착수', by)
  persist()
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
  persist()
  return order
}

/**
 * 창고 입고 + 실측.
 * 실측 무게로 정산액을 계산하고, 실제 발생한 비용을 매입 원장에 기록합니다.
 */
export function recordWeighing(id, { actualWeightG, costs = {}, by, recheck, autoSettle = true } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'IN_WAREHOUSE')

  const weightG = Number(actualWeightG)
  if (!Number.isFinite(weightG) || weightG <= 0) {
    throw new Error('실측 무게가 필요합니다.')
  }

  /**
   * 해외직구 상품 재점검.
   *
   * 해외직구는 쿠팡 결제 시점의 관·부가세가 우리 견적에 없고,
   * 실제 상품·무게·박스 크기도 도착 전에는 알 수 없습니다.
   * 그래서 입고 시 상품 정보와 비용을 다시 확인해야 최종 금액이 맞습니다.
   */
  const sourcing = analyzeSourcing(order.items)
  if (sourcing.requiresRecheck && !recheck?.confirmed) {
    throw new Error(
      '해외직구 상품이 포함되어 있습니다. 입고된 실제 상품과 추가 비용(쿠팡 관·부가세 등)을 확인한 뒤 recheck.confirmed 로 등록하세요.',
    )
  }
  if (recheck?.confirmed) {
    order.recheck = {
      confirmedBy: by ?? null,
      confirmedAt: nowIso(),
      productMatches: recheck.productMatches !== false,
      note: recheck.note ?? null,
      /** 쿠팡 결제 시 별도로 부과된 관·부가세 등 (원) */
      extraCostKrw: Math.max(0, Number(recheck.extraCostKrw) || 0),
    }
    if (order.recheck.extraCostKrw > 0) {
      addProcurementEntry(order, 'OTHER', order.recheck.extraCostKrw, {
        memo: '해외직구 추가 비용 (쿠팡 관·부가세 등)',
      })
    }
    if (!order.recheck.productMatches) {
      pushHistory(order, order.state, '⚠️ 입고 상품이 주문과 다름', by)
    }
  }

  // 실제 원가 (운송사 청구서, 세관 납부액 등)
  for (const [type, amount] of Object.entries(costs)) {
    if (Number(amount) > 0) addProcurementEntry(order, type, Number(amount), { memo: '실비' })
  }

  order.procurement.actualWeightG = weightG
  order.procurement.weighedAt = nowIso()
  order.settlement = computeSettlement(order, weightG)

  pushHistory(order, 'IN_WAREHOUSE', `실측 ${(weightG / 1000).toFixed(2)}kg`, by)
  persist()

  /**
   * 자동 정산 연쇄 — 실측이 곧 정산입니다.
   * 정산액은 실측 무게에서 결정론적으로 나오므로 버튼을 한 번 더 누를
   * 이유가 없습니다. 허용오차 이내면 SETTLED 까지 내려갑니다.
   * autoSettle: false 는 실비를 나중에 나눠 입력하는 예외 경로용입니다.
   */
  if (autoSettle) return applySettlement(id, by)
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
  persist()
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
  persist()
  return order
}

export function markShipped(id, { trackingNo, by } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'SHIPPED')
  order.delivery.trackingNo = trackingNo ?? null
  order.delivery.shippedAt = nowIso()
  pushHistory(order, 'SHIPPED', trackingNo ? `송장 ${trackingNo}` : '발송', by)
  persist()
  return order
}

export function markDelivered(id, by) {
  const order = mustGet(id)
  assertTransition(order.state, 'DELIVERED')
  order.delivery.deliveredAt = nowIso()
  pushHistory(order, 'DELIVERED', '배송 완료', by)
  persist()
  return order
}

/** 취소 — 이미 입금된 금액은 전액 환불 처리합니다. */
export function cancelOrder(id, { reason, by } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'CANCELLED')

  const s = summarize(order.ledger, order.fx.effectiveRate)
  /**
   * 청구 취소는 입금 여부와 무관하게 항상 기록합니다.
   * 입금 조건 안에 묶으면 미입금 주문을 취소했을 때 CHARGE 가 상쇄되지 않아
   * 유령 미수금(취소됐는데 잔액 > 0)이 남습니다.
   */
  const outstanding = s.billedKrw - s.creditedKrw
  if (outstanding > 0) {
    addCustomerEntry(order, 'CREDIT', outstanding, { memo: '주문 취소 - 청구 취소' })
  }
  if (s.netReceivedKrw > 0) {
    addCustomerEntry(order, 'REFUND', s.netReceivedKrw, { memo: '주문 취소 - 전액 환불' })
  }
  pushHistory(order, 'CANCELLED', reason ?? '주문 취소', by)
  persist()
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
    track: order.track,
    items: order.items,
    quote: order.quote,
    fx: { effectiveRate: fx, lockedAt: order.fx.lockedAt },

    paymentMethod: order.paymentMethod,
    invoice: order.invoice,
    paymentRequest: order.paymentRequest ?? null,

    // 배송대행: 고객 본인이 등록한 쿠팡 주문·운송장 (구매대행은 null)
    inbound: order.track === 'forwarding' ? (order.inbound ?? null) : null,

    /**
     * 배송대행 쿠팡 주문 안내 — 소포가 창고에 닿기 전까지만 보여줍니다.
     * 수령인 코드가 라벨에 찍혀야 입고가 자동 매칭됩니다.
     */
    forwardingGuide:
      order.track === 'forwarding' &&
      ['AWAITING_PAYMENT', 'PAID', 'PURCHASING', 'PURCHASED'].includes(order.state)
        ? {
            recipient: recipientCode(order.customer.name, order.orderNo),
            warehouse: {
              name: WAREHOUSE.name || '(창고 확정 후 안내)',
              zip: WAREHOUSE.zip,
              address1: WAREHOUSE.address1 || '(창고 확정 후 안내)',
              address2: WAREHOUSE.address2,
              phone: WAREHOUSE.phone,
              configured: WAREHOUSE.configured,
            },
            linked: Boolean(order.inbound?.coupangOrderNo || order.inbound?.trackingNos?.length),
          }
        : null,

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

    /** 해외직구 재점검 결과 — 고객이 알아야 할 사실만 (금액은 정산 명세로 별도 안내) */
    recheck: order.recheck
      ? { confirmedAt: order.recheck.confirmedAt, productMatches: order.recheck.productMatches }
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

/** 테스트용 초기화 — 디스크 스냅샷도 빈 상태로 맞춥니다 */
export function _reset() {
  orders.clear()
  counter = 0
  persist()
}
