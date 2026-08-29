import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, startPurchase, recordPurchase, recordWeighing,
  markShipped, getOrder, customerView, _reset,
} from '../lib/order/store.js'
import { parseCommand, findOrderFromText, trackingTokenFrom } from '../lib/telegram/inbound.js'
import { handlePartnerMessage } from '../lib/telegram/handle.js'

const forwardingPaid = (name = '박하노', coupangNo = '29000111111111') => {
  const o = createOrder({
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'forwarding',
    customer: { name, phone: '0912', address: 'Hanoi' },
    coupangOrderNo: coupangNo,
  })
  return confirmPayment(o.id, { confirmedBy: 'op' }) // → PURCHASED (연결돼 있으므로)
}

test.beforeEach(() => _reset())

// ─────────────── 메시지 해석 ───────────────

test('텔레그램 해석: 파트너의 네 가지 확인을 모두 알아듣는다', () => {
  assert.deepEqual(parseCommand('K-ECOM(박하노) 1.42kg'), { action: 'weigh', weightG: 1420 })
  assert.deepEqual(parseCommand('HN2609010001 1420g 입고'), { action: 'weigh', weightG: 1420 })
  assert.equal(parseCommand('HN2609010001 하노이 도착').milestone, '하노이 도착')
  assert.equal(parseCommand('통관 진행중 HN2609010001').milestone, '통관 진행 중')
  assert.deepEqual(parseCommand('배송일정 HN2609010001 9/3 오전'), { action: 'schedule', scheduleText: 'HN2609010001 9/3 오전' })
  assert.equal(parseCommand('배달완료 HN2609010001').action, 'delivered')
  assert.equal(parseCommand('안녕하세요~').action, null, '잡담은 무시해야 합니다')
})

test('텔레그램 해석: 운송장 토큰을 뽑는다', () => {
  assert.equal(trackingTokenFrom('입고 689012345678 1.2kg'), '689012345678')
  assert.equal(trackingTokenFrom('무게만 1.2kg'), null)
})

// ─────────────── 실행 ───────────────

test('텔레그램 입고: 한 줄 메시지로 실측·정산까지 끝난다', () => {
  const o = forwardingPaid('박하노')
  const chargeable = o.quote.weight.chargeableG

  const r = handlePartnerMessage(`K-ECOM(박하노) ${(chargeable / 1000).toFixed(2)}kg`)
  assert.equal(r.ok, true)
  assert.ok(r.reply.includes(o.orderNo))

  const after = getOrder(o.id)
  assert.equal(after.state, 'SETTLED', '허용오차 이내면 정산 완료까지 자동이어야 합니다')
  assert.equal(after.history.at(-2)?.by ?? after.history.at(-1)?.by, 'telegram:partner')
})

test('텔레그램 현황·일정·배달완료: 고객 위치 표시로 이어진다', () => {
  let o = forwardingPaid('김하노', '29000222222222')
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG })
  o = markShipped(o.id, { trackingNo: 'HAN-260901-01', by: 'op' })

  assert.equal(handlePartnerMessage(`${o.orderNo} 하노이 도착`).ok, true)
  assert.equal(handlePartnerMessage(`배송일정 ${o.orderNo} 9/3 오전 중`).ok, true)

  const v = customerView(getOrder(o.id))
  assert.equal(v.delivery.scheduledText, `${o.orderNo} 9/3 오전 중`.replace(`${o.orderNo} `, `${o.orderNo} `))
  assert.ok(v.delivery.milestones.some((m) => m.label === '하노이 도착'))
  assert.ok(v.delivery.milestones.some((m) => m.label.includes('배달 예정')))

  assert.equal(handlePartnerMessage(`배달완료 ${o.orderNo}`).ok, true)
  assert.equal(getOrder(o.id).state, 'DELIVERED')
})

test('텔레그램 안전장치: 주문 못 찾으면 안내, 잘못된 상태면 오류 회신', () => {
  const miss = handlePartnerMessage('K-ECOM(없는사람) 1.2kg')
  assert.equal(miss.ok, false)
  assert.ok(miss.reply.includes('찾지 못했습니다'))

  // 아직 발송 전인 주문의 배달완료 — 상태 머신이 거부하고 사유를 회신
  const o = forwardingPaid('이하노', '29000333333333')
  const bad = handlePartnerMessage(`배달완료 ${o.orderNo}`)
  assert.equal(bad.ok, false)
  assert.ok(bad.reply.includes('처리 실패'))
  assert.equal(getOrder(o.id).state, 'PURCHASED', '상태가 바뀌면 안 됩니다')
})

test('텔레그램 고객뷰: 매입 정보는 여전히 숨겨진다', () => {
  let o = createOrder({
    items: [{ productName: '토리든 세럼 50ml', productPrice: 25000, quantity: 1 }],
    zone: 'hanoi', track: 'agent',
    customer: { name: 'Mai', phone: '0912', address: 'Hanoi' },
  })
  o = confirmPayment(o.id, { confirmedBy: 'op' })
  o = startPurchase(o.id, 'op')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-SECRET-9', amountKrw: 30000 })
  handlePartnerMessage(`Mai ${(o.quote.weight.chargeableG / 1000).toFixed(2)}kg`)

  const json = JSON.stringify(customerView(getOrder(o.id)))
  assert.ok(!json.includes('CP-SECRET-9'), '고객 delivery 공개에 매입 정보가 섞이면 안 됩니다')
})
