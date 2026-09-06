/**
 * POST /api/ocr/text  (본문 = 글자, text/plain)
 * 공유로 온 결제 완료 알림 문자 등을 캡처 없이 해석합니다 — 규칙은 캡처와 같습니다 (lib/ocr.js interpretText).
 */
import { interpretText } from '../../../lib/ocr.js'
import { allow, clientIp } from '../../../lib/throttle.js'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' })
  }
  if (!allow('ocr-text-ip', clientIp(req), { limit: 30, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, reason: 'busy' })
  }
  const chunks = []
  let size = 0
  for await (const c of req) { size += c.length; if (size > 64 * 1024) return res.status(413).json({ ok: false, reason: 'too-large' }); chunks.push(c) }
  const text = Buffer.concat(chunks).toString('utf8')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(interpretText(text))
}
