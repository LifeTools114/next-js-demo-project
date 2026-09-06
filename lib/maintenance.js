/**
 * 점검 시간대 판정
 *
 * 설계 원칙: **로컬 시간대에 절대 의존하지 않습니다.**
 *
 * `new Date().getHours()` 는 코드가 도는 곳의 시간대를 따릅니다.
 * 서버는 UTC, 하노이 고객 브라우저는 ICT, 유럽 교민은 CET 이므로
 * 이 값을 쓰면 매일 서로 다른 시각에 서비스가 멈춥니다.
 *
 * 대신 UTC 시각에 고정 오프셋(+9시간)을 더해 KST 벽시계 분을 직접 계산합니다.
 * KST 는 서머타임이 없어 오프셋이 상수라 이 방식이 정확하고,
 * Intl 로케일 파싱 같은 취약한 단계도 필요 없습니다.
 */

import {
  MAINTENANCE,
  MAINTENANCE_POLICY,
  MAINTENANCE_EXCEPTIONS,
  MAINTENANCE_NOTICE,
} from '../config/maintenance.js'

const MINUTES_PER_DAY = 1440

/** Node(서버)와 브라우저(확장) 양쪽에서 안전하게 환경변수를 읽습니다. */
const env = (key) => (typeof process !== 'undefined' && process?.env ? process.env[key] : undefined)

/** 점검 기능이 현재 켜져 있는가 (설정 + 임시 스위치 + 환경변수) */
export function isEnabled() {
  if (!MAINTENANCE.enabled) return false
  if (MAINTENANCE_EXCEPTIONS.temporarilyDisabled) return false
  if (env('MAINTENANCE_DISABLED') === '1') return false
  return true
}

/**
 * 이 목적지 국가에 점검 창이 적용되는가.
 * 베트남만 우선 적용하고 다른 국가는 나중에 여는 구조입니다.
 */
export function appliesToCountry(country) {
  const scope = MAINTENANCE.appliesTo
  if (!Array.isArray(scope) || scope.length === 0) return true // 빈 배열 = 전체 적용
  if (!country) return true // 국가 미지정이면 보수적으로 적용
  return scope.includes(String(country).toUpperCase())
}

const formatMinutes = (m) => {
  // 음수(현지 환산으로 전날로 넘어간 경우)를 분리 전에 한 번만 정규화합니다.
  // 시(hour)만 정규화하고 분을 m % 60 으로 두면 "23:-30" 같은 표기가 나옵니다.
  const n = ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}

/**
 * 어떤 시각의 KST 벽시계를 "자정 이후 분"으로 반환합니다.
 * 실행 환경의 시간대와 무관하게 동작합니다.
 */
export function kstMinuteOfDay(date = new Date()) {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return (utcMinutes + MAINTENANCE.timezone.utcOffsetMinutes) % MINUTES_PER_DAY
}

/** KST 기준 시:분 문자열 */
export const kstClock = (date = new Date()) => formatMinutes(kstMinuteOfDay(date))

const windowStart = () => MAINTENANCE.startMinuteOfDay
const windowEnd = () => (MAINTENANCE.startMinuteOfDay + MAINTENANCE.durationMinutes) % MINUTES_PER_DAY

/** 분 단위 구간 포함 여부. 자정을 걸치는 구간도 처리합니다. 시작 포함, 끝 제외. */
function within(minute, start, end) {
  if (start === end) return false
  return start < end ? minute >= start && minute < end : minute >= start || minute < end
}

/**
 * 지금이 점검 창 안인가.
 * @param {Date} date
 * @param {string} [country] 목적지 국가 — 지정하면 적용 범위를 함께 확인합니다.
 */
export function isMaintenanceNow(date = new Date(), country) {
  if (!isEnabled()) return false
  if (!appliesToCountry(country)) return false
  return within(kstMinuteOfDay(date), windowStart(), windowEnd())
}

