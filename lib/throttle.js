/**
 * 아주 작은 요청 제한 — 개인 링크 조회·복구처럼 "더듬어 보기"가 가능한 입구에만 씁니다.
 * 프로세스 메모리 기준(서버 한 대)이라 정확한 방어가 아니라 **속도를 늦추는** 장치입니다.
 */
const buckets = globalThis.__kbThrottle ?? (globalThis.__kbThrottle = new Map())

export function allow(bucket, id, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const key = `${bucket}:${id}`
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) { buckets.set(key, hits); return false }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) buckets.clear() // 메모리 상한 — 드문 일이라 단순하게
  return true
}

export const clientIp = (req) =>
  String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
