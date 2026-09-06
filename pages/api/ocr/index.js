/**
 * POST /api/ocr  (본문 = 이미지 바이트, Content-Type: image/*)
 * 캡처 화면에서 상품명·가격·옵션을 읽어 돌려줍니다 (lib/ocr.js). 이미지는 저장하지 않습니다.
 */
import { ocrImage, MAX_IMAGE_BYTES } from '../../../lib/ocr.js'
import { allow, clientIp } from '../../../lib/throttle.js'

export const config = { api: { bodyParser: false } }

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { reject(new Error('too-large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' })
  }
  const type = String(req.headers['content-type'] ?? '')
  if (!type.startsWith('image/')) return res.status(400).json({ ok: false, error: '이미지만 받습니다.' })
  if (!allow('ocr-ip', clientIp(req), { limit: 10, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, reason: 'busy', error: '잠시 후 다시 시도해 주세요.' })
  }
  let body
  try { body = await readBody(req, MAX_IMAGE_BYTES) } catch { return res.status(413).json({ ok: false, reason: 'too-large', error: '이미지가 너무 큽니다 (8MB 까지).' }) }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(await ocrImage(body, type))
}
