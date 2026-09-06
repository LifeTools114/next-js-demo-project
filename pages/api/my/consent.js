/** POST /api/my/consent { k, agreed } — 새 소식 받기 동의·철회 (고객 본인) */
import { findByKey, setMarketing, hasPin } from '../../../lib/customer/store.js'
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
  const { k, u, agreed } = req.body ?? {}
  const found = findByKey(typeof k === 'string' ? k : '')
  if (!found) return res.status(404).json({ error: '링크가 맞지 않거나 만료되었습니다.' })
  if (hasPin(found.customer) && !checkUnlock(found.entry.hash, typeof u === 'string' ? u : '')) return res.status(403).json({ pinRequired: true })
  const m = setMarketing(found.customer.id, agreed === true, 'my-page')
  return res.status(200).json({ marketing: m.agreed })
}
