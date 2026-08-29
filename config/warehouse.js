/**
 * 한국 물류창고 (입고지) — 물류 파트너 확정 (2026-08)
 *
 * 쿠팡 배송지 입력 규칙 (파트너 요구사항):
 *   받는 사람 : 고객 본인 이름 그대로
 *   주소      : 서울특별시 강서구 개화동로 11길 5 (07504)
 *   세부주소  : "K-ECOM(주문자명)"  ← 파트너가 이 코드로 입고를 접수하므로
 *               상세주소 칸에 반드시 이 형식이 들어가야 합니다.
 *
 * 입고 매칭은 연결된 쿠팡 주문번호·운송장, 그리고 라벨의 이름
 * (K-ECOM(이름) 안의 이름 — findByInbound 의 이름 폴백)으로 이뤄집니다.
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
  /** 세부주소 코드의 접두사 — "K-ECOM(이름)" 의 K-ECOM 부분 */
  code: env('KR_WAREHOUSE_CODE') || 'K-ECOM',
  phone: env('KR_WAREHOUSE_PHONE'),
  configured: Boolean(address1),
}

/** 쿠팡 배송지의 "세부주소(상세주소)" 칸에 그대로 들어갈 문자열 */
export const detailAddressFor = (customerName) =>
  `${WAREHOUSE.code}(${String(customerName ?? '').trim() || '주문자명'})`
