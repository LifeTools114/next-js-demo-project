/**
 * 쿠팡 API 응답 → 내부 상품 모델 변환
 *
 * 내부 모델에는 쿠팡 원본 필드 외에
 *   - 여성 화장품 분류 결과 (subcategoryId)
 *   - 무게 추정 결과 (weight)
 * 가 함께 붙습니다. 이 두 가지가 이 서비스의 핵심 부가가치입니다.
 */

import { classifyProduct } from '../filter/women-cosmetics.js'
import { estimateItemWeight } from '../weight/estimate.js'

/** 상품명 앞부분에서 브랜드를 추정합니다. (대괄호 표기 우선) */
export function extractBrand(productName = '') {
  const bracket = productName.match(/^[\[(]([^\])]{1,20})[\])]/)
  if (bracket) return bracket[1].trim()
  const first = productName.trim().split(/\s+/)[0]
  return first && first.length <= 12 ? first : ''
}

/**
 * @param {object} raw 쿠팡 파트너스 productData 항목
 */
export function normalizeProduct(raw) {
  if (!raw) return null

  const productName = raw.productName ?? raw.title ?? ''
  const productPrice = Number(raw.productPrice ?? raw.price ?? 0)
  const productId = String(raw.productId ?? raw.id ?? '')

  const base = {
    id: productId,
    productId,
    productName,
    productPrice,
    productImage: raw.productImage ?? raw.image ?? '',
    productUrl: raw.productUrl ?? raw.url ?? '',
    categoryName: raw.categoryName ?? '',
    isRocket: Boolean(raw.isRocket),
    isFreeShipping: Boolean(raw.isFreeShipping),
    brand: extractBrand(productName),
  }

  const classification = classifyProduct(base)
  const weight = estimateItemWeight(base, 1)

  return {
    ...base,
    subcategoryId: classification.subcategoryId,
    subcategoryLabel: classification.subcategoryLabel,
    classification,
    weight: {
      actualG: weight.actualG,
      volumetricG: weight.volumetricG,
      chargeableG: weight.chargeableG,
      confidence: weight.confidence.level,
      confidenceLabel: weight.confidence.label,
      formLabel: weight.form.label,
      containerLabel: weight.container.label,
      basis: weight.basis,
      restriction: weight.restriction,
    },
  }
}

export function normalizeProducts(rawList = []) {
  return rawList.map(normalizeProduct).filter(Boolean)
}

/** productId 기준 중복 제거 (여러 검색어에서 같은 상품이 나올 수 있음) */
export function dedupeByProductId(products = []) {
  const seen = new Map()
  for (const p of products) {
    if (p?.productId && !seen.has(p.productId)) seen.set(p.productId, p)
  }
  return [...seen.values()]
}
