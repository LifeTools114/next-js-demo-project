/**
 * 「대신 읽기」 작업 줄 — 고객이 넣은 상품 링크를, 진짜 브라우저가 있는 사장님 기기(PC 확장·폰)가
 * 대신 열어 이름·가격·용량을 읽어 오게 하는 창구 (운영자 아이디어 26-09-07: "내 폰이 주소 변환 서버 역할").
 *
 *   고객 화면 → GET /api/product-peek?url=…  → 읽기 기기가 살아 있으면 여기 줄에 넣고 「기다리는 중」
 *   읽기 기기 → GET /api/worker/jobs (운영자 토큰) 로 가져가서 열어 읽고 → POST /api/worker/jobs/:id 로 결과
 *   고객 화면 → GET /api/product-peek?job=… 로 몇 초 동안 물어봄 → 결과가 오면 채움, 늦으면 직접 적기
 *
 * 메모리 안에서만 삽니다(서버 한 대). 작업은 3분이면 지웁니다. 상품 정보 외에 고객 정보는 담지 않습니다.
 */
const state = globalThis.__kbPeekJobs ?? (globalThis.__kbPeekJobs = { jobs: new Map(), lastPollAt: 0, seq: 0 })

const ONLINE_MS = 20_000      // 이 안에 가져간 적이 있으면 「읽기 기기 살아 있음」
const TAKE_TTL_MS = 30_000    // 가져간 뒤 이만큼 결과가 없으면 다른 기기가 다시 가져갈 수 있음
const JOB_TTL_MS = 3 * 60_000

const gc = () => {
  const now = Date.now()
  for (const [id, j] of state.jobs) if (now - j.createdAt > JOB_TTL_MS) state.jobs.delete(id)
}

export const workerOnline = (now = Date.now()) => now - state.lastPollAt < ONLINE_MS

/** 같은 상품(캐시 키)의 진행 중 작업이 있으면 그것을 돌려줍니다 */
export function enqueue({ key, url, productId, itemId = null, vendorItemId = null }) {
  gc()
  for (const j of state.jobs.values()) if (j.key === key && j.status === 'pending') return j
  state.seq += 1
  const job = {
    id: `pj_${Date.now().toString(36)}_${state.seq.toString(36)}`,
    key, url, productId, itemId, vendorItemId,
    status: 'pending', createdAt: Date.now(), takenAt: 0, result: null,
  }
  state.jobs.set(job.id, job)
  return job
}

/** 읽기 기기가 가져갑니다 — 아직 아무도 안 가져갔거나, 가져간 지 오래된 것만 */
export function take({ limit = 3, now = Date.now() } = {}) {
  gc()
  state.lastPollAt = now
  const out = []
  for (const j of state.jobs.values()) {
    if (j.status !== 'pending') continue
    if (j.takenAt && now - j.takenAt < TAKE_TTL_MS) continue
    j.takenAt = now
    out.push({ id: j.id, url: j.url, productId: j.productId })
    if (out.length >= limit) break
  }
  return out
}

export function complete(id, result) {
  const j = state.jobs.get(id)
  if (!j || j.status !== 'pending') return null
  j.status = result?.ok ? 'done' : 'failed'
  j.result = result ?? { ok: false }
  j.doneAt = Date.now()
  return j
}

export const getJob = (id) => state.jobs.get(id) ?? null

export function stats(now = Date.now()) {
  gc()
  let pending = 0
  for (const j of state.jobs.values()) if (j.status === 'pending') pending += 1
  return { online: workerOnline(now), lastPollAt: state.lastPollAt, pending }
}

export function _resetJobs() { state.jobs.clear(); state.lastPollAt = 0; state.seq = 0 }
