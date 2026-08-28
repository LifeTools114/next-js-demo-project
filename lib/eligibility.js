/**
 * 배송 가능 여부 판정
 *
 * 확장프로그램이 쿠팡 상품 페이지에서 이 판정을 먼저 보여줍니다.
 * "결제한 뒤 창고에서 반송"이 가장 큰 손실이므로,
 * 주문 전에 걸러내는 것이 이 서비스의 핵심 가치입니다.
 */

import { BLOCK_RULES, WARN_RULES, DESTINATION, SAFE_TERMS, MANUAL_QUOTE_RULES, CONTEXT_MARKERS } from '../config/eligibility.js'

const normalize = (text) => String(text || '').toLowerCase().replace(/\s+/g, '')

/**
 * 차단 키워드를 부분 문자열로 포함하는 정상 표현을 먼저 제거합니다.
 * (예: '세럼'을 지워야 '럼'(주류)에 걸리지 않습니다)
 */
const stripSafeTerms = (haystack) =>
  SAFE_TERMS.reduce((acc, term) => acc.split(normalize(term)).join(' '), haystack)

/**
 * 상품이 어떤 문맥에 속하는지 판정합니다.
 * 화장품 문맥이면 축산물·식물 검역 규칙을 적용하지 않습니다.
 * (한국 화장품에는 유제품 이름이 흔합니다 — 자음생크림, 요거트팩, 계란 클렌징폼)
 */
function detectContexts(haystack) {
  const found = new Set()
  for (const [context, markers] of Object.entries(CONTEXT_MARKERS)) {
    if (markers.some((m) => haystack.includes(normalize(m)))) found.add(context)
  }
  return found
}

/**
 * 판정 3단계.
 *   BLOCKED      수입 금지 — 아예 받지 않음
 *   MANUAL_QUOTE 배송 가능하나 자동 견적을 내지 않음 — 물류사 견적을 받아 운영자가 입력
 *   OK           자동 견적
 */
export const VERDICT = { OK: 'ok', BLOCKED: 'blocked', MANUAL_QUOTE: 'manual-quote' }

/**
 * 상품 1건의 배송 가능 여부를 판정합니다.
 *
 * @param {{productName:string, categoryPath?:string, price?:number, quantity?:number}} product
 */
export function checkEligibility(product) {
  const haystack = stripSafeTerms(normalize(`${product?.productName || ''} ${product?.categoryPath || ''}`))

  const contexts = detectContexts(haystack)
  const chargeableKg = (Number(product?.chargeableG) || 0) / 1000

  for (const rule of BLOCK_RULES) {
    // 이 규칙이 면제되는 문맥이면 건너뜁니다.
    if (rule.exemptIfContext?.some((c) => contexts.has(c))) continue

    // 무게 상한 규칙 — 키워드로 놓친 대형 상품을 추정 무게로 잡습니다.
    if (rule.maxItemKg && chargeableKg > rule.maxItemKg) {
      return {
        verdict: VERDICT.BLOCKED,
        shippable: false,
        autoQuote: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        matchedKeyword: `${chargeableKg.toFixed(1)}kg`,
        warnings: [],
        destination: DESTINATION,
      }
    }

    const hit = rule.keywords.find((kw) => haystack.includes(normalize(kw)))
    if (hit) {
      return {
        verdict: VERDICT.BLOCKED,
        shippable: false,
        autoQuote: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        matchedKeyword: hit,
        warnings: [],
        destination: DESTINATION,
      }
    }
  }

  const price = Number(product?.price) || 0
  const qty = Math.max(1, Number(product?.quantity) || 1)

  /**
   * 견적 문의 판정 — 차단을 통과한 뒤에만 확인합니다.
   * 수입 금지 품목이 견적 문의로 넘어가면 안 됩니다.
   */
  for (const rule of MANUAL_QUOTE_RULES) {
    let hit = null
    if (rule.keywords) {
      const kw = rule.keywords.find((k) => haystack.includes(normalize(k)))
      if (kw) hit = kw
    }
    if (!hit && rule.thresholdKrw && price * qty >= rule.thresholdKrw) {
      hit = `${(price * qty).toLocaleString('ko-KR')}원`
    }
    if (!hit && rule.thresholdKg && chargeableKg >= rule.thresholdKg) {
      hit = `${chargeableKg.toFixed(1)}kg`
    }
    if (hit) {
      return {
        verdict: VERDICT.MANUAL_QUOTE,
        shippable: true,
        autoQuote: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        notice: rule.notice ?? null,
        matchedKeyword: hit,
        warnings: [],
        destination: DESTINATION,
      }
    }
  }

  const warnings = []

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
    autoQuote: true,
    ruleId: null,
    label: null,
    reason: null,
    matchedKeyword: null,
    warnings,
    destination: DESTINATION,
  }
}

/** 장바구니 전체 판정 — 하나라도 불가면 전체가 불가입니다. */
/**
 * 장바구니 전체 판정.
 *
 * @param {Array} items
 * @param {Array} [weightLines] estimateShipmentWeight().lines — 무게 기반 규칙에 필요합니다.
 *   넘기지 않으면 무게 상한(30kg)·중량물 견적문의 판정이 동작하지 않습니다.
 */
export function checkCartEligibility(items = [], weightLines = []) {
  const results = items.map((item, i) => ({
    item,
    ...checkEligibility({ ...item, chargeableG: weightLines[i]?.chargeableG ?? item.chargeableG }),
  }))
  const blocked = results.filter((r) => !r.shippable)
  const warnings = results.flatMap((r) => r.warnings.map((w) => ({ ...w, productName: r.item.productName })))

  const manualQuote = results.filter((r) => r.verdict === VERDICT.MANUAL_QUOTE)

  return {
    shippable: blocked.length === 0,
    /** 하나라도 견적 문의 대상이면 자동 견적을 내지 않습니다. */
    autoQuote: blocked.length === 0 && manualQuote.length === 0,
    blocked: blocked.map((r) => ({
      productName: r.item.productName,
      label: r.label,
      reason: r.reason,
      ruleId: r.ruleId,
    })),
    manualQuote: manualQuote.map((r) => ({
      productName: r.item.productName,
      label: r.label,
      reason: r.reason,
      notice: r.notice,
      ruleId: r.ruleId,
    })),
    warnings,
    results,
  }
}
