/**
 * 고객 풀 (운영자)
 *   GET  /api/admin/customers                       전화번호별 고객 목록
 *   POST /api/admin/customers { action, phone, … }  issueLink · revoke · setMarketing · note
 */
import { listOrders } from '../../../lib/order/store.js'
import {
  listCustomers, findByPhone, upsertCustomer, issueKey, revokeKeys, setMarketing, getCustomer, clearPin,
} from '../../../lib/customer/store.js'
import { requireAdmin } from '../../../lib/auth.js'

export default function handler(req, res) {
  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e.status ?? 401).json({ error: e.message })
  }
  if (req.method === 'GET') {
    return res.status(200).json({ customers: listCustomers(listOrders()) })
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'GET 또는 POST 요청만 지원합니다.' })
  }
  const { action, phone } = req.body ?? {}
  // 기록이 없는 번호(예전 주문)는 최근 주문의 이름으로 기록을 만듭니다.
  const ensure = () => {
    const existing = findByPhone(phone)
    if (existing) return existing
    const latest = listOrders().find((o) => o.customer?.phone && String(o.customer.phone).replace(/\D/g, '').endsWith(String(phone).replace(/\D/g, '').slice(-8)))
    return upsertCustomer({ name: latest?.customer?.name ?? '', phone, email: latest?.customer?.email ?? '' }).customer
  }
  if (!phone) return res.status(400).json({ error: '전화번호가 필요합니다.' })

  if (action === 'issueLink') {
    const c = ensure()
    const key = issueKey(c.id, { verified: true, via: 'operator', label: String(req.body?.label ?? '').slice(0, 40) })
    const base = String(req.body?.base ?? '').replace(/\/$/, '')
    return res.status(200).json({ key, url: `${base}/my?k=${key}`, customerId: c.id })
  }
  if (action === 'revoke') {
    const c = findByPhone(phone)
    if (!c) return res.status(404).json({ error: '고객 기록이 없습니다.' })
    revokeKeys(c.id)
    return res.status(200).json({ ok: true })
  }
  if (action === 'resetPin') {
    const c = findByPhone(phone)
    if (!c) return res.status(404).json({ error: '고객 기록이 없습니다.' })
    clearPin(c.id)
    return res.status(200).json({ ok: true })
  }
  if (action === 'setMarketing') {
    const c = ensure()
    const m = setMarketing(c.id, req.body?.agreed === true, 'operator')
    return res.status(200).json({ marketing: m })
  }
  if (action === 'note') {
    const c = ensure()
    const cust = getCustomer(c.id)
    cust.notes = String(req.body?.notes ?? '').slice(0, 2000)
    cust.tags = Array.isArray(req.body?.tags) ? req.body.tags.map((t) => String(t).slice(0, 30)).slice(0, 20) : cust.tags
    setMarketing(c.id, cust.marketing.agreed, cust.marketing.source ?? 'operator') // persist 겸
    return res.status(200).json({ ok: true })
  }
  return res.status(400).json({ error: '알 수 없는 동작입니다.' })
}
