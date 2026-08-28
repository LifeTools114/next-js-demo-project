/**
 * 적하목록(매니페스트) 생성 — 발송 서류 수기 작성을 없앱니다.
 *
 * 발송 준비(SETTLED) 주문들을 물류사 양식(config/manifest.js)에 맞춘
 * CSV 로 뽑습니다. UTF-8 BOM 을 붙여 엑셀에서 한글이 바로 열립니다.
 */

import { MANIFEST } from '../config/manifest.js'

const TRACK_LABEL = { agent: '구매대행', forwarding: '배송대행' }

/** 주문 → 매니페스트 한 행 */
export function manifestRow(order, index) {
  const items = order.items ?? []
  const goodsKrw = items.reduce((s, i) => s + (Number(i.productPrice) || 0) * (Number(i.quantity) || 1), 0)
  // 신고가치는 주문 시점에 동결한 환율로 환산해야 청구서와 어긋나지 않습니다.
  const usdRate = order.fx?.usdToKrw || 1380
  const weightG = order.procurement?.actualWeightG ?? order.quote?.weight?.chargeableG ?? 0

  return {
    no: index + 1,
    orderNo: order.orderNo,
    recipient: order.customer?.name ?? '',
    phone: order.customer?.phone ?? '',
    address: order.customer?.address ?? '',
    zone: order.zone ?? '',
    items: items.map((i) => `${i.productName} x${i.quantity}`).join('; '),
    quantity: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0),
    weightKg: (weightG / 1000).toFixed(2),
    declaredUsd: (goodsKrw / usdRate).toFixed(2),
    coupangOrderNo: order.procurement?.coupangOrderNo ?? order.inbound?.coupangOrderNo ?? '',
    track: TRACK_LABEL[order.track] ?? order.track,
    memo: '',
  }
}

const escapeCsv = (v) => {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 행 배열 → 물류사 양식 CSV (BOM 포함) */
export function toManifestCsv(orders) {
  const header = MANIFEST.columns.map((c) => escapeCsv(c.label)).join(',')
  const lines = orders.map((order, i) => {
    const row = manifestRow(order, i)
    return MANIFEST.columns.map((c) => escapeCsv(row[c.key])).join(',')
  })
  return '\ufeff' + [header, ...lines].join('\r\n') + '\r\n'
}

export function manifestFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${MANIFEST.filePrefix}-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}.csv`
}
