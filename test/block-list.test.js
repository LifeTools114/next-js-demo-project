/**
 * 배송 불가 정책 — 운영자 최종 확정 26-09-06:
 * "중국 등 해외직구, 인화성·위험물, 배터리·강자성, 주류·담배, 냉장·냉동 식품,
 *  생고기·냉장 유제품·회, 대형 가전·가구 — 이거 빼고는 모두 됨."
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { BLOCK_RULES, LISTED_BLOCK_RULES, LISTED_CONSULT_RULES } from '../config/eligibility.js'
import { checkEligibility } from '../lib/eligibility.js'

const chk = (productName, categoryPath = '', extra = {}) =>
  checkEligibility({ productName, categoryPath, price: 10000, quantity: 1, ...extra })

test('고객 목록 = 차단 6개(순서 고정) + 상담 1개(중량 초과)', () => {
  assert.deepEqual(LISTED_BLOCK_RULES.map((r) => r.id),
    ['flammable', 'battery', 'alcohol-tobacco', 'cold-chain', 'quarantine-animal', 'oversize'])
  assert.deepEqual(LISTED_CONSULT_RULES.map((r) => r.id), ['overweight'])
  const by = Object.fromEntries(BLOCK_RULES.map((r) => [r.id, r]))
  assert.equal(by['cold-chain'].reason, '항공 배송 중에는 냉장·냉동을 유지할 수 없어 상할 수 있습니다. 상온으로 파는 식품은 문제 없음')
  assert.equal(by['quarantine-animal'].reason, '생고기·냉장 유제품·회는 상할 수 있습니다. 상온으로 파는 식품은 문제 없음')
  assert.equal(LISTED_CONSULT_RULES[0].reason, '단일 상품 30kg 을 초과할 경우 상담 요청해주세요.')
})

test('일곱 가지 빼고는 모두 된다 — 의약품·씨앗·특별소비세 품목은 이제 막지 않는다', () => {
  for (const id of ['sct', 'pharma', 'quarantine-plant', 'overweight']) {
    assert.ok(!BLOCK_RULES.some((r) => r.id === id), `${id} 는 차단 규칙에서 빠져야 합니다`)
  }
  const pill = chk('타이레놀 진통제 500mg')
  assert.equal(pill.shippable, true)
  assert.ok(pill.warnings.some((w) => w.id === 'pharma-caution'), '의약품은 통관 보류 안내만 붙습니다')
  const seed = chk('상추 씨앗 모종 세트')
  assert.equal(seed.shippable, true)
  assert.ok(seed.warnings.some((w) => w.id === 'plant-caution'))
  assert.equal(chk('화투 고스톱 세트').shippable, true)
})

test('명백한 불법 반입품(총기·마약·짝퉁·중고폰)만은 목록 없이 계속 막는다', () => {
  const r = BLOCK_RULES.find((x) => x.id === 'restricted-goods')
  assert.ok(r && r.listed === false)
  for (const name of ['에어소프트 모의총기 bb탄', '중고폰 갤럭시 S급중고', '나이키 레플리카 운동화']) {
    const v = chk(name)
    assert.equal(v.shippable, false, `${name} 은 여전히 차단`)
    assert.equal(v.ruleId, 'restricted-goods')
  }
})

test('30kg 초과는 상담, 그 아래는 자동 견적 (찹쌀 20kg 문제없음)', () => {
  const rice = chk('햇 찹쌀 20kg', '쿠팡 홈>식품>쌀/잡곡>현미/찹쌀/흑미>찹쌀', { chargeableG: 20_500 })
  assert.equal(rice.shippable, true); assert.equal(rice.autoQuote, true)
  const water = chk('코스트코 생수 2L 24병', '', { chargeableG: 51_200 })
  assert.equal(water.shippable, true); assert.equal(water.autoQuote, false); assert.equal(water.ruleId, 'overweight')
})

test('상온에서 파는 먹는 것은 모두 되고 안내도 없다 — 냉장·냉동·날것만 막는다', () => {
  for (const [name, cat] of [
    ['동원 리챔 스팸 340g', ''], ['목우촌 뚝심 햄 340g 3캔', '식품>고기/해물/간편조리>돼지고기 양념/가공>햄통조림'],
    ['진주햄 천하장사 소시지 상온보관', ''], ['서울우유 멸균우유 1L 10팩', ''], ['구운 계란 20구 실온', ''],
    ['CJ 비비고 사골곰탕 500g 레토르트', ''], ['우유 식빵 500g', '식품>빵/베이커리'], ['참치 통조림 150g 10캔', '식품>수산물>통조림'],
    ['카사베르디 유기농 레드와인 비니거 3개 500ml', '쿠팡 홈>식품>장/소스/드레싱/식초>식초/미림>와인식초'],
  ]) {
    const r = chk(name, cat)
    assert.equal(r.shippable, true, `${name} 이 ${r.label}('${r.matchedKeyword}')로 막혔습니다`)
    assert.deepEqual(r.warnings.filter((w) => w.id === 'shelf-stable-animal'), [], `${name} 에 검역 안내가 붙었습니다`)
  }
  for (const [name, rule] of [['비비고 냉동 왕교자 1.4kg', 'cold-chain'], ['제주 흑돼지 삼겹살 1kg', 'quarantine-animal'],
    ['서울우유 1L 6팩 냉장', 'cold-chain'], ['노르웨이 생연어회 300g', 'quarantine-animal'], ['칠레 레드 와인 750ml', 'alcohol-tobacco']]) {
    const r = chk(name, '식품')
    assert.equal(r.shippable, false, `${name} 은 막혀야 합니다`); assert.equal(r.ruleId, rule)
  }
})

test('해외직구(로켓직구·판매자 해외배송)는 여전히 받지 않는다 — 운영자 목록의 첫 줄', () => {
  const r = checkEligibility({ productName: '나이키 에어맥스', badges: ['로켓직구'], price: 120000, quantity: 1 })
  assert.equal(r.shippable, false); assert.equal(r.ruleId, 'overseas-sourced')
})
