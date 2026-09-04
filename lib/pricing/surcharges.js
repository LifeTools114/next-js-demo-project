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
 * 액세서리 값의 상한 — 이 값을 넘으면 본체로 봅니다.
 * 케이스·필터·먼지통 같은 소모품은 몇 만원, 기기 본체는 수십만~수백만 원이라
 * 자릿수가 다릅니다.
 */
const ACCESSORY_MAX_KRW = 100_000

/** 구성품·증정을 알리는 표기 — 이 뒤에 나오는 액세서리는 '딸려 오는 것'입니다 */
const BUNDLE_MARK = /[+(\[/]|증정|포함|구성|사은품|세트/

/**
 * exclude(액세서리 오탐 방지)를 이 상품에 적용할 것인가.
 *
 * exclude 는 '휴대폰 케이스'처럼 **액세서리가 주 상품**일 때 기기 할증을
 * 빼려고 만든 목록입니다. 그런데 제목 전체에서 찾다 보니 실제 쿠팡 제목에
 * 흔한 구성품·규격 표기에도 걸렸습니다:
 *   '아이폰 15 프로 자급제 + 정품 케이스 증정'  → '케이스' 때문에 할증이 사라짐
 *   '다이슨 V15 무선청소기 0.77L 먼지통'        → '먼지통' 때문에 할증이 사라짐
 * 기기 1대당 $40(≈55,200원)을 못 받으면서 원가 $30 은 그대로 나갑니다.
 * 실제 쿠팡 제목 7종이 전부 이 함정에 걸렸습니다.
 *
 * 판정은 **값**으로 합니다. 제목만으로는 '휴대폰 케이스'와
 * '휴대폰(케이스 증정)'을 가르기 어렵지만 값은 자릿수가 다릅니다.
 * 값을 모를 때(요금 계산기처럼 가격 없이 부르는 경우)는 구성품 표기로 판단합니다.
 */
function accessoryIsMainProduct({ price, haystack, excludeAt }) {
  if (price > 0) return price <= ACCESSORY_MAX_KRW
  // 값을 모를 때: 구성품·증정 표기 뒤에 나오면 딸려 오는 것으로 봅니다.
  const before = haystack.slice(0, excludeAt)
  return !BUNDLE_MARK.test(before)
}

/**
 * @param {Array<{productName:string, categoryPath?:string, quantity?:number}>} items
 * @param {Array<{chargeableG:number}>} weightLines estimateShipmentWeight().lines (items 와 같은 순서)
 */
export function detectItemSurcharges(items = [], weightLines = []) {
  const hits = []

  items.forEach((item, i) => {
    const haystack = norm(`${item.productName || ''} ${item.categoryPath || ''}`)
    const qty = Math.max(1, Number(item.quantity) || 1)

    // 키워드 기반 할증(전자기기·파손주의 …)을 일괄 판정합니다.
    // exclude 는 액세서리 오탐 방지 — '휴대폰 케이스'에 기기 할증이 붙으면 안 됩니다.
    for (const [id, rule] of Object.entries(ITEM_SURCHARGES)) {
      if (!Array.isArray(rule?.keywords)) continue
      const excludeHit = rule.exclude?.find((kw) => haystack.includes(norm(kw)))
      if (excludeHit && accessoryIsMainProduct({
        price: Math.max(0, Number(item.productPrice) || 0),
        haystack,
        excludeAt: haystack.indexOf(norm(excludeHit)),
      })) continue
      const hit = rule.keywords.find((kw) => haystack.includes(norm(kw)))
      if (!hit) continue
      hits.push({
        id,
        label: rule.label,
        usd: round2(rule.usd * (rule.perUnit ? qty : 1)),
        count: rule.perUnit ? qty : 1,
        productName: item.productName,
        matchedKeyword: hit,
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
