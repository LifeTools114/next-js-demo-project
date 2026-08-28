import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, getOrder, confirmPayment, startPurchase, recordPurchase,
  recordWeighing, applySettlement, closeSettlement, markShipped, markDelivered,
  cancelOrder, orderView, customerView, _reset,
} from '../lib/order/store.js'
import { canTransition, InvalidTransitionError } from '../lib/order/states.js'
import { emptyLedger, customerEntry, procurementEntry, summarize, recognizeRevenue } from '../lib/order/ledger.js'
import { computeSettlement } from '../lib/order/settlement.js'
import { availableMethods, getMethod, NotConfiguredError } from '../lib/payment/methods.js'

const ITEMS = [
  { productId: '7001', productName: '토리든 다이브인 세럼 50ml', productPrice: 19900, quantity: 2 },
  { productId: '7201', productName: '메디힐 마스크팩 10매', productPrice: 12900, quantity: 3 },
]
const newOrder = () =>
  createOrder({ items: ITEMS, zone: 'hanoi-inner', customer: { name: 'Mai', phone: '0912', address: 'Hanoi' } })

test.beforeEach(() => _reset())

// ─────────────── 상태 머신 ───────────────

test('상태 머신: 결제 없이 매입으로 건너뛸 수 없다', () => {
  assert.equal(canTransition('AWAITING_PAYMENT', 'PURCHASING'), false)
  assert.equal(canTransition('PAID', 'PURCHASING'), true)
  const o = newOrder()
  assert.throws(() => startPurchase(o.id), InvalidTransitionError)
})

test('상태 머신: 매입 착수 후에는 자동 취소가 막힌다', () => {
  // 쿠팡에서 이미 구매했으므로 반품 절차 없이 취소하면 손실이 발생합니다.
  assert.equal(canTransition('PAID', 'CANCELLED'), true)
  assert.equal(canTransition('PURCHASING', 'CANCELLED'), false)
})

// ─────────────── 주문 생성 ───────────────

test('주문 생성: 견적을 동결하고 환율을 고정한다', () => {
  const o = newOrder()
  assert.equal(o.state, 'AWAITING_PAYMENT')
  assert.match(o.orderNo, /^HN\d{10}$/)
  assert.ok(o.quote.total > 0)
  assert.equal(o.invoice.amountKrw, o.quote.total)
  assert.ok(o.fx.effectiveRate > o.fx.baseRate, '스프레드가 반영되어야 합니다')
  assert.equal(o.invoice.amountVnd, Math.round(o.quote.total * o.fx.effectiveRate))
  assert.ok(o.fx.lockedAt)
})

test('주문 생성: 청구가 고객 원장에 기록된다', () => {
  const o = newOrder()
  const s = summarize(o.ledger, o.fx.effectiveRate)
  assert.equal(s.billedKrw, o.quote.total)
  assert.equal(s.receivedKrw, 0)
  assert.equal(s.balanceKrw, o.quote.total, '입금 전에는 전액이 미납 잔액입니다')
})

test('주문 생성: 상품이 없으면 거부한다', () => {
  assert.throws(() => createOrder({ items: [], zone: 'hanoi-inner', customer: { name: 'A' } }), /상품이 없습니다/)
})

test('주문 생성: 설정되지 않은 결제 수단은 거부한다', () => {
  assert.throws(
    () => createOrder({ items: ITEMS, zone: 'hanoi-inner', customer: { name: 'A' }, paymentMethod: 'momo' }),
    NotConfiguredError,
  )
})

// ─────────────── 이중 원장 ───────────────

test('원장: 청구 → 입금 후 잔액이 0이 된다', () => {
  const o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  const s = summarize(o.ledger, o.fx.effectiveRate)
  assert.equal(s.balanceKrw, 0)
  assert.equal(s.netReceivedKrw, o.quote.total)
  assert.equal(o.state, 'PAID')
})

