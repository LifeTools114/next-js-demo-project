import test from 'node:test'
import assert from 'node:assert/strict'
import { toBillableKg, calculateShipping, getRateTable, usdToKrw } from '../lib/pricing/shipping.js'
import { quote, calculateAgencyFee, calculateTaxes, krwToVnd, TRACK } from '../lib/pricing/landed.js'
import { compareConsolidation } from '../lib/consolidation.js'
import { SHIPPING } from '../config/shipping.js'
import { FEES } from '../config/fees.js'

test('청구무게: 0.5kg 단위로 올림한다', () => {
  assert.equal(toBillableKg(100), 0.5) // 최소 청구무게
  assert.equal(toBillableKg(500), 0.5)
  assert.equal(toBillableKg(501), 1.0)
  assert.equal(toBillableKg(1000), 1.0)
  assert.equal(toBillableKg(1001), 1.5)
  assert.equal(toBillableKg(2600), 3.0)
})

test('청구무게: 부동소수 오차로 한 단계가 더 올라가지 않는다', () => {
  assert.equal(toBillableKg(1500), 1.5)
  assert.equal(toBillableKg(2500), 2.5)
  assert.equal(toBillableKg(3000), 3.0)
})

test('배송비: kg당 $9 정액 × 청구무게', () => {
  const r = calculateShipping(1200) // 1.5kg 로 올림
  assert.equal(r.billableKg, 1.5)
  assert.equal(r.ratePerKgUsd, 9)
  assert.equal(r.freightUsd, 13.5)
  assert.equal(r.totalUsd, 13.5)
  assert.equal(r.totalKrw, usdToKrw(13.5))
})

test('배송비: 구간 없이 무게에 정비례한다', () => {
  const a = calculateShipping(1000).totalUsd
  const b = calculateShipping(2000).totalUsd
  assert.equal(b, a * 2)
})

test('배송비: 지역 할증이 USD 로 더해진다', () => {
  const inner = calculateShipping(1000, { zone: 'hanoi-inner' })
  const outer = calculateShipping(1000, { zone: 'hanoi-outer' })
  assert.equal(outer.totalUsd - inner.totalUsd, SHIPPING.zones['hanoi-outer'].surchargeUsd)
})

test('배송비: 알 수 없는 지역은 기본 지역으로 처리한다', () => {
  const r = calculateShipping(1000, { zone: 'nowhere' })
  assert.equal(r.zoneSurchargeUsd, SHIPPING.zones[SHIPPING.defaultZone].surchargeUsd)
})

test('요금표: 모든 구간이 양수다', () => {
  const table = getRateTable()
  assert.ok(table.length > 0)
  assert.ok(table.every((r) => r.usd > 0 && r.krw > 0))
})

test('대행 수수료: 구매대행에만 붙고 10%다', () => {
  assert.equal(calculateAgencyFee(100000, TRACK.AGENT).fee, 10000)
  assert.equal(calculateAgencyFee(100000, TRACK.FORWARDING).fee, 0)
  assert.equal(calculateAgencyFee(100000, TRACK.FORWARDING).applicable, false)
  // 최소 수수료
  assert.equal(calculateAgencyFee(10000, TRACK.AGENT).fee, FEES.agencyMinKrw)
})

test('세금: 품목군별 관세율이 적용된다', () => {
  // 신발 30% vs 일반 10% — 같은 금액이라도 관세가 다릅니다.
  const shoes = calculateTaxes([{ productName: '나이키 운동화 270', productPrice: 100000, quantity: 1 }], 0)
  const misc = calculateTaxes([{ productName: '알 수 없는 물건', productPrice: 100000, quantity: 1 }], 0)
  assert.equal(shoes.duty, 30000)
  assert.equal(misc.duty, 10000)
  assert.ok(shoes.extraDutyKrw > 0)
  assert.equal(misc.extraDutyKrw, 0)
})

