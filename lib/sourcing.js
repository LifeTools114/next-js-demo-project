/**
 * 조달 경로 판별 및 일정 산출
 *
 * 해외직구 상품은 한국 창고 도착까지 오래 걸리고 도착일이 불확실합니다.
 * 그 사실을 주문 전에 알려주지 않으면, 고객은 "5~9일"로 알고 주문했다가
 * 한 달을 기다리게 됩니다.
 */

import { SOURCING, SOURCING_SIGNALS, OVERSEAS_NOTICE } from '../config/sourcing.js'
import { SHIPPING } from '../config/shipping.js'

const normalize = (t) => String(t || '').toLowerCase().replace(/\s+/g, '')

/**
 * 상품의 조달 경로를 판별합니다.
 *
 * @param {{productName?:string, badges?:string[], shippingText?:string, categoryPath?:string}} product
 *   badges / shippingText 는 확장이 쿠팡 페이지에서 읽어옵니다.
 */
export function detectSourcing(product = {}) {
  const haystack = normalize(
    [product.productName, product.categoryPath, product.shippingText, ...(product.badges ?? [])].join(' '),
  )

  // 판매자 해외배송이 로켓직구보다 조건이 나쁘므로 먼저 확인합니다.
  const sellerHit = SOURCING_SIGNALS.overseasSeller.find((s) => haystack.includes(normalize(s)))
  if (sellerHit) return { ...SOURCING.overseasSeller, overseas: true, matchedSignal: sellerHit }

  const rocketHit = SOURCING_SIGNALS.rocketGlobal.find((s) => haystack.includes(normalize(s)))
  if (rocketHit) return { ...SOURCING.rocketGlobal, overseas: true, matchedSignal: rocketHit }

  return { ...SOURCING.domestic, overseas: false, matchedSignal: null }
}

/**
 * 전체 일정을 계산합니다.
 *
 *   전체 = (쿠팡 → 한국 창고) + (한국 창고 → 하노이)
 *
 * 지금까지 뒤 구간만 안내했는데, 해외직구는 앞 구간이 3주까지 걸립니다.
 */
export function estimateSchedule(sourcings = []) {
  // 여러 상품이면 가장 늦게 도착하는 상품이 전체 일정을 결정합니다.
  const list = sourcings.length > 0 ? sourcings : [SOURCING.domestic]
  const toWarehouse = list.reduce(
    (worst, s) => ({
      min: Math.max(worst.min, s.toWarehouseDays.min),
      max: Math.max(worst.max, s.toWarehouseDays.max),
    }),
    { min: 0, max: 0 },
  )

  const toHanoi = SHIPPING.leadTimeDays

  return {
    toWarehouseDays: toWarehouse,
    toHanoiDays: toHanoi,
    totalDays: { min: toWarehouse.min + toHanoi.min, max: toWarehouse.max + toHanoi.max },
    /** 가장 오래 걸리는 상품 (일정을 결정하는 상품) */
    slowest: list.reduce((a, b) => (b.toWarehouseDays.max > a.toWarehouseDays.max ? b : a)),
    hasOverseas: list.some((s) => s.overseas),
  }
}

/**
 * 장바구니의 조달 경로를 분석합니다.
 * 해외직구가 섞여 있으면 확인해야 할 사항을 함께 돌려줍니다.
 */
export function analyzeSourcing(items = []) {
  const results = items.map((item) => ({ item, sourcing: detectSourcing(item) }))
  const overseas = results.filter((r) => r.sourcing.overseas)
  const schedule = estimateSchedule(results.map((r) => r.sourcing))

  const warnings = [...new Set(overseas.flatMap((r) => r.sourcing.warnings))]

  return {
    results,
    hasOverseas: overseas.length > 0,
    overseasItems: overseas.map((r) => ({
      productName: r.item.productName,
      label: r.sourcing.label,
      toWarehouseDays: r.sourcing.toWarehouseDays,
      matchedSignal: r.sourcing.matchedSignal,
    })),
    /** 합배송에서 빼야 하는 상품 — 묶으면 다른 주문까지 지연됩니다 */
    excludeFromConsolidation: overseas
      .filter((r) => r.sourcing.excludeFromConsolidation)
      .map((r) => r.item.productName),
    schedule,
    warnings,
    notice: overseas.length > 0 ? OVERSEAS_NOTICE : null,
    /**
     * 재점검이 필요한 이유.
     * 해외직구는 쿠팡 결제 시점의 관·부가세가 우리 견적에 없고,
     * 실제 무게·박스 크기도 도착 전에는 알 수 없습니다.
     */
    requiresRecheck: overseas.length > 0,
  }
}