test('원장: 입금 확인에 운영자 정보가 없으면 거부한다', () => {
  const o = newOrder()
  assert.throws(() => confirmPayment(o.id, {}), /운영자/)
})

test('매출 인식: 상품가는 예수금이므로 매출이 아니다', () => {
  const L = emptyLedger()
  L.customer.push(customerEntry('CHARGE', 276621, { fxRate: 18.78 }))
  L.customer.push(customerEntry('PAYMENT', 276621, { fxRate: 18.78 }))
  L.procurement.push(procurementEntry('COUPANG_PURCHASE', 176500))
  L.procurement.push(procurementEntry('FREIGHT', 28000))
  L.procurement.push(procurementEntry('DUTY', 20450))
  L.procurement.push(procurementEntry('VAT', 22495))

  const r = recognizeRevenue(L, 18.78, { settled: true })
  assert.equal(r.grossReceivedKrw, 276621)
  assert.equal(r.passThroughKrw, 247445)
  assert.equal(r.netRevenueKrw, 29176)
  // 총액으로 인식하면 매출이 9배 이상 부풀려집니다.
  assert.ok(r.grossIfPrincipalKrw / r.netRevenueKrw > 9)
  assert.equal(r.confirmed, true)
  // 정산 완료 전이면 같은 원장이라도 확정이 아닙니다.
  assert.equal(recognizeRevenue(L, 18.78).confirmed, false)
})

test('매출 인식: 매입 기록 전에는 확정되지 않는다', () => {
  const o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  assert.equal(recognizeRevenue(o.ledger, o.fx.effectiveRate).confirmed, false)
})

// ─────────────── 정산 ───────────────

test('정산: 실측이 무거우면 추가 청구, 가벼우면 환불', () => {
  const o = newOrder()
  const heavier = computeSettlement(o, o.quote.weight.chargeableG + 600)
  const lighter = computeSettlement(o, Math.max(100, o.quote.weight.chargeableG - 600))
  assert.equal(heavier.action, 'additional')
  assert.ok(heavier.diffKrw > 0)
  assert.equal(lighter.action, 'refund')
  assert.ok(lighter.diffKrw < 0)
})

test('정산: 허용오차 이내면 정산하지 않는다', () => {
  const o = newOrder()
  // 0.5kg 올림 단위가 작은 차이를 흡수합니다.
  const s = computeSettlement(o, o.quote.weight.chargeableG + 10)
  assert.equal(s.action, 'none')
  assert.equal(s.diffKrw, 0)
})

test('정산: 과대한 추가 청구는 운영자 확인 대상이 된다', () => {
  const o = newOrder()
  const s = computeSettlement(o, o.quote.weight.chargeableG * 6)
  assert.equal(s.action, 'additional')
  assert.equal(s.requiresReview, true)
})

test('정산: 추가 청구가 잔액으로 잡히고 입금 후 0이 된다', () => {
  let o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  o = startPurchase(o.id, 'admin')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-1', amountKrw: 78500 })
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG + 600, costs: { FREIGHT: 24000 } })
  o = applySettlement(o.id, 'admin')

  assert.equal(o.state, 'SETTLEMENT_DUE')
  const due = summarize(o.ledger, o.fx.effectiveRate).balanceKrw
  assert.ok(due > 0, '추가 청구가 미납 잔액으로 잡혀야 합니다')

  o = closeSettlement(o.id, { by: 'admin' })
  assert.equal(o.state, 'SETTLED')
  assert.equal(summarize(o.ledger, o.fx.effectiveRate).balanceKrw, 0)
})

test('정산: 차액이 없으면 SETTLEMENT_DUE 를 건너뛴다', () => {
  let o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  o = startPurchase(o.id, 'admin')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-2', amountKrw: 78500 })
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG })
  o = applySettlement(o.id, 'admin')
  assert.equal(o.state, 'SETTLED')
})

