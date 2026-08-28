/**
 * 인메모리 TTL 캐시 (stale-while-revalidate)
 *
 * 쿠팡 파트너스 API 는 호출 제한이 있어 사용자 요청마다 실시간 조회를 할 수 없습니다.
 * 따라서 TTL 캐시로 "준실시간"을 만들고, TTL 이 지나도 만료 직후에는
 * 낡은 값을 먼저 돌려준 뒤 백그라운드로 갱신합니다. (응답 지연 방지)
 *
 * ⚠️ 서버리스 환경에서는 인스턴스마다 캐시가 분리됩니다.
 *    프로덕션에서는 Redis / Vercel KV 등 외부 저장소로 교체하세요.
 */

const store = new Map()
const inflight = new Map()

export const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10분
export const STALE_TTL_MS = 60 * 60 * 1000 // 1시간까지는 낡은 값 허용

export function readCache(key) {
  const entry = store.get(key)
  if (!entry) return null
  const age = Date.now() - entry.storedAt
  return {
    value: entry.value,
    storedAt: entry.storedAt,
    age,
    fresh: age < entry.ttl,
    usable: age < STALE_TTL_MS,
  }
}

export function writeCache(key, value, ttl = DEFAULT_TTL_MS) {
  store.set(key, { value, storedAt: Date.now(), ttl })
  return value
}

/**
 * 캐시를 우선 사용하되, 없으면 fetcher 를 호출합니다.
 * 동일 키에 대한 동시 요청은 하나로 합쳐집니다. (thundering herd 방지)
 */
export async function withCache(key, fetcher, ttl = DEFAULT_TTL_MS) {
  const cached = readCache(key)
  if (cached?.fresh) {
    return { value: cached.value, fromCache: true, storedAt: cached.storedAt, stale: false }
  }

  if (inflight.has(key)) {
    const value = await inflight.get(key)
    return { value, fromCache: false, storedAt: Date.now(), stale: false }
  }

  const promise = (async () => {
    try {
      const value = await fetcher()
      writeCache(key, value, ttl)
      return value
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, promise)

  try {
    const value = await promise
    return { value, fromCache: false, storedAt: Date.now(), stale: false }
  } catch (error) {
    // 실패 시 만료된 값이라도 있으면 사용 (서비스 연속성 우선)
    if (cached?.usable) {
      return { value: cached.value, fromCache: true, storedAt: cached.storedAt, stale: true, error }
    }
    throw error
  }
}

export function clearCache() {
  store.clear()
  inflight.clear()
}
