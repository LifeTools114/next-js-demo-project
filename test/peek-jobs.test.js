import test from 'node:test'
import assert from 'node:assert/strict'
import { enqueue, take, complete, getJob, stats, workerOnline, workersOnline, recentJobs, _resetJobs } from '../lib/peek-jobs.js'
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
  // 기기가 없을 때 본 상품도 기기가 켜지면 바로 다시 맡깁니다 — 「가격만」 결과는 10초만 기억 (26-09-13 서버 시험의 원인)
  const retry = await peekProduct('https://www.coupang.com/vp/products/1001', { fetchImpl: noFetch, log: quiet })
  assert.equal(retry.reason, 'pending', '캐시를 비우지 않아도 다시 읽기 기기에 맡깁니다')
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

test('교대 — 한 기기가 실패(차단)하면 살아 있는 다른 기기에 한 번 넘기고, 그 기기가 읽으면 성공 (운영자 26-09-13)', async () => {
  _resetJobs()
  const t = 100_000
  take({ now: t, workerId: 'server' }); take({ now: t, workerId: 'pc' })
  assert.deepEqual(workersOnline(t).map((w) => w.id).sort(), ['pc', 'server'])
  assert.equal(stats(t).workers.length, 2)
  const j = enqueue({ key: 'k', url: 'https://www.coupang.com/vp/products/5005', productId: '5005' })
  assert.deepEqual(take({ now: t + 1, workerId: 'server' }).map((x) => x.id), [j.id])
  const r1 = complete(j.id, { ok: false, reason: 'blocked', message: '차단됨 (Access Denied)' }, { now: t + 2 })
  assert.equal(r1.requeued, true); assert.equal(getJob(j.id).status, 'pending', '넘긴 작업은 아직 기다리는 중')
  assert.deepEqual(take({ now: t + 3, workerId: 'server' }), [], '실패한 기기에는 다시 주지 않습니다')
  assert.deepEqual(take({ now: t + 4, workerId: 'pc' }).map((x) => x.id), [j.id], '다른 기기가 가져갑니다')
  const r2 = complete(j.id, { ok: true, productName: '분유', productPrice: 21720 }, { now: t + 5 })
  assert.equal(r2.status, 'done')
  const rec = recentJobs(1)[0]
  assert.equal(rec.attempts, 1); assert.equal(rec.worker, 'pc'); assert.equal(rec.lastError, '차단됨 (Access Denied)')
  // 두 번째 실패는 넘기지 않습니다 (한 번만)
  const j2 = enqueue({ key: 'k2', url: 'https://www.coupang.com/vp/products/5006', productId: '5006' })
  take({ now: t + 6, workerId: 'server' })
  assert.equal(complete(j2.id, { ok: false, message: 'x' }, { now: t + 7 }).requeued, true)
  take({ now: t + 8, workerId: 'pc' })
  assert.equal(complete(j2.id, { ok: false, message: 'y' }, { now: t + 9 }).status, 'failed')
  // 다른 기기가 없으면 바로 실패, redirect 는 넘기지 않음
  _resetJobs()
  const j3 = enqueue({ key: 'k3', url: 'https://www.coupang.com/vp/products/5007', productId: '5007' })
  take({ now: t, workerId: 'server' })
  assert.equal(complete(j3.id, { ok: false, message: '시간 초과' }, { now: t + 1 }).status, 'failed')
  take({ now: t + 2, workerId: 'pc' })
  const j4 = enqueue({ key: 'k4', url: 'https://shop.coupang.com/A1/2', productId: null })
  take({ now: t + 3, workerId: 'server' })
  assert.equal(complete(j4.id, { ok: false, reason: 'redirect', redirect: 'https://www.coupang.com/vp/products/1' }, { now: t + 4 }).status, 'failed')
  // API 도 헤더의 기기 번호를 씁니다 — 차단 사유는 고객 조회에 그대로
  _resetJobs()
  await call(jobsHandler, { headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'srv-1' } })
  await call(jobsHandler, { headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'pc-1' } })
  const pend = await peekProduct('https://www.coupang.com/vp/products/5008', { fetchImpl: noFetch, log: quiet })
  const got = await call(jobsHandler, { headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'srv-1' } })
  assert.equal(got.body.jobs.length, 1); assert.equal(got.body.workers.length, 2)
  const posted = await call(jobHandler, { method: 'POST', query: { id: pend.jobId }, headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'srv-1' }, body: { ok: false, reason: 'blocked', message: '차단됨' } })
  assert.equal(posted.body.requeued, true); assert.equal(posted.body.status, 'pending')
  assert.equal((await call(peekHandler, { query: { job: pend.jobId } })).body.reason, 'pending', '고객 화면은 계속 기다립니다')
  assert.equal((await call(jobsHandler, { headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'srv-1' } })).body.jobs.length, 0)
  assert.equal((await call(jobsHandler, { headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'pc-1' } })).body.jobs.length, 1)
  await call(jobHandler, { method: 'POST', query: { id: pend.jobId }, headers: { 'x-admin-token': 'tok-worker', 'x-worker-id': 'pc-1' }, body: { ok: false, reason: 'blocked', message: '차단됨' } })
  assert.equal((await call(peekHandler, { query: { job: pend.jobId } })).body.reason, 'blocked', '둘 다 막히면 사유가 그대로 고객 조회에')
})

test('최근 작업 목록 — 운영자 상태 화면용, 최신순, 결과 요약만', () => {
  _resetJobs()
  const a = enqueue({ key: 'a', url: 'https://www.coupang.com/vp/products/1', productId: '1' })
  const b = enqueue({ key: 'b', url: 'https://www.coupang.com/vp/products/2', productId: '2' })
  take({ now: Date.now() })
  complete(a.id, { ok: true, productName: '분유 800g', productPrice: 21720, options: [{ label: 'x' }, { label: 'y' }] })
  complete(b.id, { ok: false, message: '시간 초과 (탭: Access Denied)' })
  const r = recentJobs(10)
  assert.equal(r.length, 2)
  assert.equal(r[0].productId, '2'); assert.equal(r[0].status, 'failed'); assert.equal(r[0].message, '시간 초과 (탭: Access Denied)')
  assert.equal(r[1].status, 'done'); assert.equal(r[1].productPrice, 21720); assert.equal(r[1].options, 2)
  assert.ok(!('result' in r[0]) && !('url' in r[0]), '요약 필드만 — 결과 원본·주소는 넣지 않습니다')
})