test('실측 등록: 무게가 없으면 거부한다', () => {
  let o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  o = startPurchase(o.id, 'admin')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-3', amountKrw: 78500 })
  assert.throws(() => recordWeighing(o.id, { actualWeightG: 0 }), /실측 무게/)
})

test('매입 기록: 쿠팡 주문번호와 금액이 필수다', () => {
  let o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  o = startPurchase(o.id, 'admin')
  assert.throws(() => recordPurchase(o.id, { amountKrw: 1000 }), /주문번호/)
  assert.throws(() => recordPurchase(o.id, { coupangOrderNo: 'X' }), /매입 금액/)
})

// ─────────────── 전체 흐름 ───────────────

test('전체 흐름: 주문 → 배송 완료까지 진행되고 잔액이 0이다', () => {
  let o = newOrder()
  o = confirmPayment(o.id, { confirmedBy: 'admin' })
  o = startPurchase(o.id, 'admin')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-9', amountKrw: 78500 })
  o = recordWeighing(o.id, { actualWeightG: 1680, costs: { FREIGHT: 24000, DUTY: 9800, VAT: 10700 } })
  o = applySettlement(o.id, 'admin')
  if (o.state === 'SETTLEMENT_DUE') o = closeSettlement(o.id, { by: 'admin' })
  o = markShipped(o.id, { trackingNo: 'VN123' })
  o = markDelivered(o.id, 'admin')

  const v = orderView(o)
  assert.equal(v.state, 'DELIVERED')
  assert.equal(v.ledgerSummary.balanceKrw, 0)
  assert.equal(v.revenue.confirmed, true)
  assert.ok(v.revenue.netRevenueKrw < v.revenue.grossIfPrincipalKrw)
})

test('취소: 입금된 주문은 전액 환불되고 잔액이 0이 된다', () => {
  const o = cancelOrder(confirmPayment(newOrder().id, { confirmedBy: 'admin' }).id, { reason: '고객 요청' })
  assert.equal(o.state, 'CANCELLED')
  const s = summarize(o.ledger, o.fx.effectiveRate)
  assert.equal(s.balanceKrw, 0)
  assert.equal(s.netReceivedKrw, 0, '환불 후 실수취액은 0이어야 합니다')
})

// ─────────────── 고객 뷰 정보 차단 (중요) ───────────────

test('고객 뷰: 매입 원가·마진·쿠팡 주문번호가 노출되지 않는다', () => {
  let o = confirmPayment(newOrder().id, { confirmedBy: 'admin-kim' })
  o = startPurchase(o.id, 'admin-kim')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-SECRET-777', amountKrw: 15200, by: 'admin-kim' })
  o = recordWeighing(o.id, { actualWeightG: 1500, costs: { FREIGHT: 24000, DUTY: 9800 }, by: 'admin-kim' })

  const json = JSON.stringify(customerView(o))
  for (const secret of ['CP-SECRET-777', '15200', 'COUPANG_PURCHASE', 'netRevenue', 'disbursed', '24000', 'admin-kim']) {
    assert.ok(!json.includes(secret), `고객 뷰에 '${secret}' 이 노출되면 안 됩니다`)
  }
  // 반면 운영자 뷰에는 있어야 합니다.
  const adminJson = JSON.stringify(orderView(o))
  assert.ok(adminJson.includes('CP-SECRET-777'))
  assert.ok(adminJson.includes('netRevenueKrw'))
})

test('고객 뷰: 고객이 알아야 할 정보는 유지된다', () => {
  const o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  const v = customerView(o)
  assert.equal(v.orderNo, o.orderNo)
  assert.equal(v.balance.krw, 0)
  assert.ok(v.ledger.customer.length >= 2, '청구·입금 내역은 보여야 합니다')
  assert.ok(v.quote.total > 0)
  assert.ok(v.history.every((h) => h.label))
})

// ─────────────── 결제 수단 ───────────────

