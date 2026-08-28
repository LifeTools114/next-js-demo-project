/**
 * 점검 시간대(쉬는시간) 정책
 *
 * 매일 새벽 03:00~03:30 **한국시간(KST)** 동안 쿠팡에 의존하는 작업을 멈춥니다.
 * 쿠팡 점검 시간대와 겹치면 가격을 못 읽거나 잘못 읽고, 매입 결제가 실패할 수 있습니다.
 *
 * ⚠️ 쿠팡은 공개된 정기 점검 시각을 명시하지 않습니다.
 *    아래 값은 운영 관찰에 따라 조정하는 **설정값**이며,
 *    고객에게 "쿠팡 공식 점검 시간"이라고 단정해서는 안 됩니다.
 *
 * ⚠️ 기준 시간대는 KST 하나뿐입니다.
 *    서버는 UTC, 확장은 고객 로컬(하노이면 ICT)에서 돌지만
 *    판정은 언제나 KST 기준으로 하고 표시할 때만 로컬로 환산합니다.
 *
 *    03:00 KST = 01:00 ICT — 같은 날 새벽이라 안내가 자연스럽습니다.
 *    (01:00 KST 로 잡으면 하노이에서는 전날 23:00 이 되어 날짜가 넘어갑니다)
 */

export const MAINTENANCE = {
  enabled: true,

  /**
   * 적용 대상 국가 (ISO 2자리).
   * 베트남만 우선 적용하고, 다른 국가를 열 때 여기에 추가합니다.
   * 빈 배열이면 전체 적용.
   */
  appliesTo: ['VN'],

  /** 기준 시간대 — KST 는 서머타임이 없어 오프셋이 항상 +9시간 */
  timezone: { id: 'KST', label: '한국시간', utcOffsetMinutes: 9 * 60 },

  /** 창 시작 (KST 자정 기준 분). 180 = 03:00 */
  startMinuteOfDay: 180,

  /** 창 길이 (분) */
  durationMinutes: 30,

  /** 이 시간 전부터 "곧 점검" 예고 (분) */
  noticeLeadMinutes: 15,

  /** 창 종료 후 복구 확인 구간 (분) */
  graceMinutes: 10,

  label: '쿠팡 점검 시간',
  shortLabel: '점검 중',
  reason:
    '쿠팡 시스템 점검 시간대와 겹쳐 가격·재고 정보가 정확하지 않을 수 있습니다. 잘못된 견적을 드리지 않기 위해 잠시 멈춥니다.',
}

/**
 * 동작별 정책.
 *   block — 점검 중 금지 (쿠팡에 직접 의존)
 *   warn  — 수행하되 경고 (값이 부정확할 수 있음)
 *   allow — 제한 없음 (쿠팡과 무관)
 *
 * 과잉 차단은 그 자체로 비용입니다. 쿠팡에 실제로 의존하지 않는 동작은 막지 않습니다.
 */
export const MAINTENANCE_POLICY = {
  readProductPage: 'block', // 확장이 쿠팡 페이지를 읽어 견적 계산 — 점검 페이지를 읽으면 값이 틀림
  purchase: 'block', // 쿠팡에서 실제 매입 — 결제 실패 위험
  affiliateLink: 'warn', // 쿠팡으로 이동 — 점검 페이지가 뜰 수 있음
  addToCart: 'allow', // 이미 읽어둔 값
  createOrder: 'allow', // 당사 시스템 내부
  confirmPayment: 'allow', // 쿠팡과 무관
  warehouse: 'allow',
  settlement: 'allow',
}

/**
 * 예외 사항.
 *
 * 점검 창이라고 무조건 막으면 오히려 손해인 경우가 있습니다.
 * 각 예외는 사유를 남기고, 운영자 강제 실행은 감사 로그에 기록됩니다.
 */
export const MAINTENANCE_EXCEPTIONS = {
  /**
   * 운영자 강제 실행.
   * 쿠팡이 실제로는 멀쩡한데 우리 설정이 틀렸을 수 있으므로 탈출구가 필요합니다.
   */
  allowOperatorOverride: true,

  /**
   * 이미 시작된 작업은 중단하지 않습니다.
   * 매입 착수(PURCHASING) 후 점검이 시작됐다고 중단하면
   * 쿠팡에는 결제가 됐는데 우리 기록은 없는 최악의 상태가 됩니다.
   */
  allowInFlight: true,

  /**
   * 긴급 예외 주문번호.
   * 특정 주문만 점검 중에도 처리해야 할 때 여기에 추가합니다. (예: 배송 마감 임박)
   */
  exemptOrderNos: [],

  /**
   * 점검 창 자체를 임시로 끄는 스위치.
   * 쿠팡 점검 일정이 바뀌었는데 배포가 늦을 때 씁니다.
   * 환경변수 MAINTENANCE_DISABLED=1 로도 끌 수 있습니다.
   */
  temporarilyDisabled: false,
}

/** 고객 안내 문구 */
export const MAINTENANCE_NOTICE = {
  soon: (minutes) => `${minutes}분 뒤 쿠팡 점검 시간이 시작됩니다. 그 전에 주문을 마쳐주세요.`,
  active: '지금은 쿠팡 점검 시간입니다. 가격 정보가 정확하지 않을 수 있어 견적을 잠시 멈췄습니다.',
  recovering: '점검이 끝났습니다. 쿠팡이 아직 복구 중일 수 있으니 값이 이상하면 잠시 뒤 새로고침해 주세요.',
  purchaseBlocked: '점검 시간에는 쿠팡 매입을 진행하지 않습니다. 점검 종료 후 자동으로 이어집니다.',
  affiliateWarn: '점검 시간이라 쿠팡에서 점검 안내 페이지가 표시될 수 있습니다.',
  overrideUsed: '점검 시간이지만 운영자 확인 하에 강제로 진행했습니다.',
  /** 안내에 항상 붙이는 꼬리말 — 기준 시간대를 명확히 합니다 */
  timezoneHint: (kstWindow, localWindow) =>
    `점검 시간 ${kstWindow} (한국시간) · 현지 기준 ${localWindow}`,
}
