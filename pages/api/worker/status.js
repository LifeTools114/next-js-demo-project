/**
 * GET /api/worker/status — 「대신 읽기」가 살아 있는지와 최근 작업 (운영자 토큰 필수). /admin 이 보여줍니다.
 * 작업을 가져가지는 않습니다 (가져가는 것은 GET /api/worker/jobs).
 */
import { requireAdmin, UnauthorizedError } from '../../../lib/auth.js'
import { stats, recentJobs } from '../../../lib/peek-jobs.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'GET 요청만 지원합니다.' })
  }
  try { requireAdmin(req) } catch (e) {
    if (e instanceof UnauthorizedError) return res.status(401).json({ ok: false, error: e.message })
    throw e
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true, ...stats(), now: Date.now(), recent: recentJobs(10) })
}
