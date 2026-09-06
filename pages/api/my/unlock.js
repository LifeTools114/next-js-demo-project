/** POST /api/my/unlock { k, pin } — PIN 확인 → 12시간 잠금 해제 표시 + 내 주문 */
import { findByKey, checkPin } from '../../../lib/customer/store.js'
import { makeUnlock } from '../../../lib/customer/session.js'
import { allow, clientIp } from '../../../lib/throttle.js'
import { myView } from './index.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }
  if (!allow('unlock', clientIp(req), { limit: 20, windowMs: 5 * 60_000 })) {
    return res.status(429).json({ error: '시도가 너무 많습니다. 잠시 뒤 다시 해주세요.' })
  }
  const { k, pin } = req.body ?? {}
  const found = findByKey(typeof k === 'string' ? k : '')
  if (!found) return res.status(404).json({ error: '링크가 맞지 않거나 만료되었습니다.' })
  const r = checkPin(found.customer.id, pin)
  if (r === 'locked') return res.status(423).json({ error: 'PIN 을 여러 번 틀려 15분 동안 잠겼습니다.' })
  if (r === 'wrong') return res.status(403).json({ error: 'PIN 이 맞지 않습니다.' })
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ unlock: makeUnlock(found.entry.hash), ...myView(found) })
}
