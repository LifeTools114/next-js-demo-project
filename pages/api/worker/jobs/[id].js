/**
 * POST /api/worker/jobs/:id — 읽기 기기가 읽은 결과 (운영자 토큰 필수)
 * body: { ok, productName, productPrice, spec, badges, categoryPath, shippingText, blocked? } 또는 { ok:false, message }
 * 성공이면 상품 캐시에도 넣어, 같은 상품은 다음부터 바로 나옵니다.
 */
import { requireAdmin, UnauthorizedError } from '../../../../lib/auth.js'
import { complete, getJob } from '../../../../lib/peek-jobs.js'
import { rememberPeek } from '../../../../lib/product-peek.js'

const str = (v, n) => String(v ?? '').slice(0, n)

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' })
  }
  try { requireAdmin(req) } catch (e) {
    if (e instanceof UnauthorizedError) return res.status(401).json({ ok: false, error: e.message })
    throw e
  }
  const id = str(req.query?.id, 60)
  const job = getJob(id)
  if (!job) return res.status(404).json({ ok: false, error: '작업을 찾을 수 없습니다.' })
  const b = req.body ?? {}
  const price = Number(b.productPrice)
  const result = b.ok && (b.productName || price > 0)
    ? {
        ok: true,
        productName: str(b.productName, 300),
        productPrice: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
        spec: b.spec ? str(b.spec, 120) : null,
        badges: Array.isArray(b.badges) ? b.badges.slice(0, 12).map((x) => str(x, 40)) : [],
        categoryPath: str(b.categoryPath, 200),
        shippingText: str(b.shippingText, 300),
        blocked: b.blocked ? str(b.blocked, 80) : null,
        via: 'worker',
      }
    : { ok: false, message: str(b.message, 200) }
  const done = complete(id, result)
  if (!done) return res.status(409).json({ ok: false, error: '이미 끝난 작업입니다.' })
  if (result.ok) rememberPeek({ productId: job.productId, itemId: job.itemId, vendorItemId: job.vendorItemId, url: job.url }, result)
  return res.status(200).json({ ok: true, status: done.status })
}
