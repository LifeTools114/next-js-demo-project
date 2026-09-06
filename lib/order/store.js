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
import { WAREHOUSE, detailAddressFor } from '../../config/warehouse.js'
import { missingConsents } from '../../config/legal.js'
import { notifyTransition } from '../notify.js'
import { PAYMENT, RETURN_POLICY } from '../../config/payment.js'
import { FX } from '../../config/fx.js'
import { SHIPPING } from '../../config/shipping.js'
import { upsertCustomer, issueKey, findByKey, verifyKey, hashKey, setMarketing, phoneKey } from '../customer/store.js'

/**
 * 프로세스 전역 싱글턴 — dev 서버의 핫리로드나 라우트별 번들이 이 모듈을
 * 여러 번 인스턴스화해도 주문 Map 은 반드시 한 벌이어야 합니다.
 * 인스턴스가 갈라지면 "취소 API 에서는 취소됐는데, 주문 접수 API 는
 * 옛 메모리를 보고 아직 살아있다고 판단"하는 유령 상태(중복 오탐)가
 * 생깁니다. (globalThis 앵커는 Next dev 의 표준 싱글턴 패턴입니다)
 */
const store = (() => {
  if (!globalThis.__kbOrderStore) {
    const s = { orders: new Map(), counter: 0 }
    // 부팅 시 1회 복원 — 주문번호 연번(counter)도 함께 복원해야 번호가 겹치지 않습니다.
    const snapshot = loadSnapshot()
    if (snapshot) {
      for (const o of snapshot.orders) s.orders.set(o.id, o)
      s.counter = snapshot.counter
    }
    globalThis.__kbOrderStore = s
  }
  return globalThis.__kbOrderStore
})()
const orders = store.orders

function persist() {
  saveSnapshot({ counter: store.counter, orders: [...orders.values()] })
}

const nowIso = () => new Date().toISOString()

