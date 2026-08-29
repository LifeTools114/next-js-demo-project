/**
 * 국제배송비 계산 — "1kg당 $9 × 청구무게"
 *
 * 청구무게(billable weight) 산정 — 운영자 확정(26.08.29)
 *   1. 청구 대상 무게 = max(실무게, 부피무게)
 *   2. 최소 청구무게 1kg
 *   3. 1kg 부터는 0.5kg 단위 올림 — 1.2kg→1.5kg, 2.3kg→2.5kg
 *
 * 요율은 USD 기준이고 내부 원장은 KRW 이므로 두 통화를 함께 반환합니다.
 */

import { SHIPPING } from '../../config/shipping.js'
import { FX } from '../../config/fx.js'

export const usdToKrw = (usd) => Math.round((Number(usd) || 0) * FX.usdToKrw)

/**
 * 무게에 적용할 올림 단위를 찾습니다.
 * 구간은 올림 **전** 무게로 판정합니다. (올림 결과로 판정하면 순환합니다)
 */
export function roundingStepFor(rawKg) {
  const tiers = SHIPPING.roundingTiers
  return (tiers.find((t) => rawKg <= t.upToKg) ?? tiers[tiers.length - 1]).stepKg
}

/**
 * 청구무게 산정.
 * 부동소수 누적 오차로 한 단계가 더 올라가지 않도록 정수 연산으로 처리합니다.
 * (2.0kg 이 2.5kg 으로 올라가면 매 건 $4.5 를 과다 청구하게 됩니다)
 */
export function toBillableKg(chargeableG) {
  const rawKg = Math.max((Number(chargeableG) || 0) / 1000, SHIPPING.minBillableKg)
  const step = roundingStepFor(rawKg)
  const steps = Math.ceil(Math.round((rawKg / step) * 1e6) / 1e6)
  return Math.round(steps * step * 1000) / 1000
}

/** 올림 규칙을 사람이 읽는 문장으로 (UI 표시용) */
export function roundingRuleText() {
  const tiers = SHIPPING.roundingTiers
  // 단일 구간이면 "최소 1kg · 0.5kg 단위 올림" 처럼 간단히.
  if (tiers.length === 1) {
    return `최소 ${SHIPPING.minBillableKg}kg · ${tiers[0].stepKg}kg 단위 올림`
  }
  return tiers
    .map((t, i) => {
      const from = i === 0 ? 0 : tiers[i - 1].upToKg
      const range = Number.isFinite(t.upToKg) ? `~${t.upToKg}kg` : `${from}kg 초과`
      return `${range} ${t.stepKg}kg 단위`
    })
    .join(' · ')
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
  // 청구무게는 올림이므로 (청구무게 − 청구 대상 무게) 만큼은 요금이 그대로입니다.
  // 부피무게가 지배하는 상품은 실제 여유가 이보다 클 수 있어 보수적 하한입니다.
  const headroomG = Math.max(
    Math.round(billableKg * 1000 - Math.max(Number(chargeableG) || 0, 0)),
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
  return [0.5, 1, 2, 3, 5, 10, 20].map((kg) => ({
    kg,
    usd: Math.round(kg * SHIPPING.ratePerKgUsd * 100) / 100,
    krw: usdToKrw(kg * SHIPPING.ratePerKgUsd),
  }))
}
