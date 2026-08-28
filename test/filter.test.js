import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyProduct, filterWomenCosmetics, REJECT_REASONS } from '../lib/filter/women-cosmetics.js'

const name = (productName) => ({ productName })

test('남성용 제품을 제외한다', () => {
  for (const n of [
    '우르오스 스킨워시 남성 클렌징 200ml',
    '니베아 포맨 애프터쉐이브 로션',
    '비오템 옴므 아쿠아파워 에센스',
    "Nivea Men's 크림",
  ]) {
    const r = classifyProduct(name(n))
    assert.equal(r.allowed, false, n)
    assert.equal(r.rejectedBy, REJECT_REASONS.MALE, n)
  }
})

test('세이프리스트 브랜드는 남성 키워드 오탐에서 보호된다', () => {
  // '포맨트'는 여성 향수 브랜드로, 남성 키워드 '포맨'에 걸리면 안 됩니다.
  const r = classifyProduct(name('포맨트 시그니처 퍼퓸 바디미스트 120ml'))
  assert.equal(r.allowed, true)
  assert.equal(r.subcategoryId, 'perfume')
})

test('비화장품(기기·헤어·바디·위생용품)을 제외한다', () => {
  for (const n of [
    '다이슨 에어랩 헤어드라이기',
    '미쟝센 퍼펙트 세럼 샴푸 680ml',
    '해피바스 바디워시 900ml',
    '좋은느낌 생리대 중형 36개',
    '센소다인 치약 100g',
  ]) {
    const r = classifyProduct(name(n))
    assert.equal(r.allowed, false, n)
    assert.equal(r.rejectedBy, REJECT_REASONS.NON_COSMETIC, n)
  }
})

test('화장품이 아닌 상품은 미분류로 제외한다', () => {
  const r = classifyProduct(name('삼성 갤럭시 버즈3'))
  assert.equal(r.allowed, false)
  assert.equal(r.rejectedBy, REJECT_REASONS.UNCLASSIFIED)
})

test('서브카테고리를 구체적인 것부터 매칭한다', () => {
  const cases = [
    ['아누아 어성초 클렌징 오일 200ml', 'cleansing'], // 스킨케어 '오일'보다 우선
    ['라운드랩 자작나무 수분 선크림 50ml', 'suncare'], // 스킨케어 '크림'보다 우선
    ['아누아 어성초 77 수딩 토너패드 70매', 'mask'], // 스킨케어 '토너'보다 우선
    ['포맨트 시그니처 퍼퓸 바디미스트 120ml', 'perfume'], // 스킨케어 '미스트'보다 우선
    ['클리오 킬커버 메쉬글로우 쿠션 15g', 'base'],
    ['어뮤즈 딥 슬림 선스틱 23g', 'suncare'],
    ['롬앤 쥬시 래스팅 틴트 5.5g', 'lip'],
    ['클리오 프로 아이 팔레트', 'eye'],
    ['에뛰드 립 팔레트 10색', 'lip'], // '팔레트'가 아이메이크업으로 가면 안 됨
    ['데싱디바 매직프레스 네일스티커 30매', 'nail'],
    ['토리든 다이브인 히알루론산 세럼 50ml', 'skincare'],
  ]
  for (const [productName, expected] of cases) {
    assert.equal(classifyProduct(name(productName)).subcategoryId, expected, productName)
  }
})

test('SPF 표기가 있어도 쿠션은 선케어로 오분류되지 않는다', () => {
  assert.equal(classifyProduct(name('클리오 킬커버 쿠션 SPF50+ PA+++ 15g')).subcategoryId, 'base')
})

test('쿠션팩트는 마스크팩으로 오분류되지 않는다', () => {
  assert.equal(classifyProduct(name('에스쁘아 프로테일러 쿠션팩트 13g')).subcategoryId, 'base')
})

test('목록 필터가 통과·제외를 분리하고 통계를 낸다', () => {
  const { accepted, rejected, stats } = filterWomenCosmetics([
    name('토리든 세럼 50ml'),
    name('우르오스 남성 클렌징'),
    name('다이슨 헤어드라이기'),
    name('롬앤 틴트 5.5g'),
  ])
  assert.equal(accepted.length, 2)
  assert.equal(rejected.length, 2)
  assert.equal(stats.total, 4)
  assert.equal(stats[REJECT_REASONS.MALE], 1)
  assert.equal(stats[REJECT_REASONS.NON_COSMETIC], 1)
  assert.ok(accepted.every((p) => p.subcategoryId))
})
