/**
 * 실측 정산
 *
 * 결제 시점의 무게는 상품명 기반 추정치입니다.
 * 한국 창고에서 실제로 저울에 올린 무게로 배송비와 세금을 다시 계산하고,
 * 최초 청구액과의 차액을 정산합니다.
 *
 *   차액 > 0  → 추가 청구
 *   차액 < 0  → 환불
 *   |차액| < 허용오차 → 정산 생략 (송금 수수료가 차액보다 큰 경우)
 */

import { calculateShipping } from '../pricing/shipping.js'
import { FX } from '../../config/fx.js'
import { calculateTaxes } from '../pricing/landed.js'
import { FEES } from '../../config/fees.js'
import { SETTLEMENT_RULES } from '../../config/payment.js'

const round = (n) => Math.round(Number(n) || 0)

/**
 * 실측 무게로 최종 금액을 재계산합니다.
 *
 * @param {object} order 주문 (quote 스냅샷 포함)
 * @param {number} actualWeightG 창고 실측 무게(g)
 */
export function recalculateWithActualWeight(order, actualWeightG) {
  const q = order.quote

  /**
   * 주문에 동결된 USD 환율로 재계산합니다.
   * 라이브 환율을 쓰면 주문 시점과 정산 시점 사이에 환율이 바뀌었을 때
   * 무게가 같아도 차액이 생기는, 고객이 이해할 수 없는 정산이 발생합니다.
   */
  const liveFx = FX.usdToKrw
  if (Number.isFinite(order.fx?.usdToKrw) && order.fx.usdToKrw > 0) {
    FX.usdToKrw = order.fx.usdToKrw
  }
  try {
    return recalcInner(order, q, actualWeightG)
  } finally {
    FX.usdToKrw = liveFx
  }
}

function recalcInner(order, q, actualWeightG) {
  const shipping = calculateShipping(actualWeightG, {
    zone: order.zone,
    extraUsd: order.consolidation?.handlingFeeUsd ?? 0,
  })

  // 배송대행은 상품가를 청구하지 않지만 관세 과세표준에는 포함됩니다.
  const chargesGoods = order.track === 'agent'
  const goods = q.goods
  const agencyFee = q.agency.fee
  const taxes = calculateTaxes(order.items, shipping.totalKrw)

  const subtotal =
    (chargesGoods ? goods + agencyFee : 0) + shipping.totalKrw + taxes.total
  const paymentFee = round(subtotal * FEES.paymentRate)

  return {
    shipping,
    taxes,
    goods,
    agencyFee,
    paymentFee,
    total: subtotal + paymentFee,
  }
}

/**
 * 정산 결과를 산출합니다. (원장에 기록하지는 않습니다)
 *
 * @returns {{action:'additional'|'refund'|'none', diffKrw:number, ...}}
 */
export function computeSettlement(order, actualWeightG) {
  const quoted = order.quote
  const final = recalculateWithActualWeight(order, actualWeightG)

  const diff = final.total - quoted.total
  const abs = Math.abs(diff)

  let action = 'none'
  if (abs >= SETTLEMENT_RULES.toleranceKrw) {
    action = diff > 0 ? 'additional' : 'refund'
  }

  // 추가 청구가 지나치게 크면 자동 청구하지 않고 운영자 확인을 거칩니다.
  // (무게 추정이 크게 빗나갔거나 잘못된 상품이 입고된 경우일 수 있습니다)
  const additionalRate = quoted.total > 0 ? diff / quoted.total : 0
  const requiresReview =
    action === 'additional' && additionalRate > SETTLEMENT_RULES.maxAutoAdditionalRate

  const estimatedG = quoted.weight.chargeableG
  const weightErrorRate = estimatedG > 0 ? (actualWeightG - estimatedG) / estimatedG : 0

  return {
    action,
    label: SETTLEMENT_RULES.labels[action === 'none' ? 'none' : action],
    diffKrw: diff,
    absKrw: abs,
    requiresReview,
    additionalRate,

    estimatedWeightG: estimatedG,
    actualWeightG,
    weightErrorRate,

    quotedTotalKrw: quoted.total,
    finalTotalKrw: final.total,

    quotedBillableKg: quoted.shipping.billableKg,
    finalBillableKg: final.shipping.billableKg,

    final,
    /** 허용오차 이내라 정산을 생략한 경우, 그 금액은 당사 손익으로 흡수됩니다. */
    absorbedKrw: action === 'none' ? diff : 0,
  }
}

/**
 * 정산 결과를 고객 원장 항목으로 변환합니다.
 * (실제 기록은 store 에서 수행합니다)
 */
export function settlementEntries(settlement, fxRate) {
  if (settlement.action === 'none') return []

  const memo = `실측 ${(settlement.actualWeightG / 1000).toFixed(2)}kg (추정 ${(
    settlement.estimatedWeightG / 1000
  ).toFixed(2)}kg, 오차 ${(settlement.weightErrorRate * 100).toFixed(1)}%)`

  if (settlement.action === 'additional') {
    return [{ type: 'ADDITIONAL_CHARGE', amountKrw: settlement.absKrw, memo, fxRate }]
  }
  // 환불: 잔액을 마이너스로 만든 뒤(CREDIT), 실제 지급 시 REFUND 로 해소합니다.
  return [{ type: 'CREDIT', amountKrw: settlement.absKrw, memo, fxRate }]
}
