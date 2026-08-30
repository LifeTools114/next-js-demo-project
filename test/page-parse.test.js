import test from 'node:test'
import assert from 'node:assert/strict'

// 콘텐츠 스크립트가 globalThis 에 등록하는 순수 파서를 그대로 검증합니다.
await import('../extension/src/content/parse-page.js')
const P = globalThis.KBPageParse

test('결제창 형식: 이름+수량+합계를 뽑고 합계를 첫 항목 단가로 나눈다', () => {
  const text = ['이니스프리 비자 트러블 로션 100ml', '수량 2개 / 무료배송',
    '총 상품 가격 31,800원', '총 결제 금액 31,800원'].join('\n')
  const items = P.extractItemsFromText(text)
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 2)
  assert.equal(items[0].productPrice, 15900)
})

test('옵션 줄이 상품명에 붙는다 — 용량·개수가 무게 추정에 반영되도록', () => {
  const text = ['앰플엔 펩타이드샷 앰플', '옵션: 100ml, 4개', '수량 1개',
    '총 상품 가격 45,900원'].join('\n')
  const items = P.extractItemsFromText(text)
  assert.equal(items.length, 1)
  assert.ok(items[0].productName.includes('100ml, 4개'), items[0].productName)
})

test('즉시할인: 총 결제 금액이 더 낮으면 그쪽을 쓴다', () => {
  const text = ['수분크림 저자극 대용량', '수량 1개',
    '총 상품 가격 34,300원', '즉시할인 -5,000원', '총 결제 금액 29,300원'].join('\n')
  assert.equal(P.extractItemsFromText(text)[0].productPrice, 29300)
})

test('국내 배송비가 붙어 결제 금액이 더 크면 상품가를 유지한다', () => {
  const text = ['수분크림 저자극 대용량', '수량 1개',
    '총 상품 가격 30,000원', '배송비 3,000원', '총 결제 금액 33,000원'].join('\n')
  assert.equal(P.extractItemsFromText(text)[0].productPrice, 30000)
})

test('상품을 못 읽거나 합계가 없으면 빈 배열 — 옛 값으로 계산하지 않는다', () => {
  assert.deepEqual(P.extractItemsFromText('배송지 확인\n결제하기'), [])
  assert.deepEqual(P.extractItemsFromText('어떤 상품 이름\n수량 1개'), [])
})

test('계정 전용 쿠폰은 구매대행 기준가에서 제외된다 — 대리구매 불가 가격 방지', () => {
  // 와우 가입 쿠폰 -30,000원이 적용된 결제액(13,400)이 아니라,
  // 대리 구매자도 낼 수 있는 가격(결제액+쿠폰 = 43,400)이 기준이어야 합니다.
  const text = ['앰플엔 펩타이드샷 앰플 100ml', '수량 1개',
    '총 상품 가격 44,800원', '즉시할인 -1,400원',
    'WOW 와우 전용 쿠폰할인 변경 -30,000원',
    '쿠팡캐시 전액사용 - 0 원',
    '총 결제 금액 13,400원'].join('\n')
  const items = P.extractItemsFromText(text)
  assert.equal(items[0].productPrice, 43400)
})

test('줄바꿈으로 쪼개진 쿠폰 문구도 감지한다 (사이드바 줄바꿈)', () => {
  // 결제 요약 사이드바가 좁아 "쿠\n폰할인"으로 렌더링되는 실제 사례.
  const text = ['앰플엔 펩타이드샷 앰플 100ml', '수량 1개',
    '총 상품 가격 44,800원',
    'WOW 와우 전용 쿠', '폰할인 변경 -30,000원',
    '총 결제 금액 14,800원'].join('\n')
  assert.equal(P.extractItemsFromText(text)[0].productPrice, 44800)
})

// ─────────── 장바구니 줄합계 (cartLineTotal) ───────────
// 실사고: 할인 상품의 판매가 줄은 "77% 14,800원"이라 "숫자원" 단독 줄만 보면
// 취소선 정가(65,000원)가 잡혀 구매대행 상품가가 정가로 부풀었습니다.

test('장바구니: 할인율 붙은 판매가 줄을 정가보다 우선한다 + 쿠폰 되돌림', () => {
  // 청바지 실사례 — 정가 65,000 / 판매가(쿠폰 포함) 14,800 / 개인 쿠폰 30,000
  const lines = ['2장 [더맨월드] 남자 사계절용 SA슬림스판청바지 M830', '옵션: 32, 연청+중청',
    '9/1 (화) 도착 예정', '와우쿠폰할인', '65,000원', '77% 14,800원', '30,000원 쿠폰할인 적용됨', '1']
  const total = P.cartLineTotal(lines, { rowText: lines.join('\n') })
  assert.equal(total, 44800, '판매가 14,800 + 쿠폰 30,000 = 44,800 (정가 65,000 아님)')
})

test('장바구니: 할인 없는 상품은 단독 가격 줄 그대로', () => {
  assert.equal(P.cartLineTotal(['상품명 어쩌구 저쩌구', '25,900원', '1']), 25900)
})

test('장바구니: 취소선(struck) 금액은 후보에서 빠진다', () => {
  // % 표기가 없는 옛 레이아웃 — DOM 의 del 태그 금액을 제외
  const lines = ['어떤 상품 이름 예시', '153,000원', '137,700원']
  assert.equal(P.cartLineTotal(lines, { struck: ['153,000'] }), 137700)
})

test('장바구니: 전부 취소선이어도 0원이 되지는 않는다 (폴백)', () => {
  assert.equal(P.cartLineTotal(['상품 이름 예시입니다', '65,000원'], { struck: ['65,000'] }), 65000)
})

test('장바구니: 단가 표기·라벨 금액은 후보가 아니다', () => {
  // "(10ml당 1,377원)"·"상품가격 44,800원 + …"·"와우쿠폰할인 65,000원"(한 줄 표기)은 제외
  const lines = ['프랑스와즈 저분자 히알루론산 원액', '옵션: 100ml, 1개',
    '(10ml당 1,377원)', '상품가격 44,800원 + 배송비 무료 = 주문금액 44,800원', '10% 137,700원']
  assert.equal(P.cartLineTotal(lines), 137700)
})
