import test from 'node:test'
import assert from 'node:assert/strict'
import { signedDate, buildAuthorization } from '../lib/coupang/signature.js'
import { extractBrand, normalizeProduct, dedupeByProductId } from '../lib/coupang/normalize.js'
import { withCache, clearCache, readCache } from '../lib/coupang/cache.js'
import { fetchCatalog, fetchProduct, sourceStatus } from '../lib/coupang/source.js'

test('서명: signed-date 는 GMT 기준 yyMMddTHHmmssZ 형식이다', () => {
  assert.equal(signedDate(new Date('2026-08-28T12:34:56.789Z')), '260828T123456Z')
  assert.match(signedDate(), /^\d{6}T\d{6}Z$/)
})

test('서명: 동일 입력에 대해 동일한 Authorization 을 만든다', () => {
  const params = {
    method: 'GET',
    path: '/v2/providers/affiliate_open_api/apis/openapi/products/search',
    query: 'keyword=%ED%86%A0%EB%84%88&limit=20',
    accessKey: 'AK',
    secretKey: 'SK',
    now: new Date('2026-08-28T12:34:56Z'),
  }
  const a = buildAuthorization(params)
  assert.equal(a, buildAuthorization(params))
  assert.match(a, /^CEA algorithm=HmacSHA256, access-key=AK, signed-date=260828T123456Z, signature=[0-9a-f]{64}$/)
})

test('서명: 쿼리가 달라지면 서명도 달라진다', () => {
  const base = { method: 'GET', path: '/p', accessKey: 'AK', secretKey: 'SK', now: new Date('2026-08-28T12:34:56Z') }
  assert.notEqual(
    buildAuthorization({ ...base, query: 'limit=10' }),
    buildAuthorization({ ...base, query: 'limit=20' }),
  )
})

test('서명: 키가 없으면 명확히 실패한다', () => {
  assert.throws(() => buildAuthorization({ method: 'GET', path: '/p', accessKey: '', secretKey: '' }), /ACCESS_KEY/)
})

test('브랜드 추출: 대괄호 표기를 우선한다', () => {
  assert.equal(extractBrand('[토리든] 다이브인 세럼 50ml'), '토리든')
  assert.equal(extractBrand('토리든 다이브인 세럼 50ml'), '토리든')
})

test('정규화: 분류·무게 정보가 함께 붙는다', () => {
  const p = normalizeProduct({
    productId: 123,
    productName: '토리든 다이브인 저분자 히알루론산 세럼 50ml',
    productPrice: 19900,
    productUrl: 'https://www.coupang.com/vp/products/123',
  })
  assert.equal(p.id, '123')
  assert.equal(p.subcategoryId, 'skincare')
  assert.ok(p.weight.chargeableG > 0)
  assert.equal(p.weight.confidence, 'high')
  assert.equal(p.weight.restriction.status, 'ok')
})

test('정규화: productId 기준으로 중복을 제거한다', () => {
  const list = dedupeByProductId([{ productId: '1' }, { productId: '1' }, { productId: '2' }])
  assert.equal(list.length, 2)
})

test('캐시: 첫 호출은 fetcher, 두 번째는 캐시를 쓴다', async () => {
  clearCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return { n: calls }
  }
  const first = await withCache('k', fetcher)
  const second = await withCache('k', fetcher)
  assert.equal(calls, 1)
  assert.equal(first.fromCache, false)
  assert.equal(second.fromCache, true)
  assert.deepEqual(second.value, { n: 1 })
})

test('캐시: 동시 요청은 하나의 호출로 합쳐진다', async () => {
  clearCache()
  let calls = 0
  const fetcher = async () => {
    calls += 1
    await new Promise((r) => setTimeout(r, 10))
    return calls
  }
  await Promise.all([withCache('k2', fetcher), withCache('k2', fetcher), withCache('k2', fetcher)])
  assert.equal(calls, 1)
})

test('캐시: 갱신 실패 시 낡은 값으로 폴백한다', async () => {
  clearCache()
  await withCache('k3', async () => 'good', 1)
  await new Promise((r) => setTimeout(r, 5)) // TTL 만료
  const result = await withCache('k3', async () => {
    throw new Error('API 장애')
  }, 1)
  assert.equal(result.value, 'good')
  assert.equal(result.stale, true)
})

test('소스: 키가 없으면 시드 데이터로 동작한다', async () => {
  clearCache()
  const status = sourceStatus()
  assert.equal(status.source, 'seed')
  assert.equal(status.live, false)
})

test('카탈로그: 여성 화장품만 남는다', async () => {
  clearCache()
  const { products, filterStats } = await fetchCatalog({ limit: 100 })
  assert.ok(products.length > 0)
  assert.ok(products.every((p) => p.subcategoryId))
  assert.ok(filterStats.rejected > 0, '시드에 포함된 남성/비화장품이 걸러져야 합니다')
  assert.ok(!products.some((p) => p.productName.includes('남성')))
  assert.ok(!products.some((p) => p.productName.includes('샴푸')))
})

test('카탈로그: 서브카테고리별로 걸러진다', async () => {
  clearCache()
  const { products } = await fetchCatalog({ subcategoryId: 'perfume', limit: 50 })
  assert.ok(products.length > 0)
  assert.ok(products.every((p) => p.subcategoryId === 'perfume'))
})

test('상세 조회: 존재하지 않는 상품은 null 이다', async () => {
  clearCache()
  assert.ok(await fetchProduct('7001'))
  assert.equal(await fetchProduct('does-not-exist'), null)
})
