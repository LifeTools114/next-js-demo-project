/**
 * 합배송(consolidation) 계산
 *
 * 쿠팡 주문이 한국 창고에 따로 도착하면 묶어서 한 박스로 내보냅니다.
 * 절감은 세 곳에서 나오고, 보통 3번이 가장 큽니다.
 *
 *   1) 박스 무게(250g)를 건당이 아니라 1회만 가산
 *   2) 최소 청구무게(0.5kg)를 1회만 적용
 *   3) 0.5kg 올림 손실이 건별이 아니라 1회만 발생  ← 대개 여기서 가장 많이 아낌
 *
 * 예) 0.6kg 짜리 3건
 *     개별: 각 (0.6 + 0.25) = 0.85kg → 1.0kg 청구 × 3 = 3.0kg
 *     합배송: (1.8 + 0.25) = 2.05kg → 2.5kg 청구        = 2.5kg  (0.5kg 절약)
 */

import { SHIPPING, CONSOLIDATION } from '../config/shipping.js'
import { estimateItemWeight } from './weight/estimate.js'
import { calculateShipping, usdToKrw } from './pricing/shipping.js'

/** 상품 목록의 순수 상품 무게 (박스 제외) */
function itemsWeightG(items = []) {
  const lines = items.map((i) => estimateItemWeight(i, i.quantity ?? 1))
  return {
    lines,
    actualG: lines.reduce((s, l) => s + l.actualG, 0),
    volumetricG: lines.reduce((s, l) => s + l.volumetricG, 0),
  }
}

/** 박스 무게를 더해 청구 대상 무게를 냅니다. */
function parcelChargeableG({ actualG, volumetricG }) {
  const box = SHIPPING.boxWeightG
  return Math.max(actualG + box, volumetricG + box)
}

/**
 * 여러 주문을 개별 발송했을 때와 합배송했을 때를 비교합니다.
 *
 * @param {Array<{orderNo?:string, items:Array}>} shipments
 * @param {{zone?:string}} options
 */
export function compareConsolidation(shipments = [], options = {}) {
  const zone = options.zone ?? SHIPPING.defaultZone

  // ── 개별 발송 ──
  const separateParcels = shipments.map((s) => {
    const w = itemsWeightG(s.items)
    const chargeableG = parcelChargeableG(w)
    const shipping = calculateShipping(chargeableG, { zone })
    return { orderNo: s.orderNo ?? null, chargeableG, billableKg: shipping.billableKg, usd: shipping.totalUsd }
  })
  const separateUsd = Math.round(separateParcels.reduce((s, p) => s + p.usd, 0) * 100) / 100
  const separateKg = Math.round(separateParcels.reduce((s, p) => s + p.billableKg, 0) * 100) / 100

  // ── 합배송 ──
  const allItems = shipments.flatMap((s) => s.items)
  const w = itemsWeightG(allItems)
  const chargeableG = parcelChargeableG(w)
  const consolidatedShipping = calculateShipping(chargeableG, {
    zone,
    extraUsd: CONSOLIDATION.handlingFeeUsd,
  })

  const savingsUsd = Math.round((separateUsd - consolidatedShipping.totalUsd) * 100) / 100

  return {
    orderCount: shipments.length,
    separate: { parcels: separateParcels, billableKg: separateKg, totalUsd: separateUsd, totalKrw: usdToKrw(separateUsd) },
    consolidated: {
      billableKg: consolidatedShipping.billableKg,
      handlingFeeUsd: CONSOLIDATION.handlingFeeUsd,
      totalUsd: consolidatedShipping.totalUsd,
      totalKrw: consolidatedShipping.totalKrw,
      shipping: consolidatedShipping,
    },
    savingsUsd,
    savingsKrw: usdToKrw(savingsUsd),
    savingsRate: separateUsd > 0 ? savingsUsd / separateUsd : 0,
    /** 취급비를 물고도 이득인가 — 소량 2건 등에서는 손해일 수 있습니다 */
    worthwhile: savingsUsd > 0,
    exceedsMaxOrders: shipments.length > CONSOLIDATION.maxOrdersPerParcel,
    freeStorageDays: CONSOLIDATION.freeStorageDays,
  }
}
