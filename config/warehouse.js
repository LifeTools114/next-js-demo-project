/**
 * 한국 물류창고 (입고지) — 물류 파트너 확정 (2026-08)
 *
 * 쿠팡 배송지 입력 규칙 (파트너 요구사항 — 운영자 실입력 기준):
 *   이름(받는 사람) : YS-ECOM
 *   주소            : 서울특별시 강서구 개화동로 11길 5 (07504)
 *   상세주소        : "YS-ECOM 주문자명"  ← 파트너가 이 코드+이름으로
 *                     입고를 접수하므로 반드시 들어가야 합니다.
 *
 * 입고 매칭은 연결된 쿠팡 주문번호·운송장, 그리고 라벨의 이름
 * (상세주소 안의 이름 — findByInbound 의 이름 폴백)으로 이뤄집니다.
 * 형식(괄호·공백·하이픈)은 상관없습니다 — 이름만 들어 있으면 찾습니다.
 *
 * 파트너 변경에 대비해 모든 값은 env 로 덮어쓸 수 있습니다.
 */

const env = (key) => process.env[key] || ''

const address1 = env('KR_WAREHOUSE_ADDR1') || '서울특별시 강서구 개화동로 11길 5'

export const WAREHOUSE = {
  name: env('KR_WAREHOUSE_NAME'),
  zip: env('KR_WAREHOUSE_ZIP') || '07504',
  address1,
  /** 파트너 요구 외 추가 상세(층·호 등)가 생기면 env 로 */
  address2: env('KR_WAREHOUSE_ADDR2'),
  /** 세부주소 코드의 접두사 — "YS-ECOM 이름" 의 YS-ECOM 부분 */
  code: env('KR_WAREHOUSE_CODE') || 'YS-ECOM',
  /** 배송지 연락처 — 확장이 쿠팡 배송지 입력창에 자동으로 채웁니다 */
  phone: env('KR_WAREHOUSE_PHONE') || '010-7360-1156',
  configured: Boolean(address1),
}

/** 쿠팡 배송지의 "세부주소(상세주소)" 칸에 그대로 들어갈 문자열 */
export const detailAddressFor = (customerName) =>
  `${WAREHOUSE.code} ${String(customerName ?? '').trim() || '주문자명'}`
