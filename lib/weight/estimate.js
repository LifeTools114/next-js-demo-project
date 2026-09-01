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
import { detectForm, formByCategory, tareWeight, boxVolume, CONTAINERS } from './density.js'
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
  /**
   * 제형은 상품명으로 먼저 판별합니다 — 카테고리명을 함께 넣으면
   * "스킨케어" 의 '스킨' 이 토너로, "아이스크림" 의 '크림' 이 유리단지로
   * 잡히는 등 카테고리가 상품을 덮어씁니다. 못 찾을 때만 카테고리로 보완.
   */
  let detected = detectForm(productName)
  if (detected.form.id === 'unknown' && product?.categoryName) {
    // 카테고리 매핑이 먼저입니다 — 카테고리명을 상품명에 합쳐 키워드로 찾으면
    // "스킨케어"의 '스킨'이 토너로, "아이스크림"의 '크림'이 유리단지로 잡힙니다.
    const byCat = formByCategory(product.categoryName)
    detected = byCat
      ? { form: byCat, matchedKeyword: `카테고리:${product.categoryName}` }
      : detectForm(`${productName} ${product.categoryName}`)
  }
  const { form, matchedKeyword } = detected

  /**
   * 포·정 수와 함께 적힌 소용량(≤50g/ml)은 낱개 한 포의 양입니다.
   * 큰 값(예: "홍삼정 300g 30포")은 총량 표기이므로 곱하지 않습니다.
   */
  if (form.ignoreVolume) spec = { ...spec, volumeMl: null }

  const unitSpecG = spec.massG !== null && spec.massG <= 50
    ? spec.massG
    : spec.volumeMl !== null && spec.volumeMl <= 50
      ? spec.volumeMl * form.density
      : null

  const basis = []
  let netG
  let nominalMl
  let tareG
  let containerId = form.container
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
    if (form.id === 'stick-food' && !(spec.massG !== null && spec.massG >= 100)) {
      /**
       * 스틱·믹스 식품: "100개입"은 스틱 100개(한 상자)이지 낱개 상품
       * 100개가 아닙니다. 스틱 수 × 개당 무게로 잡고 구성 수량을 1로
       * 접습니다. (커피믹스 100개입이 55kg 로 계산되던 사고 방지)
       */
      const sticks = spec.sachets ?? (spec.count > 1 ? spec.count : 30)
      // "0.9g 100개입" 처럼 낱개 무게가 적혀 있으면 평균값보다 그 값이 정확합니다.
      const perStickG = spec.massG !== null && spec.massG <= 30 ? spec.massG : (form.defaultG ?? 12)
      netG = sticks * perStickG
      nominalMl = netG
      confidence = spec.massG !== null && spec.massG <= 30 ? CONFIDENCE.high : CONFIDENCE.medium
      basis.push(`${sticks}스틱 × ${perStickG}g`)
      spec = { ...spec, count: 1 }
    } else if (form.perPieceG && spec.count >= 6 && spec.massG === null && spec.volumeMl === null) {
      // '12개입' 과자는 낱봉지 12개가 아니라 한 상자 안 낱개 12개입니다.
      netG = spec.count * form.perPieceG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.medium
      basis.push(`${spec.count}개입 × 개당 ${form.perPieceG}g`)
      spec = { ...spec, count: 1 }
    } else if (form.perSheetG && spec.sheets) {
      /**
       * 장(매) 단위로 파는 물건 — 수건 10장, 복사용지 2500매.
       * 시트마스크와 달리 낱장이 그 자체로 상품이라 장당 무게를 곱합니다.
       */
      netG = spec.sheets * form.perSheetG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.high
      basis.push(`${spec.sheets}장 × 장당 ${form.perSheetG}g`)
    } else if ((spec.sachets || spec.tablets || spec.sheets) && unitSpecG !== null) {
      /**
       * "10ml 30포", "2g 60포" — 표기된 용량·중량은 한 포(정)의 것이고
       * 총량이 아닙니다. 곱하지 않으면 30포 홍삼이 10g 이 됩니다.
       */
      const n = spec.sachets ?? spec.tablets ?? spec.sheets
      const unitLabel = spec.sachets ? '포' : spec.tablets ? '정' : '매'
      netG = n * unitSpecG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.high
      basis.push(`${n}${unitLabel} × 단위 ${round1(unitSpecG)}g`)
    } else if (spec.massG !== null && spec.count >= 10 && spec.massG <= 20) {
      /**
       * "0.9g 100개입" 커피 — 낱개가 아주 가벼우면 낱개 상품 100개가 아니라
       * 한 상자입니다. 낱개마다 용기 공차를 더하면 3.7kg 로 부풀어 오릅니다.
       */
      netG = spec.massG * spec.count
      nominalMl = netG / form.density
      confidence = CONFIDENCE.medium
      basis.push(`${spec.count}개입 × 개당 ${round1(spec.massG)}g (한 포장)`)
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
      // 알약: 알 수 × 개당 무게 — 병 하나. 구성 수량과 무관합니다.
      // 식기세척기 태블릿처럼 큰 정제는 제형 테이블이 개당 무게를 지정합니다.
      const perTab = form.perTabletG ?? 0.9
      netG = spec.tablets * perTab
      nominalMl = netG / (form.perTabletG ? form.density : 0.6)
      confidence = CONFIDENCE.medium
      basis.push(`${spec.tablets}정 × ${perTab}g`)
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
    containerId = form.largeContainer && netG > (form.largeThresholdG ?? 200)
      ? form.largeContainer
      : form.container
    tareG = tareWeight(containerId, netG)
    basis.push(`${CONTAINERS[containerId].label} 공차 ${round1(tareG)}g`)
  }

  const unitCount = spec.count
  if (unitCount > 1) basis.push(`구성 수량 ${unitCount}개`)

  const setExtraG = spec.isSet ? SET_BOX_G : 0
  if (setExtraG) basis.push(`기획세트 포장 ${SET_BOX_G}g`)

  /**
   * 여러 개 구성(20개입 등)은 하나의 묶음으로 옵니다 — 낱개마다 완충재를
   * 새로 넣지 않으므로 첫 개만 온전히, 나머지는 30%만 가산합니다.
   */
  const packingG = SHIPPING.packingPerItemG * (1 + (unitCount - 1) * 0.3)
  const perOrderG = (netG + tareG) * unitCount + setExtraG + packingG

  /**
   * 부피도 같은 이유로 "박스 기본 부피 1회 + 내용물 부피 × 개수"입니다.
   * 예전에는 박스 전체를 개수만큼 곱해 화장지 30롤이 42kg 로 나왔습니다.
   */
  const box = CONTAINERS[containerId]?.box ?? { base: 110, mlFactor: 2.2 }
  const volumetricCm3 = box.base + box.mlFactor * nominalMl * unitCount + (spec.isSet ? 400 : 0)
  const perOrderVolumetricG = (volumetricCm3 / SHIPPING.volumetricDivisor) * 1000

  const qty = Math.max(1, Number(quantity) || 1)
  const actualG = perOrderG * qty
  const volumetricG = perOrderVolumetricG * qty
  const chargeableG = Math.max(actualG, volumetricG)

  return {
    productName,
    quantity: qty,
    form: { id: form.id, label: form.label, density: form.density, matchedKeyword },
    container: { id: containerId, label: CONTAINERS[containerId]?.label ?? containerId },
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
