/**
 * GET /api/extension/config
 *
 * 확장프로그램에 정책 "데이터"를 내려줍니다.
 * 요율·세율·환율이 바뀌어도 확장을 재배포할 필요가 없습니다.
 *
 * ⚠️ MV3 는 원격 코드 실행을 금지합니다.
 *    여기서 내려보내는 것은 값(숫자·문자열·셀렉터)뿐이며, 코드는 확장에 번들되어 있습니다.
 */

import { SHIPPING, CONSOLIDATION } from '../../../config/shipping'
import { TAXES } from '../../../config/taxes'
import { FEES } from '../../../config/fees'
import { FX } from '../../../config/fx'
import { AFFILIATE } from '../../../config/affiliate'
import { DESTINATION } from '../../../config/eligibility'

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
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  // 확장은 어느 오리진에서든 호출하므로 CORS 를 열어둡니다. (읽기 전용 공개 설정)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400')

  return res.status(200).json({
    version: 1,
    updatedAt: new Date().toISOString(),
    destination: DESTINATION,
    policy: {
      ratePerKgUsd: SHIPPING.ratePerKgUsd,
      minBillableKg: SHIPPING.minBillableKg,
      roundingStepKg: SHIPPING.roundingStepKg,
      agencyRate: FEES.agencyRate,
      vatRate: TAXES.vatRate,
      defaultDutyRate: TAXES.defaultDutyRate,
      usdToKrw: FX.usdToKrw,
      krwToVnd: FX.krwToVnd,
      fxSpread: FX.spread,
    },
    zones: SHIPPING.zones,
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
