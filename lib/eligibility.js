/**
 * 배송 가능 여부 판정
 *
 * 확장프로그램이 쿠팡 상품 페이지에서 이 판정을 먼저 보여줍니다.
 * "결제한 뒤 창고에서 반송"이 가장 큰 손실이므로,
 * 주문 전에 걸러내는 것이 이 서비스의 핵심 가치입니다.
 */

import { BLOCK_RULES, WARN_RULES, DESTINATION, SAFE_TERMS } from '../config/eligibility.js'

const normalize = (text) => String(text || '').toLowerCase().replace(/\s+/g, '')

/**
 * 차단 키워드를 부분 문자열로 포함하는 정상 표현을 먼저 제거합니다.
 * (예: '세럼'을 지워야 '럼'(주류)에 걸리지 않습니다)
 */
const stripSafeTerms = (haystack) =>
  SAFE_TERMS.reduce((acc, term) => acc.split(normalize(term)).join(' '), haystack)

export const VERDICT = { OK: 'ok', BLOCKED: 'blocked' }

/**
 * 상품 1건의 배송 가능 여부를 판정합니다.
 *
 * @param {{productName:string, categoryPath?:string, price?:number, quantity?:number}} product
 */
export function checkEligibility(product) {
  const haystack = stripSafeTerms(normalize(`${product?.productName || ''} ${product?.categoryPath || ''}`))

  for (const rule of BLOCK_RULES) {
    const hit = rule.keywords.find((kw) => haystack.includes(normalize(kw)))
    if (hit) {
      return {
        verdict: VERDICT.BLOCKED,
        shippable: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        matchedKeyword: hit,
        warnings: [],
        destination: DESTINATION,
      }
    }
  }

  const warnings = []
  const price = Number(product?.price) || 0
  const qty = Math.max(1, Number(product?.quantity) || 1)

  if (price * qty >= WARN_RULES.highValueKrw) {
    warnings.push({
      id: 'high-value',
      message: `고액 주문은 관세·VAT 부담이 커집니다. 베트남은 소액 면세가 폐지되어 전 건 과세됩니다.`,
    })
  }
  if (qty > WARN_RULES.maxSameItemQty) {
    warnings.push({
      id: 'commercial-quantity',
      message: `동일 상품 ${qty}개는 상업적 반입으로 간주되어 통관이 보류될 수 있습니다. ${WARN_RULES.maxSameItemQty}개 이하를 권장합니다.`,
    })
  }

  return {
    verdict: VERDICT.OK,
    shippable: true,
    ruleId: null,
    label: null,
    reason: null,
    matchedKeyword: null,
    warnings,
    destination: DESTINATION,
  }
}

/** 장바구니 전체 판정 — 하나라도 불가면 전체가 불가입니다. */
export function checkCartEligibility(items = []) {
  const results = items.map((item) => ({ item, ...checkEligibility(item) }))
  const blocked = results.filter((r) => !r.shippable)
  const warnings = results.flatMap((r) => r.warnings.map((w) => ({ ...w, productName: r.item.productName })))

  return {
    shippable: blocked.length === 0,
    blocked: blocked.map((r) => ({
      productName: r.item.productName,
      label: r.label,
      reason: r.reason,
      ruleId: r.ruleId,
    })),
    warnings,
    results,
  }
}
