import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, customerCancelOrder,
  findDuplicateOrder, CUSTOMER_CANCELLABLE_STATES, _reset,
} from '../lib/order/store.js'
import { summarize } from '../lib/order/ledger.js'

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
  createOrder({ items: ITEMS, zone: 'hanoi', track: 'agent', customer: CUSTOMER, ...over })

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

// ─────────────── 중복 감지: 쿠팡 주문번호 ───────────────

test('중복: 같은 쿠팡 주문번호는 상품·연락처가 달라도 언제나 잡힌다', () => {
  const o = createOrder({
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
  const o = createOrder({
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
  const o = createOrder({
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

test('셀프 취소 가능 상태는 입금 전 두 단계뿐이다', () => {
  assert.deepEqual(CUSTOMER_CANCELLABLE_STATES, ['REQUESTED', 'AWAITING_PAYMENT'])
})
