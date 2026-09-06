/**
 * 고객 목록 CSV (운영자)
 *   GET /api/admin/customers-export               전체
 *   GET /api/admin/customers-export?marketing=1   새 소식 받기에 동의한 고객만
 *
 * 엑셀 수식 주입 방지: = + - @ 로 시작하는 칸은 앞에 ' 를 붙입니다.
 */
import { listOrders } from '../../../lib/order/store.js'
import { listCustomers } from '../../../lib/customer/store.js'
import { requireAdmin } from '../../../lib/auth.js'

export const escapeCsv = (v) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const kst = (iso) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16) } catch { return '' }
}

export const COLUMNS = ['이름', '전화번호', '이메일', '카카오톡/Zalo', '주문 수', '입금 완료 수', '첫 주문', '최근 주문', '누적 결제(원)', '소식 동의', '동의 시각', '태그', '메모']

export function toCustomersCsv(rows) {
  const lines = rows.map((c) => [
    c.name, c.phone, c.email, c.messenger, c.orderCount, c.paidCount, kst(c.firstOrderAt), kst(c.lastOrderAt), c.totalKrw,
    c.marketing?.agreed ? '동의' : '', kst(c.marketing?.at), (c.tags ?? []).join(' '), c.notes ?? '',
  ].map(escapeCsv).join(','))
  return '﻿' + [COLUMNS.map(escapeCsv).join(','), ...lines].join('\r\n') + '\r\n'
}

export default function handler(req, res) {
  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e.status ?? 401).json({ error: e.message })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }
  let rows = listCustomers(listOrders())
  if (String(req.query.marketing ?? '') === '1') rows = rows.filter((c) => c.marketing?.agreed)
  if (rows.length === 0) return res.status(404).json({ error: '내보낼 고객이 없습니다.' })
  const d = new Date(), p = (n) => String(n).padStart(2, '0')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="customers-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv"`)
  return res.status(200).send(toCustomersCsv(rows))
}
