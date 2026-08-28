/**
 * 한국 물류창고 (입고지)
 *
 * 배송대행 고객이 쿠팡 배송지로 입력할 주소입니다. 핵심은 **수령인 코드**:
 * 수령인 칸에 "이름 + 주문번호"를 넣게 하면 소포 라벨에 주문번호가 찍혀
 * 입고 시 스캔·검색만으로 주문이 자동 매칭됩니다. (업계 표준 사서함 방식)
 *
 * 주소는 물류 파트너 확정 후 env 로 넣으세요 — 미설정이면 고객 안내에
 * 자리표시가 뜨고, configured: false 로 확인할 수 있습니다.
 */

const env = (key) => process.env[key] || ''

export const WAREHOUSE = {
  name: env('KR_WAREHOUSE_NAME'),
  zip: env('KR_WAREHOUSE_ZIP'),
  address1: env('KR_WAREHOUSE_ADDR1'),
  address2: env('KR_WAREHOUSE_ADDR2'),
  phone: env('KR_WAREHOUSE_PHONE'),
  configured: Boolean(env('KR_WAREHOUSE_ADDR1')),
}

/** 쿠팡 배송지의 "받는 사람" 칸에 그대로 들어갈 문자열 */
export const recipientCode = (customerName, orderNo) =>
  `${String(customerName ?? '').trim()} ${orderNo}`.trim()
