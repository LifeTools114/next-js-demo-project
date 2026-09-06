/**
 * POST /api/my/recover { phone, orderNo } — 개인 링크 다시 받기
 *
 * 전화번호 + 그 번호로 접수돼 **입금까지 끝난** 주문번호 하나. 어느 쪽이 틀렸는지는
 * 말하지 않고, 같은 곳에서 5분에 5번까지만 받습니다 (남의 번호 더듬기 방지).
 */
import { getOrder } from '../../../lib/order/store.js'
import { recoverKey } from '../../../lib/customer/store.js'
import { allow, clientIp } from '../../../lib/throttle.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }
  if (!allow('recover', clientIp(req), { limit: 5, windowMs: 5 * 60_000 })) {
    return res.status(429).json({ error: '시도가 너무 많습니다. 5분 뒤 다시 해주세요.' })
  }
  const { phone, orderNo } = req.body ?? {}
  const key = recoverKey({ phone, orderNo, getOrder })
  if (!key) {
    return res.status(404).json({
      error: '전화번호와 주문번호가 맞지 않거나, 아직 입금이 확인되지 않은 주문입니다. 입금까지 끝난 주문번호로 시도해 주세요.',
    })
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ key })
}
