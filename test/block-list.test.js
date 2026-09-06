/**
 * 「보낼 수 없는 물건」 고객 목록 — 운영자 확정 26-09-06.
 * 목록은 8줄(해외직구 + 규칙 7개)뿐이고, 목록에서 뺀 네 규칙은 숨기되 차단은 유지합니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { BLOCK_RULES, LISTED_BLOCK_RULES } from '../config/eligibility.js'
import { checkEligibility } from '../lib/eligibility.js'

test('고객 목록은 운영자가 정한 7개 규칙만, 그 순서로', () => {
  assert.deepEqual(LISTED_BLOCK_RULES.map((r) => r.id),
    ['flammable', 'battery', 'alcohol-tobacco', 'cold-chain', 'quarantine-animal', 'overweight', 'oversize'])
  const by = Object.fromEntries(BLOCK_RULES.map((r) => [r.id, r]))
  assert.equal(by['cold-chain'].reason, '항공 배송 중에는 냉장·냉동을 유지할 수 없어 상할 수 있습니다. 상온으로 파는 식품은 문제 없음')
  assert.equal(by['quarantine-animal'].reason, '생고기·냉장 유제품·회는 상할 수 있습니다. 상온으로 파는 식품은 문제 없음')
  assert.equal(by.overweight.reason, '단일 상품 30kg 을 초과할 경우 상담 요청해주세요.')
})

test('목록에서 뺀 규칙(특별소비세·의약품·식물 검역·통관 금지)은 숨기되 차단은 유지한다', () => {
  for (const id of ['sct', 'pharma', 'quarantine-plant', 'restricted-goods']) {
    const r = BLOCK_RULES.find((x) => x.id === id)
    assert.ok(r && r.listed === false, `${id}: 목록에서 숨겨야 합니다`)
  }
  // 베트남 수입 규제 품목은 목록에 없어도 여전히 막습니다 — 통관 압수·반송을 막기 위해서입니다.
  for (const [name, id] of [['타이레놀 진통제 500mg', 'pharma'], ['상추 씨앗 모종 세트', 'quarantine-plant'], ['에어소프트 모의총기 bb탄', 'restricted-goods']]) {
    const r = checkEligibility({ productName: name, categoryPath: '', price: 10000, quantity: 1 })
    assert.equal(r.shippable, false, `${name} 은 여전히 차단`)
    assert.equal(r.ruleId ?? r.rule?.id ?? r.id, id)
  }
})

test('와인식초·미림은 술이 아니다 — 「식초/미림」 카테고리는 통과, 진짜 와인은 여전히 차단', () => {
  // 운영자 확정 26-09-06: 「쿠팡 홈 > 식품 > 장/소스/드레싱/식초 > 식초/미림 > 와인식초」 문제없음.
  const ok = (name, cat) => checkEligibility({ productName: name, categoryPath: cat, price: 5000, quantity: 1 }).shippable
  assert.equal(ok('카사베르디 유기농 레드와인 비니거, 3개, 500ml', '쿠팡 홈>식품>장/소스/드레싱/식초>식초/미림>와인식초'), true)
  assert.equal(ok('오뚜기 와인식초 500ml', ''), true, '카테고리가 없어도 이름의 「식초」로 통과')
  assert.equal(ok('청정원 미림 맛술 410ml', '식품>장/소스/드레싱/식초>식초/미림'), true)
  assert.equal(ok('크리스탈 와인잔 2P', '주방용품>잔'), true)
  const wine = checkEligibility({ productName: '칠레 까베르네 레드 와인 750ml', categoryPath: '식품>주류', price: 20000, quantity: 1 })
  assert.equal(wine.shippable, false, '진짜 와인은 그대로 차단')
  assert.equal(wine.ruleId ?? wine.rule?.id ?? wine.id, 'alcohol-tobacco')
})
