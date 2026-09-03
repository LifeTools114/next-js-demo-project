import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, linkInbound, findByInbound, recordWeighing,
  customerView, orderView, _reset,
} from '../lib/order/store.js'
import { ALL_CONSENTS } from './helpers/consents.js'

const forwardingOrder = () =>
  createOrder({ consents: ALL_CONSENTS,
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'forwarding',
    customer: { name: '김하노', phone: '0912', address: 'Hanoi' },
  })
const agentOrder = () =>
  createOrder({ consents: ALL_CONSENTS,
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

test('쿠팡 결제 우선: 생성 시 연결 → 수동 입금확인만으로 끝까지 자동', () => {
  // 고객이 쿠팡에서 먼저 결제 → 트랜잭션(주문번호)을 들고 주문 생성
  let o = createOrder({ consents: ALL_CONSENTS,
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'forwarding',
    customer: { name: '김하노', phone: '0912', address: 'Hanoi' },
    coupangOrderNo: '29000777777777',
  })
  assert.equal(o.state, 'AWAITING_PAYMENT', '배송비 청구서가 바로 발행돼야 합니다')
  assert.equal(o.inbound.coupangOrderNo, '29000777777777')
  assert.ok(o.history.some((h) => h.memo?.includes('29000777777777')), '연결 사실이 이력에 남아야 합니다')

  // 웹훅 없이 운영자가 임의로 입금 확인 — 이후는 전부 자동
  o = confirmPayment(o.id, { confirmedBy: 'op' })
  assert.equal(o.state, 'PURCHASED', '수동 입금확인 한 번으로 창고 대기까지 가야 합니다')

  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG })
  assert.equal(o.state, 'SETTLED')
})

test('쿠팡 결제 우선: 구매대행 주문에는 연결이 무시된다', () => {
  const o = createOrder({ consents: ALL_CONSENTS,
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'agent',
    customer: { name: 'Mai', phone: '0912', address: 'Hanoi' },
    coupangOrderNo: '29000777777777',
  })
  assert.equal(o.inbound, null)
  assert.equal(customerView(o).inbound, null)
})

test('입고 매칭: 이름 폴백은 유일할 때만 통한다', () => {
  const mk = (name, no) => {
    const o = createOrder({ consents: ALL_CONSENTS,
      items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
      zone: 'hanoi', track: 'forwarding',
      customer: { name, phone: '0912', address: 'Hanoi' },
      coupangOrderNo: no,
    })
    return confirmPayment(o.id, { confirmedBy: 'op' }) // → PURCHASED (운송 중)
  }
  const a = mk('박하노', '29000111111111')
  assert.equal(findByInbound('받는사람: 박하노 / 서울 김포창고')?.id, a.id, '라벨의 이름만으로 찾아야 합니다')
  // 파트너 라벨의 세부주소 형식(공백·괄호 어느 쪽이든) 그대로 매칭됩니다
  assert.equal(findByInbound('개화동로 11길 5 YS-ECOM 박하노')?.id, a.id, '"YS-ECOM 이름" 형식 매칭')
  assert.equal(findByInbound('YS-ECOM(박하노)')?.id, a.id, '괄호 형식도 매칭')

  mk('박하노', '29000222222222') // 동명 주문이 하나 더 운송 중이면
  assert.equal(findByInbound('받는사람: 박하노 / 서울 김포창고'), null, '애매하면 사람에게 넘겨야 합니다')
})

test('입고 안내: 배송대행 고객에게만, 창고 도착 전까지만 보인다', () => {
  const f = customerView(forwardingOrder())
  assert.ok(f.forwardingGuide, '배송대행 주문에는 안내가 있어야 합니다')
  // 파트너 규격: 이름 칸은 코드(YS-ECOM), 상세주소가 "YS-ECOM 이름"
  assert.equal(f.forwardingGuide.recipient, 'YS-ECOM')
  assert.equal(f.forwardingGuide.addressDetail, 'YS-ECOM 김하노')
  assert.ok(f.forwardingGuide.warehouse.address1.includes('개화동로'), '확정 주소가 기본값이어야 합니다')
  assert.equal(f.forwardingGuide.warehouse.zip, '07504')
  assert.equal(f.forwardingGuide.warehouse.configured, true)
  assert.equal(f.forwardingGuide.linked, false)

  assert.equal(customerView(agentOrder()).forwardingGuide, null, '구매대행에는 안내가 없어야 합니다')

  let o = confirmPayment(forwardingOrder().id, { confirmedBy: 'op' })
  o = linkInbound(o.id, { coupangOrderNo: '29000111111111' })
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG })
  assert.equal(customerView(o).forwardingGuide, null, '입고 후에는 안내가 사라져야 합니다')
})
