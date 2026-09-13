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
  // 기기 번호 — 서버 크롬·PC 크롬을 구분해, 한쪽이 실패한 작업을 다른 쪽에 넘깁니다 (lib/peek-jobs.js)
  const workerId = String(req.headers?.['x-worker-id'] ?? '').replace(/[^\w.-]/g, '').slice(0, 40) || 'unknown'
  const jobs = take({ limit: Math.max(1, Math.min(Number(req.query?.limit) || 3, 10)), workerId })
  return res.status(200).json({ ok: true, jobs, ...stats() })
}
