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

test('항공 제한: 향수는 수량 제한, 네일리무버는 운송 불가', () => {
  assert.equal(estimateItemWeight({ productName: '조말론 코롱 100ml' }).restriction.status, 'limited')
  assert.equal(estimateItemWeight({ productName: '딥디크 오드퍼퓸 EDP 75ml' }).restriction.status, 'limited')
  assert.equal(estimateItemWeight({ productName: '네일리무버 100ml' }).restriction.status, 'prohibited')
  assert.equal(estimateItemWeight({ productName: '토리든 세럼 50ml' }).restriction.status, 'ok')
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

test('배송 단위 합산: 향수 수량 초과를 감지한다', () => {
  const r = estimateShipmentWeight([{ productName: '조말론 코롱 100ml', quantity: 3 }])
  assert.equal(r.restrictions.exceedsLimitedQty, true)
  assert.ok(r.restrictions.surchargeKrw > 0)
})