test('결제 수단: 은행이체는 항상 사용 가능하고 주문번호를 메모로 요구한다', () => {
  const ids = availableMethods().map((m) => m.id)
  assert.ok(ids.includes('manual-bank'))
  const o = newOrder()
  assert.equal(o.paymentRequest.reference, o.orderNo)
  assert.ok(o.paymentRequest.instructions.some((l) => l.includes(o.orderNo)))
})

test('결제 수단: 미설정 수단은 명확한 오류를 던진다', () => {
  for (const id of ['momo', 'zalopay', 'vnpay']) {
    assert.throws(() => getMethod(id), NotConfiguredError)
  }
})

test('매출 확정: 실측 직후에는 아직 확정이 아니다', () => {
  // 실측 시점에는 정산을 적용하기 전이라 잔액이 0으로 보이지만,
  // 정산을 적용하면 금액이 바뀝니다. 이때 confirmed 가 true 면 회계 판단을 그르칩니다.
  let o = confirmPayment(newOrder().id, { confirmedBy: 'admin' })
  o = startPurchase(o.id, 'admin')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-C', amountKrw: 78500 })
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG + 600, costs: { FREIGHT: 24000 } })

  const beforeSettlement = orderView(o)
  assert.equal(beforeSettlement.ledgerSummary.balanceKrw, 0, '정산 전에는 잔액이 0으로 보입니다')
  assert.equal(beforeSettlement.revenue.confirmed, false, '그래도 확정이면 안 됩니다')

  o = applySettlement(o.id, 'admin')
  o = closeSettlement(o.id, { by: 'admin' })
  const after = orderView(o)
  assert.equal(after.revenue.confirmed, true)
  assert.notEqual(after.revenue.netRevenueKrw, beforeSettlement.revenue.netRevenueKrw,
    '정산으로 마진이 실제로 바뀌므로, 확정 전 값을 믿으면 안 됩니다')
})

test('취소: 미입금 주문을 취소해도 유령 미수금이 남지 않는다', () => {
  // CHARGE 상쇄가 입금 조건 안에 묶여 있으면, 입금 전 취소 시
  // 잔액이 청구액 그대로 남아 "취소됐는데 미수금이 있는" 상태가 됩니다.
  const o = cancelOrder(newOrder().id, { reason: '고객 변심' })
  assert.equal(o.state, 'CANCELLED')
  const s = summarize(o.ledger, o.fx.effectiveRate)
  assert.equal(s.balanceKrw, 0, `유령 미수금: ${s.balanceKrw}원`)
})

test('환율 동결: 주문 생성 시 USD 환율이 주문에 저장된다', () => {
  const o = newOrder()
  assert.ok(Number.isFinite(o.fx.usdToKrw) && o.fx.usdToKrw > 0)
})

test('환율 동결: 정산은 주문 시점 환율로 재계산한다', async () => {
  // 라이브 환율이 바뀌어도 정산 금액이 흔들리면
  // 무게가 같은데 차액이 생기는, 고객이 이해할 수 없는 정산이 됩니다.
  const { FX } = await import('../config/fx.js')
  const { computeSettlement } = await import('../lib/order/settlement.js')

  const o = newOrder()
  const sameWeight = o.quote.weight.chargeableG

  const before = computeSettlement(o, sameWeight)
  const live = FX.usdToKrw
  FX.usdToKrw = live * 1.2 // 환율 20% 급등 시뮬레이션
  try {
    const after = computeSettlement(o, sameWeight)
    assert.equal(after.finalTotalKrw, before.finalTotalKrw, '환율 변동이 정산에 새어들었습니다')
    assert.equal(after.action, 'none', '무게가 같으면 정산이 없어야 합니다')
    assert.equal(FX.usdToKrw, live * 1.2, '전역 환율은 복원 전 상태여야 합니다')
  } finally {
    FX.usdToKrw = live
  }
})
