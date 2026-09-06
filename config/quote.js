/**
 * 견적서 설정 — 발행 주체(당사) 정보와 무게 차이 처리 규칙.
 *
 * 흐름 (운영자 확정 26-09-01):
 *   ① 접수 → **임시 견적서**를 고객에게 전달 (상품명 기반 추정 무게)
 *   ② 물류사 청구서(DEBIT NOTE) 도착 → 실측 무게를 입력
 *   ③ 그 무게로 **최종 견적서** 발행
 *        차액 ≥ 기준 금액 → 추가청구/환불 대상 (결정은 운영자)
 *        차액 < 기준 금액 → 임시 견적서 금액 그대로
 *
 *   기준 금액은 여기가 아니라 config/payment.js 의
 *   SETTLEMENT_RULES.toleranceByConfidence(3,000~10,000원) 한 곳에만 있습니다.
 *   (운영자 확정 26-09-04 — 견적서와 장부가 같은 기준을 쓰도록 통일)
 *
 * ⚠️ 물류사 청구서의 단가·금액은 우리 **원가**입니다.
 *    최종 견적서에는 실측 무게와 운송 정보만 옮기고 원가는 절대 넣지 않습니다.
 *    (config/costs.server.js 와 같은 취급 — 고객 화면 노출 금지)
 */

export const QUOTE = {
  /**
   * 발행 주체 — 고객에게 보이는 당사 정보 (env 로 교체 가능).
   * 고객 배송지는 견적서에 싣지 않습니다 — 견적서는 금액 문서이고
   * 배송지는 주문 화면·배송 안내로 전달합니다 (운영자 지시 26-09-01).
   */
  issuer: {
    /** 고객이 먼저 보는 브랜드명 */
    brand: process.env.COMPANY_BRAND || 'YS-ECOM 베트남 직구',
    /** 사업자 상호 — 견적서 머리글에 함께 표기 */
    /**
     * 사업자등록증상 상호는 '전세계무역'(개인사업자, 대표 김영서)입니다.
     * 견적서는 거래 문서라 등록 상호와 다르게 적으면 곤란해질 수 있어
     * 등록 상호를 먼저 쓰고 로마자 표기를 함께 답니다.
     * (영문 상호는 서류에 없어 로마자 표기 — 공식 영문명이 생기면 교체)
     */
    name: process.env.COMPANY_NAME || '전세계무역 (JEONSEGYE TRADING)',
    address: process.env.COMPANY_ADDRESS
      || '412, 4F, Bldg 1, 10 Cheongnahannae-ro 100beon-gil, Seo-gu, Incheon, Republic of Korea',
    pic: process.env.COMPANY_PIC || 'KIM YOUNG SEO',
  },

  /**
   * ⚠️ 조정 기준 금액(adjustThresholdVnd)은 여기 없습니다.
   *
   * 예전에는 견적서만 20,000동이라는 별도 기준을 들고 있어, 같은 주문을 두고
   * 문서는 "조정 대상"이라 적고 장부는 아무것도 하지 않는 일이 생길 수
   * 있었습니다. 이제 기준은 config/payment.js 한 곳에 있고, 견적서와 장부
   * 모두 lib/order/settlement.js 의 settlementToleranceKrw() 로 가져옵니다.
   * 주문마다 값이 달라(무게 추정 신뢰도별 3,000~10,000원) 견적서에는 그
   * 주문의 실제 기준 금액이 원화·동화로 찍힙니다.
   */

  /** 견적서 유효기간 (일) */
  validDays: 7,

  labels: {
    provisional: { ko: '임시 견적서', en: 'PROVISIONAL QUOTATION' },
    final: { ko: '최종 견적서', en: 'FINAL QUOTATION' },
  },
}
