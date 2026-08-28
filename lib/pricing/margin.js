/**
 * 배송 마진 계산 (운영자 전용)
 *
 * ⚠️ 이 모듈의 결과는 **절대 고객에게 노출되면 안 됩니다.**
 *    원가와 마진이 드러나면 협상력을 잃습니다.
 *    lib/order/store.js 의 customerView 가 걸러내며 회귀 테스트로 고정합니다.
 *
 *   고객 청구 = $9/kg × 청구무게
 *   물류사 원가 = $7/kg × 청구무게
 *   마진 = $2/kg × 청구무게
 *
 * 청구무게가 올림 단위(1kg)로 계산되므로, 실제로는 올림된 무게만큼
 * 원가도 청구되는지(=업체도 같은 올림 규칙을 쓰는지) 확인이 필요합니다.
 */

import { SHIPPING, CONSOLIDATION } from '../../config/shipping.js'
import { COSTS } from '../../config/costs.server.js'
import { usdToKrw } from './shipping.js'

const round2 = (n) => Math.round(n * 100) / 100

/** kg당 마진 */
export const marginPerKgUsd = () => round2(SHIPPING.ratePerKgUsd - COSTS.shippingPerKgUsd)

/**
 * 한 건의 배송 마진.
 *
 * @param {object} shipping calculateShipping() 결과
 * @param {{surchargeUsd?:number, surchargeCostUsd?:number}} [extra] 상품 할증 (청구/원가)
 */
export function shippingMargin(shipping, extra = {}) {
  const billableKg = shipping.billableKg

  // 운임
  const revenueUsd = shipping.freightUsd
  const costUsd = round2(billableKg * COSTS.shippingPerKgUsd)

  // 지역 할증은 현재 하노이 단일 $0 이지만, 확대 시 원가가 붙을 수 있습니다.
  const zoneRevenueUsd = shipping.zoneSurchargeUsd
  const zoneCostUsd = 0

  // 합배송 취급비
  const handlingRevenueUsd = shipping.extraUsd
  const handlingCostUsd = shipping.extraUsd > 0 ? COSTS.consolidationHandlingUsd : 0

  // 상품 할증 (파손주의·대형) — 업체 원가는 아직 미확인이라 기본 0
  const surchargeRevenueUsd = round2(extra.surchargeUsd ?? 0)
  const surchargeCostUsd = round2(extra.surchargeCostUsd ?? 0)

  const totalRevenueUsd = round2(revenueUsd + zoneRevenueUsd + handlingRevenueUsd + surchargeRevenueUsd)
  const totalCostUsd = round2(costUsd + zoneCostUsd + handlingCostUsd + surchargeCostUsd)
  const marginUsd = round2(totalRevenueUsd - totalCostUsd)

  return {
    billableKg,
    ratePerKgUsd: SHIPPING.ratePerKgUsd,
    costPerKgUsd: COSTS.shippingPerKgUsd,
    marginPerKgUsd: marginPerKgUsd(),

    revenueUsd: totalRevenueUsd,
    costUsd: totalCostUsd,
    marginUsd,
    marginRate: totalRevenueUsd > 0 ? marginUsd / totalRevenueUsd : 0,

    revenueKrw: usdToKrw(totalRevenueUsd),
    costKrw: usdToKrw(totalCostUsd),
    marginKrw: usdToKrw(marginUsd),

    breakdown: {
      freight: { revenueUsd, costUsd, marginUsd: round2(revenueUsd - costUsd) },
      zone: { revenueUsd: zoneRevenueUsd, costUsd: zoneCostUsd },
      handling: { revenueUsd: handlingRevenueUsd, costUsd: handlingCostUsd },
      surcharge: { revenueUsd: surchargeRevenueUsd, costUsd: surchargeCostUsd },
    },
  }
}

/**
 * 합배송이 마진에 미치는 영향.
 *
 * 합배송은 고객 배송비를 줄이지만 **우리 마진도 함께 줄어듭니다.**
 * 청구무게가 줄면 마진($2/kg)도 그만큼 줄기 때문입니다.
 * 취급비가 그 감소분을 얼마나 방어하는지 확인해야 합니다.
 *
 * @param {object} comparison compareConsolidation() 결과
 */
export function consolidationMarginImpact(comparison) {
  const m = marginPerKgUsd()

  const separateMarginUsd = round2(comparison.separate.billableKg * m)
  const consolidatedFreightMarginUsd = round2(comparison.consolidated.billableKg * m)
  const handlingMarginUsd = round2(CONSOLIDATION.handlingFeeUsd - COSTS.consolidationHandlingUsd)
  const consolidatedMarginUsd = round2(consolidatedFreightMarginUsd + handlingMarginUsd)

  const deltaUsd = round2(consolidatedMarginUsd - separateMarginUsd)

  return {
    separateMarginUsd,
    consolidatedMarginUsd,
    handlingMarginUsd,
    deltaUsd,
    deltaKrw: usdToKrw(deltaUsd),
    /** 취급비가 마진 감소를 메우는가 */
    handlingCoversLoss: deltaUsd >= 0,
    /** 마진을 유지하려면 필요한 취급비 */
    breakEvenHandlingUsd: round2(
      (comparison.separate.billableKg - comparison.consolidated.billableKg) * m + COSTS.consolidationHandlingUsd,
    ),
    customerSavingsUsd: comparison.savingsUsd,
  }
}
