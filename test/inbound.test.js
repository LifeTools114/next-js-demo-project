import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, linkInbound, findByInbound, recordWeighing,
  customerView, orderView, _reset,
} from '../lib/order/store.js'

const forwardingOrder = () =>
  createOrder({
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'forwarding',
    customer: { name: '김하노', phone: '0912', address: 'Hanoi' },
  })
const agentOrder = () =>
  createOrder({
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'agent',
    customer: { name: 'Mai', phone: '0912', address: 'Hanoi' },
  })

test.beforeEach(() => _reset())

test('입고 연결: 결제 후 연결하면 창고 배송 중까지 자동 진행된다', () => {
  let o = forwardingOrder()
  o = confirmPayment(o.id, { confirmedBy: 'op' })
  assert.equal(o.state, 'PAID')

  o = linkInbound(o.id, { coupangOrderNo: '29000123456789' })
  assert.equal(o.state, 'PURCHASED', '고객이 이미 구매했으므로 창고 대기 상태여야 합니다')
  assert.equal(o.inbound.coupangOrderNo, '29000123456789')

  // 실측 한 번으로 입고 → 정산까지 끝나는 기존 자동 연쇄와 이어집니다.
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG })
  assert.equal(o.state, 'SETTLED')
})

test('입고 연결: 결제 전에 연결해 두면 입금 확인 때 자동 진행된다', () => {
  let o = forwardingOrder()
  o = linkInbound(o.id, { trackingNo: '689012345678' })
  assert.equal(o.state, 'AWAITING_PAYMENT', '결제 게이트는 유지돼야 합니다')

  o = confirmPayment(o.id, { confirmedBy: 'op' })
  assert.equal(o.state, 'PURCHASED', '입금이 확인되면 연결된 주문은 바로 이어져야 합니다')
})

test('입고 연결: 구매대행 주문에는 연결할 수 없다', () => {
  const o = agentOrder()
  assert.throws(() => linkInbound(o.id, { coupangOrderNo: '123' }), /배송대행 주문만/)
  assert.equal(customerView(o).inbound, null)
})

test('입고 매칭: 수령인 코드·쿠팡 주문번호·운송장 무엇으로든 찾는다', () => {
  let o = forwardingOrder()
  o = confirmPayment(o.id, { confirmedBy: 'op' })
  o = linkInbound(o.id, { coupangOrderNo: '29000123456789', trackingNo: '689012345678' })

  // 라벨 스캔 문자열(이름+주문번호) 그대로
  assert.equal(findByInbound(`김하노 ${o.orderNo}`)?.id, o.id)
  assert.equal(findByInbound(o.inbound.coupangOrderNo)?.id, o.id)
  assert.equal(findByInbound('689012345678')?.id, o.id)
  assert.equal(findByInbound('없는번호999'), null)
})

test('입고 안내: 배송대행 고객에게만, 창고 도착 전까지만 보인다', () => {
  const f = customerView(forwardingOrder())
  assert.ok(f.forwardingGuide, '배송대행 주문에는 안내가 있어야 합니다')
  assert.ok(f.forwardingGuide.recipient.includes(f.orderNo), '수령인 코드에 주문번호가 들어가야 합니다')
  assert.equal(f.forwardingGuide.linked, false)

  assert.equal(customerView(agentOrder()).forwardingGuide, null, '구매대행에는 안내가 없어야 합니다')

  let o = confirmPayment(forwardingOrder().id, { confirmedBy: 'op' })
  o = linkInbound(o.id, { coupangOrderNo: '29000111111111' })
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG })
  assert.equal(customerView(o).forwardingGuide, null, '입고 후에는 안내가 사라져야 합니다')
})
