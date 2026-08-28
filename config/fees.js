/**
 * 구매대행 수수료 정책
 *
 * 사업 모델: 고객 주문 → 당사가 쿠팡에서 대신 구매 → 하노이로 배송.
 * 상품 소유권은 고객에게 있고, 당사는 대행 수수료를 받습니다.
 */

export const FEES = {
  /** 상품가 기준 대행 수수료율 (구매대행 트랙) */
  agencyRate: 0.10,

  /** 최소 대행 수수료 (원) */
  agencyMinKrw: 5000,

  /** 결제대행(PG) 수수료율 — 최종 결제금액 기준 */
  paymentRate: 0.029,

  /**
   * 무료 대행 기준액 — 상품가 합계가 이 금액 이상이면 대행 수수료 면제.
   * 0 이면 비활성화.
   */
  agencyWaiverThresholdKrw: 500000,
}

/**
 * 견적 정확도 안내 문구 (UI 표시 전용)
 *
 * 무게는 상품명 기반 "추정치"이므로 결제 시점 금액은 확정이 아닙니다.
 * 실제 정산 규칙은 config/payment.js 의 SETTLEMENT_RULES 를 보세요.
 */
export const SETTLEMENT = {
  /** 실측 정산 규칙은 config/payment.js 의 SETTLEMENT_RULES 에 있습니다. */
  notice:
    '표시 금액은 상품명 기반 추정 무게로 계산한 예상 견적입니다. 한국 창고 입고 후 실측하여 차액이 발생하면 추가 청구 또는 환불로 정산합니다.',
}
