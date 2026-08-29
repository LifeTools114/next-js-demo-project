import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductSpec } from '../lib/weight/parse.js'
import { detectForm } from '../lib/weight/density.js'
import { estimateItemWeight, estimateShipmentWeight } from '../lib/weight/estimate.js'

test('파서: 용량·중량·매수·구성수량을 추출한다', () => {
  assert.equal(parseProductSpec('토리든 세럼 50ml').volumeMl, 50)
  assert.equal(parseProductSpec('클리오 쿠션 15g').massG, 15)
  assert.equal(parseProductSpec('메디힐 마스크팩 10매').sheets, 10)
  assert.equal(parseProductSpec('에스트라 크림 80ml x 2').count, 2)
  assert.equal(parseProductSpec('클리오 쿠션 15g 1+1').count, 2)
  assert.equal(parseProductSpec('아누아 토너 250ml 3개입').count, 3)
  assert.ok(Math.abs(parseProductSpec('키엘 울트라 훼이셜 크림 1.7oz').volumeMl - 50.27) < 0.01)
})

test('파서: 용량이 아닌 숫자를 용량으로 오인하지 않는다', () => {
  // SPF/PA 등급
  assert.equal(parseProductSpec('선크림 SPF50+ PA++++ 50ml').volumeMl, 50)
  // 색상 호수
  assert.equal(parseProductSpec('쿠션 15g 21호').count, 1)
  // 연도
  assert.equal(parseProductSpec('수딩 크림 2025년형').volumeMl, null)
  // 색상 번호
  assert.equal(parseProductSpec('립틴트 5.5g #09').massG, 5.5)
  // 성분 함량
  assert.equal(parseProductSpec('나이아신아마이드 10% 세럼 30ml').volumeMl, 30)
})

test('제형 판별: 구체적인 제형이 일반 제형보다 먼저 매칭된다', () => {
  assert.equal(detectForm('아누아 클렌징오일 200ml').form.id, 'cleansing-oil')
  assert.equal(detectForm('라운드랩 선크림 50ml').form.id, 'sunscreen')
  assert.equal(detectForm('닥터지 수분크림 50ml').form.id, 'cream')
  assert.equal(detectForm('어뮤즈 선스틱 23g').form.id, 'sun-stick')
  assert.equal(detectForm('클리오 선쿠션').form.id, 'sun-cushion')
})

test('무게 추정: 실제 배송중량과 ±15% 이내로 일치한다', () => {
  const references = [
    ['토리든 다이브인 세럼 50ml', 130],
    ['아이소이 블레미쉬 케어 크림 50ml', 200],
    ['라운드랩 자작나무 선크림 50ml', 85],
    ['에스트라 아토베리어365 로션 200ml', 250],
    ['바닐라코 클린 잇 제로 클렌징오일 200ml', 250],
    ['이니스프리 그린티 토너 200ml', 250],
    ['메디힐 마스크팩 10매', 265],
    ['롬앤 쥬시 래스팅 틴트 5.5g', 45],
  ]
  for (const [name, expected] of references) {
    const { actualG } = estimateItemWeight({ productName: name })
    const error = Math.abs(actualG - expected) / expected
    assert.ok(error <= 0.15, `${name}: 추정 ${actualG}g vs 참고 ${expected}g (오차 ${(error * 100).toFixed(1)}%)`)
  }
})

test('무게 추정: 청구무게는 실무게와 부피무게 중 큰 값이다', () => {
  const r = estimateItemWeight({ productName: '아이소이 크림 50ml' })
  assert.equal(r.chargeableG, Math.max(r.actualG, r.volumetricG))
  assert.equal(r.chargeableBy, 'actual')
})

test('무게 추정: 수량과 구성수량이 함께 곱해진다', () => {
  const single = estimateItemWeight({ productName: '토리든 세럼 50ml' }, 1)
  const double = estimateItemWeight({ productName: '토리든 세럼 50ml' }, 2)
  assert.ok(Math.abs(double.actualG - single.actualG * 2) < 0.5)

  const bundled = estimateItemWeight({ productName: '토리든 세럼 50ml 2개' }, 1)
  assert.ok(Math.abs(bundled.actualG - single.actualG * 2) < 0.5)
})

