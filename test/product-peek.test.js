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
  const fetchOk = async (url) => { calls += 1; return { ok: true, status: 200, url, headers: { get: () => null }, text: async () => PAGE } }
  const r = await peekProduct('https://www.coupang.com/vp/products/7654321?itemId=1&vendorItemId=2', { fetchImpl: fetchOk, log: quiet, readPage: true })
  assert.equal(r.ok, true); assert.equal(r.productId, '7654321'); assert.equal(r.productPrice, 19900)
  await peekProduct('https://www.coupang.com/vp/products/7654321?itemId=1&vendorItemId=2', { fetchImpl: fetchOk, log: quiet, readPage: true })
  assert.equal(calls, 1, '같은 상품은 한 번만 엽니다')

  const fetch403 = async (url) => ({ ok: false, status: 403, url, headers: { get: () => null }, text: async () => '' })
  const b = await peekProduct('https://www.coupang.com/vp/products/1111111', { fetchImpl: fetch403, log: quiet, readPage: true })
  assert.equal(b.ok, false); assert.equal(b.reason, 'bot-protected')
  assert.equal((await peekProduct('https://example.com/x', { fetchImpl: fetchOk, log: quiet, readPage: true })).reason, 'not-a-product-link')
})

const resp = (status, { url = '', location = null, body = '' } = {}) =>
  ({ ok: status >= 200 && status < 300, status, url, headers: { get: (k) => (k.toLowerCase() === 'location' ? location : null) }, text: async () => body })

test('짧은 링크 — 302 를 한 단계씩 따라가다 pageKey/상품 주소가 보이면 그 상품을 엽니다', async () => {
  _resetPeekCache()
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push(url)
    if (url === 'https://link.coupang.com/a/abc') {
      assert.equal(opts.redirect, 'manual')
      // PC 브라우저에게는 302, 폰 브라우저에게는 중간 페이지 — PC 로 먼저 물어야 합니다
      if (/Mobile/.test(opts.headers['User-Agent'])) return resp(200, { url, body: '<title>Deeplink Redirect</title>' })
      return resp(302, { location: 'https://link.coupang.com/re/AFFSDP?lptag=AF1&pageKey=424242&itemId=5&vendorItemId=9&traceid=x' })
    }
    if (url.startsWith('https://www.coupang.com/vp/products/424242')) { assert.equal(opts.redirect, 'follow'); return resp(200, { url, body: PAGE }) }
    throw new Error('unexpected ' + url)
  }
  const r = await peekProduct('https://link.coupang.com/a/abc', { fetchImpl, log: quiet, readPage: true })
  assert.equal(r.ok, true); assert.equal(r.productId, '424242'); assert.equal(r.productPrice, 19900)
  assert.equal(r.url, 'https://www.coupang.com/vp/products/424242?itemId=5&vendorItemId=9')
  assert.equal(calls.length, 2, '/re/ 주소는 열지 않고 번호만 읽습니다')
})

test('중간 안내 페이지(200)에 상품 주소가 숨어 있으면 찾아서 이어갑니다', async () => {
  _resetPeekCache()
  const fetchImpl = async (url) => {
    if (url.startsWith('https://link.coupang.com/')) return resp(200, { url, body: '<html><script>location.href="https://www.coupang.com/vp/products/777?itemId=1&vendorItemId=2&lptag=x"</script></html>' })
    return resp(200, { url, body: PAGE })
  }
  const r = await peekProduct('[쿠팡] 세럼 https://link.coupang.com/a/zzz 보세요', { fetchImpl, log: quiet, readPage: true })
  assert.equal(r.ok, true); assert.equal(r.productId, '777'); assert.equal(r.url, 'https://www.coupang.com/vp/products/777?itemId=1&vendorItemId=2')
  const stuck = await peekProduct('https://link.coupang.com/a/none', { fetchImpl: async (url) => resp(200, { url, body: '<html>아무것도</html>' }), log: quiet, readPage: true })
  assert.equal(stuck.ok, false); assert.equal(stuck.reason, 'unresolved')
})

