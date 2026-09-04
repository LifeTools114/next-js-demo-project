import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, customerCancelOrder,
  findDuplicateOrder, CUSTOMER_CANCELLABLE_STATES, _reset,
} from '../lib/order/store.js'
import { summarize } from '../lib/order/ledger.js'
import { ALL_CONSENTS } from './helpers/consents.js'

/**
 * 중복 접수 감지 + 고객 셀프 취소.
 *
 * 실제 사고 시나리오: 제출 더블클릭, 뒤로가기 후 재제출, 확장 신청서가
 * 두 번 열림. 같은 주문이 두 건 들어가면 고객은 두 번 입금하거나,
 * 우리는 같은 상품을 두 번 발주합니다.
 */

const ITEMS = [
  { productId: '7001', productName: '토리든 다이브인 세럼 50ml', productPrice: 19900, quantity: 2 },
  { productId: '7201', productName: '메디힐 마스크팩 10매', productPrice: 12900, quantity: 3 },
]
const CUSTOMER = { name: 'Mai', phone: '0912 345 678', address: 'Hanoi' }
const make = (over = {}) =>
  createOrder({ consents: ALL_CONSENTS, items: ITEMS, zone: 'hanoi', track: 'agent', customer: CUSTOMER, ...over })

test.beforeEach(() => _reset())

// ─────────────── 중복 감지: 같은 구성 ───────────────

test('중복: 같은 트랙·연락처·상품 구성이면 잡힌다', () => {
  const o = make()
  const dup = findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS })
  assert.ok(dup, '중복이 감지되어야 합니다')
  assert.equal(dup.kind, 'same-items')
  assert.equal(dup.order.orderNo, o.orderNo)
})

test('중복: 전화번호 표기(하이픈·공백)가 달라도 같은 번호면 잡힌다', () => {
  make()
  const dup = findDuplicateOrder({
    track: 'agent',
    customer: { ...CUSTOMER, phone: '0912-345-678' },
    items: ITEMS,
  })
  assert.equal(dup?.kind, 'same-items')
})

test('중복: 상품을 담은 순서가 달라도 같은 구성이면 잡힌다', () => {
  make()
  const dup = findDuplicateOrder({
    track: 'agent', customer: CUSTOMER, items: [...ITEMS].reverse(),
  })
  assert.equal(dup?.kind, 'same-items')
})

test('중복 아님: 수량·트랙·연락처가 다르면 새 주문이다', () => {
  make()
  const changedQty = [{ ...ITEMS[0], quantity: 5 }, ITEMS[1]]
  assert.equal(findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: changedQty }), null)
  assert.equal(findDuplicateOrder({ track: 'forwarding', customer: CUSTOMER, items: ITEMS }), null)
  assert.equal(
    findDuplicateOrder({ track: 'agent', customer: { ...CUSTOMER, phone: '0999' }, items: ITEMS }),
    null,
  )
})

test('중복 아님: 취소된 주문은 다시 접수할 수 있다', () => {
  const o = make()
  customerCancelOrder(o.id)
  assert.equal(findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS }), null)
})

test('중복 아님: 이미 입금된 주문은 재구매로 본다', () => {
  // 입금까지 마친 주문과 같은 구성을 다시 넣는 건 대개 진짜 재구매입니다.
  const o = make()
  confirmPayment(o.id, { confirmedBy: 'admin' })
  assert.equal(findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS }), null)
})

test('중복 아님: 30분이 지난 미결제 주문은 잡지 않는다', () => {
  const o = make()
  o.createdAt = new Date(Date.now() - 31 * 60 * 1000).toISOString()
  assert.equal(findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS }), null)
})

test('중복: 여러 건이 열려 있으면 전부 알려준다 — 하나만 취소하면 또 잡히므로', () => {
  // 실사고 재현: "한 번 더 주문"으로 2건을 만든 뒤 1건만 취소하고 재접수하면
  // 남은 건이 다시 중복으로 잡힙니다. 화면이 전부 정리하려면 목록이 필요합니다.
  const first = make()
  const second = make()
  const dup = findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS })
  assert.deepEqual(dup.openOrderNos, [second.orderNo, first.orderNo], '최신순 전체 목록')

  customerCancelOrder(second.orderNo)
  const remain = findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS })
  assert.deepEqual(remain.openOrderNos, [first.orderNo], '남은 한 건은 계속 잡힙니다')

  customerCancelOrder(first.orderNo)
  assert.equal(findDuplicateOrder({ track: 'agent', customer: CUSTOMER, items: ITEMS }), null)
})