test('무게 추정: 신뢰도가 정보량에 따라 낮아진다', () => {
  assert.equal(estimateItemWeight({ productName: '토리든 세럼 50ml' }).confidence.level, 'high')
  assert.equal(estimateItemWeight({ productName: '토리든 다이브인 세럼' }).confidence.level, 'medium')
  assert.equal(estimateItemWeight({ productName: '알수없는 상품' }).confidence.level, 'low')
})

test('배송 단위 합산: 박스 무게는 건당 1회만 가산된다', () => {
  const one = estimateShipmentWeight([{ productName: '토리든 세럼 50ml', quantity: 1 }])
  const two = estimateShipmentWeight([
    { productName: '토리든 세럼 50ml', quantity: 1 },
    { productName: '롬앤 틴트 5.5g', quantity: 1 },
  ])
  assert.equal(one.boxG, two.boxG)
  assert.ok(two.actualG > one.actualG)
})

test('배송 단위 합산: 신뢰도는 가장 낮은 상품을 따른다', () => {
  const mixed = estimateShipmentWeight([
    { productName: '토리든 세럼 50ml', quantity: 1 },
    { productName: '알수없는 상품', quantity: 1 },
  ])
  assert.equal(mixed.confidence.level, 'low')
})


test('고시정보: 상품명보다 우선 적용된다', () => {
  // 상품명에 용량이 없어도 상세페이지 고시정보로 정확히 계산됩니다.
  const withNotice = estimateItemWeight({ productName: '토리든 다이브인 세럼', specOverride: '50ml' })
  const nameOnly = estimateItemWeight({ productName: '토리든 다이브인 세럼 50ml' })
  assert.ok(Math.abs(withNotice.actualG - nameOnly.actualG) < 1)
  assert.equal(withNotice.confidence.level, 'high')
})

test('고시정보: 총량 표기를 구성 수량과 이중으로 곱하지 않는다', () => {
  // "600g (120g x 5)" 의 600g 은 이미 5개분 총량입니다.
  // 상품명의 "5개입"을 다시 곱하면 5배로 부풀려집니다.
  const r = estimateItemWeight({
    productName: '농심 신라면 봉지라면 120g 5개입',
    specOverride: '600g (120g x 5)',
  })
  assert.ok(r.actualG > 550 && r.actualG < 750, `총량 이중 곱셈이 발생했습니다: ${r.actualG}g`)
})

test('고시정보: 단위 용량이면 구성 수량을 곱한다', () => {
  // "50ml" 는 1개분이므로 "2개"를 곱해야 합니다.
  const one = estimateItemWeight({ productName: '토리든 세럼', specOverride: '50ml' })
  const two = estimateItemWeight({ productName: '토리든 세럼 2개', specOverride: '50ml' })
  assert.ok(two.actualG > one.actualG * 1.8, '단위 용량에는 구성 수량이 곱해져야 합니다')
})

test('고시정보: 매수 표기로 시트마스크를 정확히 계산한다', () => {
  const r = estimateItemWeight({ productName: '메디힐 마스크팩', specOverride: '23ml x 10매' })
  assert.ok(r.actualG > 230 && r.actualG < 300, `${r.actualG}g`)
})

test('비화장품 패드·쿠션은 화장품으로 오인하지 않는다', () => {
  // 운동화 수선패드가 토너패드(단지 150ml)로 잡히면 8개에 2kg 이상 부풀어
  // 배송비가 완전히 틀립니다 — 소형 잡화로 가볍게 잡아야 합니다.
  const shoe = detectForm('릴리홈스 운동화 뒷꿈치 수선패드 쿠션, 8개, 블랙, 11x8cm')
  assert.equal(shoe.form.id, 'small-goods')
  const w = estimateItemWeight({ productName: '릴리홈스 운동화 뒷꿈치 수선패드 쿠션, 8개, 블랙' }, 1)
  assert.ok(w.chargeableG < 700, `수선패드 8개가 ${w.chargeableG}g 로 과대추정되면 안 됩니다`)

  // 진짜 화장품 패드·쿠션은 그대로 화장품으로 잡혀야 합니다.
  assert.equal(detectForm('메디힐 마데카소사이드 토너패드 100매').form.id, 'toner-pad')
  assert.equal(detectForm('아누아 어성초 필링패드').form.id, 'toner-pad')
  assert.equal(detectForm('클리오 킬커버 쿠션 15g').form.id, 'cushion')
  // 생활용품 쿠션(방석·베개)도 화장품 쿠션이 아닙니다.
  assert.notEqual(detectForm('메모리폼 목쿠션 베개').form.id, 'cushion')
})
