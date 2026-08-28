/**
 * 랜딩코스트(하노이 문 앞까지의 총 비용) 계산 — 두 트랙
 *
 * ┌ 배송대행 (forwarding) ── 고객이 쿠팡에서 직접 결제
 * │   청구액 = 국제배송비 + 관세 + VAT + 결제수수료
 * │   상품가는 청구하지 않지만 **관세 과세표준(CIF)에는 포함**됩니다.
 * │   (세관은 고객이 실제로 지불한 상품가로 과세합니다)
 * │   수익: 배송 마진 + 쿠팡 파트너스 제휴 수수료
 * │
 * └ 구매대행 (agent) ── 당사가 대신 결제
 *     청구액 = 상품가 + 대행수수료 10% + 국제배송비 + 관세 + VAT + 결제수수료
 *     수익: 대행수수료 + 배송 마진 (제휴 수수료는 본인 구매라 발생하지 않음)
 *
 * ⚠️ 2025-02-18 부터 베트남 소액 면세가 폐지되어 금액과 무관하게 과세됩니다.
 */

import { FEES } from '../../config/fees.js'
import { TAXES } from '../../config/taxes.js'
import { FX } from '../../config/fx.js'
import { AFFILIATE } from '../../config/affiliate.js'
import { estimateShipmentWeight } from '../weight/estimate.js'
import { calculateShipping, usdToKrw } from './shipping.js'
import { calculateItemDuties } from './duty.js'
import { detectItemSurcharges } from './surcharges.js'
import { checkCartEligibility } from '../eligibility.js'
import { analyzeSourcing } from '../sourcing.js'

export const TRACK = { FORWARDING: 'forwarding', AGENT: 'agent' }

const round = (n) => Math.round(Number(n) || 0)

export const krwToVnd = (krw) => {
  const raw = krw * FX.krwToVnd * (1 + FX.spread)
  return Math.round(raw / FX.vndRoundTo) * FX.vndRoundTo
}

/** 구매대행 수수료 (배송대행에는 없음) */
export function calculateAgencyFee(goodsKrw, track) {
  if (track !== TRACK.AGENT) return { fee: 0, rate: 0, applicable: false }
  return {
    fee: Math.max(round(goodsKrw * FEES.agencyRate), FEES.agencyMinKrw),
    rate: FEES.agencyRate,
    applicable: true,
  }
}

/**
 * 베트남 수입 세금.
 * 관세는 품목군별 세율로 계산하고, VAT 는 (CIF + 관세) 에 부과합니다.
 */
export function calculateTaxes(items, freightKrw) {
  const duties = calculateItemDuties(items, freightKrw)
  const cif = duties.cifTotal

  if (TAXES.deMinimisVnd > 0 && krwToVnd(cif) < TAXES.deMinimisVnd) {
    return { cif, duty: 0, vat: 0, total: 0, exempt: true, duties }
  }

  const duty = duties.dutyTotal
  const vat = round((cif + duty) * TAXES.vatRate)

  return {
    cif,
    duty,
    vat,
    total: duty + vat,
    exempt: false,
    vatRate: TAXES.vatRate,
    duties,
    /** 기본세율(10%)보다 더 붙은 금액 — "세금이 더 붙는 품목"의 실제 금액 */
    extraDutyKrw: duties.extraVsDefaultKrw,
    surcharged: duties.surcharged,
  }
}

/** 배송대행 트랙에서 기대되는 제휴 수수료 (참고용 추정치) */
function estimateAffiliate(items, track) {
  if (track !== TRACK.FORWARDING) {
    return { applicable: false, estimatedKrw: 0, reason: '구매대행은 본인 구매라 제휴 수수료가 발생하지 않습니다.' }
  }
  const goods = items.reduce((s, i) => s + (Number(i.productPrice) || 0) * (i.quantity ?? 1), 0)
  const rate = AFFILIATE.estimatedRate.default
  return {
    applicable: true,
    rate,
    estimatedKrw: round(goods * rate),
    reason: `클릭 후 ${AFFILIATE.cookieWindowHours}시간 내 구매만 인정됩니다. 카테고리별로 최대 3%입니다.`,
  }
}

/**
 * 견적을 계산합니다.
 *
 * @param {Array<{productName:string, productPrice:number, quantity:number}>} items
 * @param {{track?:string, zone?:string, extraUsd?:number}} options
 */
