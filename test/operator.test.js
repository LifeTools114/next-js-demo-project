import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, confirmPayment, startPurchase, getOrder, _reset } from '../lib/order/store.js'
import captureHandler from '../pages/api/admin/coupang-capture.js'
import { ALL_CONSENTS } from './helpers/consents.js'

const agentOrder = () =>
  createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '7001', productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 2 }],
    zone: 'hanoi', track: 'agent',
    customer: { name: 'Mai', phone: '0912', address: 'Hanoi' },
  })
const toPurchasing = () => {
  const o = agentOrder()
  confirmPayment(o.id, { confirmedBy: 'op' })
  return startPurchase(o.id, 'op')
}

function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this },
    json(o) { this.body = o; return this },
  }
}
const post = (body) => {
  const res = mockRes()
  captureHandler({ method: 'POST', headers: {}, body }, res)
  return res
}

test.beforeEach(() => _reset())

test('쿠팡 캡처: 매입 중 주문이 하나면 자동으로 매입 기록된다', () => {
  const o = toPurchasing()
  const res = post({ coupangOrderNo: '29000123456789', amountKrw: 48200 })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.matched, true)

  const after = getOrder(o.id)
  assert.equal(after.state, 'PURCHASED')
  assert.equal(after.procurement.coupangOrderNo, '29000123456789')
})

test('쿠팡 캡처: 매입 중 주문이 없거나 여러 건이면 자동 기록하지 않는다', () => {
  // 0건 — 결제 전 주문만 있는 상태
  agentOrder()
  const none = post({ coupangOrderNo: '29000123456789', amountKrw: 48200 })
  assert.equal(none.body.matched, false)
  assert.equal(none.body.reason, 'no-purchasing')

  // 2건 — 어느 주문의 결제인지 알 수 없으므로 사람에게 넘깁니다
  const a = toPurchasing()
  const b = toPurchasing()
  const ambiguous = post({ coupangOrderNo: '29000999999999', amountKrw: 48200 })
  assert.equal(ambiguous.body.matched, false)
  assert.equal(ambiguous.body.reason, 'ambiguous')
  assert.deepEqual(ambiguous.body.candidates.sort(), [a.orderNo, b.orderNo].sort())
  assert.equal(getOrder(a.id).state, 'PURCHASING', '자동 기록이 일어나면 안 됩니다')
})

test('쿠팡 캡처: 주문번호·금액이 없으면 거부한다', () => {
  toPurchasing()
  assert.equal(post({ coupangOrderNo: '', amountKrw: 1000 }).statusCode, 400)
  assert.equal(post({ coupangOrderNo: '123456789', amountKrw: 0 }).statusCode, 400)
})
