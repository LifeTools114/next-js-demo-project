/**
 * GET /api/product-peek?url=<상품 링크>
 * 폰 공유로 받은 링크의 이름·가격·용량을 서버가 읽어 돌려줍니다 (lib/product-peek.js).
 * 실패해도 200 + ok:false — 화면은 가격을 직접 적게 안내합니다.
 */
import { peekProduct } from '../../lib/product-peek.js'
import { allow, clientIp } from '../../lib/throttle.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'GET 요청만 지원합니다.' })
  }
  const url = String(req.query?.url ?? '').slice(0, 1000)
  if (!url) return res.status(400).json({ ok: false, error: 'url 이 필요합니다.' })
  if (!allow('peek-ip', clientIp(req), { limit: 12, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, reason: 'busy', error: '잠시 후 다시 시도해 주세요.' })
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(await peekProduct(url))
}
