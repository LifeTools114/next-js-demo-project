import test from 'node:test'
import assert from 'node:assert/strict'
import { checkEligibility, checkCartEligibility, VERDICT } from '../lib/eligibility.js'
import { classifyDuty, calculateItemDuties } from '../lib/pricing/duty.js'
import { BLOCK_RULES, SAFE_TERMS } from '../config/eligibility.js'

const p = (productName, extra = {}) => ({ productName, ...extra })

/**
 * ⚠️ 이 코퍼스가 이 파일의 존재 이유입니다.
 *
 * 한국어에는 단어 경계가 없어 차단 키워드가 무관한 상품명에 우연히 포함됩니다.
 * 실제로 초기 구현은 정상 상품 21건 중 19건을 잘못 차단했습니다.
 *   '럼'(주류) ⊂ 세럼 / '무기' ⊂ 무기자차 / '회'(생선회) ⊂ 회복
 *   '릴' ⊂ 릴리즈 / '글로' ⊂ 글로우 / '라이터' ⊂ 하이라이터
 * 차단 키워드를 추가할 때는 반드시 이 테스트를 통과시키세요.
 */
const MUST_PASS = [
  '토리든 다이브인 저분자 히알루론산 세럼 50ml',
  '클리오 킬커버 메쉬글로우 쿠션 15g',
  '라운드랩 자작나무 무기자차 선크림 50ml',
  '고려은단 칼슘 마그네슘 비타민D 아연',
  '닥터지 릴리즈 수분크림 70ml',
  '아이오페 회복 앰플 30ml',
  '바이오더마 액상형 클렌징 워터 500ml',
  '메디힐 마스크팩 총 12개입',
  '햄버거 패티 만들기 틀',
  '슈피겐 마그네틱 폰케이스',
  '삼성 갤럭시 버즈3 무선이어폰',
  '모나미 자석 필통',
  '아모레퍼시픽 회전 클렌징 브러시',
  '이니스프리 분사형 미스트 100ml',
  '아누아 스프레이형 토너 250ml',
  '데싱디바 매직프레스 네일스티커 30매',
  '숨37 미생물 발효 에센스',
  '락앤락 냉장고 정리용기 세트',
  '다우니 건조기 시트 100매',
  '이케아 침대커버 퀸사이즈',
  '자이언트 자전거 헬멧',
  '방탄소년단 포토카드 세트',
  '중고등학생 영어 문제집',
  '현금영수증 발행 스티커',
  '한일 우유거품기',
  '쿠쿠 계란찜기',
  '스키피 피넛버터 500g',
  '더바디샵 시어버터 립밤',
  '농심 신라면 5개입',
  '종근당 오메가3 프리미엄',
  '에스쁘아 프로 하이라이터',
  '흙침대 온열 매트',
  '오뚜기 진라면 매운맛 5개입',
  '동원 참치캔 라이트스탠다드 6개',
  '롯데리아 햄버거 기프티콘',
  '햄스터 사료 1kg',
  '스팸메일 차단 프로그램',
]

const MUST_BLOCK = [
  ['조말론 잉글리쉬 페어 코롱 100ml', 'flammable'],
  ['샤넬 코코마드모아젤 오드퍼퓸 50ml', 'flammable'],
  ['아세톤 네일리무버 100ml', 'flammable'],
  ['맥스 부탄가스 4개입', 'flammable'],
  ['삼성 보조배터리 20000mAh', 'battery'],
  ['참이슬 후레쉬 소주 20병', 'alcohol-tobacco'],
  ['에쎄 체인지 담배 1보루', 'alcohol-tobacco'],
  ['타이레놀 진통제 500mg', 'pharma'],
  ['제주 흑돼지 삼겹살 1kg', 'quarantine-animal'],
  ['서울우유 1L 6팩', 'quarantine-animal'],
  ['동원 리챔 스팸 340g', 'quarantine-animal'],
  ['존쿡 델리미트 슬라이스햄 500g', 'quarantine-animal'],
  ['상추 씨앗 모종 세트', 'quarantine-plant'],
  ['LG 트롬 건조기 20kg', 'oversize'],
  ['삼성 비스포크 냉장고', 'oversize'],
  ['캘러웨이 골프채 아이언 세트', 'sct'],
]

