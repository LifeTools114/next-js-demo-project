import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductHtml, peekProduct, _resetPeekCache } from '../lib/product-peek.js'

const PAGE = `<html><head><title>토리든 다이브인 저분자 히알루론산 세럼, 50ml, 1개 - 쿠팡!</title>
<meta property="og:title" content="토리든 다이브인 저분자 히알루론산 세럼, 50ml, 1개 - 쿠팡!"></head>
<body><h1 class="prod-buy-header__title">토리든 다이브인 저분자 히알루론산 세럼, 50ml, 1개</h1>
<span class="total-price"><strong>19,900</strong>원</span>
<table><tr><th>용량</th><td>50ml</td></tr></table></body></html>`
const quiet = { info() {} }

test('HTML 에서 이름(쿠팡! 꼬리 제거)·가격·용량을 읽습니다', () => {
  const p = parseProductHtml(PAGE)
  assert.equal(p.productName, '토리든 다이브인 저분자 히알루론산 세럼, 50ml, 1개')
  assert.equal(p.productPrice, 19900)
  assert.equal(p.spec, '50ml')
})

test('JSON 값·다른 표기도 잡고, 없으면 null', () => {
  assert.equal(parseProductHtml('<div>"salePrice":"12900"</div>').productPrice, 12900)
  assert.equal(parseProductHtml('<meta property="og:price:amount" content="8,900">').productPrice, 8900)
  assert.equal(parseProductHtml('<p>중량: 360g × 2개입</p>').spec, '360g × 2개입')
  assert.equal(parseProductHtml('<p>아무것도</p>').productPrice, null)
})

test('peekProduct — 정상 응답이면 ok, 차단(403)이면 ok:false 이유와 함께, 결과는 캐시', async () => {
  _resetPeekCache()
  let calls = 0
  const fetchOk = async () => { calls += 1; return { ok: true, status: 200, headers: { get: () => null }, text: async () => PAGE } }
  const r = await peekProduct('https://www.coupang.com/vp/products/7654321?itemId=1&vendorItemId=2', { fetchImpl: fetchOk, log: quiet })
  assert.equal(r.ok, true); assert.equal(r.productId, '7654321'); assert.equal(r.productPrice, 19900)
  await peekProduct('https://www.coupang.com/vp/products/7654321?itemId=1&vendorItemId=2', { fetchImpl: fetchOk, log: quiet })
  assert.equal(calls, 1, '같은 상품은 한 번만 엽니다')

  const fetch403 = async () => ({ ok: false, status: 403, headers: { get: () => null }, text: async () => '' })
  const b = await peekProduct('https://www.coupang.com/vp/products/1111111', { fetchImpl: fetch403, log: quiet })
  assert.equal(b.ok, false); assert.equal(b.reason, 'http-403')
  assert.equal((await peekProduct('https://example.com/x', { fetchImpl: fetchOk, log: quiet })).reason, 'not-a-product-link')
})

test('짧은 링크는 Location 을 따라가 상품 번호를 찾습니다', async () => {
  _resetPeekCache()
  const fetchImpl = async (url, opts) => {
    if (url.startsWith('https://link.coupang.com/')) return { ok: true, status: 302, headers: { get: (k) => (k === 'location' ? 'https://www.coupang.com/vp/products/424242?itemId=5' : null) }, text: async () => '' }
    assert.equal(opts.redirect, 'follow')
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => PAGE }
  }
  const r = await peekProduct('https://link.coupang.com/a/abc', { fetchImpl, log: quiet })
  assert.equal(r.ok, true); assert.equal(r.productId, '424242'); assert.equal(r.productPrice, 19900)
})

test('시간 초과·네트워크 오류는 조용히 ok:false', async () => {
  _resetPeekCache()
  const boom = async () => { throw new Error('ECONNRESET') }
  const r = await peekProduct('https://www.coupang.com/vp/products/2222222', { fetchImpl: boom, log: quiet })
  assert.equal(r.ok, false); assert.equal(r.reason, 'fetch-failed')
})