/** 곧 점검이 시작되는가 */
export function isMaintenanceSoon(date = new Date(), country) {
  if (!isEnabled() || !appliesToCountry(country) || isMaintenanceNow(date, country)) return false
  const lead = (windowStart() - MAINTENANCE.noticeLeadMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return within(kstMinuteOfDay(date), lead, windowStart())
}

/** 점검 종료 직후 복구 확인 구간인가 */
export function isRecovering(date = new Date(), country) {
  if (!isEnabled() || !appliesToCountry(country) || isMaintenanceNow(date, country)) return false
  const end = windowEnd()
  return within(kstMinuteOfDay(date), end, (end + MAINTENANCE.graceMinutes) % MINUTES_PER_DAY)
}

function minutesUntil(targetMinute, date = new Date()) {
  const delta = (targetMinute - kstMinuteOfDay(date) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return delta === 0 ? MINUTES_PER_DAY : delta
}

export const minutesUntilStart = (date = new Date(), country) =>
  isMaintenanceNow(date, country) ? 0 : minutesUntil(windowStart(), date)

export const minutesUntilEnd = (date = new Date(), country) =>
  isMaintenanceNow(date, country) ? minutesUntil(windowEnd(), date) : 0

/** 다음 경계의 절대 시각 — 고객 로컬 시간대로 표시할 때 씁니다. */
export function nextBoundaryAt(date = new Date(), country) {
  const mins = isMaintenanceNow(date, country) ? minutesUntilEnd(date, country) : minutesUntilStart(date, country)
  return new Date(date.getTime() + mins * 60_000)
}

/**
 * 특정 동작이 지금 허용되는지 판정합니다.
 *
 * @param {string} action MAINTENANCE_POLICY 의 키
 * @param {object} [opts]
 * @param {Date}   [opts.date]
 * @param {string} [opts.country]  목적지 국가 (미적용 국가면 통과)
 * @param {boolean}[opts.override] 운영자 강제 실행
 * @param {boolean}[opts.inFlight] 이미 시작된 작업인가
 * @param {string} [opts.orderNo]  긴급 예외 주문번호 확인용
 */
export function checkAction(action, opts = {}) {
  // Date 를 옵션 자리에 그대로 넘기는 실수를 방어합니다.
  // 방치하면 opts.date 가 undefined 라 조용히 "현재 시각"으로 폴백해
  // 점검 중인데 차단이 안 되는 실패가 무증상으로 지나갑니다.
  if (opts instanceof Date) opts = { date: opts }
  const { date = new Date(), country, override = false, inFlight = false, orderNo } = opts
  const policy = MAINTENANCE_POLICY[action] ?? 'allow'
  const active = isMaintenanceNow(date, country)

  const base = { action, policy, maintenance: active, warn: false, exception: null }

  if (!active || policy === 'allow') return { ...base, allowed: true }

  // ── 예외 처리 ──
  if (override && MAINTENANCE_EXCEPTIONS.allowOperatorOverride) {
    return { ...base, allowed: true, warn: true, exception: 'operator-override', message: MAINTENANCE_NOTICE.overrideUsed }
  }
  if (inFlight && MAINTENANCE_EXCEPTIONS.allowInFlight) {
    // 중단하면 쿠팡에는 결제가 됐는데 우리 기록은 없는 상태가 됩니다.
    return { ...base, allowed: true, warn: true, exception: 'in-flight', message: '이미 진행 중인 작업이라 중단하지 않습니다.' }
  }
  if (orderNo && MAINTENANCE_EXCEPTIONS.exemptOrderNos.includes(orderNo)) {
    return { ...base, allowed: true, warn: true, exception: 'exempt-order', message: '긴급 예외로 지정된 주문입니다.' }
  }

  if (policy === 'warn') {
    return { ...base, allowed: true, warn: true, message: MAINTENANCE_NOTICE.blocked }
  }

  return {
    ...base,
    allowed: false,
    message: action === 'purchase' ? MAINTENANCE_NOTICE.purchaseBlocked : MAINTENANCE_NOTICE.active,
    retryAfterMinutes: minutesUntilEnd(date, country),
    retryAt: nextBoundaryAt(date, country).toISOString(),
  }
}

/**
 * UI 표시용 상태 묶음.
 *
 * KST 벽시계와 **절대 시각**을 함께 담습니다.
 * 절대 시각을 넘겨야 브라우저가 고객 로컬 시간대로 알아서 표시합니다.
 * 03:00 KST 는 하노이에서 01:00 ICT 로, 같은 날 새벽입니다.
 */
export function maintenanceStatus(date = new Date(), country) {
  const enabled = isEnabled() && appliesToCountry(country)
  const active = isMaintenanceNow(date, country)
  const soon = isMaintenanceSoon(date, country)
  const recovering = isRecovering(date, country)

  const startClock = formatMinutes(windowStart())
  const endClock = formatMinutes(windowEnd())

  // 현지 시각 창 — KST 오프셋과 목적지 오프셋의 차이로 환산합니다.
  const localOffset = LOCAL_OFFSETS[String(country ?? '').toUpperCase()]
  const shift = localOffset === undefined ? null : localOffset - MAINTENANCE.timezone.utcOffsetMinutes
  const localWindow =
    shift === null
      ? null
      : { start: formatMinutes(windowStart() + shift), end: formatMinutes(windowEnd() + shift) }

  let notice = null
  if (active) notice = MAINTENANCE_NOTICE.active
  else if (soon) notice = MAINTENANCE_NOTICE.soon(minutesUntilStart(date, country))
  else if (recovering) notice = MAINTENANCE_NOTICE.recovering

  return {
    enabled,
    appliesToCountry: appliesToCountry(country),
    country: country ?? null,
    active,
    soon,
    recovering,
    label: MAINTENANCE.label,
    shortLabel: MAINTENANCE.shortLabel,
    reason: MAINTENANCE.reason,
    notice,
    /** 기준 시간대의 창 (항상 KST) */
    windowKst: { start: startClock, end: endClock, timezone: MAINTENANCE.timezone.label },
    /** 목적지 현지 기준 창 (있으면) */
    windowLocal: localWindow,
    timezoneHint: localWindow
      ? MAINTENANCE_NOTICE.timezoneHint(`${startClock}~${endClock}`, `${localWindow.start}~${localWindow.end}`)
      : `점검 시간 ${startClock}~${endClock} (한국시간)`,
    nowKst: kstClock(date),
    nextBoundaryAt: nextBoundaryAt(date, country).toISOString(),
    minutesUntilStart: minutesUntilStart(date, country),
    minutesUntilEnd: minutesUntilEnd(date, country),
    policy: MAINTENANCE_POLICY,
  }
}

/** 목적지 국가별 UTC 오프셋(분) — 현지 시각 안내용 */
const LOCAL_OFFSETS = {
  VN: 7 * 60, // ICT
  KR: 9 * 60,
  JP: 9 * 60,
  SG: 8 * 60,
  TH: 7 * 60,
}
