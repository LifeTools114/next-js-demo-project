/**
 * 이중 원장 — 고객 원장(VND)과 매입 원장(KRW)을 분리해 기록합니다.
 *
 * 왜 분리하는가
 *   고객이 낸 276,621원 중 대부분(상품가·관세·VAT)은 당사 매출이 아니라
 *   고객 돈을 대신 지불하는 예수금입니다. 이를 한 덩어리로 다루면
 *   매출이 20배 부풀려지고 세금이 과다 계상됩니다.
 *
 *   실마진 = 고객에게 실제 받은 돈 − 실제 지출한 돈
 *
 * 모든 금액의 원천은 KRW 입니다. VND 표시액은 주문에 고정된 환율로 환산합니다.
 * (VND를 원천으로 삼으면 반올림 오차가 누적됩니다)
 */

/**
 * 고객 원장 항목 유형.
 * delta 는 "고객이 당사에 내야 할 잔액"의 증감입니다.
 *   잔액 > 0  고객 미납
 *   잔액 < 0  당사가 환불해야 함
 *   잔액 = 0  정산 완료
 */
export const CUSTOMER_ENTRY = {
  CHARGE: { label: '주문 청구', sign: +1 },
  ADDITIONAL_CHARGE: { label: '차액 추가 청구', sign: +1 },
  CREDIT: { label: '차액 감액', sign: -1 },
  PAYMENT: { label: '입금', sign: -1 },
  REFUND: { label: '환불 지급', sign: +1 },
}

/** 매입 원장 항목 유형 — 전부 당사가 실제로 지출한 금액입니다. */
export const PROCUREMENT_ENTRY = {
  COUPANG_PURCHASE: { label: '쿠팡 상품 매입' },
  FREIGHT: { label: '국제운임 실비' },
  DUTY: { label: '수입관세 실납부' },
  VAT: { label: 'VAT 실납부' },
  WAREHOUSE: { label: '창고·검수 비용' },
  LAST_MILE: { label: '하노이 현지 배송비' },
  OTHER: { label: '기타 비용' },
}

let seq = 0
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1).toString(36)}`

const round = (n) => Math.round(Number(n) || 0)

/**
 * 고객 원장 항목을 만듭니다.
 * @param {string} type CUSTOMER_ENTRY 키
 * @param {number} amountKrw 양수로 전달 (부호는 type 이 결정)
 */
export function customerEntry(type, amountKrw, { memo = '', ref = null, fxRate, at } = {}) {
  const def = CUSTOMER_ENTRY[type]
  if (!def) throw new Error(`알 수 없는 고객 원장 유형입니다: ${type}`)
  const amount = round(Math.abs(amountKrw))
  return {
    id: nextId('c'),
    at: at ?? new Date().toISOString(),
    type,
    label: def.label,
    amountKrw: amount,
    delta: def.sign * amount,
    amountVnd: fxRate ? round(amount * fxRate) : null,
    memo,
    ref,
  }
}

/** 매입 원장 항목을 만듭니다. (전부 지출, 양수) */
export function procurementEntry(type, amountKrw, { memo = '', ref = null, at } = {}) {
  const def = PROCUREMENT_ENTRY[type]
  if (!def) throw new Error(`알 수 없는 매입 원장 유형입니다: ${type}`)
  return {
    id: nextId('p'),
    at: at ?? new Date().toISOString(),
    type,
    label: def.label,
    amountKrw: round(Math.abs(amountKrw)),
    memo,
    ref,
  }
}

const sumBy = (entries, predicate) =>
  entries.filter(predicate).reduce((s, e) => s + e.amountKrw, 0)

/**
 * 원장을 집계합니다.
 *
 * @param {{customer:Array, procurement:Array}} ledger
 * @param {number} fxRate 주문에 고정된 환율 (1 KRW = ? VND)
 */
export function summarize(ledger, fxRate) {
  const customer = ledger?.customer ?? []
  const procurement = ledger?.procurement ?? []

  const billed = sumBy(customer, (e) => e.type === 'CHARGE' || e.type === 'ADDITIONAL_CHARGE')
  const credited = sumBy(customer, (e) => e.type === 'CREDIT')
  const received = sumBy(customer, (e) => e.type === 'PAYMENT')
  const refunded = sumBy(customer, (e) => e.type === 'REFUND')

  // 잔액: 양수면 고객 미납, 음수면 당사가 환불해야 할 금액
  const balance = customer.reduce((s, e) => s + e.delta, 0)

  // 실제 수취한 순액 (환불 차감)
  const netReceived = received - refunded

  const disbursed = procurement.reduce((s, e) => s + e.amountKrw, 0)

  const byType = {}
  for (const e of procurement) {
    byType[e.type] = (byType[e.type] ?? 0) + e.amountKrw
  }

  return {
    billedKrw: billed,
    creditedKrw: credited,
    receivedKrw: received,
    refundedKrw: refunded,
    netReceivedKrw: netReceived,
    balanceKrw: balance,
    balanceVnd: fxRate ? round(balance * fxRate) : null,
    disbursedKrw: disbursed,
    disbursedByType: byType,

    /**
     * 실마진 — 실제 받은 돈에서 실제 쓴 돈을 뺀 값.
     * 매입이 끝나기 전에는 지출이 덜 잡혀 과대평가되므로,
     * settled 플래그로 확정 여부를 함께 알려줍니다.
     */
    netRevenueKrw: netReceived - disbursed,

    /** 정산 완료 여부: 잔액이 0이고 지출이 기록되어 있어야 확정입니다. */
    isBalanced: balance === 0,
    hasProcurement: procurement.length > 0,
  }
}

/**
 * 매출 인식 (대리인 방식 · 순액).
 *
 * 상품가·관세·VAT 는 예수금이므로 매출이 아닙니다.
 * 당사 매출은 고객 수취액에서 대납액을 뺀 나머지입니다.
 */
export function recognizeRevenue(ledger, fxRate, { settled = false } = {}) {
  const s = summarize(ledger, fxRate)
  const passThrough = s.disbursedKrw

  return {
    grossReceivedKrw: s.netReceivedKrw,
    passThroughKrw: passThrough,
    netRevenueKrw: s.netReceivedKrw - passThrough,
    /** 총액으로 잘못 인식했을 때의 금액 — 비교용 */
    grossIfPrincipalKrw: s.netReceivedKrw,

    /**
     * 확정 여부.
     *
     * 잔액 0 + 지출 기록만으로는 부족합니다. 실측 직후에는 아직 정산을
     * 적용하지 않아 잔액이 0으로 보이지만, 정산을 적용하면 금액이 바뀝니다.
     * 따라서 주문이 정산 완료(SETTLED) 이후 단계에 도달했는지도 함께 봅니다.
     */
    confirmed: settled && s.isBalanced && s.hasProcurement,
  }
}

export function emptyLedger() {
  return { customer: [], procurement: [] }
}
