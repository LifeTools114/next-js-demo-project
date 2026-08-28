/**
 * GET /api/admin/review — 사람이 봐야 할 것만 모은 검토 큐 (운영자)
 *
 * 자동화가 처리하지 못하고 남긴 건들입니다:
 *   paymentReview  대조 실패·부족·초과 입금 (.data/payment-review.jsonl)
 *   captureReview  쿠팡 주문 캡처 보류 (.data/coupang-capture-review.jsonl)
 *   notifications  최근 상태 전이 알림 (.data/notifications.jsonl)
 */

import { requireAdmin, UnauthorizedError } from '../../../lib/auth.js'
import { readLog } from '../../../lib/order/persist.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e instanceof UnauthorizedError ? e.status : 401).json({ error: e.message })
  }

  return res.status(200).json({
    paymentReview: readLog('payment-review.jsonl', { limit: 50 }),
    captureReview: readLog('coupang-capture-review.jsonl', { limit: 50 }),
    notifications: readLog('notifications.jsonl', { limit: 20 }),
  })
}
