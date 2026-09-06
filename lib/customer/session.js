/**
 * PIN 잠금 해제 표시 — 상태를 서버에 두지 않는 짧은 서명(HMAC).
 *
 * 고객이 PIN 을 맞히면 이 표시를 받아 12시간 동안 다시 묻지 않습니다.
 * 표시는 열쇠 해시에 묶여 있어 다른 링크에는 쓸 수 없고, 서버가 재시작하면
 * (비밀이 바뀌어) 다시 PIN 을 묻습니다 — 안전한 쪽으로 실패합니다.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.SESSION_SECRET || (globalThis.__kbSessionSecret ??= randomBytes(32).toString('hex'))
const TTL_MS = 12 * 60 * 60 * 1000

const sign = (keyHash, exp) => createHmac('sha256', SECRET).update(`${keyHash}.${exp}`).digest('base64url')

export function makeUnlock(keyHash) {
  const exp = Date.now() + TTL_MS
  return `${exp}.${sign(keyHash, exp)}`
}

export function checkUnlock(keyHash, token) {
  if (!token || typeof token !== 'string') return false
  const [expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false
  const want = sign(keyHash, exp)
  const a = Buffer.from(sig), b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}
