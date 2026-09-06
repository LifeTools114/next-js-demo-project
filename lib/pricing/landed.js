/**
 * 랜딩코스트(하노이 문 앞까지의 총 비용) 계산 — 두 트랙
 *
 * ┌ 배송대행 (forwarding) ── 고객이 쿠팡에서 직접 결제
 * │   청구액 = 국제배송비 (+ 지역 할증·상품 할증)
 * │   수익: 배송 마진
 * │
 * └ 구매대행 (agent) ── 당사가 대신 결제
 *     청구액 = 상품가 + 국내배송비 + 대행수수료(기본료 + 초과분) + 국제배송비
 *     수익: 대행수수료 + 배송 마진
 *
 * 관세·VAT·결제수수료: 현재 걷지 않습니다 — 개인통관·무증빙 채널이라
 * 수입세 미징수(config/taxes.js `collect:false`), 수금이 계좌이체뿐이라
 * 결제수수료 0(config/fees.js `paymentRate`). 정책이 바뀌면 그 두 값만
 * 되돌리면 아래 계산·표시가 다시 살아납니다.
 */

import { FEES, ORDER_MIN } from '../../config/fees.js'
import { TAXES } from '../../config/taxes.js'
import { FX } from '../../config/fx.js'
import { estimateShipmentWeight } from '../weight/estimate.js'
import { calculateShipping, usdToKrw } from './shipping.js'
import { calculateItemDuties } from './duty.js'
import { detectItemSurcharges } from './surcharges.js'
import { domesticShipping } from './domestic.js'
import { checkCartEligibility } from '../eligibility.js'
import { analyzeSourcing } from '../sourcing.js'

export const TRACK = { FORWARDING: 'forwarding', AGENT: 'agent' }

const round = (n) => Math.round(Number(n) || 0)

export const krwToVnd = (krw) => {
  const raw = krw * FX.krwToVnd * (1 + FX.spread)
  return Math.round(raw / FX.vndRoundTo) * FX.vndRoundTo
}

/**
 * 구매대행 수수료 (배송대행에는 없음)
 *
 * 기본료(config/fees.js · 상품가 10만원·5종류까지) + 10만원 초과분 5% + 5종류 초과
 * 종류당 1,000원. 정률(10%)이 비싼 주문에서 과해지는 문제를 없앴습니다.
 * @param {number} goodsKrw 상품가 합계
 * @param {string} track
 * @param {number} lineCount 상품 종류 수 (수량 아님 — 발주 노동 기준)
 */
export function calculateAgencyFee(goodsKrw, track, lineCount = 1) {
  if (track !== TRACK.AGENT) return { fee: 0, applicable: false, baseKrw: 0, excessKrw: 0, extraItemsKrw: 0 }
  const goods = Math.max(Number(goodsKrw) || 0, 0)
  const lines = Math.max(Number(lineCount) || 1, 1)
  const excessKrw = round(Math.max(goods - FEES.agencyBaseMaxGoodsKrw, 0) * FEES.agencyExcessRate)
  const extraItemsKrw = Math.max(lines - FEES.agencyBaseMaxItems, 0) * FEES.agencyPerExtraItemKrw
  return {
    fee: FEES.agencyBaseKrw + excessKrw + extraItemsKrw,
    baseKrw: FEES.agencyBaseKrw,
    excessKrw,
    extraItemsKrw,
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

  // 운영 정책: 개인통관·무증빙 — 관세·VAT 를 걷지 않습니다 (config/taxes.js).
  // surcharged 도 비워 "세금이 더 붙는 품목" 안내까지 함께 사라집니다.
  if (!TAXES.collect) {
    return { cif, duty: 0, vat: 0, total: 0, exempt: true, vatRate: 0, duties, extraDutyKrw: 0, surcharged: [] }
  }

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

  /**
   * 국내 배송비 — 구매대행에서만. 저희가 쿠팡에 내는 돈이라 견적에 들어갑니다.
   * 판매자마다 한 번, 무료 조건을 넘으면 0원 (규정: lib/pricing/domestic.js).
   * 수수료는 **상품가** 기준이므로 여기에 더하지 않습니다.
   */
  const domestic = domesticShipping(normalized, track)
  const agency = calculateAgencyFee(goods, track, normalized.length)
  const taxes = calculateTaxes(normalized, freightForTaxKrw)

  // 트랙별 청구 항목
  const rows = []
  if (track === TRACK.AGENT) {
    rows.push({ key: 'goods', label: '상품 금액', krw: goods })
    if (domestic.krw > 0) {
      rows.push({
        key: 'domestic',
        label: domestic.rows.length > 1
          ? `국내 배송비 (판매자 ${domestic.rows.length}곳)`
          : '국내 배송비 (쿠팡 → 한국 창고)',
        krw: domestic.krw,
      })
    }
    rows.push({
      key: 'agency',
      // 기본료만이면 '(기본)', 초과분이 붙으면 그 이유가 라벨에 보이게.
      // 금액을 문자열에 박지 않습니다 — 수수료를 바꿨을 때 라벨만 옛 값으로 남습니다.
      label: agency.excessKrw > 0 || agency.extraItemsKrw > 0
        ? `구매대행 수수료 (기본 ${FEES.agencyBaseKrw.toLocaleString('ko-KR')}원 + 초과분)`
        : '구매대행 수수료 (기본)',
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
      (track === TRACK.AGENT ? goods + domestic.krw + agency.fee : 0) + sh.totalKrw + itemSurcharges.totalKrw + tx.total
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
    /** 국내 배송비 — 청구액·무료로 깎인 내역 (화면이 이유를 말할 수 있게) */
    domestic,
    taxes,
    breakdown: rows.filter((r) => r.krw > 0),

    /** 상품가 — 배송대행에서는 청구하지 않지만 과세표준에 포함됩니다 */
    goods,
    goodsChargedToCustomer: track === TRACK.AGENT,

    /**
     * 최소 주문 금액 판정 — 이 견적에 담긴 상품가 기준.
     * 장바구니 전체 판정은 서버(POST /api/orders)가 최종으로 합니다.
     */
    /** 구매대행 1회 접수 한도 — 카드·신청서가 미리 경고하고 서버가 최종 거절 */
    agentLimit: track === TRACK.AGENT
      ? {
          maxGoodsKrw: FEES.agentMaxGoodsKrw,
          exceeded: FEES.agentMaxGoodsKrw > 0 && goods > FEES.agentMaxGoodsKrw,
        }
      : null,

    minOrder: {
      goodsKrw: ORDER_MIN.goodsKrw,
      met: ORDER_MIN.goodsKrw <= 0 || goods >= ORDER_MIN.goodsKrw,
      shortfallKrw: Math.max(ORDER_MIN.goodsKrw - goods, 0),
    },

    subtotal,
    paymentFee,
    total,
    totalVnd: krwToVnd(total),
    totalUsd: Math.round((total / FX.usdToKrw) * 100) / 100,

    range: { low: rangeAt(weight.chargeableG * (1 - tolerance)), high: rangeAt(weight.chargeableG * (1 + tolerance)) },
  }
}
