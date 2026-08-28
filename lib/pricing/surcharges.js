/**
 * 상품 할증 판정
 *
 * "배송 불가"(eligibility)까지는 아니지만 추가 취급비가 붙는 품목을 찾습니다.
 *   fragile — 도자기·유리 식기 등 (키워드, 개당)
 *   bulky   — 한 품목 청구무게 10kg 이상 (무게 엔진 결과, 건당)
 *
 * 일반 화장품 유리용기(크림 단지·세럼 스포이드)는 업계 표준 포장이라
 * 할증하지 않습니다 — 가장 흔한 품목에 $2 씩 붙이면 견적만 부풀립니다.
 */

import { ITEM_SURCHARGES } from '../../config/shipping.js'
import { usdToKrw } from './shipping.js'

const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, '')
const round2 = (n) => Math.round(n * 100) / 100

/**
 * @param {Array<{productName:string, categoryPath?:string, quantity?:number}>} items
 * @param {Array<{chargeableG:number}>} weightLines estimateShipmentWeight().lines (items 와 같은 순서)
 */
export function detectItemSurcharges(items = [], weightLines = []) {
  const hits = []

  items.forEach((item, i) => {
    const haystack = norm(`${item.productName || ''} ${item.categoryPath || ''}`)
    const qty = Math.max(1, Number(item.quantity) || 1)

    const fragile = ITEM_SURCHARGES.fragile
    const fragileHit = fragile?.keywords?.find((kw) => haystack.includes(norm(kw)))
    if (fragileHit) {
      hits.push({
        id: 'fragile',
        label: fragile.label,
        usd: round2(fragile.usd * (fragile.perUnit ? qty : 1)),
        count: fragile.perUnit ? qty : 1,
        productName: item.productName,
        matchedKeyword: fragileHit,
      })
    }

    const bulky = ITEM_SURCHARGES.bulky
    const perItemKg = (weightLines[i]?.chargeableG ?? 0) / 1000
    if (bulky && perItemKg >= bulky.thresholdKg) {
      hits.push({
        id: 'bulky',
        label: bulky.label,
        usd: bulky.usd,
        count: 1,
        productName: item.productName,
        matchedKeyword: `${perItemKg.toFixed(1)}kg`,
      })
    }
  })

  // 유형별 합산 (견적 명세에는 유형당 한 줄)
  const byId = {}
  for (const h of hits) {
    byId[h.id] ??= { id: h.id, label: h.label, usd: 0, count: 0, items: [] }
    byId[h.id].usd = round2(byId[h.id].usd + h.usd)
    byId[h.id].count += h.count
    byId[h.id].items.push(h.productName)
  }
  const rows = Object.values(byId).map((r) => ({ ...r, krw: usdToKrw(r.usd) }))

  return {
    rows,
    hits,
    totalUsd: round2(rows.reduce((s, r) => s + r.usd, 0)),
    totalKrw: rows.reduce((s, r) => s + r.krw, 0),
  }
}
