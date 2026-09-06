/**
 * POST /api/my/pin { k, u?, pin?, remove? } — PIN 걸기·바꾸기·풀기 (고객 본인)
 * 이미 PIN 이 있으면 잠금 해제 표시(u)가 있어야 바꾸거나 풀 수 있습니다.
 */
import { findByKey, hasPin, setPin, clearPin } from '../../../lib/customer/store.js'
import { checkUnlock } from '../../../lib/customer/session.js'
import { allow, clientIp } from '../../../lib/throttle.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }
  if (!allow('my', clientIp(req), { limit: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: '잠시 후 다시 시도해 주세요.' })
  }
  const { k, u, pin, remove } = req.body ?? {}
  const found = findByKey(typeof k === 'string' ? k : '')
  if (!found) return res.status(404).json({ error: '링크가 맞지 않거나 만료되었습니다.' })
  if (hasPin(found.customer) && !checkUnlock(found.entry.hash, typeof u === 'string' ? u : '')) {
    return res.status(403).json({ pinRequired: true })
  }
  try {
    if (remove === true) { clearPin(found.customer.id); return res.status(200).json({ pin: false }) }
    setPin(found.customer.id, pin)
    return res.status(200).json({ pin: true })
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
}
