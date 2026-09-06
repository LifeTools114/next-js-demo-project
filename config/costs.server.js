/**
 * ⚠️ 서버 전용 원가 설정 — 절대 확장프로그램 번들에 포함되면 안 됩니다.
 *
 * 파일명에 `.server` 를 붙인 이유:
 *   lib/extension-entry.js(번들 진입점)가 이 파일을 import 하지 않으면
 *   esbuild 가 번들에 넣지 않습니다. config/shipping.js 에 두었을 때는
 *   그 파일 전체가 번들되면서 `costPerKgUsd:7` 이 확장 파일에 그대로 박혔습니다.
 *   확장은 사용자가 파일을 열어볼 수 있으므로 실질적인 누출이었습니다.
 *
 * 원가가 드러나면 협상력을 잃고, 고객이 마진을 역산할 수 있습니다.
 * npm run check:leak 이 번들 누출을 검사합니다.
 */

/**
 * 업체(물류사) 청구 추가비용의 고객 견적 배수 — 운영자 확정(26.08.29):
 * "다른 추가비용이 있다면 업체 비용보다 20% 인상된 견적으로".
 * 적용 대상: 특이건 할증(전자전자기기 원가 $30/EA → 고객가 $40/EA (운영자 확정 26-08-30, ITEM_SURCHARGES.device)
 * (빈푹 $5→$6 · 박닌/박장/흥옌 $7→$8 · 하이퐁 $17→$20 — 소수점 아래 버림, 운영자 26-09-06), 검사·포장·보관 실비.
 * 관세·VAT 같은 세금은 마진 없이 실비 그대로 전달합니다.
 */
export const COST_MARKUP = 1.2

export const COSTS = {
  /** 물류사 원가 — 1kg당 USD (판매가 $8, 마진 $1/kg — 26-09-04 인하) */
  /**
   * S1 EXPRESS 견적서(26.08.28) 확정: 기본 $6/kg + 유류 임시조정 $1 = $7.
   * 임시조정이라 월별로 변동 가능 — $6 복귀 시 마진 +$1, 인상 시 재검토.
   * FSC·베트남 통관료 포함(ALL IN), 부피중량 ÷6000, 하노이 현지운송 $0.
   */
  shippingPerKgUsd: 7,

  /** 합배송 재포장 원가 (USD) — 아직 미확인 */
  consolidationHandlingUsd: 0,

  /** 상품 할증 원가 (USD) — 업체 확인 전까지 0 */
  surcharge: { fragile: 0, bulky: 0 },

  /**
   * 지역 할증 원가 (USD) — S1 EXPRESS 견적서 26.08.28 베트남 현지운송비.
   * 고객가는 config/shipping.js zones (원가 × COST_MARKUP, 소수점 버림). 키는 zones 와 같아야 합니다.
   */
  zoneUsd: { hanoi: 0, vinhphuc: 5, bacninh: 7, bacgiang: 7, hungyen: 7, haiduong: 17, haiphong: 17 },

  /** 결제대행(PG) 실비율 — 고객 청구율과 다를 수 있습니다 */
  paymentRate: 0.029,
}
