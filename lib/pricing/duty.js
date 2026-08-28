/**
 * 품목군별 관세율 판별
 *
 * "세금이 더 붙는 품목"(신발 30%, 가방 25%, 의류·화장품 20% …)을
 * 단일 세율로 뭉뚱그리지 않고 품목별로 계산합니다.
 *
 * 판별에 실패하면 기본 세율을 쓰고 confidence 를 낮게 표시합니다.
 * 어차피 최종 금액은 실납부 관세로 정산되므로, 추정임을 드러내는 것이 중요합니다.
 */

import { DUTY_CATEGORIES, TAXES } from '../../config/taxes.js'
import { SAFE_TERMS } from '../../config/eligibility.js'

const normalize = (t) => String(t || '').toLowerCase().replace(/\s+/g, '')
const stripSafe = (h) => SAFE_TERMS.reduce((acc, t) => acc.split(normalize(t)).join(' '), h)

export const DEFAULT_DUTY = {
  id: 'general',
  label: '일반 품목',
  dutyRate: TAXES.defaultDutyRate,
}

/**
 * 상품의 관세 품목군을 판별합니다.
 * @param {{productName:string, categoryPath?:string}} product
 */
export function classifyDuty(product) {
  // 화장품 판별에는 '세럼' 같은 표현이 필요하므로 SAFE_TERMS 를 지우지 않은
  // 원문도 함께 봅니다. (차단 판정과 달리 오분류의 대가가 작습니다)
  const raw = normalize(`${product?.productName || ''} ${product?.categoryPath || ''}`)
  const stripped = stripSafe(raw)

  for (const cat of DUTY_CATEGORIES) {
    const hit = cat.keywords.find((kw) => raw.includes(normalize(kw)) || stripped.includes(normalize(kw)))
    if (hit) {
      return {
        categoryId: cat.id,
        label: cat.label,
        dutyRate: cat.dutyRate,
        matchedKeyword: hit,
        confidence: 'high',
        aboveDefault: cat.dutyRate > TAXES.defaultDutyRate,
      }
    }
  }

  return {
    categoryId: DEFAULT_DUTY.id,
    label: DEFAULT_DUTY.label,
    dutyRate: DEFAULT_DUTY.dutyRate,
    matchedKeyword: null,
    confidence: 'low',
    aboveDefault: false,
  }
}

/**
 * 장바구니의 품목별 관세를 계산합니다.
 *
 * 국제운임은 세관 관행에 맞춰 가액 비례로 각 품목에 배분한 뒤,
 * 품목별 CIF 에 품목별 관세율을 적용합니다.
 *
 * @param {Array<{productName:string, productPrice:number, quantity:number}>} items
 * @param {number} freightKrw 국제운임 총액 (KRW)
 */
export function calculateItemDuties(items = [], freightKrw = 0) {
  const lines = items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1)
    const value = (Number(item.productPrice) || 0) * qty
    return { item, qty, value, duty: classifyDuty(item) }
  })

  const totalValue = lines.reduce((s, l) => s + l.value, 0)

  const priced = lines.map((l) => {
    // 가액 비례 배분 (총액이 0이면 균등 배분)
    const share = totalValue > 0 ? l.value / totalValue : 1 / Math.max(lines.length, 1)
    const freightShare = Math.round(freightKrw * share)
    const cif = l.value + freightShare
    const duty = Math.round(cif * l.duty.dutyRate)
    return { ...l, freightShare, cif, dutyKrw: duty }
  })

  const dutyTotal = priced.reduce((s, l) => s + l.dutyKrw, 0)
  const cifTotal = priced.reduce((s, l) => s + l.cif, 0)

  // 기본 세율보다 높은 품목이 있으면 UI 에서 사유를 보여줍니다.
  const surcharged = priced
    .filter((l) => l.duty.aboveDefault)
    .map((l) => ({
      productName: l.item.productName,
      label: l.duty.label,
      dutyRate: l.duty.dutyRate,
      extraKrw: Math.round(l.cif * (l.duty.dutyRate - TAXES.defaultDutyRate)),
    }))

  return {
    lines: priced,
    cifTotal,
    dutyTotal,
    surcharged,
    /** 단일 기본세율로 계산했을 때와의 차이 — "추가 비용"의 정체 */
    extraVsDefaultKrw: surcharged.reduce((s, x) => s + x.extraKrw, 0),
  }
}