test('PC 주소가 403 이면 모바일 주소(m.coupang.com)로 한 번 더 읽습니다', async () => {
  _resetPeekCache()
  const hosts = []
  const fetchImpl = async (url) => {
    hosts.push(new URL(url).hostname)
    if (url.startsWith('https://www.')) return resp(403, { url })
    return resp(200, { url, body: PAGE })
  }
  const r = await peekProduct('https://www.coupang.com/vp/products/31337', { fetchImpl, log: quiet, readPage: true })
  assert.equal(r.ok, true); assert.equal(r.productPrice, 19900)
  assert.deepEqual(hosts, ['www.coupang.com', 'm.coupang.com'])
  const both = await peekProduct('https://www.coupang.com/vp/products/31338', { fetchImpl: async (url) => resp(403, { url }), log: quiet, readPage: true })
  assert.equal(both.ok, false); assert.equal(both.reason, 'bot-protected')
})

test('시간 초과·네트워크 오류는 조용히 ok:false', async () => {
  _resetPeekCache()
  const boom = async () => { throw new Error('ECONNRESET') }
  const r = await peekProduct('https://www.coupang.com/vp/products/2222222', { fetchImpl: boom, log: quiet, readPage: true })
  assert.equal(r.ok, false); assert.equal(r.reason, 'fetch-failed')
})

test('짧은 링크 페이지의 이스케이프(\\/)·URL 인코딩된 상품 주소도 찾습니다', async () => {
  _resetPeekCache()
  const body1 = '<script>var t="https:\\/\\/www.coupang.com\\/vp\\/products\\/8080?itemId=3&amp;vendorItemId=4"</script>'
  const body2 = '<a href="intent://x#Intent;S.browser_fallback_url=https%3A%2F%2Fwww.coupang.com%2Fvp%2Fproducts%2F9090%3FitemId%3D1;end">앱</a>'
  for (const [body, id] of [[body1, '8080'], [body2, '9090']]) {
    const fetchImpl = async (url) => url.startsWith('https://link.coupang.com/') ? resp(200, { url, body }) : resp(200, { url, body: PAGE })
    const r = await peekProduct(`https://link.coupang.com/a/${id}`, { fetchImpl, log: quiet, readPage: true })
    assert.equal(r.ok, true, id); assert.equal(r.productId, id)
  }
  const fetchKey = async (url) => url.startsWith('https://link.coupang.com/') ? resp(200, { url, body: '{"pageKey":"7225189423","x":1}' }) : resp(200, { url, body: PAGE })
  const k = await peekProduct('https://link.coupang.com/a/key', { fetchImpl: fetchKey, log: quiet, readPage: true })
  assert.equal(k.ok, true); assert.equal(k.productId, '7225189423')
})

test('PC 주소는 PC 브라우저로 엽니다 — 폰 브라우저인 척하면 빈 화면이 옵니다', async () => {
  _resetPeekCache()
  const seen = []
  const fetchImpl = async (url, opts) => {
    seen.push([new URL(url).hostname, /Mobile/.test(opts.headers['User-Agent']) ? 'mobile' : 'pc'])
    if (url.startsWith('https://www.')) return /Mobile/.test(opts.headers['User-Agent']) ? resp(200, { url, body: '<html><title>쿠팡!</title></html>' }) : resp(200, { url, body: PAGE })
    return resp(200, { url, body: '<html><title>쿠팡!</title></html>' })
  }
  const r = await peekProduct('https://www.coupang.com/vp/products/5150', { fetchImpl, log: quiet, readPage: true })
  assert.equal(r.ok, true); assert.equal(r.productPrice, 19900)
  assert.deepEqual(seen[0], ['www.coupang.com', 'pc'])
})

