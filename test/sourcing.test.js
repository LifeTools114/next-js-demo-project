import test from 'node:test'
import assert from 'node:assert/strict'
import { detectSourcing, estimateSchedule, analyzeSourcing } from '../lib/sourcing.js'
import { recordWeighing, createOrder, confirmPayment, startPurchase, recordPurchase, orderView, customerView, _reset } from '../lib/order/store.js'

test.beforeEach(() => _reset())

test('배지로 조달 경로를 판별한다', () => {
  assert.equal(detectSourcing({ productName: '토리든 세럼', badges: ['로켓배송'] }).overseas, false)
  assert.equal(detectSourcing({ productName: '나이키', badges: ['로켓직구'] }).id, 'rocket-global')
  assert.equal(detectSourcing({ productName: '비타민', badges: ['해외직구'] }).id, 'overseas-seller')
})

test('배송 문구로도 해외직구를 잡는다', () => {
  const s = detectSourcing({ productName: '샤오미 공기청정기', shippingText: '해외배송 · 통관번호 필요' })
  assert.equal(s.overseas, true)
  assert.equal(s.id, 'overseas-seller')
})

test('판매자 해외배송이 로켓직구보다 우선 판별된다', () => {
  // 둘 다 걸리면 조건이 나쁜 쪽을 택해야 안전합니다.
  const s = detectSourcing({ productName: 'x', badges: ['로켓직구', '해외직구'] })
  assert.equal(s.id, 'overseas-seller')
})

test('일정은 쿠팡→창고 + 창고→하노이 두 구간을 합산한다', () => {
  const domestic = estimateSchedule([detectSourcing({ productName: '세럼', badges: ['로켓배송'] })])
  assert.equal(domestic.totalDays.min, 1 + 5)
  assert.equal(domestic.totalDays.max, 3 + 9)
  assert.equal(domestic.hasOverseas, false)
})

test('해외직구가 섞이면 전체 일정이 크게 늘어난다', () => {
  const a = analyzeSourcing([
    { productName: '토리든 세럼', badges: ['로켓배송'] },
    { productName: '해외직구 비타민', badges: ['해외직구'] },
  ])
  assert.equal(a.hasOverseas, true)
  // 가장 늦게 도착하는 상품이 전체 일정을 결정합니다.
  assert.equal(a.schedule.toWarehouseDays.max, 21)
  assert.equal(a.schedule.totalDays.max, 21 + 9)
  assert.ok(a.warnings.length > 0)
  assert.equal(a.requiresRecheck, true)
})

test('판매자 해외배송은 합배송에서 제외한다', () => {
  // 묶으면 다른 주문까지 3주를 기다리게 됩니다.
  const a = analyzeSourcing([
    { productName: '해외직구 비타민', badges: ['해외직구'] },
    { productName: '토리든 세럼', badges: ['로켓배송'] },
  ])
  assert.deepEqual(a.excludeFromConsolidation, ['해외직구 비타민'])
})

test('국내 상품만 있으면 재점검이 필요 없다', () => {
  const a = analyzeSourcing([{ productName: '토리든 세럼', badges: ['로켓배송'] }])
  assert.equal(a.requiresRecheck, false)
  assert.equal(a.notice, null)
})

// ─────────── 입고 재점검 ───────────

const overseasOrder = () =>
  createOrder({
    items: [{ productName: '해외직구 비타민 D3', productPrice: 45000, quantity: 1, badges: ['해외직구'] }],
    zone: 'hanoi',
    track: 'agent',
    customer: { name: 'Mai', phone: '090', address: 'Hanoi' },
  })

const advanceToWarehouse = (o) => {
  confirmPayment(o.id, { confirmedBy: 'admin' })
  startPurchase(o.id, 'admin')
  recordPurchase(o.id, { coupangOrderNo: 'CP-1', amountKrw: 45000 })
  return o
}

test('해외직구 주문은 재점검 없이 실측 등록을 막는다', () => {
  const o = advanceToWarehouse(overseasOrder())
  assert.throws(() => recordWeighing(o.id, { actualWeightG: 300 }), /해외직구/)
})

test('재점검을 확인하면 실측이 등록되고 추가 비용이 원장에 잡힌다', () => {
  const o = advanceToWarehouse(overseasOrder())
  recordWeighing(o.id, {
    actualWeightG: 300,
    by: 'admin',
    recheck: { confirmed: true, productMatches: true, extraCostKrw: 12000 },
  })
  const v = orderView(o)
  // 실측이 정산까지 자동 연쇄되므로 IN_WAREHOUSE 에 머물지 않습니다.
  assert.ok(['SETTLED', 'SETTLEMENT_DUE'].includes(v.state), `정산까지 자동 진행돼야 합니다 (현재 ${v.state})`)
  assert.equal(v.recheck.extraCostKrw, 12000)
  assert.ok(v.ledgerSummary.disbursedByType.OTHER === 12000, '추가 비용이 매입 원장에 잡혀야 합니다')
})

test('국내 상품 주문은 재점검 없이도 실측이 등록된다', () => {
  const o = createOrder({
    items: [{ productName: '토리든 세럼 50ml', productPrice: 19900, quantity: 1, badges: ['로켓배송'] }],
    zone: 'hanoi', track: 'agent', customer: { name: 'Mai', phone: '090', address: 'Hanoi' },
  })
  advanceToWarehouse(o)
  recordWeighing(o.id, { actualWeightG: 140, by: 'admin' })
  assert.ok(['SETTLED', 'SETTLEMENT_DUE'].includes(orderView(o).state), '재점검 없이 실측·정산이 진행돼야 합니다')
})

test('고객 뷰에는 재점검 사실만 보이고 내부 금액은 안 보인다', () => {
  const o = advanceToWarehouse(overseasOrder())
  recordWeighing(o.id, {
    actualWeightG: 300, by: 'admin-kim',
    recheck: { confirmed: true, productMatches: true, extraCostKrw: 12000, note: '내부 메모' },
  })
  const json = JSON.stringify(customerView(o))
  assert.ok(json.includes('recheck'), '재점검 사실은 보여야 합니다')
  for (const secret of ['12000', 'admin-kim', '내부 메모', 'extraCostKrw']) {
    assert.ok(!json.includes(secret), `고객 뷰에 '${secret}' 이 노출되면 안 됩니다`)
  }
})