test('정상 상품을 차단하지 않는다 (오탐 0)', () => {
  const wrong = MUST_PASS.filter((n) => !checkEligibility(p(n)).shippable).map((n) => {
    const r = checkEligibility(p(n))
    return `${n} → ${r.label}('${r.matchedKeyword}')`
  })
  assert.deepEqual(wrong, [], `오탐이 발생했습니다:\n${wrong.join('\n')}`)
})

test('차단 대상을 빠짐없이 막는다 (누락 0)', () => {
  for (const [name, expectedRule] of MUST_BLOCK) {
    const r = checkEligibility(p(name))
    assert.equal(r.shippable, false, `${name} 이 차단되지 않았습니다`)
    assert.equal(r.verdict, VERDICT.BLOCKED)
    assert.equal(r.ruleId, expectedRule, `${name}: ${r.ruleId} ≠ ${expectedRule}`)
    assert.ok(r.reason, '차단 사유가 있어야 합니다')
  }
})

test('차단 키워드는 오탐을 유발할 만큼 짧지 않다', () => {
  // 1자 키워드는 substring 매칭에서 거의 반드시 오탐을 냅니다.
  const tooShort = BLOCK_RULES.flatMap((r) =>
    r.keywords.filter((k) => k.replace(/\s/g, '').length < 2).map((k) => `${r.id}:${k}`),
  )
  assert.deepEqual(tooShort, [], `1자 키워드는 오탐을 유발합니다: ${tooShort.join(', ')}`)
})

test('세이프리스트가 실제로 오탐을 막는다', () => {
  assert.ok(SAFE_TERMS.includes('세럼'), "'세럼'이 없으면 '럼'(주류)에 걸립니다")
  assert.ok(SAFE_TERMS.includes('무기자차'), "'무기자차'가 없으면 '무기'에 걸립니다")
  assert.ok(SAFE_TERMS.includes('하이라이터'), "'하이라이터'가 없으면 '라이터'에 걸립니다")
})

test('고액·다량 주문은 차단하지 않고 경고만 한다', () => {
  const high = checkEligibility(p('다이슨 에어랩', { price: 599000, quantity: 3 }))
  assert.equal(high.shippable, true)
  assert.ok(high.warnings.some((w) => w.id === 'high-value'))

  const many = checkEligibility(p('토리든 세럼 50ml', { price: 19900, quantity: 10 }))
  assert.equal(many.shippable, true)
  assert.ok(many.warnings.some((w) => w.id === 'commercial-quantity'))
})

test('장바구니는 하나라도 불가면 전체가 불가다', () => {
  const r = checkCartEligibility([
    p('토리든 세럼 50ml'),
    p('조말론 코롱 100ml'),
    p('농심 신라면 5개입'),
  ])
  assert.equal(r.shippable, false)
  assert.equal(r.blocked.length, 1)
  assert.equal(r.blocked[0].ruleId, 'flammable')
})

test('관세 품목군: 세금이 더 붙는 품목을 구분한다', () => {
  assert.equal(classifyDuty(p('나이키 운동화 270')).dutyRate, 0.3)
  assert.equal(classifyDuty(p('구찌 크로스백')).dutyRate, 0.25)
  assert.equal(classifyDuty(p('유니클로 히트텍 티셔츠')).dutyRate, 0.2)
  assert.equal(classifyDuty(p('토리든 세럼 50ml')).dutyRate, 0.2)
  assert.equal(classifyDuty(p('알 수 없는 물건')).dutyRate, 0.1)
  assert.equal(classifyDuty(p('알 수 없는 물건')).confidence, 'low')
})

test('관세 배분: 운임을 가액 비례로 나누고 품목별 세율을 적용한다', () => {
  const r = calculateItemDuties(
    [
      { productName: '나이키 운동화 270', productPrice: 100000, quantity: 1 },
      { productName: '알 수 없는 물건', productPrice: 100000, quantity: 1 },
    ],
    20000,
  )
  // 가액이 같으므로 운임도 절반씩 → CIF 각 110,000
  assert.equal(r.lines[0].cif, 110000)
  assert.equal(r.lines[1].cif, 110000)
  assert.equal(r.lines[0].dutyKrw, 33000) // 30%
  assert.equal(r.lines[1].dutyKrw, 11000) // 10%
  assert.equal(r.dutyTotal, 44000)
  assert.equal(r.surcharged.length, 1)
  assert.equal(r.extraVsDefaultKrw, 22000) // 신발이 기본세율보다 20%p 더
})
