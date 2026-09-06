/**
 * GET /api/my?k=<열쇠>[&u=<잠금 해제 표시>]  — 개인 링크로 내 주문 전체 (고객)
 *
 * 열쇠는 서버에 해시로만 있습니다. 미확인 열쇠(입금 전)는 그 열쇠로 만든 주문만,
 * 확인된 열쇠는 이 전화번호의 주문 전부를 돌려줍니다. 원가·마진이 없는 고객용 뷰만.
 * PIN 을 걸어 둔 고객은 /api/my/unlock 에서 받은 표시(u)가 있어야 합니다.
 */
import { listOrders, customerView } from '../../../lib/order/store.js'
import { findByKey, visibleOrders, hasPin } from '../../../lib/customer/store.js'
import { checkUnlock } from '../../../lib/customer/session.js'
import { allow, clientIp } from '../../../lib/throttle.js'
import { maskPhone } from '../../../lib/mask.js'

export { maskPhone }

export function myView(found) {
  const orders = visibleOrders(found, listOrders()).map(customerView)
  return {
    customer: {
      name: found.customer.name,
      phone: maskPhone(found.customer.phone),
      marketing: Boolean(found.customer.marketing?.agreed),
      verified: Boolean(found.entry.verified),
      pin: hasPin(found.customer),
      messenger: found.customer.messenger ?? '',
    },
    orders,
  }
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }
  if (!allow('my', clientIp(req), { limit: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: '잠시 후 다시 시도해 주세요.' })
  }
  const k = typeof req.query.k === 'string' ? req.query.k : ''
  const found = findByKey(k)
  if (!found) return res.status(404).json({ error: '링크가 맞지 않거나 만료되었습니다.' })
  res.setHeader('Cache-Control', 'no-store')
  if (hasPin(found.customer) && !checkUnlock(found.entry.hash, typeof req.query.u === 'string' ? req.query.u : '')) {
    return res.status(403).json({ pinRequired: true, name: found.customer.name })
  }
  return res.status(200).json(myView(found))
}
