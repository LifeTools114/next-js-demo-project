/**
 * 환율 자동 갱신 — config 수동 수정을 없앱니다.
 *
 * 무료·무키 환율 API(기본: open.er-api.com)에서 USD 기준 시세를 받아
 *   usdToKrw = KRW 시세, krwToVnd = VND 시세 ÷ KRW 시세
 * 로 환산해 적용합니다. 스프레드(고객 마진)는 그대로 유지됩니다.
 *
 * 안전장치:
 *   - 정상 범위를 벗어난 값은 절대 적용하지 않습니다 (API 오염 방어)
 *   - 실패하면 기존 값 유지 — 환율이 죽어도 서비스는 돌아갑니다
 *   - 적용 값은 파일에 남아 재시작 후에도 이어집니다
 *   - 주문은 생성 시점 환율을 동결하므로 소급 영향이 없습니다
 *
 * 갱신 트리거는 요청 경로의 ensureFreshFx() — 확장 설정·견적 API 가
 * 불릴 때 오래됐으면 백그라운드로 한 번 갱신합니다. (별도 크론 불필요)
 */

import { FX } from '../../config/fx.js'
import { readState, writeState, appendLog } from '../order/persist.js'

const STATE_FILE = 'fx.json'
const DEFAULT_SOURCE = 'https://open.er-api.com/v6/latest/USD'

/** 이 범위를 벗어나면 API 가 무너진 것으로 보고 버립니다 */
const LIMITS = {
  usdToKrw: [800, 3000],
  krwToVnd: [10, 35],
}

const refreshHours = () => {
  const n = Number.parseFloat(process.env.FX_REFRESH_HOURS)
  return Number.isFinite(n) && n > 0 ? n : 12
}

const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi

let fetchedAt = null // 마지막으로 적용된 시세의 시각
let lastAttemptAt = 0 // 실패 반복 시 재시도 과열 방지

/** 검증 통과 시에만 라이브 FX 를 바꿉니다 */
export function applyRates({ usdToKrw, krwToVnd, fetchedAt: at, source }) {
  if (!inRange(usdToKrw, LIMITS.usdToKrw) || !inRange(krwToVnd, LIMITS.krwToVnd)) {
    return { applied: false, reason: 'out-of-range', usdToKrw, krwToVnd }
  }
  FX.usdToKrw = Math.round(usdToKrw * 100) / 100
  FX.krwToVnd = Math.round(krwToVnd * 10000) / 10000
  FX.updatedAt = at ?? new Date().toISOString()
  fetchedAt = FX.updatedAt
  writeState(STATE_FILE, { usdToKrw: FX.usdToKrw, krwToVnd: FX.krwToVnd, fetchedAt: FX.updatedAt, source: source ?? null })
  return { applied: true, usdToKrw: FX.usdToKrw, krwToVnd: FX.krwToVnd }
}

/** 부팅 시 1회 — 마지막으로 적용했던 시세 복원 (env 기본값보다 최신) */
function loadPersisted() {
  const s = readState(STATE_FILE)
  if (!s) return
  if (inRange(s.usdToKrw, LIMITS.usdToKrw) && inRange(s.krwToVnd, LIMITS.krwToVnd)) {
    FX.usdToKrw = s.usdToKrw
    FX.krwToVnd = s.krwToVnd
    FX.updatedAt = s.fetchedAt ?? FX.updatedAt
    fetchedAt = s.fetchedAt ?? null
  }
}
loadPersisted()

export function fxStatus() {
  const ageMs = fetchedAt ? Date.now() - Date.parse(fetchedAt) : Infinity
  return {
    usdToKrw: FX.usdToKrw,
    krwToVnd: FX.krwToVnd,
    spread: FX.spread,
    fetchedAt,
    stale: ageMs > refreshHours() * 3600 * 1000,
  }
}

/** 시세를 받아 적용합니다. 실패해도 던지지 않고 결과만 알립니다. */
export async function refreshFx({ fetchImpl = fetch, force = false } = {}) {
  if (!force && !fxStatus().stale) return { ok: true, skipped: true }

  const url = process.env.FX_SOURCE_URL || DEFAULT_SOURCE
  try {
    const res = await fetchImpl(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const krw = Number(data?.rates?.KRW)
    const vnd = Number(data?.rates?.VND)
    if (!krw || !vnd) throw new Error('응답에 KRW/VND 시세가 없습니다')

    const result = applyRates({
      usdToKrw: krw,
      krwToVnd: vnd / krw,
      fetchedAt: new Date().toISOString(),
      source: url,
    })
    appendLog('fx.jsonl', { event: result.applied ? 'fx-refresh' : 'fx-rejected', ...result, source: url })
    return { ok: result.applied, ...result }
  } catch (error) {
    appendLog('fx.jsonl', { event: 'fx-refresh-failed', error: error.message, source: url })
    return { ok: false, error: error.message }
  }
}

/**
 * 요청 경로용 — 오래됐으면 백그라운드로 갱신을 시작하고 즉시 돌아갑니다.
 * 응답 지연 0, 실패해도 기존 환율로 계속 동작합니다.
 */
export function ensureFreshFx() {
  if (!fxStatus().stale) return
  if (Date.now() - lastAttemptAt < 10 * 60 * 1000) return // 실패 반복 과열 방지
  lastAttemptAt = Date.now()
  refreshFx().catch(() => { /* 결과는 fx.jsonl 에 남습니다 */ })
}
