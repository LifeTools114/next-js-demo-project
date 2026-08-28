/**
 * "뷰티 카테고리 중 여성 화장품만" 3단 필터
 *
 *   1단계 — 남성용 키워드 제외 (남성/옴므/포맨/쉐이빙 …)
 *   2단계 — 비화장품 제외 (미용기기·헤어·바디·위생용품 …)
 *   3단계 — 서브카테고리 화이트리스트 매칭 (스킨케어/클렌징/…/향수)
 *
 * ⚠️ 자동 분류만으로 100%를 걸러낼 수는 없습니다.
 *    매칭 근거를 함께 반환하므로 운영자 검수 큐에서 판단 근거를 확인할 수 있습니다.
 */

import { SUBCATEGORIES, MALE_KEYWORDS, NON_COSMETIC_KEYWORDS, BRAND_SAFELIST } from '../../config/catalog.js'

const normalize = (text) => String(text || '').toLowerCase().replace(/\s+/g, '')

const findKeyword = (haystack, keywords) =>
  keywords.find((kw) => haystack.includes(normalize(kw))) || null

/**
 * 세이프리스트 브랜드명을 제거한 뒤 제외 키워드를 검사합니다.
 * (여성 브랜드 '포맨트'가 남성 키워드 '포맨'에 걸리는 오탐 방지)
 */
const stripSafeBrands = (haystack) =>
  BRAND_SAFELIST.reduce((acc, brand) => acc.split(normalize(brand)).join(' '), haystack)

/**
 * 분류 우선순위 순서 (구체적 → 일반적).
 * SUBCATEGORIES 배열 순서는 UI 노출 순서이므로 분류에 그대로 쓰면 안 됩니다.
 * 예) '클렌징오일'이 스킨케어의 '오일'에, '선크림'이 스킨케어의 '크림'에 먼저 걸립니다.
 */
const MATCH_ORDER = [...SUBCATEGORIES].sort(
  (a, b) => (a.matchPriority ?? 999) - (b.matchPriority ?? 999),
)

export const REJECT_REASONS = {
  MALE: 'male-product',
  NON_COSMETIC: 'non-cosmetic',
  UNCLASSIFIED: 'unclassified',
}

/**
 * 상품 1건을 분류합니다.
 * @param {{productName:string, categoryName?:string}} product
 * @returns {{allowed:boolean, subcategoryId:string|null, subcategoryLabel:string|null,
 *            matchedKeyword:string|null, reason:string|null, rejectedBy:string|null}}
 */
export function classifyProduct(product) {
  const haystack = normalize(`${product?.productName || ''} ${product?.categoryName || ''}`)
  const exclusionHaystack = stripSafeBrands(haystack)

  const maleHit = findKeyword(exclusionHaystack, MALE_KEYWORDS)
  if (maleHit) {
    return {
      allowed: false,
      subcategoryId: null,
      subcategoryLabel: null,
      matchedKeyword: maleHit,
      reason: `남성용 키워드 '${maleHit}' 포함`,
      rejectedBy: REJECT_REASONS.MALE,
    }
  }

  const nonCosmeticHit = findKeyword(exclusionHaystack, NON_COSMETIC_KEYWORDS)
  if (nonCosmeticHit) {
    return {
      allowed: false,
      subcategoryId: null,
      subcategoryLabel: null,
      matchedKeyword: nonCosmeticHit,
      reason: `취급 제외 품목 키워드 '${nonCosmeticHit}' 포함`,
      rejectedBy: REJECT_REASONS.NON_COSMETIC,
    }
  }

  for (const sub of MATCH_ORDER) {
    const hit = findKeyword(haystack, sub.keywords)
    if (hit) {
      return {
        allowed: true,
        subcategoryId: sub.id,
        subcategoryLabel: sub.label,
        matchedKeyword: hit,
        reason: `'${hit}' → ${sub.label}`,
        rejectedBy: null,
      }
    }
  }

  return {
    allowed: false,
    subcategoryId: null,
    subcategoryLabel: null,
    matchedKeyword: null,
    reason: '여성 화장품 서브카테고리에 해당하지 않음',
    rejectedBy: REJECT_REASONS.UNCLASSIFIED,
  }
}

/**
 * 상품 목록을 필터링합니다.
 * @returns {{accepted:Array, rejected:Array, stats:object}}
 */
export function filterWomenCosmetics(products = []) {
  const accepted = []
  const rejected = []

  for (const product of products) {
    const classification = classifyProduct(product)
    if (classification.allowed) {
      accepted.push({
        ...product,
        subcategoryId: classification.subcategoryId,
        subcategoryLabel: classification.subcategoryLabel,
        classification,
      })
    } else {
      rejected.push({ ...product, classification })
    }
  }

  const stats = rejected.reduce(
    (acc, r) => {
      acc[r.classification.rejectedBy] = (acc[r.classification.rejectedBy] || 0) + 1
      return acc
    },
    { total: products.length, accepted: accepted.length, rejected: rejected.length },
  )

  return { accepted, rejected, stats }
}
