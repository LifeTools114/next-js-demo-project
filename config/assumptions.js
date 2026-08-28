/**
 * 정책 값 출처 관리
 *
 * 베트남 직구 사업이 아직 확정되지 않아, 현재 설정값의 상당수는
 * 공개 자료와 업계 관행에 근거한 **추정값**입니다.
 * 통관업체·물류사 제안이 들어오면 그 값으로 교체해야 합니다.
 *
 * 어느 값이 확정이고 어느 값이 추정인지 코드 안에서 구분되지 않으면
 * 추정값을 확정값처럼 고객에게 안내하게 됩니다. 그래서 여기 모읍니다.
 *
 * status:
 *   confirmed — 업체·기관 확인 완료
 *   assumed   — 추정값. 확인 전까지 고객 안내에 "예상"임을 밝혀야 함
 *   blocked   — 확인이 필요한데 아직 물어보지 못함
 */

export const ASSUMPTIONS = [
  {
    id: 'shipping-rate',
    label: '국제배송 요율 $9/kg',
    where: 'config/shipping.js · ratePerKgUsd',
    status: 'confirmed',
    source: '운영자 제시',
  },
  {
    id: 'volumetric-divisor',
    label: '부피무게 계수 ÷6000',
    where: 'config/shipping.js · volumetricDivisor',
    status: 'assumed',
    source: '항공특송 일반 관행',
    risk: '업체가 ÷5000 을 쓰면 부피 큰 화물의 배송비가 20% 과소 산정됩니다.',
    askBroker: '부피무게 산출 계수가 6000 인지 5000 인지',
  },
  {
    id: 'billing-increment',
    label: '청구무게 0.5kg 올림 · 최소 0.5kg',
    where: 'config/shipping.js · roundingStepKg / minBillableKg',
    status: 'assumed',
    source: '업계 일반',
    risk: '0.1kg 단위 업체면 견적이 계속 과대 산정됩니다.',
    askBroker: '청구무게 올림 단위와 최소 청구무게',
  },
  {
    id: 'import-duty',
    label: '품목군별 관세율 (신발 30% / 가방 25% / 의류·화장품 20% …)',
    where: 'config/taxes.js · DUTY_CATEGORIES',
    status: 'assumed',
    source: '베트남 MFN 세율대 추정',
    risk: '실제 HS 코드 세율과 다르면 견적 전체가 어긋납니다. 가장 영향이 큰 미확정 값입니다.',
    askBroker: '주요 취급 품목의 HS 코드별 실제 관세율, VKFTA/AKFTA 적용 가능 여부',
  },
  {
    id: 'vat',
    label: '베트남 VAT 10%',
    where: 'config/taxes.js · vatRate',
    status: 'assumed',
    source: '베트남 표준세율',
    askBroker: '개인 특송 화물에 적용되는 실제 VAT 율',
  },
  {
    id: 'de-minimis',
    label: '소액 면세 폐지 (전 건 과세)',
    where: 'config/taxes.js · deMinimisVnd = 0',
    status: 'confirmed',
    source: 'Decision 01/2025/QD-TTg (2025-02-18 시행)',
  },
  {
    id: 'blocked-items',
    label: '배송 금지 품목 9개 유형',
    where: 'config/eligibility.js · BLOCK_RULES',
    status: 'assumed',
    source: '베트남 수입 규정 + 항공 위험물 규정 공개 자료',
    risk: '업체 금지 목록이 더 넓으면 통관에서 반송됩니다.',
    askBroker: '업체가 취급하지 않는 품목 전체 목록',
  },
  {
    id: 'item-surcharge',
    label: '상품 할증 (파손주의 $2/개, 대형 $5/건)',
    where: 'config/shipping.js · ITEM_SURCHARGES',
    status: 'assumed',
    source: '임시 설정값',
    askBroker: '파손주의·대형 화물 취급 수수료',
  },
  {
    id: 'lead-time',
    label: '하노이 도착 5~9영업일',
    where: 'config/shipping.js · leadTimeDays',
    status: 'assumed',
    source: '임시 설정값',
    askBroker: '실제 리드타임과 지연 시 보상 기준',
  },
  {
    id: 'maintenance-window',
    label: '점검 시간 03:00~03:30 KST',
    where: 'config/maintenance.js',
    status: 'assumed',
    source: '운영자 지정 (쿠팡은 공개 점검 시각을 명시하지 않음)',
    askBroker: null,
  },
  {
    id: 'insurance',
    label: '고액 상품 보험',
    where: '미구현',
    status: 'blocked',
    source: '-',
    risk: '200만원대 상품 분실 시 배송 마진 수십 건이 날아갑니다.',
    askBroker: '보험 가입 가능 여부, 요율, 보상 한도',
  },
  {
    id: 'device-handling',
    label: '전자기기(리튬배터리 내장) 취급',
    where: 'config/eligibility.js · MANUAL_QUOTE_RULES',
    status: 'blocked',
    source: '-',
    risk: '항공사별로 취급 조건이 달라 자동 견적이 불가합니다.',
    askBroker: '휴대폰·노트북 취급 가능 여부, 수량 제한, 별도 요율',
  },
]

export const assumptionsByStatus = () => ({
  confirmed: ASSUMPTIONS.filter((a) => a.status === 'confirmed'),
  assumed: ASSUMPTIONS.filter((a) => a.status === 'assumed'),
  blocked: ASSUMPTIONS.filter((a) => a.status === 'blocked'),
})

/** 통관업체에 물어볼 항목만 추립니다. */
export const brokerQuestions = () =>
  ASSUMPTIONS.filter((a) => a.askBroker).map((a) => ({
    id: a.id,
    label: a.label,
    question: a.askBroker,
    risk: a.risk ?? null,
    status: a.status,
  }))