test('세금: VAT 는 관세 위에 부과된다', () => {
  const t = calculateTaxes([{ productName: '알 수 없는 물건', productPrice: 100000, quantity: 1 }], 20000)
  assert.equal(t.cif, 120000)
  assert.equal(t.duty, 12000)
  assert.equal(t.vat, 13200) // (120000 + 12000) × 10%
})

test('세금: 면세 한도가 폐지되어 소액도 과세된다', () => {
  const t = calculateTaxes([{ productName: '소액 물건', productPrice: 5000, quantity: 1 }], 6500)
  assert.equal(t.exempt, false)
  assert.ok(t.total > 0)
})

test('견적: 배송대행은 상품가를 청구하지 않지만 과세표준에는 포함한다', () => {
  const items = [{ productName: '토리든 세럼 50ml', productPrice: 19900, quantity: 2 }]
  const fw = quote(items, { track: TRACK.FORWARDING })
  const ag = quote(items, { track: TRACK.AGENT })

  assert.equal(fw.goodsChargedToCustomer, false)
  assert.equal(ag.goodsChargedToCustomer, true)
  assert.ok(!fw.breakdown.some((r) => r.key === 'goods'), '배송대행 명세에 상품가가 없어야 합니다')
  assert.ok(ag.breakdown.some((r) => r.key === 'goods'))

  // 상품가를 청구하지 않아도 관세는 같습니다 (CIF 에 포함되므로)
  assert.equal(fw.taxes.duty, ag.taxes.duty)
  assert.ok(fw.total < ag.total)
})

test('견적: 명세 합계가 총액과 일치한다', () => {
  const q = quote(
    [
      { productName: '토리든 세럼 50ml', productPrice: 19900, quantity: 2 },
      { productName: '농심 신라면 5개입', productPrice: 4500, quantity: 1 },
    ],
    { track: TRACK.AGENT },
  )
  assert.equal(q.breakdown.reduce((s, r) => s + r.krw, 0), q.total)
})

test('견적: 제휴 수수료는 배송대행에만 잡힌다', () => {
  const items = [{ productName: '토리든 세럼 50ml', productPrice: 100000, quantity: 1 }]
  assert.equal(quote(items, { track: TRACK.FORWARDING }).affiliate.applicable, true)
  assert.equal(quote(items, { track: TRACK.AGENT }).affiliate.applicable, false)
  assert.equal(quote(items, { track: TRACK.AGENT }).affiliate.estimatedKrw, 0)
})

test('견적: 배송 불가 상품이 있으면 표시된다', () => {
  const q = quote([{ productName: '조말론 코롱 100ml', productPrice: 98000, quantity: 1 }], { track: TRACK.AGENT })
  assert.equal(q.eligibility.shippable, false)
  assert.equal(q.eligibility.blocked.length, 1)
})

test('견적: 빈 장바구니는 0원이다', () => {
  const q = quote([])
  assert.equal(q.goods, 0)
  assert.equal(q.itemCount, 0)
})

test('환율: VND 는 1,000 단위로 반올림된다', () => {
  assert.equal(krwToVnd(100000) % 1000, 0)
})

test('합배송: 여러 건을 묶으면 청구무게가 줄어든다', () => {
  const c = compareConsolidation([
    { orderNo: 'A', items: [{ productName: '토리든 세럼 50ml', quantity: 2 }] },
    { orderNo: 'B', items: [{ productName: '메디힐 마스크팩 10매', quantity: 2 }] },
    { orderNo: 'C', items: [{ productName: '라운드랩 선크림 50ml', quantity: 3 }] },
  ])
  assert.ok(c.consolidated.billableKg < c.separate.billableKg, '합배송 청구무게가 더 작아야 합니다')
  assert.ok(c.savingsUsd > 0)
  assert.equal(c.worthwhile, true)
})

test('합배송: 한 건만 있으면 취급비 때문에 이득이 아니다', () => {
  const c = compareConsolidation([{ orderNo: 'A', items: [{ productName: '토리든 세럼 50ml', quantity: 1 }] }])
  assert.equal(c.worthwhile, false, '단건 합배송은 취급비만 더 듭니다')
})
