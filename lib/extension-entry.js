/**
 * 크롬 확장프로그램용 번들 진입점
 *
 * 확장은 이 모듈들을 번들해서 브라우저 안에서 즉시 계산합니다.
 * (서버 왕복이 없어야 패널이 바로 뜹니다)
 *
 * ⚠️ 요율·세율 같은 "정책 값"은 여기 고정된 기본값이 아니라
 *    백엔드에서 받아온 설정으로 덮어씁니다. applyConfig() 참조.
 *    MV3 는 원격 "코드" 실행을 금지하므로 코드는 번들에 고정하고
 *    데이터만 원격에서 받습니다.
 */

export { estimateItemWeight, estimateShipmentWeight } from './weight/estimate.js'
export { parseProductSpec } from './weight/parse.js'
export { detectForm } from './weight/density.js'
export { calculateShipping, toBillableKg, getRateTable, usdToKrw, roundingStepFor, roundingRuleText } from './pricing/shipping.js'
export { quote, calculateTaxes, calculateAgencyFee, krwToVnd, TRACK } from './pricing/landed.js'
export { classifyDuty, calculateItemDuties } from './pricing/duty.js'
export { checkEligibility, checkCartEligibility, VERDICT } from './eligibility.js'
export { compareConsolidation } from './consolidation.js'
export { krw, vnd, weight, kg, toVnd, CONFIDENCE_TAG } from './format.js'
export {
  isMaintenanceNow, isMaintenanceSoon, isRecovering, checkAction as checkMaintenanceAction,
  maintenanceStatus, kstClock, minutesUntilStart, minutesUntilEnd, appliesToCountry,
} from './maintenance.js'

import { SHIPPING, CONSOLIDATION } from '../config/shipping.js'
import { roundingRuleText } from './pricing/shipping.js'
import { TAXES } from '../config/taxes.js'
import { FEES } from '../config/fees.js'
import { FX } from '../config/fx.js'
import { AFFILIATE } from '../config/affiliate.js'
import { DESTINATION } from '../config/eligibility.js'
import { MAINTENANCE, MAINTENANCE_POLICY } from '../config/maintenance.js'

/** 현재 적용 중인 정책 값 (패널에 표시) */
export function currentPolicy() {
  return {
    destination: DESTINATION,
    ratePerKgUsd: SHIPPING.ratePerKgUsd,
    minBillableKg: SHIPPING.minBillableKg,
    roundingTiers: SHIPPING.roundingTiers,
    roundingRuleText: roundingRuleText(),
    zones: SHIPPING.zones,
    agencyRate: FEES.agencyRate,
    vatRate: TAXES.vatRate,
    defaultDutyRate: TAXES.defaultDutyRate,
    usdToKrw: FX.usdToKrw,
    krwToVnd: FX.krwToVnd,
    consolidation: CONSOLIDATION,
    affiliateDisclosure: AFFILIATE.compliance.disclosure,
    affiliateDisclosureShort: AFFILIATE.compliance.disclosureShort,
    maintenance: {
      enabled: MAINTENANCE.enabled,
      appliesTo: MAINTENANCE.appliesTo,
      windowKst: MAINTENANCE.startMinuteOfDay,
      durationMinutes: MAINTENANCE.durationMinutes,
      policy: MAINTENANCE_POLICY,
    },
  }
}

/**
 * 백엔드에서 받은 정책 값을 적용합니다. (원격 데이터, 원격 코드 아님)
 * 요율이 바뀌어도 확장을 재배포할 필요가 없습니다.
 */
export function applyConfig(config = {}) {
  if (Number.isFinite(config.ratePerKgUsd) && config.ratePerKgUsd > 0) {
    SHIPPING.ratePerKgUsd = config.ratePerKgUsd
  }
  // 올림 규칙은 구간 배열이라 형태를 검증한 뒤에만 적용합니다.
  if (
    Array.isArray(config.roundingTiers) &&
    config.roundingTiers.length > 0 &&
    config.roundingTiers.every((t) => Number.isFinite(t?.stepKg) && t.stepKg > 0)
  ) {
    SHIPPING.roundingTiers = config.roundingTiers.map((t) => ({
      // JSON 은 Infinity 를 표현하지 못해 null 로 옵니다.
      upToKg: Number.isFinite(t.upToKg) ? t.upToKg : Infinity,
      stepKg: t.stepKg,
    }))
  }
  if (Number.isFinite(config.minBillableKg) && config.minBillableKg > 0) {
    SHIPPING.minBillableKg = config.minBillableKg
  }
  if (Number.isFinite(config.usdToKrw) && config.usdToKrw > 0) FX.usdToKrw = config.usdToKrw
  if (Number.isFinite(config.krwToVnd) && config.krwToVnd > 0) FX.krwToVnd = config.krwToVnd
  if (Number.isFinite(config.fxSpread) && config.fxSpread >= 0) FX.spread = config.fxSpread
  if (Number.isFinite(config.agencyRate) && config.agencyRate >= 0) FEES.agencyRate = config.agencyRate
  if (Number.isFinite(config.vatRate) && config.vatRate >= 0) TAXES.vatRate = config.vatRate
  if (Number.isFinite(config.defaultDutyRate) && config.defaultDutyRate >= 0) {
    TAXES.defaultDutyRate = config.defaultDutyRate
  }

  /**
   * 점검 창 설정.
   *
   * 확장은 이 값으로 **스스로** 판정합니다. 서버에 "지금 점검이야?"를 묻지 않습니다.
   * 그래야 네트워크가 끊기거나 설정 캐시가 오래돼도 정확히 동작합니다.
   * (시각 설정은 거의 안 바뀌고, 판정은 시계만 있으면 되기 때문입니다)
   */
  const m = config.maintenance
  if (m && typeof m === 'object') {
    if (typeof m.enabled === 'boolean') MAINTENANCE.enabled = m.enabled
    if (Array.isArray(m.appliesTo)) MAINTENANCE.appliesTo = m.appliesTo
    if (Number.isFinite(m.startMinuteOfDay)) MAINTENANCE.startMinuteOfDay = m.startMinuteOfDay
    if (Number.isFinite(m.durationMinutes) && m.durationMinutes > 0) MAINTENANCE.durationMinutes = m.durationMinutes
    if (Number.isFinite(m.noticeLeadMinutes)) MAINTENANCE.noticeLeadMinutes = m.noticeLeadMinutes
    if (Number.isFinite(m.graceMinutes)) MAINTENANCE.graceMinutes = m.graceMinutes
    if (Number.isFinite(m.utcOffsetMinutes)) MAINTENANCE.timezone.utcOffsetMinutes = m.utcOffsetMinutes
    if (typeof m.reason === 'string' && m.reason) MAINTENANCE.reason = m.reason
  }

  return currentPolicy()
}
