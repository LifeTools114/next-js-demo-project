import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductUrl, fromShare } from '../lib/coupang-url.js'

test('PC·모바일 상품 주소에서 상품 번호와 옵션 값을 읽고, 추적 꼬리표는 뗍니다', () => {
  const p = parseProductUrl('https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22&src=share&q=x')
  assert.equal(p.productId, '7654321'); assert.equal(p.itemId, '11'); assert.equal(p.vendorItemId, '22')
  assert.equal(p.url, 'https://www.coupang.com/vp/products/7654321?itemId=11&vendorItemId=22')
  assert.equal(parseProductUrl('https://m.coupang.com/vm/products/99999').productId, '99999')
  const re = parseProductUrl('https://link.coupang.com/re/AFFSDP?lptag=AF1&pageKey=424242&itemId=5&vendorItemId=9&traceid=x')
  assert.equal(re.productId, '424242'); assert.equal(re.itemId, '5'); assert.equal(re.vendorItemId, '9')
  assert.equal(re.url, 'https://www.coupang.com/vp/products/424242?itemId=5&vendorItemId=9')
})

test('글 속에 섞인 주소도 찾고, 짧은 링크는 주소만 남기며, 다른 사이트는 거절', () => {
  assert.equal(parseProductUrl('[쿠팡] 토리든 세럼 https://m.coupang.com/vm/products/123?x=1 보세요').productId, '123')
  const s = parseProductUrl('https://link.coupang.com/a/abc123')
  assert.equal(s.productId, null); assert.equal(s.url, 'https://link.coupang.com/a/abc123')
  assert.equal(parseProductUrl('https://example.com/vp/products/123'), null)
  assert.equal(parseProductUrl('그냥 글'), null)
})

test('공유(share_target)로 온 세 값에서 링크와 이름을 고릅니다', () => {
  const r = fromShare({ title: '토리든 다이브인 세럼 50ml', text: 'https://www.coupang.com/vp/products/555' })
  assert.equal(r.link.productId, '555'); assert.equal(r.productName, '토리든 다이브인 세럼 50ml')
  const t = fromShare({ text: '[쿠팡] 분유 360g https://m.coupang.com/vm/products/777' })
  assert.equal(t.link.productId, '777'); assert.equal(t.productName, '[쿠팡] 분유 360g')
  assert.equal(fromShare({}).link, null)
})
