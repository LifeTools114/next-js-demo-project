import test from 'node:test'
import assert from 'node:assert/strict'
import {
  kstMinuteOfDay, kstClock, isMaintenanceNow, isMaintenanceSoon, isRecovering,
  minutesUntilStart, minutesUntilEnd, checkAction, maintenanceStatus, nextBoundaryAt,
  appliesToCountry, isEnabled,
} from '../lib/maintenance.js'
import { MAINTENANCE, MAINTENANCE_EXCEPTIONS } from '../config/maintenance.js'

/** KST 벽시계 시각을 UTC 기준 Date 로 만듭니다. (KST = UTC+9, 서머타임 없음) */
const kst = (h, m = 0, day = 28) => new Date(Date.UTC(2026, 7, day, h - 9, m))
const VN = { country: 'VN' }

// ─────────── 시간대 독립성 (가장 중요) ───────────

test('KST 분 계산은 실행 환경 시간대와 무관하다', () => {
  // new Date().getHours() 를 썼다면 여기서 깨집니다.
  const d = kst(3, 15)
  const original = process.env.TZ
  const results = []
  for (const tz of ['UTC', 'Asia/Seoul', 'Asia/Ho_Chi_Minh', 'America/New_York', 'Pacific/Kiritimati']) {
    process.env.TZ = tz
    results.push(kstMinuteOfDay(d))
  }
  process.env.TZ = original
  assert.deepEqual([...new Set(results)], [195], `시간대별 결과가 갈렸습니다: ${results}`)
  assert.equal(kstClock(d), '03:15')
})

test('하노이 로컬 01:00 이 곧 KST 03:00 점검 시작이다', () => {
  // 하노이(ICT, UTC+7) 01:00 → UTC 18:00 전날 → KST 03:00
  const hanoi1am = new Date(Date.UTC(2026, 7, 27, 18, 0))
  assert.equal(kstClock(hanoi1am), '03:00')
  assert.equal(isMaintenanceNow(hanoi1am, 'VN'), true)
})

test('03:00 KST 는 하노이에서 같은 날 새벽이라 날짜가 넘어가지 않는다', () => {
  const s = maintenanceStatus(kst(3, 10), 'VN')
  assert.equal(s.windowKst.start, '03:00')
  assert.equal(s.windowLocal.start, '01:00', '하노이 현지 01:00 — 전날이 아님')
  assert.equal(s.windowLocal.end, '01:30')
  assert.match(s.timezoneHint, /03:00~03:30 \(한국시간\).*01:00~01:30/)
})

// ─────────── 창 경계 ───────────

test('점검 창은 KST 03:00 이상 03:30 미만이다', () => {
  assert.equal(isMaintenanceNow(kst(2, 59), 'VN'), false)
  assert.equal(isMaintenanceNow(kst(3, 0), 'VN'), true, '시작 시각은 포함')
  assert.equal(isMaintenanceNow(kst(3, 29), 'VN'), true)
  assert.equal(isMaintenanceNow(kst(3, 30), 'VN'), false, '종료 시각은 제외')
})

test('예고는 15분 전부터, 복구 확인은 종료 후 10분간이다', () => {
  assert.equal(isMaintenanceSoon(kst(2, 44), 'VN'), false)
  assert.equal(isMaintenanceSoon(kst(2, 45), 'VN'), true)
  assert.equal(isMaintenanceSoon(kst(3, 0), 'VN'), false, '점검 중은 예고가 아니다')
  assert.equal(isRecovering(kst(3, 30), 'VN'), true)
  assert.equal(isRecovering(kst(3, 39), 'VN'), true)
  assert.equal(isRecovering(kst(3, 40), 'VN'), false)
})

test('남은 시간과 다음 경계가 정확하다', () => {
  assert.equal(minutesUntilStart(kst(2, 30), 'VN'), 30)
  assert.equal(minutesUntilStart(kst(3, 10), 'VN'), 0, '점검 중이면 0')
  assert.equal(minutesUntilEnd(kst(3, 10), 'VN'), 20)
  assert.equal(nextBoundaryAt(kst(3, 10), 'VN').getTime(), kst(3, 30).getTime())
  assert.equal(minutesUntilStart(kst(3, 30), 'VN'), 1410, '창 직후엔 다음 날까지')
})

