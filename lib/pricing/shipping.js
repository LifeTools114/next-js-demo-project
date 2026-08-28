/**
 * 국제배송비 계산 — "1kg당 $9 × 청구무게"
 *
 * 청구무게(billable weight) 산정
 *   1. 청구 대상 무게 = max(실무게, 부피무게)
 *   2. 최소 청구무게(0.5kg) 미만이면 최소값 적용
 *   3. 0.5kg 단위로 올림
 *
 * 요율은 USD 기준이고 내부 원장은 KRW 이므로 두 통화를 함께 반환합니다.
 */

import { SHIPPING } from '../../config/shipping.js'
import { FX } from '../../config/fx.js'

export const usdToKrw = (usd) => Math.round((Number(usd) || 0) * FX.usdToKrw)

/** 부동소수 누적 오차를 막기 위해 올림을 정수 연산으로 처리 */
export function toBillableKg(chargeableG) {
  const step = SHIPPING.roundingStepKg
  const rawKg = Math.max((Number(chargeableG) || 0) / 1000, SHIPPING.minBillableKg)
  const steps = Math.ceil(Math.round((rawKg / step) * 1e6) / 1e6)
  return Math.round(steps * step * 1000) / 1000
}

/**
 * 배송비를 계산합니다.
 *
 * @param {number} chargeableG 청구 대상 무게(g)
 * @param {{zone?:string, extraUsd?:number}} options extraUsd 는 합배송 취급비 등
 */
export function calculateShipping(chargeableG, options = {}) {
  const { zone = SHIPPING.defaultZone, extraUsd = 0 } = options

  const billableKg = toBillableKg(chargeableG)
  const ratePerKgUsd = SHIPPING.ratePerKgUsd
  const freightUsd = Math.round(billableKg * ratePerKgUsd * 100) / 100

  const zoneInfo = SHIPPING.zones[zone] ?? SHIPPING.zones[SHIPPING.defaultZone]
  const zoneSurchargeUsd = zoneInfo.surchargeUsd
  const extra = Math.round((Number(extraUsd) || 0) * 100) / 100

  const totalUsd = Math.round((freightUsd + zoneSurchargeUsd + extra) * 100) / 100

  return {
    billableKg,
    ratePerKgUsd,
    freightUsd,
    zone,
    zoneLabel: zoneInfo.label,
    zoneSurchargeUsd,
    extraUsd: extra,
    totalUsd,

    // 내부 원장·세금 계산용 원화 환산
    freightKrw: usdToKrw(freightUsd),
    zoneSurchargeKrw: usdToKrw(zoneSurchargeUsd),
    extraKrw: usdToKrw(extra),
    totalKrw: usdToKrw(totalUsd),

    exceedsMaxParcel: billableKg > SHIPPING.maxParcelKg,
    leadTimeDays: SHIPPING.leadTimeDays,
  }
}

/** 요금 안내용 예시표 */
export function getRateTable() {
  return [0.5, 1, 2, 3, 5, 10, 20].map((kg) => ({
    kg,
    usd: Math.round(kg * SHIPPING.ratePerKgUsd * 100) / 100,
    krw: usdToKrw(kg * SHIPPING.ratePerKgUsd),
  }))
}
