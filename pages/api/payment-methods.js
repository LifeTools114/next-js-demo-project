/** GET /api/payment-methods — 현재 설정되어 사용 가능한 수금 수단 */
import { availableMethods } from '../../lib/payment/methods'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }
  return res.status(200).json({ methods: availableMethods() })
}