test('자정을 걸치는 창도 올바르게 판정한다', () => {
  const [os, od] = [MAINTENANCE.startMinuteOfDay, MAINTENANCE.durationMinutes]
  MAINTENANCE.startMinuteOfDay = 23 * 60 + 50
  MAINTENANCE.durationMinutes = 30
  try {
    assert.equal(isMaintenanceNow(kst(23, 49), 'VN'), false)
    assert.equal(isMaintenanceNow(kst(23, 50), 'VN'), true)
    assert.equal(isMaintenanceNow(kst(0, 0), 'VN'), true, '자정을 넘어도 점검 중')
    assert.equal(isMaintenanceNow(kst(0, 19), 'VN'), true)
    assert.equal(isMaintenanceNow(kst(0, 20), 'VN'), false)
  } finally {
    MAINTENANCE.startMinuteOfDay = os
    MAINTENANCE.durationMinutes = od
  }
})

// ─────────── 국가 범위 ───────────

test('베트남만 우선 적용되고 다른 국가는 영향받지 않는다', () => {
  assert.equal(appliesToCountry('VN'), true)
  assert.equal(appliesToCountry('JP'), false)
  assert.equal(appliesToCountry('SG'), false)
  assert.equal(isMaintenanceNow(kst(3, 10), 'VN'), true)
  assert.equal(isMaintenanceNow(kst(3, 10), 'JP'), false, '일본은 아직 미적용')
  assert.equal(checkAction('purchase', { date: kst(3, 10), country: 'JP' }).allowed, true)
})

test('국가를 지정하지 않으면 보수적으로 적용한다', () => {
  assert.equal(appliesToCountry(undefined), true)
  assert.equal(isMaintenanceNow(kst(3, 10)), true)
})

test('적용 국가를 추가하면 그 국가도 적용된다', () => {
  const orig = [...MAINTENANCE.appliesTo]
  MAINTENANCE.appliesTo = ['VN', 'JP']
  try {
    assert.equal(isMaintenanceNow(kst(3, 10), 'JP'), true)
  } finally {
    MAINTENANCE.appliesTo = orig
  }
})

test('적용 국가가 빈 배열이면 전체 적용이다', () => {
  const orig = [...MAINTENANCE.appliesTo]
  MAINTENANCE.appliesTo = []
  try {
    assert.equal(appliesToCountry('JP'), true)
    assert.equal(appliesToCountry('US'), true)
  } finally {
    MAINTENANCE.appliesTo = orig
  }
})

// ─────────── 동작별 정책 ───────────

test('쇼핑몰 의존 작업만 차단하고 나머지는 막지 않는다', () => {
  const opts = { date: kst(3, 10), ...VN }
  for (const action of ['readProductPage', 'purchase']) {
    const r = checkAction(action, opts)
    assert.equal(r.allowed, false, `${action} 은 차단되어야 합니다`)
    assert.ok(r.retryAfterMinutes > 0)
    assert.ok(r.retryAt)
  }
  // 담기·주문·수금은 우리 화면에서 하는 일이라 점검과 무관하게 열려 있습니다.
  const cart = checkAction('addToCart', opts)
  assert.equal(cart.allowed, true)

  // 과잉 차단 방지 — 쿠팡과 무관한 작업은 통과해야 합니다.
  for (const action of ['addToCart', 'createOrder', 'confirmPayment', 'warehouse', 'settlement']) {
    assert.equal(checkAction(action, opts).allowed, true, `${action} 을 막으면 과잉 대응입니다`)
  }
})

test('점검 시간이 아니면 모든 동작이 허용된다', () => {
  for (const action of ['readProductPage', 'purchase', 'addToCart']) {
    const r = checkAction(action, { date: kst(14, 0), ...VN })
    assert.equal(r.allowed, true)
    assert.equal(r.warn, false)
    assert.equal(r.maintenance, false)
  }
})

test('알 수 없는 동작은 기본 허용이다', () => {
  assert.equal(checkAction('전혀 모르는 동작', { date: kst(3, 10), ...VN }).allowed, true)
})

// ─────────── 예외 사항 ───────────

test('운영자 강제 실행은 차단을 통과하되 경고를 남긴다', () => {
  const r = checkAction('purchase', { date: kst(3, 10), ...VN, override: true })
  assert.equal(r.allowed, true)
  assert.equal(r.exception, 'operator-override')
  assert.equal(r.warn, true, '강제 실행은 기록으로 남도록 경고 플래그가 있어야 합니다')
})

test('이미 진행 중인 작업은 중단하지 않는다', () => {
  // 매입 착수 후 점검이 시작됐다고 중단하면
  // 쿠팡에는 결제됐는데 우리 기록은 없는 최악의 상태가 됩니다.
  const r = checkAction('purchase', { date: kst(3, 10), ...VN, inFlight: true })
  assert.equal(r.allowed, true)
  assert.equal(r.exception, 'in-flight')
})

