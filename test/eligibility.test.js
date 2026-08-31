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

test('고액 주문은 차단하지 않고 견적 문의로 보낸다', () => {
  // 100만원 이상은 보험 여부를 확인해야 해서 자동 견적을 내지 않습니다.
  const high = checkEligibility(p('에르메스 실크 스카프', { price: 1200000, quantity: 1 }))
  assert.equal(high.shippable, true, '배송은 가능해야 합니다')
  assert.equal(high.verdict, VERDICT.MANUAL_QUOTE)
  assert.equal(high.autoQuote, false)
  assert.equal(high.ruleId, 'high-value')

  // 가전(에어랩 등)은 이제 견적 문의가 아니라 기기당 $40 할증으로 자동 견적
  // (운영자 확정 26-08-30). 고액 게이트(100만원↑)는 그대로 잡습니다.
  const dyson = checkEligibility(p('다이슨 에어랩 멀티 스타일러', { price: 590000, quantity: 1 }))
  assert.equal(dyson.verdict, VERDICT.OK, '가전은 자동 견적')
  assert.equal(dyson.autoQuote, true)
  assert.ok(dyson.warnings.some((w) => w.id === 'device-care'), '$40 취급비·A/S 경고는 남습니다')

  // 골프채는 배송 가능하되 장척 화물이라 견적 문의 (운영자 확정 26-08-30).
  const golf = checkEligibility(p('캘러웨이 골프채 아이언 세트', { price: 800000, quantity: 1 }))
  assert.equal(golf.shippable, true)
  assert.equal(golf.verdict, VERDICT.MANUAL_QUOTE)
  assert.equal(golf.ruleId, 'oversize')
})

test('다량 주문은 자동 견적을 유지하되 경고한다', () => {
  const many = checkEligibility(p('토리든 세럼 50ml', { price: 19900, quantity: 10 }))
  assert.equal(many.shippable, true)
  assert.equal(many.verdict, VERDICT.OK)
  assert.ok(many.warnings.some((w) => w.id === 'commercial-quantity'))
})

test('전자기기 본체: 자동 견적 + A/S 경고, 고액·액세서리는 각자 규칙대로', () => {
  // 운영자 확정 (26-08-30): 본체는 기기당 $40 할증으로 자동 견적하고 경고만 남깁니다.
  const mid = checkEligibility(p('아이패드 프로 13', { price: 500000, quantity: 1 }))
  assert.equal(mid.verdict, VERDICT.OK)
  assert.ok(mid.warnings.some((w) => w.id === 'device-care'), 'A/S 경고가 있어야 합니다')
  // 100만원 이상 본체는 고액 게이트로 수동 견적 유지.
  const high = checkEligibility(p('LG 그램 17인치 노트북', { price: 1890000, quantity: 1 }))
  assert.equal(high.verdict, VERDICT.MANUAL_QUOTE)
  assert.equal(high.ruleId, 'high-value')
  // 액세서리는 경고 없이 자동 견적.
  const buds = checkEligibility(p('에어팟 프로 3', { price: 359000, quantity: 1 }))
  assert.equal(buds.verdict, VERDICT.OK)
  assert.ok(!buds.warnings.some((w) => w.id === 'device-care'))
  const kase = checkEligibility(p('갤럭시탭 케이스 투명', { price: 20000, quantity: 1 }))
  assert.ok(!kase.warnings.some((w) => w.id === 'device-care'))
})

test('중고 전자기기는 견적 문의가 아니라 차단이다', () => {
  // 베트남은 2015-12 부터 중고 휴대폰·노트북 수입을 금지합니다.
  // 차단이 견적 문의보다 우선해야 합니다.
  for (const name of ['중고폰 아이폰 14 S급', '중고노트북 그램 리퍼브']) {
    const r = checkEligibility(p(name, { price: 500000, quantity: 1 }))
    assert.equal(r.verdict, VERDICT.BLOCKED, `${name} 은 차단이어야 합니다`)
    assert.equal(r.shippable, false)
  }
})

