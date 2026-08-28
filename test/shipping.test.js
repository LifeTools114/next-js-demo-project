import test from 'node:test'
import assert from 'node:assert/strict'
import { toBillableKg, calculateShipping, getRateTable, usdToKrw } from '../lib/pricing/shipping.js'
import { quote, calculateAgencyFee, calculateTaxes, krwToVnd, TRACK } from '../lib/pricing/landed.js'
import { compareConsolidation } from '../lib/consolidation.js'
import { SHIPPING } from '../config/shipping.js'
import { FEES } from '../config/fees.js'

test('청구무게: 1kg 단위로 올림하고 최소 1kg 이다', () => {
  // ~1kg 은 1kg, 1~2kg 은 2kg 청구
  assert.equal(toBillableKg(100), 1) // 최소 청구무게
  assert.equal(toBillableKg(500), 1)
  assert.equal(toBillableKg(999), 1)
  assert.equal(toBillableKg(1000), 1, '정확히 1kg 은 1kg 청구')
  assert.equal(toBillableKg(1001), 2, '1kg 을 넘으면 2kg')
  assert.equal(toBillableKg(2000), 2)
  assert.equal(toBillableKg(2001), 3)
})

test('청구무게: 부동소수 오차로 한 단계가 더 올라가지 않는다', () => {
  // 정확히 경계값인 무게가 다음 구간으로 넘어가면 매번 1kg 을 더 청구하게 됩니다.
  for (const kg of [1, 2, 3, 5, 10, 20]) {
    assert.equal(toBillableKg(kg * 1000), kg, `${kg}kg 이 그대로여야 합니다`)
  }
})

test('청구무게: 경쟁사보다 최소 단위가 작다', () => {
  // 경쟁사(Giaonhan247)는 최소 2kg 을 청구합니다.
  // 소액·경량 주문에서 우리가 우위를 갖는 근거입니다.
  assert.ok(SHIPPING.minBillableKg < 2)
  assert.equal(toBillableKg(300), 1)
})

test('배송비: kg당 $9 정액 × 청구무게', () => {
  const r = calculateShipping(1200) // 2kg 로 올림
  assert.equal(r.billableKg, 2)
  assert.equal(r.ratePerKgUsd, 9)
  assert.equal(r.freightUsd, 18)
  assert.equal(r.totalUsd, 18)
  assert.equal(r.totalKrw, usdToKrw(18))
})

test('배송비: 구간 없이 무게에 정비례한다', () => {
  const a = calculateShipping(1000).totalUsd
  const b = calculateShipping(2000).totalUsd
  assert.equal(b, a * 2)
})

test('서비스 지역: 현재 하노이 시내 단일이며 할증이 없다', () => {
  // 물류사가 하노이만 연결되어 있는 파일럿 구성입니다.
  assert.deepEqual(Object.keys(SHIPPING.zones), ['hanoi'])
  assert.equal(SHIPPING.zones.hanoi.surchargeUsd, 0)
  assert.equal(SHIPPING.defaultZone, 'hanoi')
  assert.ok(SHIPPING.serviceAreaNotice.includes('하노이'))
})

test('배송비: 지역 할증 메커니즘은 유지된다 (지역 확대 대비)', () => {
  // 커버리지가 넓어져 zones 에 지역을 추가하면 할증이 자동으로 붙어야 합니다.
  SHIPPING.zones['test-outer'] = { label: '테스트 외곽', surchargeUsd: 3 }
  try {
    const base = calculateShipping(1000, { zone: SHIPPING.defaultZone })
    const surcharged = calculateShipping(1000, { zone: 'test-outer' })
    assert.equal(surcharged.totalUsd - base.totalUsd, 3)
    assert.equal(surcharged.totalKrw - base.totalKrw, usdToKrw(3))
  } finally {
    delete SHIPPING.zones['test-outer']
  }
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


// ─────────── 상품 할증 ───────────

test('상품 할증: 파손주의 품목에 수량 비례 취급비가 붙는다', () => {
  const q = quote(
    [{ productName: '광주요 도자기 그릇세트 4인용', productPrice: 89000, quantity: 2 }],
    { track: TRACK.FORWARDING },
  )
  const row = q.breakdown.find((r) => r.key === 'surcharge-fragile')
  assert.ok(row, '파손주의 할증 행이 있어야 합니다')
  assert.equal(row.usd, 4, '개당 $2 × 2개')
  assert.equal(q.breakdown.reduce((s, r) => s + r.krw, 0), q.total, '명세 합계는 총액과 일치해야 합니다')
})

test('상품 할증: 10kg 이상 품목에 대형 취급비가 붙는다', () => {
  const q = quote([{ productName: '이천쌀 20kg', productPrice: 65000, quantity: 1 }], { track: TRACK.FORWARDING })
  assert.ok(q.breakdown.some((r) => r.key === 'surcharge-bulky'))
  assert.equal(q.itemSurcharges.rows.find((r) => r.id === 'bulky').usd, 5)
})

test('상품 할증: 일반 화장품 유리용기에는 붙지 않는다', () => {
  // 크림 유리단지는 업계 표준 포장 — 가장 흔한 품목에 할증하면 견적만 부풀립니다.
  const q = quote(
    [{ productName: '아이소이 블레미쉬 케어 크림 50ml', productPrice: 32000, quantity: 3 }],
    { track: TRACK.FORWARDING },
  )
  assert.ok(!q.breakdown.some((r) => r.key.startsWith('surcharge-')), '화장품에 할증이 붙으면 안 됩니다')
  assert.equal(q.itemSurcharges.totalUsd, 0)
})

test('상품 할증: 관세 과세표준(CIF)에 포함된다', () => {
  // 할증은 운임의 일부이므로 세관 과세표준에 들어갑니다.
  const withSurcharge = quote(
    [{ productName: '광주요 도자기 그릇세트', productPrice: 100000, quantity: 1 }],
    { track: TRACK.FORWARDING },
  )
  assert.equal(
    withSurcharge.taxes.cif,
    100000 + withSurcharge.shipping.totalKrw + withSurcharge.itemSurcharges.totalKrw,
    'CIF = 상품가 + 운임 + 상품할증',
  )
})

test('정산 허용오차: 1kg 단위 올림이 작은 오차를 흡수한다', () => {
  // 실측이 조금 달라도 같은 kg 구간이면 배송비가 변하지 않습니다.
  // 이 성질 덕분에 대부분의 주문은 차액 정산 없이 끝납니다.
  assert.equal(toBillableKg(1200), toBillableKg(1800), '1.2kg 과 1.8kg 은 같은 2kg 구간')
  assert.notEqual(toBillableKg(1800), toBillableKg(2200), '2kg 을 넘으면 구간이 바뀜')
})
