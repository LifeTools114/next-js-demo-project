/**
 * 환율 관리 (운영자)
 *
 * GET  /api/admin/fx                현재 적용 환율·신선도
 * POST /api/admin/fx {refresh:true} 지금 바로 시세 갱신 (결과 반환)
 * POST /api/admin/fx {usdToKrw?, krwToVnd?} 수동 고정 (검증 후 적용)
 *
 * 자동 갱신은 확장 설정·견적 API 가 불릴 때 알아서 돌므로,
 * 이 API 는 확인·강제 갱신·수동 개입용입니다.
 */

import { requireAdmin, UnauthorizedError } from '../../../lib/auth.js'
import { fxStatus, refreshFx, applyRates } from '../../../lib/fx/refresh.js'

export default async function handler(req, res) {
  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e instanceof UnauthorizedError ? e.status : 401).json({ error: e.message })
  }

  if (req.method === 'GET') {
    return res.status(200).json({ fx: fxStatus() })
  }

  if (req.method === 'POST') {
    const { refresh, usdToKrw, krwToVnd } = req.body ?? {}

    if (refresh === true) {
      const result = await refreshFx({ force: true })
      return res.status(result.ok ? 200 : 502).json({ ...result, fx: fxStatus() })
    }

    const current = fxStatus()
    const result = applyRates({
      usdToKrw: usdToKrw ?? current.usdToKrw,
      krwToVnd: krwToVnd ?? current.krwToVnd,
      source: 'manual',
    })
    if (!result.applied) {
      return res.status(400).json({ error: '환율이 정상 범위를 벗어났습니다.', ...result })
    }
    return res.status(200).json({ ...result, fx: fxStatus() })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'GET 또는 POST 요청만 지원합니다.' })
}
