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
