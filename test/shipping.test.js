import test from 'node:test'
import assert from 'node:assert/strict'
import { toBillableKg, calculateShipping, getRateTable, usdToKrw, roundingRuleText } from '../lib/pricing/shipping.js'
import { quote, calculateAgencyFee, calculateTaxes, krwToVnd, TRACK } from '../lib/pricing/landed.js'
import { compareConsolidation } from '../lib/consolidation.js'
import { SHIPPING } from '../config/shipping.js'
import { FEES, ORDER_MIN } from '../config/fees.js'
import { TAXES } from '../config/taxes.js'

/** 세율표 보존 검증용 — 미징수 스위치를 잠깐 켜고 계산을 확인합니다 */
const withTaxes = (fn) => {
  TAXES.collect = true
  try { fn() } finally { TAXES.collect = false }
}

test('청구무게: 정수 kg — 소수 0.5 이하 버림·초과 올림 (운영자 확정, 업체와 동일)', () => {
  assert.equal(toBillableKg(100), 1, '최소 청구무게')
  assert.equal(toBillableKg(999), 1)
  assert.equal(toBillableKg(1000), 1, '정확히 1kg 은 1kg')
  assert.equal(toBillableKg(1300), 1, '소수 0.3 은 버림')
  assert.equal(toBillableKg(1500), 1, '소수 0.5 는 버림 (경계는 고객 유리)')
  assert.equal(toBillableKg(1501), 2, '0.5 초과는 올림')
  assert.equal(toBillableKg(2000), 2)
  assert.equal(toBillableKg(2500), 2)
  assert.equal(toBillableKg(2501), 3)
  assert.equal(toBillableKg(3400), 3)
  assert.equal(toBillableKg(3600), 4)
  assert.equal(toBillableKg(10100), 10)
})

test('여유 무게: 청구 경계까지 남은 g 을 알려준다', () => {
  // 400g 담아도 1kg 요금이고, 1.5kg 까지 같은 요금 → 1100g 여유
  assert.equal(calculateShipping(400).headroomG, 1100)
  // 2.3kg → 2kg 요금, 2.5kg 까지 동일 → 200g 여유
  assert.equal(calculateShipping(2300).headroomG, 200)
  // 정확히 경계(2.5kg)면 여유 없음
  assert.equal(calculateShipping(2500).headroomG, 0)
  // 경계 직후는 다음 경계(3.5kg)까지 통째로 여유
  assert.equal(calculateShipping(2501).headroomG, 999)
  // 여유만큼 더 담아도 배송비가 정말 같은지 (경계 전 구간 전수 확인)
  for (const g of [400, 1500, 2300, 4700]) {
    const s = calculateShipping(g)
    assert.equal(calculateShipping(g + s.headroomG).freightUsd, s.freightUsd, `${g}g + 여유`)
    if (s.headroomG > 0) {
      assert.notEqual(calculateShipping(g + s.headroomG + 1).freightUsd, s.freightUsd, `${g}g 여유 초과`)
    }
  }
})

test('청구무게: 반내림 경계가 대칭이다 (x.5 까지 x, 그 위는 x+1)', () => {
  for (const k of [1, 2, 5, 10]) {
    assert.equal(toBillableKg(k * 1000 + 500), k, `${k}.5kg 은 ${k}kg`)
    assert.equal(toBillableKg(k * 1000 + 501), k + 1, `${k}.501kg 은 ${k + 1}kg`)
  }
})

test('청구무게: 부동소수 오차로 한 단계가 더 올라가지 않는다', () => {
  for (const kg of [1, 2, 3, 5, 10, 20]) {
    assert.equal(toBillableKg(kg * 1000), kg, `${kg}kg 이 그대로여야 합니다`)
  }
})

test('청구무게: 경쟁사보다 최소 단위가 작다', () => {
  // 경쟁사(Giaonhan247)는 최소 2kg 을 청구합니다.
  // 경량 주문에서 우리가 우위를 갖는 근거입니다.
  assert.ok(SHIPPING.minBillableKg < 2)
  assert.equal(toBillableKg(300), 1)
})

test('청구 규칙 문장이 기본요금과 반내림을 설명한다', () => {
  const text = roundingRuleText()
  assert.match(text, /1kg까지 기본요금/)
  assert.match(text, /0\.5 이하 버림/)
})

