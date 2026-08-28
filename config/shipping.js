/**
 * 국제배송(한국 → 베트남 하노이) 요율 정책
 *
 * 배송비 = 1kg당 요율(USD) × 청구무게
 * 청구무게 = max(실무게, 부피무게) 를 0.5kg 단위로 올림
 *
 * 요율은 USD 기준이고 고객 청구는 VND, 내부 원장은 KRW 이므로
 * 환산은 config/fx.js 의 고정 환율을 씁니다.
 */

export const SHIPPING = {
  origin: '대한민국 (인천)',
  destination: '베트남 하노이',

  /** 1kg당 요율 (USD) — 구간 없는 정액 */
  ratePerKgUsd: 9,

  /** 최소 청구무게 — 이보다 가벼워도 이 무게로 청구합니다. */
  minBillableKg: 0.5,

  /** 청구무게 올림 단위 */
  roundingStepKg: 0.5,

  /** 항공 부피무게 환산 계수: (가로×세로×높이 cm) / 6000 = kg */
  volumetricDivisor: 6000,

  /** 박스 1개당 최대 무게 — 초과 시 분할 배송 */
  maxParcelKg: 30,

  /** 포장 박스 자체 무게 (배송 건당 1회 가산, g) */
  boxWeightG: 250,

  /** 상품 1개당 완충재 무게 (g) */
  packingPerItemG: 12,

  /** 배송 지역별 할증 (USD) */
  zones: {
    'hanoi-inner': { label: '하노이 시내 (Ba Đình·Hoàn Kiếm·Đống Đa·Hai Bà Trưng·Cầu Giấy·Thanh Xuân)', surchargeUsd: 0 },
    'hanoi-outer': { label: '하노이 외곽 (Long Biên·Hà Đông·Nam Từ Liêm·Bắc Từ Liêm 등)', surchargeUsd: 3 },
    'hanoi-rural': { label: '하노이 근교 군지역 (Sóc Sơn·Ba Vì·Mỹ Đức 등)', surchargeUsd: 7 },
  },
  defaultZone: 'hanoi-inner',

  leadTimeDays: { min: 5, max: 9 },
}

/**
 * 합배송(consolidation) 정책
 *
 * 쿠팡 주문이 한국 창고에 따로따로 도착하면, 묶어서 한 박스로 보냅니다.
 * 절감 효과는 세 곳에서 나옵니다.
 *   1) 박스 무게 250g 을 건당이 아니라 1회만 가산
 *   2) 최소 청구무게 0.5kg 를 1회만 적용
 *   3) 0.5kg 올림 손실이 건별이 아니라 1회만 발생  ← 보통 이게 가장 큼
 */
export const CONSOLIDATION = {
  enabled: true,
  /** 무료 보관 기간 (일). 초과 시 일할 보관료 */
  freeStorageDays: 30,
  storageFeePerDayUsd: 0.5,
  /** 한 번에 묶을 수 있는 최대 주문 수 */
  maxOrdersPerParcel: 20,
  /** 합배송 취급 수수료 (USD) — 재포장 인건비 */
  handlingFeeUsd: 2,
}
