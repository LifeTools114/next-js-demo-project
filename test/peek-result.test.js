/** 대신 읽기 결과 정리 — 값 검증·길이 상한·옵션 목록 (lib/peek-result.js) */
import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeWorkerResult, sanitizeOptions, MAX_OPTIONS } from '../lib/peek-result.js'

test('이름도 가격도 없으면 실패 — 빈 성공을 만들지 않는다', () => {
  assert.deepEqual(sanitizeWorkerResult({ ok: true, productName: '', productPrice: 0 }), { ok: false, message: '' })
  assert.deepEqual(sanitizeWorkerResult({ ok: false, message: '시간 초과' }), { ok: false, message: '시간 초과' })
  assert.equal(sanitizeWorkerResult(null).ok, false)
})

test('성공 결과 — 숫자 검증, 길이 상한, 정식 주소, 옵션 포함', () => {
  const r = sanitizeWorkerResult({
    ok: true, productName: '토리든 세럼 50ml'.padEnd(400, '!'), productPrice: '19900.4', spec: '50ml',
    badges: Array.from({ length: 20 }, (_, i) => `b${i}`), categoryPath: '뷰티>스킨케어',
    productUrl: 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22&utm=x',
    options: [
      { label: '50ml', itemId: 11, vendorItemId: 22, url: 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22', price: 19900, selected: true },
      { label: '100ml', itemId: '33', vendorItemId: '44', url: 'https://www.coupang.com/vp/products/7654321?itemId=33&vendorItemId=44', price: '29,900' },
    ],
  }, { productId: '7654321' })
  assert.equal(r.ok, true)
  assert.equal(r.productName.length, 300)
  assert.equal(r.productPrice, 19900)
  assert.equal(r.badges.length, 12)
  assert.equal(r.productUrl, 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22')
  assert.equal(r.options.length, 2)
  assert.deepEqual(r.options[0], { label: '50ml', itemId: '11', vendorItemId: '22', url: 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22', price: 19900, selected: true })
  assert.equal(r.options[1].price, null, '"29,900" 같은 글자는 숫자로 치지 않습니다')
  assert.equal(r.via, 'worker')
})

test('옵션 — 다른 상품 주소·엉뚱한 주소는 url 을 버리고, 같은 번호는 하나로, 최대 60개', () => {
  const list = [
    { label: '블랙', itemId: 1, vendorItemId: 2, url: 'https://www.coupang.com/vp/products/999?itemId=1&vendorItemId=2' },
    { label: '블랙(중복)', itemId: 1, vendorItemId: 2, url: 'https://www.coupang.com/vp/products/777?itemId=1&vendorItemId=2' },
    { label: '화이트', url: 'https://evil.example.com/vp/products/777?itemId=5' },
    { label: '   ', itemId: 9 },
    { label: 'x'.repeat(200), itemId: 7, vendorItemId: 8, url: 'https://www.coupang.com/vp/products/777?itemId=7&vendorItemId=8', price: -5 },
    ...Array.from({ length: 80 }, (_, i) => ({ label: `옵션 ${i}`, itemId: 100 + i })),
  ]
  const out = sanitizeOptions(list, { productId: '777' })
  assert.equal(out.length, MAX_OPTIONS)
  assert.equal(out[0].url, null, '다른 상품(999)의 주소는 버립니다')
  assert.equal(out[1].label, '화이트'); assert.equal(out[1].url, null)
  assert.equal(out[2].label.length, 80); assert.equal(out[2].url, 'https://www.coupang.com/vp/products/777?itemId=7&vendorItemId=8'); assert.equal(out[2].price, null)
  assert.deepEqual(sanitizeOptions('아무거나'), [])
})

test('상품 화면이 아니었을 때 찾아온 상품 주소(redirect) — 쇼핑몰 정식 주소로 확인된 것만', () => {
  const r = sanitizeWorkerResult({ ok: false, redirect: 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22&x=1', message: '브랜드관' })
  assert.deepEqual(r, { ok: false, reason: 'redirect', redirect: 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22', productId: '7654321', message: '브랜드관' })
  assert.deepEqual(sanitizeWorkerResult({ ok: false, redirect: 'https://evil.example.com/vp/products/1' }), { ok: false, message: '' })
})
