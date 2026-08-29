/**
 * 무게 산정 엔진
 *
 *   내용물(net) = 용량(ml) × 밀도(g/ml)   ← 상품명 파싱
 *   용기(tare)  = base + ratio × net       ← 용기 종류별 테이블
 *   실무게      = (내용물 + 용기 + 완충재) × 수량
 *   부피무게    = 외박스 부피(cm³) ÷ 6000
 *   청구무게    = max(실무게, 부피무게)
 *
 * 배송 가능 여부(위험물·통관 금지)는 lib/eligibility.js 가 따로 판정합니다.
 * 이 모듈은 무게만 책임집니다.
 *
 * 결과에는 항상 confidence(신뢰도)와 basis(산출 근거)가 함께 담깁니다.
 * 구매대행 특성상 "추정치"임을 고객에게 투명하게 보여줘야 하기 때문입니다.
 */

import { parseProductSpec } from './parse.js'
import { detectForm, tareWeight, boxVolume, CONTAINERS } from './density.js'
import { SHIPPING } from '../../config/shipping.js'

/** 시트마스크 1매 구성 (에센스 + 시트 / 파우치) */
const SHEET = { netG: 20, tareG: 5 }

/** 기획세트 추가 포장 무게 */
const SET_BOX_G = 80

export const CONFIDENCE = {
  high: { level: 'high', label: '정확', tolerance: 0.12, description: '상품명에서 용량/중량을 확인했습니다.' },
  medium: { level: 'medium', label: '보통', tolerance: 0.25, description: '제형은 확인했으나 용량 표기가 없어 평균값을 적용했습니다.' },
  low: { level: 'low', label: '낮음', tolerance: 0.4, description: '용량·제형 정보가 없어 카테고리 기본값을 적용했습니다.' },
}

const round1 = (n) => Math.round(n * 10) / 10

/**
 * 상품 1건(구성 수량 포함)의 무게를 추정합니다.
 *
 * @param {{productName:string, categoryName?:string}} product
 * @param {number} quantity 주문 수량 (기본 1)
 */
