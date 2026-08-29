/**
 * 주문 목록 엑셀 다운로드 (운영자)
 *
 * GET /api/admin/orders-export            전체 주문 (최신순)
 * GET /api/admin/orders-export?state=PAID 해당 상태만
 *
 * UTF-8 BOM 을 붙인 CSV 라 엑셀에서 더블클릭으로 한글이 바로 열립니다.
 * 무게(추정·실측·청구)와 쿠팡 주문번호(매입·고객연결)까지 한 줄에 담아,
 * 물류사 대사·세무 정리·재고 확인을 이 파일 하나로 합니다.
 */

import { listOrders } from '../../../lib/order/store.js'
import { requireAdmin, UnauthorizedError } from '../../../lib/auth.js'
import { ORDER_STATES } from '../../../lib/order/states.js'

const escapeCsv = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** ISO → 'YYYY-MM-DD HH:mm' (한국시간) — 엑셀이 날짜로 바로 인식합니다 */
const kst = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
  } catch {
    return ''
  }
}

const kg = (g) => (Number.isFinite(g) && g > 0 ? (g / 1000).toFixed(2) : '')

export const COLUMNS = [
  '주문번호', '상태', '구분', '주문일',
  '수령인', '전화번호', '베트남 주소', '이메일',
  '상품', '쿠팡 주문번호', '국내 택배송장',
  '추정무게(kg)', '실측무게(kg)', '청구무게(kg)',
  '청구금액(원)', '청구금액(동)',
  '국제 운송장', '발송일', '배송완료일',
]

export function toOrdersCsv(orders) {
  const rows = orders.map((o) => {
    const finalKrw = o.settlement?.finalTotalKrw ?? o.invoice?.amountKrw ?? o.quote?.total ?? ''
    const finalVnd = Number.isFinite(finalKrw) && o.fx?.effectiveRate
      ? Math.round(finalKrw * o.fx.effectiveRate)
      : o.invoice?.amountVnd ?? ''
    return [
      o.orderNo,
      ORDER_STATES[o.state]?.label ?? o.state,
      o.track === 'forwarding' ? '배송대행' : '구매대행',
      kst(o.createdAt),
      o.customer?.name ?? '',
      o.customer?.phone ?? '',
      o.customer?.address ?? '',
      o.customer?.email ?? '',
      (o.items ?? []).map((i) => `${i.productName} × ${i.quantity}`).join(' / '),
      // 구매대행은 당사 매입 주문번호, 배송대행은 고객이 연결한 주문번호.
      o.procurement?.coupangOrderNo || o.inbound?.coupangOrderNo || '',
      (o.inbound?.trackingNos ?? []).join(' '),
      kg(o.quote?.weight?.chargeableG),
      kg(o.procurement?.actualWeightG),
      o.settlement?.finalBillableKg ?? o.quote?.shipping?.billableKg ?? '',
      finalKrw,
      finalVnd,
      o.delivery?.trackingNo ?? '',
      kst(o.delivery?.shippedAt),
      kst(o.delivery?.deliveredAt),
    ].map(escapeCsv).join(',')
  })
  // \uFEFF = UTF-8 BOM — 이게 있어야 한국어 엑셀이 더블클릭으로 바로 읽습니다.
  return '\uFEFF' + [COLUMNS.map(escapeCsv).join(','), ...rows].join('\r\n') + '\r\n'
}

export function ordersFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `orders-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}.csv`
}

export default function handler(req, res) {
  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e instanceof UnauthorizedError ? e.status : 401).json({ error: e.message })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  let orders = listOrders()
  const state = String(req.query.state ?? '').trim().toUpperCase()
  if (state) orders = orders.filter((o) => o.state === state)
  orders = [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

  if (orders.length === 0) {
    return res.status(404).json({ error: '내보낼 주문이 없습니다.' })
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${ordersFileName()}"`)
  return res.status(200).send(toOrdersCsv(orders))
}
