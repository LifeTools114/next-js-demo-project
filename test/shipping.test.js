import test from 'node:test'
import assert from 'node:assert/strict'
import { toBillableKg, findTier, calculateShipping, getRateTable } from '../lib/pricing/shipping.js'
import { quote, calculateAgencyFee, calculateTaxes, krwToVnd } from '../lib/pricing/landed.js'
import { SHIPPING } from '../config/shipping.js'

test('청구무게: 0.5kg 단위로 올림한다', () => {
  assert.equal(toBillableKg(100), 0.5) // 최소 청구무게
  assert.equal(toBillableKg(500), 0.5)
  assert.equal(toBillableKg(501), 1.0)
  assert.equal(toBillableKg(1000), 1.0)
  assert.equal(toBillableKg(1001), 1.5)
  assert.equal(toBillableKg(2600), 3.0)
})

test('청구무게: 부동소수 오차로 한 단계가 더 올라가지 않는다', () => {
  // 1500g 은 정확히 1.5kg 이므로 2.0kg 이 되면 안 됩니다.
  assert.equal(toBillableKg(1500), 1.5)
  assert.equal(toBillableKg(2500), 2.5)
  assert.equal(toBillableKg(3000), 3.0)
})

test('요율 구간: 경계값은 낮은 구간에 속한다', () => {
  assert.equal(findTier(2).ratePerKg, 13000)
  assert.equal(findTier(2.5).ratePerKg, 11500)
  assert.equal(findTier(5).ratePerKg, 11500)
  assert.equal(findTier(5.5).ratePerKg, 10000)
  assert.equal(findTier(100).ratePerKg, 8200)
})

test('배송비: 1kg당 요율 × 청구무게', () => {
  const r = calculateShipping(1200) // 1.5kg 로 올림
  assert.equal(r.billableKg, 1.5)
  assert.equal(r.ratePerKg, 13000)
  assert.equal(r.freight, 19500)
  assert.equal(r.total, 19500) // 하노이 시내는 할증 없음
})

test('배송비: 지역 할증이 더해진다', () => {
  const inner = calculateShipping(1000, { zone: 'hanoi-inner' })
  const outer = calculateShipping(1000, { zone: 'hanoi-outer' })
  assert.equal(outer.total - inner.total, SHIPPING.zones['hanoi-outer'].surcharge)
})

test('배송비: 알 수 없는 지역은 기본 지역으로 처리한다', () => {
  const r = calculateShipping(1000, { zone: 'nowhere' })
  assert.equal(r.zoneSurcharge, SHIPPING.zones[SHIPPING.defaultZone].surcharge)
})

test('배송비: 위험물 할증이 반영된다', () => {
  const r = calculateShipping(1000, { restrictionSurchargeKrw: 16000 })
  assert.equal(r.restrictionSurcharge, 16000)
  assert.equal(r.total, r.freight + 16000)
})

test('요율표: 모든 구간이 노출된다', () => {
  const table = getRateTable()
  assert.equal(table.length, SHIPPING.tiers.length)
  assert.equal(table[0].fromKg, 0)
  assert.ok(table.every((row) => row.ratePerKg > 0))
})

test('대행 수수료: 최소 금액과 면제 기준이 적용된다', () => {
  assert.equal(calculateAgencyFee(10000).fee, 5000) // 8% = 800 < 최소 5000
  assert.equal(calculateAgencyFee(100000).fee, 8000)
  assert.equal(calculateAgencyFee(600000).waived, true)
  assert.equal(calculateAgencyFee(600000).fee, 0)
})

test('세금: 과세표준은 CIF(상품가+운임)이며 VAT는 관세 위에 부과된다', () => {
  const t = calculateTaxes(100000, 20000)
  assert.equal(t.cif, 120000)
  assert.equal(t.duty, 12000) // 120000 × 10%
  assert.equal(t.vat, 13200) // (120000 + 12000) × 10%
  assert.equal(t.total, 25200)
})

test('세금: 면세 한도가 폐지되어 소액도 과세된다', () => {
  const t = calculateTaxes(5000, 6500)
  assert.equal(t.exempt, false)
  assert.ok(t.total > 0)
})

test('견적: 항목 합계가 총액과 일치한다', () => {
  const q = quote([
    { productName: '토리든 다이브인 세럼 50ml', productPrice: 19900, quantity: 2 },
    { productName: '메디힐 마스크팩 10매', productPrice: 12900, quantity: 1 },
  ])
  const sum = q.breakdown.reduce((s, row) => s + row.krw, 0)
  assert.equal(sum, q.total)
  assert.equal(q.itemCount, 3)
  assert.ok(q.totalVnd > 0)
})

test('견적: 정산 범위가 총액을 포함한다', () => {
  const q = quote([{ productName: '닥터지 수딩 크림', productPrice: 24000, quantity: 3 }])
  assert.ok(q.range.low <= q.total)
  assert.ok(q.range.high >= q.total)
})

test('견적: 빈 장바구니는 0원이다', () => {
  const q = quote([])
  assert.equal(q.goods, 0)
  assert.equal(q.itemCount, 0)
  assert.equal(q.weight.chargeableG, 0)
})

test('환율: VND는 1,000 단위로 반올림된다', () => {
  assert.equal(krwToVnd(100000) % 1000, 0)
  assert.ok(krwToVnd(100000) > 0)
})

test('견적 명세: 배송 할증이 별도 항목으로 분리된다', () => {
  // 향수(알코올) + 외곽 지역 → 기본운임/지역할증/위험물할증이 각각 보여야 합니다.
  // 합산만 표시하면 "2kg × 13,000원인데 왜 34,000원?" 같은 분쟁이 생깁니다.
  const q = quote([{ productName: '조말론 코롱 100ml', productPrice: 98000, quantity: 1 }], {
    zone: 'hanoi-outer',
  })
  const keys = q.breakdown.map((r) => r.key)
  assert.ok(keys.includes('freight'), '기본 운임 항목이 있어야 합니다')
  assert.ok(keys.includes('zone'), '지역 할증 항목이 있어야 합니다')
  assert.ok(keys.includes('restriction'), '위험물 할증 항목이 있어야 합니다')

  const find = (k) => q.breakdown.find((r) => r.key === k).krw
  assert.equal(find('freight'), q.shipping.freight)
  assert.equal(find('zone'), q.shipping.zoneSurcharge)
  assert.equal(find('restriction'), q.shipping.restrictionSurcharge)
  assert.equal(find('freight') + find('zone') + find('restriction'), q.shipping.total)

  // 명세 합계는 여전히 총액과 일치해야 합니다.
  assert.equal(q.breakdown.reduce((s, r) => s + r.krw, 0), q.total)
})

test('견적 명세: 할증이 없으면 해당 항목이 표시되지 않는다', () => {
  const q = quote([{ productName: '토리든 세럼 50ml', productPrice: 19900, quantity: 1 }], {
    zone: 'hanoi-inner',
  })
  const keys = q.breakdown.map((r) => r.key)
  assert.ok(keys.includes('freight'))
  assert.ok(!keys.includes('zone'), '할증 0원이면 항목이 숨겨져야 합니다')
  assert.ok(!keys.includes('restriction'))
})