// ─────────────── 중복 감지: 쿠팡 주문번호 ───────────────

test('중복: 같은 쿠팡 주문번호는 상품·연락처가 달라도 언제나 잡힌다', () => {
  const o = createOrder({ consents: ALL_CONSENTS,
    items: ITEMS, zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
    coupangOrderNo: '30001234567890',
  })
  const dup = findDuplicateOrder({
    track: 'forwarding',
    customer: { name: 'B', phone: '0777' },
    items: [{ productName: '다른 상품', productPrice: 1000, quantity: 1 }],
    coupangOrderNo: '30001234567890',
  })
  assert.equal(dup?.kind, 'coupang-order-no')
  assert.equal(dup.order.orderNo, o.orderNo)
})

test('중복: 쿠팡 주문번호 중복은 결제·배송이 진행된 뒤에도 잡힌다', () => {
  const o = createOrder({ consents: ALL_CONSENTS,
    items: ITEMS, zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
    coupangOrderNo: '30009999999999',
  })
  // 쿠팡 주문이 연결된 배송대행은 입금 확인 시 '창고로 배송 중'까지 자동 진행됩니다.
  const paid = confirmPayment(o.id, { confirmedBy: 'admin' })
  assert.equal(paid.state, 'PURCHASED')
  const probe = { track: 'forwarding', customer: CUSTOMER, items: ITEMS, coupangOrderNo: '30009999999999' }
  assert.equal(findDuplicateOrder(probe)?.kind, 'coupang-order-no')
})

test('중복: 연결된 주문을 취소하면 같은 쿠팡 주문을 다시 접수할 수 있다', () => {
  const o = createOrder({ consents: ALL_CONSENTS,
    items: ITEMS, zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
    coupangOrderNo: '30008888888888',
  })
  customerCancelOrder(o.id, { reason: '주소를 잘못 입력' })
  assert.equal(
    findDuplicateOrder({ track: 'forwarding', customer: CUSTOMER, items: ITEMS, coupangOrderNo: '30008888888888' }),
    null,
  )
})

// ─────────────── 고객 셀프 취소 ───────────────

test('셀프 취소: 입금 전에는 취소되고 유령 미수금이 남지 않는다', () => {
  const o = make()
  assert.equal(o.state, 'AWAITING_PAYMENT')
  const cancelled = customerCancelOrder(o.orderNo, { reason: '실수로 두 번 접수' })
  assert.equal(cancelled.state, 'CANCELLED')
  assert.equal(summarize(cancelled.ledger, cancelled.fx.effectiveRate).balanceKrw, 0)
  const last = cancelled.history.at(-1)
  assert.equal(last.by, 'customer')
  assert.match(last.memo, /고객 직접 취소/)
  assert.match(last.memo, /실수로 두 번 접수/)
})

test('셀프 취소: 입금이 확인된 주문은 거부한다 (운영자 경로만)', () => {
  const o = make()
  confirmPayment(o.id, { confirmedBy: 'admin' })
  assert.throws(() => customerCancelOrder(o.id), /입금 확인 전/)
})

test('셀프 취소: 이미 취소된 주문의 재취소는 오류가 아니다 (멱등)', () => {
  // 다른 탭에서 먼저 취소했거나 버튼을 두 번 누른 경우 —
  // 오류를 내면 "취소 후 재접수" 흐름이 멈춰버립니다.
  const o = make()
  customerCancelOrder(o.id)
  const again = customerCancelOrder(o.id)
  assert.equal(again.state, 'CANCELLED')
  // 원장이 중복으로 상쇄·환불되지 않아야 합니다 (CANCELLED 이력 1회).
  assert.equal(again.history.filter((h) => h.state === 'CANCELLED').length, 1)
  assert.equal(summarize(again.ledger, again.fx.effectiveRate).balanceKrw, 0)
})

test('셀프 취소 가능 상태는 입금 전 두 단계뿐이다', () => {
  assert.deepEqual(CUSTOMER_CANCELLABLE_STATES, ['REQUESTED', 'AWAITING_PAYMENT'])
})

// ─────────── 변심 취소 실비 차감 (RETURN_POLICY) ───────────

