/**
 * 국제배송(한국 → 베트남 하노이) 요율 정책
 *
 * 핵심 규칙: 배송비는 "1kg당 요율 × 청구무게"로 산정합니다.
 * 청구무게(billable weight)는 실무게와 부피무게 중 큰 값을 사용하며,
 * roundingStepKg 단위로 올림 처리합니다. (항공특송 업계 표준 방식)
 *
 * 요율을 바꾸려면 이 파일만 수정하면 전 서비스에 반영됩니다.
 */

export const SHIPPING = {
  origin: '대한민국 (인천)',
  destination: '베트남 하노이',
  currency: 'KRW',

  /**
   * 구간별 1kg당 요율 (원/kg).
   * 청구무게가 속한 구간의 요율을 "전체 청구무게"에 적용합니다.
   * 예) 3.5kg → 2~5kg 구간이므로 3.5 × 11,500 = 40,250원
   */
  tiers: [
    { maxKg: 2, ratePerKg: 13000, label: '~2kg' },
    { maxKg: 5, ratePerKg: 11500, label: '2~5kg' },
    { maxKg: 10, ratePerKg: 10000, label: '5~10kg' },
    { maxKg: 20, ratePerKg: 9000, label: '10~20kg' },
    { maxKg: Infinity, ratePerKg: 8200, label: '20kg~' },
  ],

  /** 최소 청구무게 — 이보다 가벼워도 이 무게로 청구합니다. */
  minBillableKg: 0.5,

  /** 청구무게 올림 단위 (0.5kg 단위로 올림) */
  roundingStepKg: 0.5,

  /** 항공 부피무게 환산 계수: (가로×세로×높이 cm) / 6000 = kg */
  volumetricDivisor: 6000,

  /** 박스 1개당 최대 무게 — 초과 시 분할 배송 안내 */
  maxParcelKg: 30,

  /** 포장 박스 자체 무게 (배송 건당 1회 가산, g) */
  boxWeightG: 250,

  /** 상품 1개당 완충재 무게 (g) */
  packingPerItemG: 12,

  /** 배송 지역별 할증 (원) */
  zones: {
    'hanoi-inner': { label: '하노이 시내 (Ba Đình·Hoàn Kiếm·Đống Đa·Hai Bà Trưng·Cầu Giấy·Thanh Xuân)', surcharge: 0 },
    'hanoi-outer': { label: '하노이 외곽 (Long Biên·Hà Đông·Nam Từ Liêm·Bắc Từ Liêm 등)', surcharge: 20000 },
    'hanoi-rural': { label: '하노이 근교 군지역 (Sóc Sơn·Ba Vì·Mỹ Đức 등)', surcharge: 45000 },
  },
  defaultZone: 'hanoi-inner',

  /** 예상 소요일 (영업일) */
  leadTimeDays: { min: 5, max: 9 },
}

/**
 * 항공 운송 제한 품목 규칙.
 * 향수·네일리무버 등 인화성(알코올) 제품은 항공특송이 제한됩니다.
 * 한국 화장품 직구에서 비중이 크므로 반드시 사전 고지해야 합니다.
 */
export const AIR_RESTRICTIONS = {
  /** 항공 운송 완전 불가 */
  prohibited: {
    keywords: ['네일리무버', '리무버액', '아세톤', '헤어스프레이', '무스', '에어졸', '에어로졸', '가스'],
    message: '인화성/에어로졸 제품으로 항공특송이 불가합니다. 선박 운송만 가능합니다.',
  },
  /** 수량 제한 + 할증 */
  limited: {
    keywords: ['향수', '퍼퓸', '오드', 'EDT', 'EDP', '코롱', '샤워코롱', '헤어퍼퓸', '바디미스트'],
    maxItemsPerParcel: 2,
    surchargePerItem: 8000,
    message: '알코올 함유 제품은 배송 건당 최대 2개까지 가능하며 위험물 취급 할증이 적용됩니다.',
  },
}
