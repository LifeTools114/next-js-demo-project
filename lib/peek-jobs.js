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
const state = globalThis.__kbPeekJobs ?? (globalThis.__kbPeekJobs = { jobs: new Map(), lastPollAt: 0, seq: 0, pollers: new Map() })
// 옛 프로세스 상태(pollers 없이 만든 것)도 그대로 씁니다
if (!state.pollers) state.pollers = new Map()

const ONLINE_MS = 20_000      // 이 안에 가져간 적이 있으면 「읽기 기기 살아 있음」
const TAKE_TTL_MS = 30_000    // 가져간 뒤 이만큼 결과가 없으면 다른 기기가 다시 가져갈 수 있음
const JOB_TTL_MS = 3 * 60_000

const gc = () => {
  const now = Date.now()
  for (const [id, j] of state.jobs) if (now - j.createdAt > JOB_TTL_MS) state.jobs.delete(id)
}

export const workerOnline = (now = Date.now()) => now - state.lastPollAt < ONLINE_MS

/** 살아 있는 읽기 기기들 — 서버 크롬·PC 크롬이 각자 X-Worker-Id 로 확인합니다 */
export const workersOnline = (now = Date.now()) =>
  [...state.pollers].filter(([, at]) => now - at < ONLINE_MS).map(([id, at]) => ({ id, lastPollAt: at }))
const otherWorkerOnline = (exclude, now) => workersOnline(now).some((w) => w.id !== exclude)

/** 같은 상품(캐시 키)의 진행 중 작업이 있으면 그것을 돌려줍니다 */
export function enqueue({ key, url, productId, itemId = null, vendorItemId = null }) {
  gc()
  for (const j of state.jobs.values()) if (j.key === key && j.status === 'pending') return j
  state.seq += 1
  const job = {
    id: `pj_${Date.now().toString(36)}_${state.seq.toString(36)}`,
    key, url, productId, itemId, vendorItemId,
    status: 'pending', createdAt: Date.now(), takenAt: 0, result: null,
    attempts: 0, takenBy: null, avoid: null, lastError: null,
  }
  state.jobs.set(job.id, job)
  return job
}

/**
 * 읽기 기기가 가져갑니다 — 아직 아무도 안 가져갔거나, 가져간 지 오래된 것만.
 * 한 기기가 실패해 다른 기기에 넘긴 작업(avoid)은 그 기기에는 다시 주지 않습니다.
 */
export function take({ limit = 3, now = Date.now(), workerId = 'w' } = {}) {
  gc()
  state.lastPollAt = now
  state.pollers.set(workerId, now)
  const out = []
  for (const j of state.jobs.values()) {
    if (j.status !== 'pending') continue
    if (j.takenAt && now - j.takenAt < TAKE_TTL_MS) continue
    if (j.avoid && j.avoid === workerId) continue
    j.takenAt = now
    j.takenBy = workerId
    out.push({ id: j.id, url: j.url, productId: j.productId })
    if (out.length >= limit) break
  }
  return out
}

/**
 * 결과 접수. 실패(차단·시간 초과)인데 **다른 읽기 기기가 살아 있으면** 한 번은 그 기기에 넘깁니다 —
 * 서버 크롬이 쇼핑몰에 막혀도 PC 크롬이 이어받게 (운영자 26-09-13: "안 되면 될 수 있는 방법"). 상품 주소를 찾아
 * 돌려준 것(redirect)은 실패가 아니라 넘기지 않습니다. 넘긴 작업은 pending 그대로라 고객 화면은 계속 기다립니다.
 */
export function complete(id, result, { now = Date.now() } = {}) {
  const j = state.jobs.get(id)
  if (!j || j.status !== 'pending') return null
  const failed = !result?.ok
  if (failed && result?.reason !== 'redirect' && j.takenBy && (j.attempts ?? 0) < 1 && otherWorkerOnline(j.takenBy, now)) {
    j.attempts = (j.attempts ?? 0) + 1
    j.avoid = j.takenBy
    j.takenAt = 0
    j.lastError = result?.message ?? null
    return { ...j, requeued: true }
  }
  j.status = failed ? 'failed' : 'done'
  j.result = result ?? { ok: false }
  j.doneAt = now
  return j
}

export const getJob = (id) => state.jobs.get(id) ?? null

export function stats(now = Date.now()) {
  gc()
  let pending = 0
  for (const j of state.jobs.values()) if (j.status === 'pending') pending += 1
  return { online: workerOnline(now), lastPollAt: state.lastPollAt, pending, workers: workersOnline(now) }
}

/** 최근 작업 — 운영자 상태 화면용 (상품 번호·결과만, 고객 정보 없음). 최신순 */
export function recentJobs(limit = 10) {
  gc()
  return [...state.jobs.values()]
    .reverse() // Map 은 넣은 순서를 지킵니다 — 같은 밀리초에 만든 작업도 최신이 앞에
    .slice(0, limit)
    .map((j) => ({
      id: j.id, productId: j.productId, status: j.status, createdAt: j.createdAt, takenAt: j.takenAt || null, doneAt: j.doneAt ?? null,
      productName: j.result?.productName ?? null, productPrice: j.result?.productPrice ?? null,
      options: Array.isArray(j.result?.options) ? j.result.options.length : 0, message: j.result?.message ?? null,
      attempts: j.attempts ?? 0, worker: j.takenBy ?? null, lastError: j.lastError ?? null,
    }))
}

export function _resetJobs() { state.jobs.clear(); state.lastPollAt = 0; state.seq = 0; state.pollers.clear() }
