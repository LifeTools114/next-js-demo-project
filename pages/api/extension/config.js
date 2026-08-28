/**
 * GET /api/extension/config
 *
 * 확장프로그램에 정책 "데이터"를 내려줍니다.
 * 요율·세율·환율이 바뀌어도 확장을 재배포할 필요가 없습니다.
 *
 * ⚠️ MV3 는 원격 코드 실행을 금지합니다.
 *    여기서 내려보내는 것은 값(숫자·문자열·셀렉터)뿐이며, 코드는 확장에 번들되어 있습니다.
 */

import { SHIPPING, CONSOLIDATION, ITEM_SURCHARGES } from '../../../config/shipping'
import { TAXES } from '../../../config/taxes'
import { FEES, ORDER_MIN } from '../../../config/fees'
import { FX } from '../../../config/fx'
import { AFFILIATE } from '../../../config/affiliate'
import { DESTINATION } from '../../../config/eligibility'
import { MAINTENANCE } from '../../../config/maintenance'
import { WAREHOUSE } from '../../../config/warehouse'
import { maintenanceStatus } from '../../../lib/maintenance'
import { ensureFreshFx } from '../../../lib/fx/refresh'

/**
 * 쿠팡 마크업이 바뀌었을 때 확장 재배포 없이 대응하기 위한 셀렉터 설정.
 * 확장은 이 값을 자기 기본값 앞에 덧붙여 시도합니다.
 */
const SELECTORS = {
  productName: [],
  price: [],
  breadcrumb: [],
  noticeTable: [],
  rocket: [],
  soldOut: [],
  /** 운영자 모드 — 쿠팡 주문완료 화면의 주문번호·결제액 (마크업 변경 대응용) */
  orderNo: [],
  orderTotal: [],
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  // 환율이 오래됐으면 백그라운드로 갱신 — 이 응답은 기존 값으로 즉시 나갑니다.
  ensureFreshFx()

  // 확장은 어느 오리진에서든 호출하므로 CORS 를 열어둡니다. (읽기 전용 공개 설정)
  res.setHeader('Access-Control-Allow-Origin', '*')
  // serverStatus 가 시각 의존이라 짧게 캐시합니다. 확장은 시각 설정으로 자체 판정하므로 안전합니다.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400')

  return res.status(200).json({
    version: 1,
    updatedAt: new Date().toISOString(),
    destination: DESTINATION,

    /**
     * 점검 창 — 확장은 이 값으로 **스스로 판정**합니다.
     * 시각만 넘기면 네트워크가 끊겨도, 캐시가 오래돼도 정확히 동작합니다.
     * (서버에 매번 "지금 점검이야?"를 묻는 구조였다면 오프라인에서 깨집니다)
     */
    maintenance: {
      enabled: MAINTENANCE.enabled,
      appliesTo: MAINTENANCE.appliesTo,
      utcOffsetMinutes: MAINTENANCE.timezone.utcOffsetMinutes,
      startMinuteOfDay: MAINTENANCE.startMinuteOfDay,
      durationMinutes: MAINTENANCE.durationMinutes,
      noticeLeadMinutes: MAINTENANCE.noticeLeadMinutes,
      graceMinutes: MAINTENANCE.graceMinutes,
      label: MAINTENANCE.label,
      shortLabel: MAINTENANCE.shortLabel,
      reason: MAINTENANCE.reason,
      /** 서버 기준 현재 상태 — 확장 자체 판정과 대조해 시계 오차를 감지합니다 */
      serverStatus: maintenanceStatus(new Date(), DESTINATION.country),
    },
    policy: {
      ratePerKgUsd: SHIPPING.ratePerKgUsd,
      minBillableKg: SHIPPING.minBillableKg,
      roundingTiers: SHIPPING.roundingTiers,
      agencyRate: FEES.agencyRate,
      minOrderGoodsKrw: ORDER_MIN.goodsKrw,
      vatRate: TAXES.vatRate,
      defaultDutyRate: TAXES.defaultDutyRate,
      usdToKrw: FX.usdToKrw,
      krwToVnd: FX.krwToVnd,
      fxSpread: FX.spread,
    },
    zones: SHIPPING.zones,
    serviceAreaNotice: SHIPPING.serviceAreaNotice,

    /**
     * 한국 창고 주소 — 배송대행 고객이 쿠팡 배송지에 입력합니다.
     * 쿠팡 결제를 먼저 하는 흐름이라 구매 "전"에 확장이 보여줘야 합니다.
     */
    warehouse: {
      name: WAREHOUSE.name,
      zip: WAREHOUSE.zip,
      address1: WAREHOUSE.address1,
      address2: WAREHOUSE.address2,
      phone: WAREHOUSE.phone,
      configured: WAREHOUSE.configured,
    },
    leadTimeDays: SHIPPING.leadTimeDays,
    itemSurcharges: ITEM_SURCHARGES,
    consolidation: {
      freeStorageDays: CONSOLIDATION.freeStorageDays,
      handlingFeeUsd: CONSOLIDATION.handlingFeeUsd,
    },
    affiliate: {
      // 배송대행에서만 제휴가 적용된다는 사실을 확장도 알아야 합니다.
      applyTo: AFFILIATE.applyTo,
      disclosure: AFFILIATE.compliance.disclosure,
      disclosureShort: AFFILIATE.compliance.disclosureShort,
    },
    selectors: SELECTORS,
  })
}