function generateOrderNo() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const ymd = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`
  store.counter += 1
  return `HN${ymd}${String(store.counter).padStart(4, '0')}`
}

/** 고객에게 적용되는 실효 환율 (스프레드 포함) */
function effectiveFxRate() {
  return FX.krwToVnd * (1 + FX.spread)
}

function pushHistory(order, state, memo, by) {
  const changed = order.state !== state
  order.history.push({ state, at: nowIso(), memo: memo ?? null, by: by ?? null })
  order.state = state
  order.updatedAt = nowIso()
  // 상태가 실제로 바뀔 때만 알림 — 같은 상태의 이력 메모는 소음입니다.
  if (changed) notifyTransition(order, state)
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
export function createOrder({ items, zone, customer, track = 'agent', paymentMethod = DEFAULT_METHOD, coupangOrderNo, consents, marketing = false, myKey = null }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('주문할 상품이 없습니다.')
  }

  /**
   * 필수 고지 동의 — 화면 체크박스를 우회한 직접 API 호출도 막습니다.
   * 분쟁 시 "고지하고 동의받았다"의 증빙이 되도록 주문에 기록합니다.
   */
  const missing = missingConsents(consents)
  if (missing.length > 0) {
    throw new Error(`다음 항목에 동의해야 접수됩니다: ${missing.join(' / ')}`)
  }
  const zoneKey = Object.hasOwn(SHIPPING.zones, zone) ? zone : SHIPPING.defaultZone

  // 결제 수단이 사용 가능한지 먼저 확인합니다. (미설정 수단이면 여기서 실패)
  const method = getMethod(paymentMethod)

  const trackKey = track === 'forwarding' ? 'forwarding' : 'agent'
  const frozenQuote = buildQuote(items, { zone: zoneKey, track: trackKey })

  /**
   * 배송 불가 상품 서버 최종 거절 — 화면 검증을 우회한 직접 API 호출을 막습니다.
   * (금지 품목, 해외직구(타국 발송) 등 eligibility 차단 전부)
   */
  if (frozenQuote.eligibility && frozenQuote.eligibility.shippable === false) {
    const first = frozenQuote.eligibility.blocked?.[0]
    throw new Error(
      first
        ? `배송할 수 없는 상품이 포함되어 있습니다: ${first.productName} — ${first.reason ?? first.label}`
        : '배송할 수 없는 상품이 포함되어 있습니다.',
    )
  }

  // 구매대행 1회 접수 한도 — 발주 손실·통관 보류 위험 상한 (config/fees.js, 0 = 무제한).
  // 신청서·카드가 미리 경고하지만 최종 거절은 여기 한 곳에서 합니다.
  if (frozenQuote.agentLimit?.exceeded) {
    throw new Error(
      `대신 사드리는 건 한 번에 상품값 합계 ${frozenQuote.agentLimit.maxGoodsKrw.toLocaleString('ko-KR')}원까지 신청하실 수 있습니다. 나눠서 신청해 주세요.`,
    )
  }
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
      email: customer?.email ?? '',
      // 카카오톡 ID 또는 Zalo 번호 (선택) — 소식·연락 채널
      messenger: customer?.messenger ?? '',
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

    /** 접수 시점에 받은 필수 동의 (고지 이행 증빙) */
    consents: {
      ids: Array.isArray(consents) ? [...consents] : Object.keys(consents ?? {}).filter((k) => consents[k]),
      agreedAt: issuedAt,
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

  /**
   * 쿠팡 결제 우선 흐름 — 고객이 이미 결제한 쿠팡 주문번호를 생성 시점에
   * 연결합니다. 이후 입금이 확인되면(수동이든 웹훅이든) confirmPayment 의
   * 자동 진행이 "창고로 배송 중"까지 사람 손 없이 잇습니다.
   */
  const inboundNo = String(coupangOrderNo ?? '').trim().slice(0, 40)
  if (trackKey === 'forwarding' && inboundNo) {
    order.inbound.coupangOrderNo = inboundNo
    order.inbound.linkedAt = issuedAt
  }

  // [거래 A] 고객에게 청구 — 원장에 기록
  addCustomerEntry(order, 'CHARGE', frozenQuote.total, { memo: '주문 청구 (예상 견적)' })

  const request = method.createRequest(order)
  order.invoice.reference = request.reference
  order.paymentRequest = request

  assertTransition('REQUESTED', 'AWAITING_PAYMENT')
  pushHistory(
    order,
    'AWAITING_PAYMENT',
    order.inbound?.coupangOrderNo ? `청구서 발행 · 쿠팡 주문 ${order.inbound.coupangOrderNo} 연결` : '청구서 발행',
  )

  /**
   * 고객 풀 연결 — 전화번호가 고객입니다 (lib/customer/store.js).
   *   처음 온 고객      미확인 열쇠를 새로 발급해 돌려줍니다(이 주문만 보임 → 입금되면 전체).
   *   열쇠를 들고 온 고객 그 열쇠에 주문을 묶습니다(새 발급 없음).
   *   기존 고객인데 열쇠 없음  아무것도 발급하지 않습니다 — 남의 번호로 신청서만 내고
   *                      그 사람 주문을 보는 길을 막기 위해서입니다. 복구는 입금 끝난 주문번호로.
   */
  let issuedKey = null
  order.customerId = null
  if (phoneKey(order.customer.phone)) { // 전화번호 없는 옛 경로(테스트·내부 호출)는 고객 풀에 넣지 않습니다
    const { customer: cust, created } = upsertCustomer({ name: order.customer.name, phone: order.customer.phone, email: order.customer.email, messenger: order.customer.messenger })
    order.customerId = cust.id
    const held = myKey ? findByKey(myKey) : null
    if (held && held.customer.id === cust.id) {
      order.keyHash = held.entry.hash
    } else if (created) {
      issuedKey = issueKey(cust.id, { verified: false, via: 'first-order' })
      order.keyHash = hashKey(issuedKey)
    }
    if (marketing === true) setMarketing(cust.id, true, 'checkout')
  }
  order.consents.marketing = marketing === true
  // 평문 열쇠는 저장하지 않고(열거 불가 속성) 응답에만 한 번 실립니다.
  Object.defineProperty(order, '_issuedKey', { value: issuedKey, enumerable: false, writable: true })

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

/**
 * 중복 접수 감지 — 같은 주문이 두 번 들어가는 사고를 잡습니다.
 * (제출 더블클릭, 뒤로가기 후 재제출, 확장 신청서 중복 열림)
 *
 * 신호 두 가지:
 *   coupang-order-no  같은 쿠팡 주문번호가 이미 다른 주문에 연결됨.
 *                     같은 쿠팡 결제 건이 두 번 배송될 수는 없으므로 언제나 중복.
 *   same-items        같은 트랙·연락처·상품 구성의 주문이 30분 안에
 *                     아직 입금 전 상태로 남아 있음. 대개 실수지만
 *                     진짜 "한 번 더 구매"일 수 있어 고객 확인(force)으로 진행 가능.
 *
 * 취소된 주문은 두 검사 모두 제외합니다 — 취소 후 재접수가 정상 경로입니다.
 */
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000
const DUPLICATE_OPEN_STATES = ['REQUESTED', 'AWAITING_PAYMENT']

const normalizePhone = (v) => String(v ?? '').replace(/\D/g, '')

/** 상품 구성 서명 — 이름×수량을 정렬해 담은 순서와 무관하게 비교합니다. */
const itemsSignature = (items = []) =>
  items
    .map((i) => `${String(i.productName ?? '').trim()}×${Number(i.quantity) || 1}`)
    .sort()
    .join('|')

export function findDuplicateOrder({ track, customer, items, coupangOrderNo } = {}) {
  const trackKey = track === 'forwarding' ? 'forwarding' : 'agent'

  const coupangNo = String(coupangOrderNo ?? '').trim()
  if (coupangNo) {
    for (const o of orders.values()) {
      if (o.state === 'CANCELLED') continue
      if (o.inbound?.coupangOrderNo === coupangNo) return { kind: 'coupang-order-no', order: o }
    }
  }

  const phone = normalizePhone(customer?.phone)
  const sig = itemsSignature(items)
  if (!phone || !sig) return null
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS
  const matches = [...orders.values()]
    .filter((o) =>
      o.track === trackKey &&
      DUPLICATE_OPEN_STATES.includes(o.state) &&
      Date.parse(o.createdAt) >= cutoff &&
      normalizePhone(o.customer?.phone) === phone &&
      itemsSignature(o.items) === sig)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (matches.length === 0) return null
  /**
   * 열린 중복 전부를 알려줍니다 — 한 건만 알려주면 고객이 그 건을 취소한 뒤
   * "취소했는데 또 중복이래요"가 됩니다 (남은 다른 건이 다시 잡히므로).
   * 화면은 전체 목록을 보여주고 한 번에 모두 취소할 수 있어야 합니다.
   */
  return { kind: 'same-items', order: matches[0], openOrderNos: matches.map((o) => o.orderNo) }
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
  // 입금 = 전화번호 주인 증명 → 이 주문을 만든 개인 링크가 「확인됨」이 됩니다.
  if (order.customerId && order.keyHash) verifyKey(order.customerId, order.keyHash)
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

  /**
   * 이름 폴백 — 쿠팡 결제 우선 흐름에서는 라벨에 코드가 없을 수 있습니다
   * (받는 사람이 본인 이름뿐). 운송 중 주문 가운데 이름이 유일하게 맞을
   * 때만 매칭합니다. 두 명 이상이면 사람이 판단하도록 null.
   */
  const inTransit = ['PAID', 'PURCHASING', 'PURCHASED']
  const byName = [...orders.values()].filter((o) => {
    const name = String(o.customer?.name ?? '').trim().toUpperCase()
    return name.length >= 2 && inTransit.includes(o.state) && needle.includes(name)
  })
  if (byName.length === 1) return byName[0]

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

  /**
   * 고객 표시가 대조 — 구매대행의 약속은 "고객이 화면에서 본 가격 그대로".
   * 주문서의 상품가 합(고객이 본 가격 스냅샷)과 실매입가의 차를 기록해
   * 초과 매입이 원장에 조용히 묻히지 않게 합니다. 싸게 산 경우(쿠폰 등)는
   * 차액이 음수로 남아 마진으로 확인됩니다.
   */
  const quotedGoodsKrw = order.items.reduce(
    (s, i) => s + (Number(i.productPrice) || 0) * (Number(i.quantity) || 1), 0,
  )
  const priceDiffKrw = spent - quotedGoodsKrw
  order.procurement.quotedGoodsKrw = quotedGoodsKrw
  order.procurement.priceDiffKrw = priceDiffKrw

  addProcurementEntry(order, 'COUPANG_PURCHASE', spent, { ref: coupangOrderNo })
  order.procurement.coupangOrderNo = coupangOrderNo
  order.procurement.purchasedAt = nowIso()
  const diffNote = priceDiffKrw === 0
    ? ''
    : ` · 표시가 ${quotedGoodsKrw.toLocaleString('ko-KR')}원 대비 ${priceDiffKrw > 0 ? '+' : ''}${priceDiffKrw.toLocaleString('ko-KR')}원`
  pushHistory(order, 'PURCHASED', `쿠팡 주문 ${coupangOrderNo}${diffNote}`, by)
  persist()
  return order
}

/**
 * 창고 입고 + 실측.
 * 실측 무게로 정산액을 계산하고, 실제 발생한 비용을 매입 원장에 기록합니다.
 */
/**
 * 물류사 청구서(DEBIT NOTE) 등록 — 최종 견적서의 근거가 됩니다.
 *
 * 저장하는 값은 실측 무게와 운송 정보뿐입니다. 청구서의 단가·금액은 당사
 * 원가라 주문에 남기지 않습니다 (남기면 고객 화면 응답에 섞일 위험이 있음).
 * 정산 실행(추가청구·환불)은 운영자 판단이므로 여기서 하지 않습니다.
 */
export function saveDebitNote(id, note = {}) {
  const order = orders.get(id)
  if (!order) throw new Error('주문을 찾을 수 없습니다.')
  const kg = Number(note.chargeableWeightKg)
  if (!Number.isFinite(kg) || kg <= 0) throw new Error('실측 무게(kg)가 올바르지 않습니다.')

  order.debitNote = {
    chargeableWeightKg: kg,
    invoiceNo: note.invoiceNo ?? '',
    hawbNo: note.hawbNo ?? '',
    mawbNo: note.mawbNo ?? '',
    flight: note.flight ?? '',
    etd: note.etd ?? '',
    eta: note.eta ?? '',
    package: note.package ?? '',
    recordedAt: nowIso(),
  }
  order.updatedAt = nowIso()
  persist()
  return order
}

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

  /**
   * ⚠️ 상태 검증을 원장 기록보다 **먼저** 합니다. 순서가 뒤바뀌면 안 됩니다.
   *
   * 예전에는 원장을 먼저 쓰고 나중에 검증했습니다. 그래서 [정산 적용]을 두 번
   * 누르면 — 운영자가 폰에서 눌렀는데 응답이 늦어 다시 누르거나, 열어둔 다른
   * 탭의 옛 목록에서 누르는 경우 — 화면에는 409 오류만 뜨는데 고객 원장에는
   * 추가청구가 한 줄 더 쌓여 **청구액이 조용히 두 배**가 됐습니다
   * (24,840원 → 49,680원으로 재현). 환불 건이면 반대로 회사가 두 배를 물어줍니다.
   *
   * 이제는 두 번째 호출이 원장에 손대기 전에 멈춥니다
   * (SETTLEMENT_DUE→SETTLEMENT_DUE, SETTLED→SETTLED 는 허용되지 않는 전이).
   */
  const next = order.settlement.action === 'none' ? 'SETTLED' : 'SETTLEMENT_DUE'
  assertTransition(order.state, next)

  const entries = settlementEntries(order.settlement, order.fx.effectiveRate)
  for (const e of entries) {
    addCustomerEntry(order, e.type, e.amountKrw, { memo: e.memo })
  }

  if (next === 'SETTLED') {
    pushHistory(order, 'SETTLED', '차액 없음 (허용오차 이내)', by)
  } else {
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

/**
 * 배송 현황(위치) 갱신 — 상태 머신을 건드리지 않는 표시용 이력입니다.
 * 파트너의 "하노이 도착"·"통관" 보고가 고객 주문 페이지의 위치 표시로
 * 이어집니다. 라벨은 고객에게 그대로 노출되므로 짧은 문구만 받습니다.
 */
export function addDeliveryMilestone(id, label, by) {
  const order = mustGet(id)
  const clean = String(label ?? '').trim().slice(0, 60)
  if (!clean) throw new Error('현황 문구가 필요합니다.')
  order.delivery.milestones ??= []
  order.delivery.milestones.push({ at: nowIso(), label: clean })
  pushHistory(order, order.state, `현황 — ${clean}`, by)
  persist()
  return order
}

/** 도착 후 배송일정 — 파트너가 확인해준 배달 예정을 고객에게 보여줍니다. */
export function setDeliverySchedule(id, scheduleText, by) {
  const order = mustGet(id)
  const clean = String(scheduleText ?? '').trim().slice(0, 80)
  if (!clean) throw new Error('배송일정 문구가 필요합니다.')
  order.delivery.scheduledText = clean
  order.delivery.milestones ??= []
  order.delivery.milestones.push({ at: nowIso(), label: `배달 예정 — ${clean}` })
  pushHistory(order, order.state, `배달 예정 — ${clean}`, by)
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

/**
 * 취소 — 기본은 전액 환불(당사 사유: 품절·가격 인상 등, 화면 약속 그대로).
 * customerFault(고객 변심)면 실비를 남기고 환불합니다:
 *   구매대행  동결 견적의 대행수수료 제외 — 이미 수행한 접수·검수 실비
 *   배송대행  $1 차감 — 배송비만 받는 트랙이라 환불 시 남는 마진이 없음
 * (config/payment.js RETURN_POLICY, 운영자 확정 26-08-30)
 */
export function cancelOrder(id, { reason, by, customerFault = false } = {}) {
  const order = mustGet(id)
  assertTransition(order.state, 'CANCELLED')

  const s = summarize(order.ledger, order.fx.effectiveRate)

  // 변심 취소 실비 — 입금된 돈이 있을 때만 의미가 있습니다.
  let retainKrw = 0
  let retainMemo = ''
  if (customerFault && s.netReceivedKrw > 0) {
    if (order.track === 'agent' && RETURN_POLICY.agentRetainsAgencyFee) {
      retainKrw = Math.min(order.quote?.agency?.fee ?? 0, s.netReceivedKrw)
      retainMemo = '대신 구매 수수료'
    } else if (order.track === 'forwarding') {
      const feeKrw = Math.round((RETURN_POLICY.forwardingRefundFeeUsd ?? 0) * (order.fx.usdToKrw || 0))
      retainKrw = Math.min(feeKrw, s.netReceivedKrw)
      retainMemo = `환불 처리 수수료 $${RETURN_POLICY.forwardingRefundFeeUsd}`
    }
  }

  /**
   * 청구 취소는 입금 여부와 무관하게 항상 기록합니다.
   * 입금 조건 안에 묶으면 미입금 주문을 취소했을 때 CHARGE 가 상쇄되지 않아
   * 유령 미수금(취소됐는데 잔액 > 0)이 남습니다.
   * 변심 취소는 남기는 실비만큼 청구를 살려 둬야 장부가 0으로 끝납니다 —
   * 전액 상쇄하면 남긴 돈이 영원히 '환불 예정'으로 보입니다.
   */
  const outstanding = s.billedKrw - s.creditedKrw
  const creditKrw = Math.max(0, outstanding - retainKrw)
  if (creditKrw > 0) {
    addCustomerEntry(order, 'CREDIT', creditKrw, { memo: '주문 취소 - 청구 취소' })
  }
  const refundKrw = s.netReceivedKrw - retainKrw
  if (refundKrw > 0) {
    addCustomerEntry(order, 'REFUND', refundKrw, {
      memo: retainKrw > 0
        ? `주문 취소 - 환불 (${retainMemo} ${retainKrw.toLocaleString('ko-KR')}원 제외)`
        : '주문 취소 - 전액 환불',
    })
  }
  pushHistory(order, 'CANCELLED', reason ?? '주문 취소', by)
  persist()
  return order
}

/**
 * 고객이 직접 취소할 수 있는 상태 — 입금 확인 전.
 * 입금 후에는 환불 계좌 확인이 필요하고, 매입 후에는 쿠팡 반품 절차가
 * 필요하므로 운영자 경로(cancelOrder)로만 취소합니다.
 */
export const CUSTOMER_CANCELLABLE_STATES = ['REQUESTED', 'AWAITING_PAYMENT']

/** 고객 셀프 취소 — 주문 페이지의 [주문 취소] 버튼과 중복 접수 안내가 씁니다. */
export function customerCancelOrder(id, { reason } = {}) {
  const order = mustGet(id)
  /**
   * 멱등 — 이미 취소된 주문의 재취소는 성공으로 봅니다.
   * 다른 탭에서 먼저 취소했거나 버튼을 두 번 누른 경우, 오류를 내면
   * "취소 후 재접수" 흐름이 여기서 멈춰버립니다. 원장도 이미 상쇄돼
   * 있으므로 그대로 돌려주는 것이 맞습니다.
   */
  if (order.state === 'CANCELLED') return order
  if (!CUSTOMER_CANCELLABLE_STATES.includes(order.state)) {
    throw new Error(
      '입금 확인 전 주문만 직접 취소할 수 있습니다. 이미 진행 중인 주문은 운영자에게 문의해 주세요.',
    )
  }
  const memo = String(reason ?? '').trim().slice(0, 120)
  return cancelOrder(order.id, {
    reason: memo ? `고객 직접 취소 — ${memo}` : '고객 직접 취소',
    by: 'customer',
  })
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
     * 배송 현황 — 고객 위치 표시용. 마스터 AWB·현황·배달 예정만 공개
     * (매입 관련 정보는 procurement 에 있고 여기 절대 넣지 않습니다).
     */
    delivery: {
      trackingNo: order.delivery?.trackingNo ?? null,
      shippedAt: order.delivery?.shippedAt ?? null,
      deliveredAt: order.delivery?.deliveredAt ?? null,
      scheduledText: order.delivery?.scheduledText ?? null,
      milestones: order.delivery?.milestones ?? [],
    },

    /**
     * 배송대행 쿠팡 주문 안내 — 소포가 창고에 닿기 전까지만 보여줍니다.
     * 파트너 규격: 세부주소에 "YS-ECOM 주문자명" 이 있어야 창고가 접수합니다.
     * (형식은 관대 — 이름만 들어 있으면 findByInbound 가 찾습니다)
     */
    forwardingGuide:
      order.track === 'forwarding' &&
      ['AWAITING_PAYMENT', 'PAID', 'PURCHASING', 'PURCHASED'].includes(order.state)
        ? {
            /** 받는 사람(이름 칸) — 파트너 규격상 코드 자체를 넣습니다 */
            recipient: WAREHOUSE.code,
            /** 세부주소(상세주소) 칸에 그대로 들어갈 코드 */
            addressDetail: detailAddressFor(order.customer.name),
            warehouse: {
              name: WAREHOUSE.name,
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
  store.counter = 0
  persist()
}