test('변심 취소: 구매대행은 대행수수료만 남기고 환불한다', async () => {
  const { cancelOrder } = await import('../lib/order/store.js')
  const o = make()
  confirmPayment(o.id, { confirmedBy: 'admin' })
  const cancelled = cancelOrder(o.id, { reason: '고객 변심', by: 'admin', customerFault: true })
  const s = summarize(cancelled.ledger, cancelled.fx.effectiveRate)
  const fee = cancelled.quote.agency.fee
  assert.ok(fee >= 5000, `수수료가 동결 견적에 있어야 합니다 (${fee})`)
  assert.equal(s.netReceivedKrw, fee, '남는 돈 = 대행수수료')
  assert.equal(s.balanceKrw, 0, '잔액은 0으로 끝나야 합니다 (유령 환불 예정 금지)')
  const refund = cancelled.ledger.customer.find((e) => e.type === 'REFUND')
  assert.equal(refund.amountKrw, cancelled.quote.total - fee)
  // 고객에게 보이는 말이라 쉬운 말로 바꿨습니다 (config/words.js 방침)
  assert.match(refund.memo, /대신 구매 수수료/)
})

test('변심 취소: 배송만은 배송만 수수료만 차감한다', async () => {
  const { cancelOrder } = await import('../lib/order/store.js')
  const { FEES } = await import('../config/fees.js')
  const o = createOrder({ consents: ALL_CONSENTS, items: ITEMS, zone: 'hanoi', track: 'forwarding', customer: CUSTOMER })
  confirmPayment(o.id, { confirmedBy: 'admin' })
  const cancelled = cancelOrder(o.id, { reason: '고객 변심', by: 'admin', customerFault: true })
  const s = summarize(cancelled.ledger, cancelled.fx.effectiveRate)
  assert.equal(s.netReceivedKrw, FEES.forwardingFeeKrw, '남는 돈 = 배송만 수수료 3,000원')
  assert.equal(s.balanceKrw, 0)
  const refund = cancelled.ledger.customer.find((e) => e.type === 'REFUND')
  assert.match(refund.memo, /배송만 수수료/, '고객이 이유를 알 수 있어야 합니다')
})

test('취소 기본값: customerFault 없이는 전액 환불 그대로다', async () => {
  const { cancelOrder } = await import('../lib/order/store.js')
  const o = make()
  confirmPayment(o.id, { confirmedBy: 'admin' })
  const cancelled = cancelOrder(o.id, { reason: '품절 — 당사 사유', by: 'admin' })
  const s = summarize(cancelled.ledger, cancelled.fx.effectiveRate)
  assert.equal(s.netReceivedKrw, 0, '전액 환불')
  assert.equal(s.balanceKrw, 0)
})

test('반송비 고객가: 원가 전 구간 +$2 — 하노이 2kg까지 $20, 초과 kg당 $11', async () => {
  // 운영자 확정 26-08-31: S1 원가($18/+$9)의 모든 금액에 $2 마진.
  const { estimateReturnShippingUsd, RETURN_SHIPPING } = await import('../config/shipping.js')
  assert.equal(RETURN_SHIPPING.assumed, false)
  assert.equal(RETURN_SHIPPING.agentHandlingKrw, 5000, '구매대행 반품·교환 처리 기본료')
  assert.equal(estimateReturnShippingUsd(1), 20)
  assert.equal(estimateReturnShippingUsd(2), 20, '기본 구간(2kg)까지는 $20')
  assert.equal(estimateReturnShippingUsd(2.2), 31, '초과분은 kg 올림 +$11')
  assert.equal(estimateReturnShippingUsd(5), 20 + 3 * 11)
  assert.equal(estimateReturnShippingUsd(0.5), 20, '최소 기본 구간 취급')
})

test('서버 최종 거절: 배송 불가 상품은 주문 생성 자체가 막힌다', async () => {
  // 화면 검증을 우회한 직접 API 호출 대비 — 해외직구·금지 품목 공통 가드.
  const overseas = [{ productName: '나이키 에어맥스', productPrice: 120000, quantity: 1, badges: ['로켓직구'] }]
  assert.throws(
    () => createOrder({ consents: ALL_CONSENTS, items: overseas, zone: 'hanoi', track: 'forwarding', customer: CUSTOMER }),
    /배송할 수 없는 상품/,
  )
  const banned = [{ productName: '샤넬 오드퍼퓸 50ml', productPrice: 200000, quantity: 1 }]
  assert.throws(
    () => createOrder({ consents: ALL_CONSENTS, items: banned, zone: 'hanoi', track: 'agent', customer: CUSTOMER }),
    /배송할 수 없는 상품/,
  )
})