export function estimateItemWeight(product, quantity = 1) {
  const productName = product?.productName || ''
  const nameSpec = parseProductSpec(productName)

  /**
   * 상세페이지 고시정보(내용물의 용량 또는 중량)가 있으면 그쪽이 정확합니다.
   * 용량·중량·매수만 덮어쓰고, 구성 수량(1+1, 5개입)은 상품명 쪽을 유지합니다.
   * (고시정보에는 보통 총량만 적혀 있어 수량 정보가 없습니다)
   */
  const override = product?.specOverride ? parseProductSpec(String(product.specOverride)) : null

  /**
   * 고시정보에 수량 표기가 함께 있으면(예: "600g (120g x 5)", "23ml x 10매")
   * 그 용량·중량은 이미 **총량**입니다. 여기에 상품명의 구성 수량("5개입")을
   * 다시 곱하면 5배로 부풀려집니다. 그래서 그 경우 구성 수량을 1로 둡니다.
   */
  const overrideIsTotal = Boolean(override && (override.count > 1 || override.sheets !== null))

  let spec = override
    ? {
        ...nameSpec,
        volumeMl: override.volumeMl ?? nameSpec.volumeMl,
        massG: override.massG ?? nameSpec.massG,
        sheets: override.sheets ?? nameSpec.sheets,
        count: overrideIsTotal ? 1 : nameSpec.count,
      }
    : nameSpec
  const { form, matchedKeyword } = detectForm(`${productName} ${product?.categoryName || ''}`)

  const basis = []
  let netG
  let nominalMl
  let tareG
  let confidence

  if (form.perSheetTotalG || form.id === 'sheet-mask') {
    // 시트마스크: 매수 기준으로 계산
    const sheets = spec.sheets ?? form.defaultSheets ?? 10
    netG = sheets * SHEET.netG
    tareG = sheets * SHEET.tareG
    nominalMl = sheets * SHEET.netG
    confidence = spec.sheets ? CONFIDENCE.high : CONFIDENCE.medium
    basis.push(`${sheets}매 × (에센스 ${SHEET.netG}g + 파우치 ${SHEET.tareG}g)`)
  } else {
    if (form.id === 'stick-food') {
      /**
       * 스틱·믹스 식품: "100개입"은 스틱 100개(한 상자)이지 낱개 상품
       * 100개가 아닙니다. 스틱 수 × 개당 무게로 잡고 구성 수량을 1로
       * 접습니다. (커피믹스 100개입이 55kg 로 계산되던 사고 방지)
       */
      const sticks = spec.sachets ?? (spec.count > 1 ? spec.count : 30)
      netG = sticks * (form.defaultG ?? 12)
      nominalMl = netG
      confidence = CONFIDENCE.medium
      basis.push(`${sticks}스틱 × ${form.defaultG ?? 12}g`)
      spec = { ...spec, count: 1 }
    } else if (form.perPieceG && spec.count >= 6 && spec.massG === null && spec.volumeMl === null) {
      // '12개입' 과자는 낱봉지 12개가 아니라 한 상자 안 낱개 12개입니다.
      netG = spec.count * form.perPieceG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.medium
      basis.push(`${spec.count}개입 × 개당 ${form.perPieceG}g`)
      spec = { ...spec, count: 1 }
    } else if (spec.massG !== null) {
      netG = spec.massG
      nominalMl = spec.massG / form.density
      confidence = CONFIDENCE.high
      basis.push(`상품명 표기 중량 ${round1(spec.massG)}g`)
    } else if (spec.volumeMl !== null) {
      netG = spec.volumeMl * form.density
      nominalMl = spec.volumeMl
      confidence = CONFIDENCE.high
      basis.push(`${round1(spec.volumeMl)}ml × ${form.label} 밀도 ${form.density}g/ml = ${round1(netG)}g`)
    } else if (spec.tablets) {
      // 알약: 알 수 × 0.9g — 병 하나. 구성 수량과 무관합니다.
      netG = spec.tablets * 0.9
      nominalMl = netG / 0.6
      confidence = CONFIDENCE.medium
      basis.push(`${spec.tablets}정 × 0.9g`)
    } else if (spec.sachets) {
      // 포(스틱): 포 수 × 8g — 홍삼 스틱·유산균 분말 등.
      netG = spec.sachets * 8
      nominalMl = netG
      confidence = CONFIDENCE.medium
      basis.push(`${spec.sachets}포 × 8g`)
    } else if (form.defaultMl != null) {
      netG = form.defaultMl * form.density
      nominalMl = form.defaultMl
      confidence = form.id === 'unknown' ? CONFIDENCE.low : CONFIDENCE.medium
      basis.push(`용량 미표기 → ${form.label} 평균 ${form.defaultMl}ml 적용`)
    } else {
      netG = form.defaultG ?? 20
      nominalMl = netG / form.density
      confidence = form.id === 'unknown' ? CONFIDENCE.low : CONFIDENCE.medium
      basis.push(`용량 미표기 → ${form.label} 평균 ${round1(netG)}g 적용`)
    }
    tareG = tareWeight(form.container, netG)
    const container = CONTAINERS[form.container]
    basis.push(`${container.label} 공차 ${round1(tareG)}g`)
  }

  const unitCount = spec.count
  if (unitCount > 1) basis.push(`구성 수량 ${unitCount}개`)

  const setExtraG = spec.isSet ? SET_BOX_G : 0
  if (setExtraG) basis.push(`기획세트 포장 ${SET_BOX_G}g`)

  const packingG = SHIPPING.packingPerItemG * unitCount
  const perOrderG = (netG + tareG) * unitCount + setExtraG + packingG

  const volumetricCm3 = boxVolume(form.container, nominalMl) * unitCount + (spec.isSet ? 400 : 0)
  const perOrderVolumetricG = (volumetricCm3 / SHIPPING.volumetricDivisor) * 1000

  const qty = Math.max(1, Number(quantity) || 1)
  const actualG = perOrderG * qty
  const volumetricG = perOrderVolumetricG * qty
  const chargeableG = Math.max(actualG, volumetricG)

  return {
    productName,
    quantity: qty,
    form: { id: form.id, label: form.label, density: form.density, matchedKeyword },
    container: { id: form.container, label: CONTAINERS[form.container]?.label ?? form.container },
    spec,
    netG: round1(netG * unitCount * qty),
    tareG: round1(tareG * unitCount * qty),
    packingG: round1((packingG + setExtraG) * qty),
    actualG: round1(actualG),
    volumetricCm3: Math.round(volumetricCm3 * qty),
    volumetricG: round1(volumetricG),
    chargeableG: round1(chargeableG),
    chargeableBy: actualG >= volumetricG ? 'actual' : 'volumetric',
    confidence,
    basis,
  }
}

/**
 * 장바구니 전체(여러 상품)의 배송 무게를 합산합니다.
 * 박스 무게는 배송 건당 1회만 가산합니다.
 */
export function estimateShipmentWeight(items = []) {
  const lines = items.map((item) => estimateItemWeight(item, item.quantity ?? 1))

  const itemsActualG = lines.reduce((sum, l) => sum + l.actualG, 0)
  const itemsVolumetricG = lines.reduce((sum, l) => sum + l.volumetricG, 0)

  const boxG = lines.length > 0 ? SHIPPING.boxWeightG : 0
  const actualG = itemsActualG + boxG
  const volumetricG = itemsVolumetricG + boxG
  const chargeableG = Math.max(actualG, volumetricG)

  // 신뢰도는 가장 낮은 항목을 따릅니다.
  const rank = { high: 3, medium: 2, low: 1 }
  const confidence = lines.reduce(
    (worst, l) => (rank[l.confidence.level] < rank[worst.level] ? l.confidence : worst),
    CONFIDENCE.high,
  )

  return {
    lines,
    boxG,
    actualG: round1(actualG),
    volumetricG: round1(volumetricG),
    chargeableG: round1(chargeableG),
    chargeableKg: round1(chargeableG / 1000),
    chargeableBy: actualG >= volumetricG ? 'actual' : 'volumetric',
    confidence,
    exceedsMaxParcel: chargeableG / 1000 > SHIPPING.maxParcelKg,
  }
}