export function quote(items = [], options = {}) {
  const track = options.track === TRACK.AGENT ? TRACK.AGENT : TRACK.FORWARDING
  const normalized = items.map((i) => ({ ...i, quantity: Math.max(1, Number(i.quantity) || 1) }))

  const goods = normalized.reduce((s, i) => s + (Number(i.productPrice) || 0) * i.quantity, 0)

  // 무게를 먼저 계산합니다 — 30kg 상한 차단과 중량물 견적문의 판정에 필요합니다.
  const weight = estimateShipmentWeight(normalized)

  // 배송 불가 품목이 있으면 견적 자체를 내지 않습니다.
  const eligibility = checkCartEligibility(normalized, weight.lines)

  // 해외직구 상품이 섞이면 한국 창고 도착이 늦어져 전체 일정이 달라집니다.
  const sourcing = analyzeSourcing(normalized)
  const shipping = calculateShipping(weight.chargeableG, {
    zone: options.zone,
    extraUsd: options.extraUsd ?? 0,
  })

  // 상품 할증 (파손주의·대형) — 운임의 일부이므로 관세 과세표준(CIF)에도 포함합니다.
  const itemSurcharges = detectItemSurcharges(normalized, weight.lines)
  const freightForTaxKrw = shipping.totalKrw + itemSurcharges.totalKrw

  const agency = calculateAgencyFee(goods, track)
  const taxes = calculateTaxes(normalized, freightForTaxKrw)

  // 트랙별 청구 항목
  const rows = []
  if (track === TRACK.AGENT) {
    rows.push({ key: 'goods', label: '상품 금액', krw: goods })
    rows.push({
      key: 'agency',
      label: `구매대행 수수료 (${Math.round(agency.rate * 100)}%)`,
      krw: agency.fee,
    })
  }
  rows.push({
    key: 'freight',
    label: `국제배송비 (${shipping.billableKg}kg × $${shipping.ratePerKgUsd}/kg)`,
    krw: shipping.freightKrw,
    usd: shipping.freightUsd,
  })
  if (shipping.zoneSurchargeKrw > 0) {
    rows.push({ key: 'zone', label: `지역 할증 (${shipping.zoneLabel.split(' (')[0]})`, krw: shipping.zoneSurchargeKrw, usd: shipping.zoneSurchargeUsd })
  }
  if (shipping.extraKrw > 0) {
    rows.push({ key: 'extra', label: '합배송 취급비', krw: shipping.extraKrw, usd: shipping.extraUsd })
  }
  for (const sc of itemSurcharges.rows) {
    rows.push({
      key: `surcharge-${sc.id}`,
      label: sc.count > 1 ? `${sc.label} (${sc.count}개)` : sc.label,
      krw: sc.krw,
      usd: sc.usd,
    })
  }
  rows.push({ key: 'duty', label: '수입관세 (품목별)', krw: taxes.duty })
  rows.push({ key: 'vat', label: `베트남 VAT (${Math.round(TAXES.vatRate * 100)}%)`, krw: taxes.vat })

  const subtotal = rows.reduce((s, r) => s + r.krw, 0)
  const paymentFee = round(subtotal * FEES.paymentRate)
  if (paymentFee > 0) rows.push({ key: 'payment', label: '결제 수수료', krw: paymentFee })

  const total = subtotal + paymentFee

  // 실측 정산 범위
  const tolerance = weight.confidence.tolerance
  const rangeAt = (g) => {
    const sh = calculateShipping(g, { zone: options.zone, extraUsd: options.extraUsd ?? 0 })
    const tx = calculateTaxes(normalized, sh.totalKrw + itemSurcharges.totalKrw)
    const base =
      (track === TRACK.AGENT ? goods + agency.fee : 0) + sh.totalKrw + itemSurcharges.totalKrw + tx.total
    return base + round(base * FEES.paymentRate)
  }

  return {
    track,
    eligibility,
    itemCount: normalized.reduce((s, i) => s + i.quantity, 0),
    weight,
    shipping,
    sourcing,
    itemSurcharges,
    agency,
    taxes,
    affiliate: estimateAffiliate(normalized, track),
    breakdown: rows.filter((r) => r.krw > 0),

    /** 상품가 — 배송대행에서는 청구하지 않지만 과세표준에 포함됩니다 */
    goods,
    goodsChargedToCustomer: track === TRACK.AGENT,

    subtotal,
    paymentFee,
    total,
    totalVnd: krwToVnd(total),
    totalUsd: Math.round((total / FX.usdToKrw) * 100) / 100,

    range: { low: rangeAt(weight.chargeableG * (1 - tolerance)), high: rangeAt(weight.chargeableG * (1 + tolerance)) },
  }
}