test('같은 상품을 동시에 여러 번 물어도 한 번만 엽니다 (진행 중 합치기)', async () => {
  _resetPeekCache()
  let calls = 0
  const fetchImpl = async (url) => { calls += 1; await new Promise((r) => setTimeout(r, 20)); return resp(200, { url, body: PAGE }) }
  const url = 'https://www.coupang.com/vp/products/6060?itemId=1&vendorItemId=2'
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => peekProduct(url, { fetchImpl, log: quiet, readPage: true })))
  assert.ok(all.every((r) => r.ok && r.productPrice === 19900))
  assert.equal(calls, 1)
})

test('제목만 「쿠팡!」인 빈 화면은 이름으로 치지 않습니다', () => {
  assert.equal(parseProductHtml('<title>쿠팡!</title>').productName, '')
  assert.equal(parseProductHtml('<title>분유 360g | 쿠팡</title>').productName, '분유 360g')
})

test('짧은 링크가 PC 에도 200 중간 페이지를 주면 폰 브라우저로 한 번 더 열어 이중 인코딩된 주소까지 찾습니다', async () => {
  _resetPeekCache()
  const tries = []
  const fetchImpl = async (url, opts) => {
    const mobile = /Mobile/.test(opts.headers['User-Agent'])
    if (url.startsWith('https://link.coupang.com/')) {
      tries.push(mobile ? 'mobile' : 'pc')
      return resp(200, { url, body: mobile ? '<a href="https%253A%252F%252Fwww.coupang.com%252Fvp%252Fproducts%252F4242%253FitemId%253D7">모바일 웹으로 보기</a>' : '<title>Deeplink Redirect</title>' })
    }
    return resp(200, { url, body: PAGE })
  }
  const r = await peekProduct('https://link.coupang.com/a/dbl', { fetchImpl, log: quiet, readPage: true })
  assert.equal(r.ok, true); assert.equal(r.productId, '4242'); assert.equal(r.url, 'https://www.coupang.com/vp/products/4242?itemId=7')
  assert.deepEqual(tries, ['pc', 'mobile'])
})

test('기본값 — 상품 화면은 열지 않고(봇 차단) 링크에서 번호·정식 주소만 확인합니다', async () => {
  _resetPeekCache()
  let pageFetches = 0
  const fetchImpl = async (url, opts) => {
    if (url.startsWith('https://link.coupang.com/')) return resp(302, { location: 'https://www.coupang.com/vp/products/7412573396?itemId=1&vendorItemId=2' })
    pageFetches += 1; return resp(200, { url, body: PAGE })
  }
  const r = await peekProduct('https://link.coupang.com/a/gPC8fsLo3E', { fetchImpl, log: quiet })
  assert.equal(r.ok, false); assert.equal(r.reason, 'page-off')
  assert.equal(r.productId, '7412573396'); assert.equal(r.url, 'https://www.coupang.com/vp/products/7412573396?itemId=1&vendorItemId=2')
  assert.equal(pageFetches, 0, '상품 화면은 열지 않습니다')
  const direct = await peekProduct('https://www.coupang.com/vp/products/555', { fetchImpl, log: quiet })
  assert.equal(direct.reason, 'page-off'); assert.equal(direct.productId, '555'); assert.equal(pageFetches, 0)
})

test('봇 검사 페이지(200 이지만 akam 스크립트뿐)는 bot-protected 로 구분합니다', async () => {
  _resetPeekCache()
  const fetchImpl = async (url) => resp(200, { url, body: '<html><head></head><body><script src="https://www.coupang.com/akam/13/abc"></script>Powered and protected by Privacy</body></html>' })
  const r = await peekProduct('https://www.coupang.com/vp/products/9122192858', { fetchImpl, log: quiet, readPage: true })
  assert.equal(r.ok, false); assert.equal(r.reason, 'bot-protected'); assert.equal(r.productId, '9122192858')
})
