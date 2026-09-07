import test from 'node:test'
import assert from 'node:assert/strict'
import { enqueue, take, complete, getJob, stats, workerOnline, _resetJobs } from '../lib/peek-jobs.js'
import { peekProduct, peekCached, _resetPeekCache } from '../lib/product-peek.js'
import peekHandler from '../pages/api/product-peek.js'
import jobsHandler from '../pages/api/worker/jobs/index.js'
import jobHandler from '../pages/api/worker/jobs/[id].js'

const call = (handler, { method = 'GET', query = {}, body = {}, headers = {} } = {}) => {
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this }, json(o) { this.body = o; return this } }
  const r = handler({ method, query, body, headers: { 'x-forwarded-for': '10.0.0.5', ...headers }, socket: {} }, res)
  return r && typeof r.then === 'function' ? r.then(() => res) : res
}
const quiet = { info() {} }
const noFetch = async () => { throw new Error('네트워크를 쓰면 안 됩니다') }
const resolveOnly = async (url) => ({ ok: true, status: 302, url, headers: { get: (k) => (k === 'location' ? 'https://www.coupang.com/vp/products/424242?itemId=5' : null) }, text: async () => '' })

test.beforeEach(() => { _resetJobs(); _resetPeekCache(); process.env.ADMIN_TOKEN = 'tok-worker' })

test('읽기 기기가 없으면 page-off, 방금 가져간 기기가 있으면 작업 줄에 넣고 pending', async () => {
  const off = await peekProduct('https://www.coupang.com/vp/products/1001', { fetchImpl: noFetch, log: quiet })
  assert.equal(off.reason, 'page-off')
  take() // 기기가 한 번 가져감 → 살아 있음
  assert.equal(workerOnline(), true)
  _resetPeekCache()
  const pend = await peekProduct('https://www.coupang.com/vp/products/1002?itemId=3', { fetchImpl: noFetch, log: quiet })
  assert.equal(pend.reason, 'pending'); assert.ok(pend.jobId); assert.equal(pend.productId, '1002')
  assert.equal(stats().pending, 1)
  // 같은 상품을 또 물으면 같은 작업
  const again = await peekProduct('https://www.coupang.com/vp/products/1002?itemId=3', { fetchImpl: noFetch, log: quiet })
  assert.equal(again.jobId, pend.jobId)
})

test('가져가기 — 한 번 가져간 작업은 30초 안에는 다시 주지 않고, 완료하면 캐시에 남습니다', () => {
  const j = enqueue({ key: 'k1', url: 'https://www.coupang.com/vp/products/2001', productId: '2001' })
  const first = take({ now: 1_000 })
  assert.deepEqual(first.map((x) => x.id), [j.id])
  assert.deepEqual(take({ now: 2_000 }), [])
  assert.equal(take({ now: 40_000 }).length, 1, '30초 지나면 다시')
  const done = complete(j.id, { ok: true, productName: '분유', productPrice: 31800 })
  assert.equal(done.status, 'done')
  assert.equal(complete(j.id, { ok: true }), null, '두 번 완료는 안 됩니다')
  assert.equal(getJob(j.id).result.productPrice, 31800)
})

test('API — 토큰 없이는 401, 토큰으로 가져가고 결과를 올리면 고객 조회(?job=)가 성공으로 바뀌고 캐시됩니다', async () => {
  take()
  const pend = await peekProduct('https://link.coupang.com/a/abc', { fetchImpl: resolveOnly, log: quiet })
  assert.equal(pend.reason, 'pending'); assert.equal(pend.productId, '424242')
  assert.equal((await call(jobsHandler)).statusCode, 401)
  const got = await call(jobsHandler, { headers: { 'x-admin-token': 'tok-worker' } })
  assert.equal(got.statusCode, 200); assert.equal(got.body.jobs.length, 1); assert.equal(got.body.jobs[0].url, 'https://www.coupang.com/vp/products/424242?itemId=5')
  const waiting = await call(peekHandler, { query: { job: pend.jobId } })
  assert.equal(waiting.body.reason, 'pending')
  const posted = await call(jobHandler, { method: 'POST', query: { id: pend.jobId }, headers: { 'x-admin-token': 'tok-worker' },
    body: { ok: true, productName: '아이엠마더 첫 100일 분유', productPrice: 21720, spec: '360g × 1개입', badges: ['로켓배송'] } })
  assert.equal(posted.statusCode, 200); assert.equal(posted.body.status, 'done')
  const doneRes = await call(peekHandler, { query: { job: pend.jobId } })
  assert.equal(doneRes.body.ok, true); assert.equal(doneRes.body.productPrice, 21720); assert.equal(doneRes.body.productName, '아이엠마더 첫 100일 분유')
  assert.equal(peekCached({ productId: '424242', itemId: '5' })?.productPrice, 21720, '같은 상품은 다음부터 캐시')
  const cached = await peekProduct('https://www.coupang.com/vp/products/424242?itemId=5', { fetchImpl: noFetch, log: quiet })
  assert.equal(cached.ok, true); assert.equal(cached.via, 'worker')
  assert.equal((await call(jobHandler, { method: 'POST', query: { id: pend.jobId }, headers: { 'x-admin-token': 'tok-worker' }, body: { ok: true, productName: 'x' } })).statusCode, 409)
})

test('읽기 기기가 실패를 올리면 worker-failed — 고객 화면은 직접 적기로 넘어갑니다', async () => {
  take()
  const pend = await peekProduct('https://www.coupang.com/vp/products/3003', { fetchImpl: noFetch, log: quiet })
  await call(jobHandler, { method: 'POST', query: { id: pend.jobId }, headers: { 'x-admin-token': 'tok-worker' }, body: { ok: false, message: '읽기 실패' } })
  const r = await call(peekHandler, { query: { job: pend.jobId } })
  assert.equal(r.body.reason, 'worker-failed'); assert.equal(r.body.productId, '3003')
  assert.equal((await call(peekHandler, { query: { job: 'pj_none' } })).body.reason, 'unknown-job')
})
