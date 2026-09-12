/**
 * 옵션 목록 고르기(순수 함수) — 대신 읽기가 상품 화면에서 모은 후보를 고객이 고를 옵션으로 만드는 규칙.
 * extract.js 는 브라우저용 IIFE 라 vm 안에서 실행해 KBExtract.pickOptions 만 꺼내 씁니다 (DOM 불필요).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../extension/src/content/extract.js', import.meta.url), 'utf8')
const sandbox = { console, URL, URLSearchParams }
vm.runInNewContext(src, sandbox)
// vm 안에서 만든 객체는 프로토타입이 달라 deepEqual(strict)이 어긋납니다 — 평범한 값으로 바꿔 비교합니다
const plain = (v) => JSON.parse(JSON.stringify(v))
const pickOptions = (...a) => plain(sandbox.KBExtract.pickOptions(...a))
const { DEFAULT_SELECTORS } = sandbox.KBExtract

test('링크·번호가 있는 옵션 — 번호를 읽고 그 옵션의 정식 주소를 만들며, 현재 주소의 옵션에 선택 표시', () => {
  const out = pickOptions([
    { text: '1단계 800g 21,720원', href: '/vp/products/7654321?itemId=11&vendorItemId=22' },
    { text: '2단계 800g\n23,900원', itemId: 12, vendorItemId: '23' },
    { text: '3단계 800g (품절) 25,900원', href: 'https://www.coupang.com/vp/products/7654321?itemId=13&vendorItemId=24&q=x' },
  ], { productId: '7654321', currentItemId: '12', currentVendorItemId: '23' })
  assert.equal(out.length, 3)
  assert.deepEqual(out[0], { label: '1단계 800g', itemId: '11', vendorItemId: '22', url: 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22', price: 21720, selected: false })
  assert.equal(out[1].selected, true)
  assert.equal(out[1].url, 'https://www.coupang.com/vp/products/7654321?itemId=12&vendorItemId=23')
  assert.equal(out[2].label, '3단계 800g', '품절·가격은 라벨에서 뗍니다')
  assert.equal(out[2].price, 25900)
})

test('번호 없는 옵션은 이름표만(url 없음), 같은 번호는 하나로, 긴 글(목록 전체)은 버림, 하나뿐이면 빈 목록', () => {
  const out = pickOptions([
    { text: '블랙', selected: true },
    { text: '화이트' },
    { text: '화이트 12,900원' },                      // 라벨 같음 → 하나로
    { text: '블랙 화이트 레드 '.repeat(20) },          // 옵션 목록 전체를 감싼 요소
    { text: '', itemId: 5 },
  ], { productId: '1' })
  assert.deepEqual(out.map((o) => [o.label, o.url, o.selected, o.price]), [['블랙', null, true, null], ['화이트', null, false, null]])
  assert.deepEqual(pickOptions([{ text: '단일 옵션', itemId: 1 }], { productId: '1' }), [])
  assert.deepEqual(pickOptions(null), [])
})

test('최대 60개, 상품 번호가 없으면 주소를 만들지 않음', () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ text: `옵션 ${i}`, itemId: 100 + i }))
  assert.equal(pickOptions(many, { productId: '9' }).length, 60)
  assert.equal(pickOptions(many.slice(0, 2), {})[0].url, null)
  assert.ok(Array.isArray(DEFAULT_SELECTORS.optionScope) && DEFAULT_SELECTORS.optionScope.includes('.prod-option'))
})
