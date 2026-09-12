/**
 * POST /api/worker/jobs/:id — 읽기 기기가 읽은 결과 (운영자 토큰 필수)
 * body: { ok, productName, productPrice, spec, badges, categoryPath, shippingText, blocked?, productUrl?, options? }
 *       또는 { ok:false, message }. 정리 규칙은 lib/peek-result.js.
 * 성공이면 상품 캐시에도 넣어, 같은 상품(같은 옵션)은 다음부터 바로 나옵니다.
 */
import { requireAdmin, UnauthorizedError } from '../../../../lib/auth.js'
import { complete, getJob } from '../../../../lib/peek-jobs.js'
import { rememberPeek } from '../../../../lib/product-peek.js'
import { sanitizeWorkerResult } from '../../../../lib/peek-result.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' })
  }
  try { requireAdmin(req) } catch (e) {
    if (e instanceof UnauthorizedError) return res.status(401).json({ ok: false, error: e.message })
    throw e
  }
  const id = String(req.query?.id ?? '').slice(0, 60)
  const job = getJob(id)
  if (!job) return res.status(404).json({ ok: false, error: '작업을 찾을 수 없습니다.' })
  const result = sanitizeWorkerResult(req.body, { productId: job.productId })
  const done = complete(id, result)
  if (!done) return res.status(409).json({ ok: false, error: '이미 끝난 작업입니다.' })
  if (result.ok) rememberPeek({ productId: job.productId, itemId: job.itemId, vendorItemId: job.vendorItemId, url: job.url }, result)
  return res.status(200).json({ ok: true, status: done.status })
}
