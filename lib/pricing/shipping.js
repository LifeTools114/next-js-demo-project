/**
 * 국제배송비 계산 — "1kg당 요율 × 청구무게"
 *
 * 청구무게(billable weight) 산정 순서
 *   1. 청구 대상 무게 = max(실무게, 부피무게)
 *   2. 최소 청구무게 미만이면 최소 청구무게로 올림
 *   3. roundingStepKg(0.5kg) 단위로 올림
 * 그 다음 청구무게가 속한 구간의 1kg당 요율을 전체 무게에 적용합니다.
 */

import { SHIPPING } from '../../config/shipping.js'

/** 부동소수점 누적 오차를 막기 위해 0.5kg 단위 올림을 정수 연산으로 처리 */
export function toBillableKg(chargeableG) {
  const step = SHIPPING.roundingStepKg
  const rawKg = Math.max((Number(chargeableG) || 0) / 1000, SHIPPING.minBillableKg)
  const steps = Math.ceil(Math.round((rawKg / step) * 1e6) / 1e6)
  return Math.round(steps * step * 1000) / 1000
}

/** 청구무게가 속한 요율 구간을 찾습니다. */
export function findTier(billableKg) {
  return SHIPPING.tiers.find((t) => billableKg <= t.maxKg) ?? SHIPPING.tiers[SHIPPING.tiers.length - 1]
}

/**
 * 배송비를 계산합니다.
 *
 * @param {number} chargeableG 청구 대상 무게(g) — estimateShipmentWeight 결과
 * @param {object} options
 * @param {string} options.zone 배송 지역 키
 * @param {number} options.restrictionSurchargeKrw 위험물(향수 등) 할증
 */
export function calculateShipping(chargeableG, options = {}) {
  const { zone = SHIPPING.defaultZone, restrictionSurchargeKrw = 0 } = options

  const billableKg = toBillableKg(chargeableG)
  const tier = findTier(billableKg)
  const freight = Math.round(billableKg * tier.ratePerKg)

  const zoneInfo = SHIPPING.zones[zone] ?? SHIPPING.zones[SHIPPING.defaultZone]
  const zoneSurcharge = zoneInfo.surcharge
  const surcharge = Math.round(restrictionSurchargeKrw)

  const total = freight + zoneSurcharge + surcharge

  return {
    billableKg,
    ratePerKg: tier.ratePerKg,
    tierLabel: tier.label,
    freight,
    zone,
    zoneLabel: zoneInfo.label,
    zoneSurcharge,
    restrictionSurcharge: surcharge,
    total,
    exceedsMaxParcel: billableKg > SHIPPING.maxParcelKg,
    leadTimeDays: SHIPPING.leadTimeDays,
  }
}

/**
 * 요율표 전체를 UI용으로 반환합니다. (요금 안내 페이지)
 */
export function getRateTable() {
  return SHIPPING.tiers.map((t, i) => {
    const from = i === 0 ? 0 : SHIPPING.tiers[i - 1].maxKg
    return {
      label: t.label,
      fromKg: from,
      toKg: t.maxKg,
      ratePerKg: t.ratePerKg,
      /** 구간 하한 기준 예시 금액 */
      exampleKg: Number.isFinite(t.maxKg) ? t.maxKg : from + 5,
      exampleTotal: Math.round((Number.isFinite(t.maxKg) ? t.maxKg : from + 5) * t.ratePerKg),
    }
  })
}