test('긴급 예외 주문번호만 통과한다', () => {
  const orig = [...MAINTENANCE_EXCEPTIONS.exemptOrderNos]
  MAINTENANCE_EXCEPTIONS.exemptOrderNos = ['HN2608280001']
  try {
    assert.equal(checkAction('purchase', { date: kst(3, 10), ...VN, orderNo: 'HN2608280001' }).allowed, true)
    assert.equal(checkAction('purchase', { date: kst(3, 10), ...VN, orderNo: 'HN2608280002' }).allowed, false)
  } finally {
    MAINTENANCE_EXCEPTIONS.exemptOrderNos = orig
  }
})

test('임시 스위치로 점검 창을 끌 수 있다', () => {
  MAINTENANCE_EXCEPTIONS.temporarilyDisabled = true
  try {
    assert.equal(isEnabled(), false)
    assert.equal(isMaintenanceNow(kst(3, 10), 'VN'), false)
    assert.equal(checkAction('purchase', { date: kst(3, 10), ...VN }).allowed, true)
  } finally {
    MAINTENANCE_EXCEPTIONS.temporarilyDisabled = false
  }
})

test('환경변수로도 점검 창을 끌 수 있다', () => {
  process.env.MAINTENANCE_DISABLED = '1'
  try {
    assert.equal(isEnabled(), false)
    assert.equal(isMaintenanceNow(kst(3, 10), 'VN'), false)
  } finally {
    delete process.env.MAINTENANCE_DISABLED
  }
})

// ─────────── 안내 ───────────

test('상태별로 적절한 안내 문구가 나온다', () => {
  assert.match(maintenanceStatus(kst(2, 50), 'VN').notice, /뒤 쇼핑몰 점검 시간이 시작/)
  assert.match(maintenanceStatus(kst(3, 10), 'VN').notice, /지금은 쇼핑몰 점검 시간/)
  assert.match(maintenanceStatus(kst(3, 35), 'VN').notice, /점검이 끝났습니다/)
  assert.equal(maintenanceStatus(kst(14, 0), 'VN').notice, null, '평시에는 안내가 없어야 합니다')
})

test('상태 객체는 KST 창·현지 창·절대 시각을 모두 담는다', () => {
  const s = maintenanceStatus(kst(3, 10), 'VN')
  assert.equal(s.active, true)
  assert.equal(s.nowKst, '03:10')
  assert.deepEqual(s.windowKst, { start: '03:00', end: '03:30', timezone: '한국시간' })
  assert.deepEqual(s.windowLocal, { start: '01:00', end: '01:30' })
  // 절대 시각이어야 클라이언트가 자기 시간대로 표시할 수 있습니다.
  assert.equal(new Date(s.nextBoundaryAt).getTime(), kst(3, 30).getTime())
})

test('미적용 국가는 상태에서 그 사실이 드러난다', () => {
  const s = maintenanceStatus(kst(3, 10), 'JP')
  assert.equal(s.appliesToCountry, false)
  assert.equal(s.enabled, false)
  assert.equal(s.active, false)
})

test('현지 환산이 음수로 넘어가도 표기가 깨지지 않는다', () => {
  // 창을 01:00 KST 로 바꾸면 하노이 환산이 -60분(전날 23:00)이 됩니다.
  // 시(hour)만 정규화하고 분을 그대로 두면 "23:-30" 이 나옵니다.
  const os = MAINTENANCE.startMinuteOfDay
  MAINTENANCE.startMinuteOfDay = 60
  try {
    const s = maintenanceStatus(kst(1, 10), 'VN')
    assert.deepEqual(s.windowLocal, { start: '23:00', end: '23:30' })
    assert.ok(!s.timezoneHint.includes('-'), `음수 분 표기: ${s.timezoneHint}`)
  } finally {
    MAINTENANCE.startMinuteOfDay = os
  }
})

test('옵션 자리에 Date 를 넘겨도 조용히 현재 시각으로 폴백하지 않는다', () => {
  // checkAction(action, dateObj) 로 잘못 호출하면 opts.date 가 undefined 라
  // 현재 시각 폴백 → 점검 중인데 차단이 안 되는 무증상 실패가 됩니다.
  const during = kst(3, 10)
  const r = checkAction('readProductPage', during)
  assert.equal(r.allowed, false, 'Date 위치 인자도 점검 시각으로 판정되어야 합니다')
})
