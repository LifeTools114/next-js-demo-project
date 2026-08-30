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
    label: '국제배송 요율 $9/kg (원가 $7 = S1 기본 $6 + 유류 임시조정 $1)',
    where: 'config/shipping.js · ratePerKgUsd / config/costs.server.js',
    status: 'confirmed',
    source: '고객가: 운영자 제시 · 원가: S1 EXPRESS 견적서 26.08.28 (FSC·VN통관료 포함 ALL IN)',
    risk: '유류 임시조정(+$1)은 월별 변동 가능 — $6 복귀 시 마진 +$1/kg, 추가 인상 시 고객가 재검토.',
  },
  {
    id: 'zone-surcharges',
    label: '베트남 현지운송비 — 하노이 $0 확정 (빈푹 $5 · 박닌/박장/흥옌 $7 · 하이즈엉/하이퐁 $17)',
    where: 'config/shipping.js · zones (현재 하노이만 활성)',
    status: 'confirmed',
    source: 'S1 EXPRESS 견적서 26.08.28 — 확장 시 zones 에 위 원가로 추가하면 됨',
  },
  {
    id: 'device-rate',
    label: '전자기기 취급비 — 고객 $40/EA (원가 S1 $30/EA)',
    where: 'config/shipping.js · ITEM_SURCHARGES.device',
    status: 'confirmed',
    source: '고객가: 운영자 확정 26-08-30 · 원가: S1 EXPRESS 견적서 26.08.28. 본체는 자동 견적+할증, 고액(100만원↑)·대량은 기존 게이트 유지',
  },
  {
    id: 'volumetric-divisor',
    label: '부피무게 계수 ÷6000',
    where: 'config/shipping.js · volumetricDivisor',
    status: 'confirmed',
    source: 'S1 EXPRESS 견적서 26.08.28 — "가로*세로*높이 / 6000" 명시',
  },
  {
    id: 'billing-increment',
    label: '청구무게: 최소 1kg · 1kg 부터 0.5kg 단위 올림 (고객 청구 기준)',
    where: 'config/shipping.js · roundingTiers / minBillableKg',
    status: 'confirmed',
    source: '운영자 확정 26.08.29',
    risk: 'S1 의 원가 청구 단위는 미확인 — 우리보다 굵게(예: 1kg) 청구하면 구간별로 원가가 마진을 초과할 수 있음.',
    askBroker: 'S1 이정은 과장: 원가 청구무게 올림 단위(0.1/0.5/1kg)와 최소 청구무게',
  },
  {
    id: 'tax-collect',
    label: '관세·VAT 미징수 — 개인통관·영수증 무증빙 채널',
    where: 'config/taxes.js · collect = false',
    status: 'confirmed',
    source: '운영자 확정 (26-08-29) — S1 $7/kg 올인에 통관 포함, 세금 별도 고지 없음',
    risk: '통관 방식이 정식(수입신고) 채널로 바뀌면 관세·VAT 를 다시 걷어야 합니다 (collect: true 로 복원, 세율표는 보존됨).',
  },
  {
    id: 'import-duty',
    label: '(보존) 품목군별 관세율 — 현재 미사용',
    where: 'config/taxes.js · DUTY_CATEGORIES',
    status: 'confirmed',
    source: '관세 미징수 정책으로 계산에서 제외 — 세율표는 정책 변경 대비 보존',
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
    label: '리드타임 — 창고→하노이 2~3영업일 · 국내 쿠팡→창고 1~3영업일 · 해외직구 +2~3영업일',
    where: 'config/shipping.js · leadTimeDays / config/sourcing.js',
    status: 'confirmed',
    source: '운영자 확정 (26-08-30) — 모두 영업일 기준(주말·공휴일 제외)',
  },
  {
    id: 'return-shipping',
    label: '하노이→한국 반송 — 하노이 2kg까지 $18 + 초과 kg당 $9 (사전 접수 필수)',
    where: 'config/shipping.js · RETURN_SHIPPING',
    status: 'confirmed',
    source: 'S1 EXPRESS 견적서 26.08.28 「하노이 > 인천 (Outbound)」 — 박닌권 $23 · 타이응우옌/하이즈엉 $28, 한국 내 택배 전달 1~10kg $7 / 11~20kg $14',
    risk: '액체·배터리·현금·신용카드·대량물품은 베→한 발송 불가 (화장품 액체류는 반품 자체가 불가). $150 이상 신고 시 관부가세.',
    askBroker: '견적서의 4번째 반송 구간(33$) 지역명 확인, 반송 리드타임',
  },
  {
    id: 'refund-policy',
    label: '환불 영업일 3~7일 · 변심 취소: 구매대행 수수료 제외 / 배송대행 $1 차감 · 반품 비용 전액 구매자 부담',
    where: 'config/payment.js · REFUND_DAYS / RETURN_POLICY',
    status: 'confirmed',
    source: '운영자 확정 (26-08-30) — 당사 사유(품절·가격 인상) 취소는 전액 환불 유지',
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
  {
    id: 'min-order',
    label: '최소 주문 금액 — 없음 (폐지)',
    where: 'config/fees.js · ORDER_MIN.goodsKrw = 0',
    status: 'confirmed',
    source: '운영자 확정 (26-08-29) — 진입장벽 제거 우선. 금액을 넣으면 안내·거절이 다시 살아납니다.',
    risk: '소액 주문은 최소 청구 1kg(12,420원) 배송비가 상품가보다 클 수 있으나, 그 금액 자체에 마진이 있어 역마진은 아닙니다.',
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
