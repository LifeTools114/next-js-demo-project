/**
 * GET /api/worker/jobs — 읽기 기기(운영자 PC 확장·폰)가 대신 읽을 상품 링크를 가져갑니다 (운영자 토큰 필수).
 * 가져간 순간부터 서버는 「읽기 기기 살아 있음」으로 보고 고객 링크를 이 줄에 넣습니다.
 */
import { requireAdmin, UnauthorizedError } from '../../../../lib/auth.js'
import { take, stats } from '../../../../lib/peek-jobs.js'

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
  const jobs = take({ limit: Math.max(1, Math.min(Number(req.query?.limit) || 3, 10)) })
  return res.status(200).json({ ok: true, jobs, ...stats() })
}
