/**
 * 랜딩코스트(하노이 문 앞까지의 총 비용) 계산
 *
 *   상품가         (쿠팡 판매가)
 * + 구매대행 수수료
 * + 국제배송비      (1kg당 요율 × 청구무게)
 * + 수입관세        CIF × 관세율
 * + 부가가치세      (CIF + 관세) × VAT율
 * = 총 결제 예상액
 *
 * ⚠️ 2025-02-18 부터 베트남의 100만 VND 미만 면세 제도가 폐지되어
 *    금액과 무관하게 관세·VAT가 부과됩니다. (Decision 01/2025/QD-TTg)
 */

import { FEES } from '../../config/fees.js'
import { TAXES } from '../../config/taxes.js'
import { FX } from '../../config/fx.js'
import { estimateShipmentWeight } from '../weight/estimate.js'
import { calculateShipping } from './shipping.js'

export const krwToVnd = (krw) => {
  const raw = krw * FX.krwToVnd * (1 + FX.spread)
  return Math.round(raw / FX.vndRoundTo) * FX.vndRoundTo
}

/** 구매대행 수수료 */
export function calculateAgencyFee(goodsKrw) {
  if (FEES.agencyWaiverThresholdKrw > 0 && goodsKrw >= FEES.agencyWaiverThresholdKrw) {
    return { fee: 0, waived: true, rate: FEES.agencyRate }
  }
  const fee = Math.max(Math.round(goodsKrw * FEES.agencyRate), FEES.agencyMinKrw)
  return { fee, waived: false, rate: FEES.agencyRate }
}

/**
 * 베트남 수입 세금 (과세표준 = CIF)
 * @param {number} goodsKrw 상품가
 * @param {number} freightKrw 국제운임
 */
export function calculateTaxes(goodsKrw, freightKrw) {
  const insurance = Math.round(goodsKrw * TAXES.insuranceRate)
  const cif = goodsKrw + freightKrw + insurance

  // 면세 한도가 살아있는 경우에만 면세 처리 (현재 0 = 항상 과세)
  const cifVnd = krwToVnd(cif)
  if (TAXES.deMinimisVnd > 0 && cifVnd < TAXES.deMinimisVnd) {
    return { cif, insurance, duty: 0, vat: 0, total: 0, exempt: true }
  }

  const duty = Math.round(cif * TAXES.importDutyRate)
  const sct = Math.round((cif + duty) * TAXES.specialConsumptionTaxRate)
  const vat = Math.round((cif + duty + sct) * TAXES.vatRate)

  return {
    cif,
    insurance,
    duty,
    sct,
    vat,
    total: duty + sct + vat,
    exempt: false,
    dutyRate: TAXES.importDutyRate,
    vatRate: TAXES.vatRate,
  }
}

/** 실측 정산 범위를 total 과 동일한 기준(결제 수수료 포함)으로 계산 */
function withPaymentFee(goods, agencyFee, shippingTotal) {
  const sub = goods + agencyFee + shippingTotal + calculateTaxes(goods, shippingTotal).total
  return sub + Math.round(sub * FEES.paymentRate)
}

/**
 * 장바구니 전체 견적.
 *
 * @param {Array<{productPrice:number, quantity:number, productName:string}>} items
 * @param {{zone?:string}} options
 */
export function quote(items = [], options = {}) {
  const normalized = items.map((i) => ({ ...i, quantity: Math.max(1, Number(i.quantity) || 1) }))

  const goods = normalized.reduce((sum, i) => sum + (Number(i.productPrice) || 0) * i.quantity, 0)

  const weight = estimateShipmentWeight(normalized)
  const shipping = calculateShipping(weight.chargeableG, {
    zone: options.zone,
    restrictionSurchargeKrw: weight.restrictions.surchargeKrw,
  })

  const agency = calculateAgencyFee(goods)
  const taxes = calculateTaxes(goods, shipping.total)

  const subtotal = goods + agency.fee + shipping.total + taxes.total
  const paymentFee = Math.round(subtotal * FEES.paymentRate)
  const total = subtotal + paymentFee

  // 실측 정산 시 발생할 수 있는 금액 범위
  const tolerance = weight.confidence.tolerance
  const shippingLow = calculateShipping(weight.chargeableG * (1 - tolerance), {
    zone: options.zone,
    restrictionSurchargeKrw: weight.restrictions.surchargeKrw,
  })
  const shippingHigh = calculateShipping(weight.chargeableG * (1 + tolerance), {
    zone: options.zone,
    restrictionSurchargeKrw: weight.restrictions.surchargeKrw,
  })

  return {
    itemCount: normalized.reduce((s, i) => s + i.quantity, 0),
    weight,
    shipping,
    agency,
    taxes,
    breakdown: [
      { key: 'goods', label: '상품 금액', krw: goods },
      { key: 'agency', label: agency.waived ? '구매대행 수수료 (면제)' : `구매대행 수수료 (${Math.round(agency.rate * 100)}%)`, krw: agency.fee },
      { key: 'freight', label: `국제배송비 (${shipping.billableKg}kg × ${shipping.ratePerKg.toLocaleString('ko-KR')}원/kg)`, krw: shipping.freight },
      { key: 'zone', label: `지역 할증 (${shipping.zoneLabel.split(' (')[0]})`, krw: shipping.zoneSurcharge },
      { key: 'restriction', label: `위험물 취급 할증 (알코올 함유 ${weight.restrictions.limitedQty}개)`, krw: shipping.restrictionSurcharge },
      { key: 'duty', label: `수입관세 (${Math.round(taxes.dutyRate * 100)}%)`, krw: taxes.duty },
      { key: 'vat', label: `베트남 VAT (${Math.round(taxes.vatRate * 100)}%)`, krw: taxes.vat },
      { key: 'payment', label: '결제 수수료', krw: paymentFee },
    ].filter((r) => r.krw > 0),
    goods,
    subtotal,
    paymentFee,
    total,
    totalVnd: krwToVnd(total),
    range: {
      low: withPaymentFee(goods, agency.fee, shippingLow.total),
      high: withPaymentFee(goods, agency.fee, shippingHigh.total),
    },
  }
}
