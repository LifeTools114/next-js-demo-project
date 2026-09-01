/**
 * 파트너 메시지 해석 — 텔레그램 한 줄이 곧 업무 처리입니다.
 *
 * 파트너가 확인해줘야 하는 세 가지(도착 / 도착 후 배송일정 / 배달 확인)를
 * 자연스러운 한 줄 메시지로 받습니다. 형식은 느슨하게 — 식별자와 키워드만
 * 있으면 어순이 달라도 알아듣습니다.
 *
 *   "YS-ECOM(박하노) 1.42kg"            → 한국 창고 입고 + 실측 (정산까지 자동)
 *   "HN2609010001 하노이 도착"          → 현황 갱신 (고객 위치 표시)
 *   "HN2609010001 통관 진행"            → 현황 갱신
 *   "배송일정 HN2609010001 9/3 오전"    → 배달 예정 안내 (고객에게 표시)
 *   "배달완료 HN2609010001"             → 배송 완료 처리
 *
 * 식별자는 주문번호(HN…)·YS-ECOM(이름)·운송장·쿠팡 주문번호 무엇이든 됩니다.
 */

/** 메시지 → { action, weightG?, scheduleText?, milestone? } */
export function parseCommand(text) {
  const t = String(text ?? '').trim()
  if (!t) return { action: null }

  // 1) 배달 완료 — "확인"의 마지막 단계
  if (/배달\s*완료|배송\s*완료|전달\s*완료/i.test(t)) {
    return { action: 'delivered' }
  }

  // 2) 도착 후 배송일정 — 키워드 뒤 나머지가 일정 문구
  const sched = t.match(/(?:배송\s*일정|배달\s*예정|배송\s*예정)[:\s]*(.*)$/i)
  if (sched) {
    return { action: 'schedule', scheduleText: sched[1].trim() }
  }

  // 3) 무게가 있으면 한국 창고 입고 + 실측
  const kg = t.match(/(\d+(?:[.,]\d+)?)\s*kg/i)
  if (kg) {
    return { action: 'weigh', weightG: Math.round(Number.parseFloat(kg[1].replace(',', '.')) * 1000) }
  }
  const g = t.match(/(\d{2,6})\s*(?:g|그램)(?![a-zA-Z가-힣])/)
  if (g) {
    return { action: 'weigh', weightG: Number.parseInt(g[1], 10) }
  }

  // 4) 도착·통관 현황 (하노이 구간)
  if (/하노이\s*도착/i.test(t)) return { action: 'milestone', milestone: '하노이 도착' }
  if (/통관/i.test(t)) return { action: 'milestone', milestone: '통관 진행 중' }
  if (/도착/i.test(t)) return { action: 'milestone', milestone: '도착' }
  if (/출고|발송/i.test(t)) return { action: 'milestone', milestone: '하노이로 출발' }

  return { action: null }
}

/**
 * 메시지에서 주문을 찾습니다 — findByInbound 를 여러 후보로 시도.
 * 전체 문장(주문번호·이름 포함 매칭) → 숫자 토큰(운송장·쿠팡 번호) 순서.
 */
export function findOrderFromText(text, findByInbound) {
  const t = String(text ?? '')
  const whole = findByInbound(t)
  if (whole) return whole
  for (const token of t.match(/\d{9,20}/g) ?? []) {
    const hit = findByInbound(token)
    if (hit) return hit
  }
  return null
}

/** 메시지 안의 운송장처럼 생긴 토큰 (미연결 배송대행 자동 연결용) */
export function trackingTokenFrom(text) {
  return String(text ?? '').match(/\d{10,14}/)?.[0] ?? null
}