test('배송비: kg당 $9 정액 × 청구무게', () => {
  const r = calculateShipping(1600) // 소수 0.6 → 2kg
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

test('대행 수수료: 기본 5,000원 + 10만원 초과분 5% + 5종 초과 종당 1,000원', () => {
  // 배송대행에는 없음
  assert.equal(calculateAgencyFee(100000, TRACK.FORWARDING).fee, 0)
  assert.equal(calculateAgencyFee(100000, TRACK.FORWARDING).applicable, false)
  // 기본 구간 — 상품가 10만원·5종까지는 금액과 무관하게 5,000원
  assert.equal(calculateAgencyFee(10000, TRACK.AGENT, 1).fee, 5000)
  assert.equal(calculateAgencyFee(100000, TRACK.AGENT, 5).fee, 5000)
  // 초과분에만 5% — 경계에서 역전 없이 이어집니다
  assert.equal(calculateAgencyFee(100001, TRACK.AGENT, 1).fee, 5000)   // 초과 1원 × 5% → 반올림 0
  assert.equal(calculateAgencyFee(250000, TRACK.AGENT, 2).fee, 12500)  // 5,000 + 150,000×5%
  assert.equal(calculateAgencyFee(500000, TRACK.AGENT, 1).fee, 25000)  // 5,000 + 400,000×5%
  // 종류 초과 — 노동 보상
  assert.equal(calculateAgencyFee(80000, TRACK.AGENT, 8).fee, 8000)    // 5,000 + 3종×1,000
  assert.equal(calculateAgencyFee(250000, TRACK.AGENT, 7).fee, 14500)  // 5,000 + 7,500 + 2,000
})

test('최소 주문 금액: 기본은 폐지(0) — 소액도 통과, 안내 없음', () => {
  // 운영자 확정 (26-08-29): 진입장벽 제거. 0 이면 어떤 금액도 미달이 아닙니다.
  assert.equal(ORDER_MIN.goodsKrw, 0)
  const small = quote([{ productName: '립밤 4g', productPrice: 8000, quantity: 1 }], { track: TRACK.FORWARDING })
  assert.equal(small.minOrder.met, true)
  assert.equal(small.minOrder.shortfallKrw, 0)
})

test('최소 주문 금액(보존): 금액을 설정하면 미달 판정·부족액이 살아난다', () => {
  ORDER_MIN.goodsKrw = 20000
  try {
    const below = quote([{ productName: '립밤 4g', productPrice: 8000, quantity: 1 }], { track: TRACK.FORWARDING })
    assert.equal(below.minOrder.met, false)
    assert.equal(below.minOrder.shortfallKrw, 12000)
    const above = quote([{ productName: '수분크림 50ml', productPrice: 25000, quantity: 1 }], { track: TRACK.FORWARDING })
    assert.equal(above.minOrder.met, true)
  } finally {
    ORDER_MIN.goodsKrw = 0
  }
})

test('세금: 미징수가 기본 — 관세·VAT·할증 안내가 모두 0/빈값이다', () => {
  // 운영자 확정 (26-08-29): 개인통관·무증빙 채널이라 걷지 않습니다.
  const t = calculateTaxes([{ productName: '나이키 운동화 270', productPrice: 100000, quantity: 1 }], 12420)
  assert.equal(t.duty, 0)
  assert.equal(t.vat, 0)
  assert.equal(t.total, 0)
  assert.deepEqual(t.surcharged, [])
  // 견적 명세에도 세금·결제수수료 줄이 없어야 합니다.
  const q = quote([{ productName: '수분크림 50ml', productPrice: 25000, quantity: 1 }], { track: TRACK.AGENT })
  assert.ok(!q.breakdown.some((r) => ['duty', 'vat', 'payment'].includes(r.key)))
  assert.equal(q.total, 25000 + q.agency.fee + q.shipping.totalKrw)
})

test('세금(보존): 스위치를 켜면 품목군별 관세율·VAT 계산이 살아있다', () => withTaxes(() => {
  // 신발 30% vs 일반 10% — 정책이 되돌아왔을 때를 위한 회귀 방지.
  const shoes = calculateTaxes([{ productName: '나이키 운동화 270', productPrice: 100000, quantity: 1 }], 0)
  const misc = calculateTaxes([{ productName: '알 수 없는 물건', productPrice: 100000, quantity: 1 }], 20000)
  assert.equal(shoes.duty, 30000)
  assert.ok(shoes.extraDutyKrw > 0)
  assert.equal(misc.cif, 120000)
  assert.equal(misc.duty, 12000)
  assert.equal(misc.vat, 13200) // (120000 + 12000) × 10%
  assert.equal(misc.exempt, false)
}))

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

test('정산 허용오차: 청구 구간이 작은 오차를 흡수한다', () => {
  // 실측이 조금 달라도 같은 구간(x−0.5 초과 ~ x+0.5)이면 배송비가 같아 정산이 없습니다.
  assert.equal(toBillableKg(700), toBillableKg(1500), '0.7kg 과 1.5kg 은 같은 1kg 요금')
  assert.notEqual(toBillableKg(1500), toBillableKg(1600), '1.5kg 초과에서 구간이 바뀜')
  assert.equal(toBillableKg(2600), toBillableKg(3400), '2.6kg 과 3.4kg 은 같은 3kg 요금')
  assert.notEqual(toBillableKg(3400), toBillableKg(3600))
})

// ─────────── 확장 → 서버 필드 보존 ───────────

test('입력 정규화: 확장이 보낸 판별 근거를 버리지 않는다', async () => {
  const { normalizeOrderItem } = await import('../lib/order/normalize-items.js')
  const n = normalizeOrderItem({
    productId: '123',
    productName: '농심 신라면 120g 5개입',
    productPrice: 4480,
    quantity: 2,
    specOverride: '600g (120g x 5)',
    categoryPath: '식품 > 라면',
    badges: ['로켓배송'],
    shippingText: '내일 도착',
  })
  // 이 필드들이 사라지면 서버 견적이 확장 패널과 달라집니다.
  assert.equal(n.specOverride, '600g (120g x 5)')
  assert.equal(n.categoryPath, '식품 > 라면')
  assert.deepEqual(n.badges, ['로켓배송'])
  assert.equal(n.shippingText, '내일 도착')
})

test('입력 정규화: 금액·수량은 그대로 믿지 않고 범위를 강제한다', async () => {
  const { normalizeOrderItem } = await import('../lib/order/normalize-items.js')
  assert.equal(normalizeOrderItem({ productPrice: -5000 }).productPrice, 0)
  assert.equal(normalizeOrderItem({ productPrice: 9e12 }).productPrice, 100_000_000)
  assert.equal(normalizeOrderItem({ quantity: 0 }).quantity, 1)
  assert.equal(normalizeOrderItem({ quantity: 99999 }).quantity, 999)
  // 길이 폭탄 방어
  assert.equal(normalizeOrderItem({ productName: 'x'.repeat(9999) }).productName.length, 300)
  assert.equal(normalizeOrderItem({ badges: Array(99).fill('b') }).badges.length, 12)
})

test('견적: 고시정보를 넘기면 서버 계산이 달라진다', () => {
  // 정규화가 specOverride 를 버리면 두 견적이 같아집니다.
  const withSpec = quote(
    [{ productName: '테스트 상품', specOverride: '2500g', productPrice: 50000, quantity: 1 }],
    { track: TRACK.FORWARDING },
  )
  const without = quote(
    [{ productName: '테스트 상품', productPrice: 50000, quantity: 1 }],
    { track: TRACK.FORWARDING },
  )
  assert.ok(withSpec.shipping.billableKg > without.shipping.billableKg, '고시정보가 무게에 반영되어야 합니다')
})

test('견적: 배지를 넘기면 해외직구가 판별된다', () => {
  const overseas = quote(
    [{ productName: '비타민 D3', productPrice: 45000, quantity: 1, badges: ['해외직구'] }],
    { track: TRACK.FORWARDING },
  )
  assert.equal(overseas.sourcing.hasOverseas, true)
  assert.equal(overseas.sourcing.schedule.toWarehouseDays.max, 21)
})

test('구매대행 접수 한도: 견적에 플래그가 실리고 배송대행은 무관하다', () => {
  const over = quote([{ productName: '수분크림 50ml', productPrice: 550000, quantity: 2 }], { track: TRACK.AGENT })
  assert.equal(over.agentLimit.exceeded, true)
  assert.equal(over.agentLimit.maxGoodsKrw, FEES.agentMaxGoodsKrw)
  const under = quote([{ productName: '수분크림 50ml', productPrice: 400000, quantity: 2 }], { track: TRACK.AGENT })
  assert.equal(under.agentLimit.exceeded, false)
  // 배송대행은 상품값을 받지 않으므로 한도 자체가 없습니다.
  const fw = quote([{ productName: '수분크림 50ml', productPrice: 550000, quantity: 2 }], { track: TRACK.FORWARDING })
  assert.equal(fw.agentLimit, null)
})

test('전자기기 할증: 기기당 $40, 액세서리는 제외 (운영자 확정 26-08-30)', () => {
  const q = quote([{ productName: '아이패드 프로 13', productPrice: 500000, quantity: 2 }], { track: TRACK.FORWARDING })
  const row = q.itemSurcharges.rows.find((r) => r.id === 'device')
  assert.ok(row, '기기 할증이 있어야 합니다')
  assert.equal(row.usd, 80) // $40 × 2대
  assert.ok(q.breakdown.some((r) => r.key === 'surcharge-device'))
  const acc = quote([{ productName: '아이패드 케이스 투명', productPrice: 20000, quantity: 1 }], { track: TRACK.FORWARDING })
  assert.ok(!acc.itemSurcharges.rows.some((r) => r.id === 'device'))
})

test('가전 할증: 청소기·드라이기도 기기당 $40, 소모품은 제외', async () => {
  const { detectItemSurcharges } = await import('../lib/pricing/surcharges.js')
  const vac = detectItemSurcharges([
    { productName: 'MIFAN 무선 UV 살균 침대 이불 침구 청소기', quantity: 1 },
  ])
  assert.equal(vac.rows.length, 1)
  assert.equal(vac.rows[0].id, 'device')
  assert.equal(vac.rows[0].usd, 40)

  const two = detectItemSurcharges([
    { productName: '보다나 트리플플로우 헤어 드라이기', quantity: 2 },
  ])
  assert.equal(two.rows[0].usd, 80, '기기당 과금 — 2대는 $80')

  const filter = detectItemSurcharges([
    { productName: '청소기 교체용 헤파 필터 3개입', quantity: 1 },
  ])
  assert.equal(filter.rows.length, 0, '소모품은 할증 없음')
})
