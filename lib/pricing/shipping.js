/**
 * 국제배송비 계산 — "1kg당 $9 × 청구무게"
 *
 * 청구무게(billable weight) 산정 — 운영자 확정(26.08.29, 업체와 동일 기준)
 *   1. 청구 대상 무게 = max(실무게, 부피무게)
 *   2. 최소 청구무게 1kg
 *   3. 정수 kg 청구: 소수 0.5 이하 버림·초과 올림 — 1.5→1kg, 1.6→2kg
 *
 * 요율은 USD 기준이고 내부 원장은 KRW 이므로 두 통화를 함께 반환합니다.
 */

import { SHIPPING } from '../../config/shipping.js'
import { FX } from '../../config/fx.js'

export const usdToKrw = (usd) => Math.round((Number(usd) || 0) * FX.usdToKrw)

/**
 * 청구무게 산정 — 정수 kg, 소수 0.5 이하 버림 / 초과 올림 (업체와 동일).
 * g 정수 연산이라 부동소수 오차가 없습니다.
 *   999g→1 · 1500g→1 · 1501g→2 · 2500g→2 · 2501g→3
 */
export function toBillableKg(chargeableG) {
  const g = Math.max(Math.round(Number(chargeableG) || 0), 0)
  const wholeKg = Math.floor(g / 1000)
  const fractionG = g - wholeKg * 1000
  const billable = fractionG <= 500 ? wholeKg : wholeKg + 1
  return Math.max(billable, SHIPPING.minBillableKg)
}

/** 청구무게 규칙을 사람이 읽는 문장으로 (UI 표시용) */
export function roundingRuleText() {
  return `${SHIPPING.minBillableKg}kg까지 기본요금 · 이후 kg 단위 (0.5 이하 버림·초과 올림)`
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

  // 같은 배송비로 더 담을 수 있는 여유(g).
  // 청구 kg 는 소수 0.5 까지 버림이므로 (청구무게 + 0.5kg) 직전까지 요금이 같습니다.
  // 부피무게가 지배하는 상품은 실제 여유가 이보다 클 수 있어 보수적 하한입니다.
  const headroomG = Math.max(
    Math.round(billableKg * 1000 + 500 - Math.max(Number(chargeableG) || 0, 0)),
    0
  )

  return {
    billableKg,
    headroomG,
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
  return [1, 2, 3, 5, 10, 20].map((kg) => ({
    kg,
    usd: Math.round(kg * SHIPPING.ratePerKgUsd * 100) / 100,
    krw: usdToKrw(kg * SHIPPING.ratePerKgUsd),
  }))
}