test('화장품 이름의 유제품 단어를 축산물로 오판하지 않는다', () => {
  // 한국 화장품에는 유제품 이름이 흔합니다. 키워드 나열로는 막을 수 없어
  // 화장품 문맥이면 검역 규칙을 적용하지 않습니다.
  const cosmetics = [
    '설화수 자음생크림 60ml', '미샤 타임레볼루션 재생크림', '정관장 진생크림',
    '스킨푸드 요거트 마스크팩', '더페이스샵 우유크림 세안제', '메디힐 우유팩 마스크',
    '토니모리 계란 클렌징폼', '네이처리퍼블릭 치즈볼 쿠션', '닥터자르트 시카페어 재생크림',
  ]
  for (const name of cosmetics) {
    assert.notEqual(checkEligibility(p(name)).verdict, VERDICT.BLOCKED, `${name} 이 오차단되었습니다`)
  }
  // 실제 식품은 그대로 차단되어야 합니다.
  for (const name of ['서울우유 1L 6팩', '매일 생크림 500ml', '풀무원 크림치즈 200g', '목우촌 계란 30구']) {
    assert.equal(checkEligibility(p(name)).verdict, VERDICT.BLOCKED, `${name} 이 통과되었습니다`)
  }
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

// ─────────── 무게 상한 ───────────

test('단일 상품 30kg 초과는 무게만으로 차단된다', () => {
  // 키워드로 못 잡는 대형 상품을 추정 무게로 거릅니다.
  const r = checkEligibility(p('코스트코 생수 2L 24병', { chargeableG: 51_200 }))
  assert.equal(r.verdict, VERDICT.BLOCKED)
  assert.equal(r.ruleId, 'overweight')
  assert.match(r.matchedKeyword, /kg$/)
})

test('30kg 이하는 차단하지 않는다', () => {
  const r = checkEligibility(p('쌀 25kg', { chargeableG: 25_000, price: 50000, quantity: 1 }))
  assert.notEqual(r.verdict, VERDICT.BLOCKED)
})

test('15~30kg 구간은 견적 문의로 보낸다', () => {
  const r = checkEligibility(p('이천쌀 20kg', { chargeableG: 21_000, price: 65000, quantity: 1 }))
  assert.equal(r.verdict, VERDICT.MANUAL_QUOTE)
  assert.equal(r.ruleId, 'heavy')
})

test('냉장고·세탁기는 무게 추정과 무관하게 키워드로도 차단된다', () => {
  // 무게 추정이 실패해도(폴백 100g) 키워드가 잡아야 합니다.
  for (const name of ['삼성 비스포크 냉장고 800L', 'LG 트롬 세탁기', '피아노 디지털']) {
    const r = checkEligibility(p(name, { chargeableG: 100 }))
    assert.equal(r.verdict, VERDICT.BLOCKED, `${name} 이 통과되었습니다`)
  }
})

test('장바구니 판정에 무게를 넘기면 상한이 적용된다', () => {
  const items = [p('생수 2L 24병'), p('토리든 세럼 50ml')]
  const lines = [{ chargeableG: 51_200 }, { chargeableG: 140 }]
  const r = checkCartEligibility(items, lines)
  assert.equal(r.shippable, false)
  assert.equal(r.blocked[0].ruleId, 'overweight')

  // 무게를 안 넘기면 무게 규칙이 동작하지 않습니다 (호출부 실수 방지용 문서화)
  assert.equal(checkCartEligibility(items).shippable, true)
})

test('가전 본체: 자동 견적 + 취급비 경고, 소모품은 할증 없음 (운영자 확정 26-08-30)', () => {
  // 실사례 — MIFAN 무선 UV 살균 침구 청소기: 예전엔 견적 문의로 막혔습니다.
  const vac = checkEligibility(p('MIFAN 무선 UV 살균 침대 이불 침구 청소기', { price: 89000, quantity: 1 }))
  assert.equal(vac.verdict, VERDICT.OK)
  assert.equal(vac.autoQuote, true)
  assert.ok(vac.warnings.some((w) => w.id === 'device-care'))

  // 소모품(필터·브러시 등)은 기기가 아니므로 경고도 할증도 없어야 합니다.
  const filter = checkEligibility(p('MIFAN 청소기 교체용 헤파 필터 3개입', { price: 12000, quantity: 1 }))
  assert.equal(filter.verdict, VERDICT.OK)
  assert.ok(!filter.warnings.some((w) => w.id === 'device-care'), '소모품에 기기 경고 금지')
})

test('해외직구(타국 발송) 상품은 접수하지 않는다 (운영자 확정 26-08-31)', () => {
  // 로켓직구 배지
  const rocket = checkEligibility(p('나이키 에어맥스', { badges: ['로켓직구'], price: 120000, quantity: 1 }))
  assert.equal(rocket.verdict, VERDICT.BLOCKED)
  assert.equal(rocket.ruleId, 'overseas-sourced')
  // 판매자 해외배송 문구
  const seller = checkEligibility(p('샤오미 공기청정기 필터', { shippingText: '해외배송 · 통관번호 필요' }))
  assert.equal(seller.verdict, VERDICT.BLOCKED)
  assert.equal(seller.ruleId, 'overseas-sourced')
  // 국내 로켓배송은 정상
  const domestic = checkEligibility(p('토리든 세럼 50ml', { badges: ['로켓배송'] }))
  assert.equal(domestic.verdict, VERDICT.OK)
})
