/**
 * 견적서(임시·최종) 문서 데이터 생성
 *
 * 화면·인쇄에 필요한 값을 한 곳에서 만듭니다. 페이지는 이 결과를 그리기만
 * 하므로, 금액 규칙이 바뀌어도 고칠 곳은 여기 하나입니다.
 *
 * 최종 견적서는 물류사 청구서(DEBIT NOTE)의 **실측 무게**로 다시 계산합니다.
 * ⚠️ 물류사 청구서의 단가·금액은 당사 원가입니다 — 이 문서에는 절대 넣지
 *    않습니다. 여기서 가져오는 값은 무게와 운송 정보(HAWB·편명·도착일)뿐입니다.
 */

import { QUOTE } from '../config/quote.js'
import { CONTACT } from '../config/contact.js'
import { BUSINESS } from '../config/legal.js'
import { trackDocLabel } from '../config/tracks.js'
import { recalculateWithActualWeight, settlementToleranceKrw } from './order/settlement.js'

const round = (n) => Math.round(Number(n) || 0)
const kgOf = (g) => Math.round((Number(g) || 0) / 100) / 10

/** 임시/최종 공통 머리말 */
function header(order, kind) {
  const label = QUOTE.labels[kind]
  const issuedAt = new Date()
  const validUntil = new Date(issuedAt.getTime() + QUOTE.validDays * 86400_000)
  return {
    kind,
    title: label.ko,
    titleEn: label.en,
    // 임시(Q)와 최종(F)을 번호만 봐도 구분할 수 있게 합니다.
    docNo: `${kind === 'final' ? 'F' : 'Q'}-${order.orderNo}`,
    orderNo: order.orderNo,
    issuedAt: issuedAt.toISOString(),
    validUntil: kind === 'final' ? null : validUntil.toISOString(),
    issuer: QUOTE.issuer,
    /** 전자상거래법 표시사항 — 거래 문서에 등록번호를 함께 남깁니다 */
    business: {
      name: BUSINESS.name, ceo: BUSINESS.ceo,
      bizNo: BUSINESS.bizNo, mailOrderNo: BUSINESS.mailOrderNo,
    },
    // 문의는 카카오톡 오픈채팅 한 곳으로 받습니다.
    contact: {
      label: CONTACT.label, kakaoId: CONTACT.kakaoId,
      url: CONTACT.kakaoOpenChat, qrPath: CONTACT.qrPath,
    },
    // 주소는 견적서에 싣지 않습니다 (운영자 지시 26-09-01) — 이름·연락처만.
    customer: {
      name: order.customer?.name ?? '',
      phone: order.customer?.phone ?? '',
    },
    // 쉬운 말을 앞에, 정식 용어를 괄호로 — 견적서는 거래 문서라 정식 용어가 빠지면
    // 곤란해질 수 있습니다 (config/tracks.js 의 trackDocLabel 과 같은 규칙).
    trackLabel: trackDocLabel(order.track),
  }
}

/** 견적 내역 줄 — 원화와 동화를 함께 보여줍니다. */
function lines(breakdown, rate) {
  return (breakdown ?? []).map((r) => ({
    key: r.key ?? r.label,
    label: r.label,
    krw: r.krw,
    vnd: round(r.krw * rate),
  }))
}

/**
 * 임시 견적서 — 접수 시점의 동결 견적(추정 무게) 그대로.
 */
export function buildProvisionalQuote(order) {
  const rate = order.fx?.effectiveRate ?? 0
  const q = order.quote
  // 조정 기준은 장부와 같은 곳에서 가져옵니다 (주문마다 다름 — 3,000~10,000원).
  const thresholdKrw = settlementToleranceKrw(order)
  const thresholdVnd = round(thresholdKrw * rate)
  return {
    ...header(order, 'provisional'),
    fxRate: rate,
    weight: {
      basis: '추정',
      chargeableG: q.weight?.chargeableG ?? 0,
      chargeableKg: kgOf(q.weight?.chargeableG),
      billableKg: q.weight?.billableKg ?? null,
      confidence: q.weight?.confidence?.label ?? null,
    },
    shipment: null,
    lines: lines(q.breakdown, rate),
    totalKrw: q.total,
    totalVnd: round(q.total * rate),
    thresholdKrw,
    thresholdVnd,
    notes: [
      '위 무게는 상품명 기준 추정치입니다. 한국 창고 실측 후 최종 견적서를 보내드립니다.',
      `실측 차액이 ${thresholdVnd.toLocaleString('ko-KR')}동(${thresholdKrw.toLocaleString('ko-KR')}원) 이상일 때만 추가청구 또는 환불하며, 그 미만이면 이 금액 그대로 확정됩니다.`,
      `견적 유효기간: 발행일로부터 ${QUOTE.validDays}일`,
    ],
  }
}

/**
 * 최종 견적서 — 물류사 청구서의 실측 무게로 재계산하고 임시분과 비교합니다.
 *
 * @param {object} order
 * @param {object} debitNote 운영자가 입력한 청구서 정보
 *        { chargeableWeightKg, hawbNo, mawbNo, flight, etd, eta, package, invoiceNo }
 */
export function buildFinalQuote(order, debitNote = {}) {
  const rate = order.fx?.effectiveRate ?? 0
  const q = order.quote
  const actualG = round((Number(debitNote.chargeableWeightKg) || 0) * 1000)
  if (actualG <= 0) throw new Error('물류사 청구서의 실측 무게(C/Weight)가 필요합니다.')

  const final = recalculateWithActualWeight(order, actualG)
  const provisionalKrw = q.total
  const diffKrw = final.total - provisionalKrw
  const diffVnd = round(diffKrw * rate)

  /**
   * 조정 여부 — 차액이 기준 미만이면 임시 견적서 금액을 그대로 청구합니다.
   * 최종 결정(청구·환불 실행)은 운영자가 하며, 이 문서는 판단 근거만 담습니다.
   *
   * 기준은 장부와 **같은 함수**에서 가져오고, 비교도 장부와 같이 **원화로**
   * 합니다. 동화로 바꾼 뒤 비교하면 반올림 한 동 차이로 문서는 "조정 대상",
   * 장부는 "조정 없음" 이 되어 서로 어긋날 수 있습니다.
   */
  const thresholdKrw = settlementToleranceKrw(order)
  const thresholdVnd = round(thresholdKrw * rate)
  const adjust = Math.abs(diffKrw) >= thresholdKrw
  const chargeKrw = adjust ? final.total : provisionalKrw

  const rows = [
    ...(order.track === 'agent'
      ? [{ key: 'goods', label: '상품 금액', krw: final.goods },
         { key: 'agency', label: '대신 구매 수수료', krw: final.agencyFee }]
      : [{ key: 'forwarding', label: '배송만 수수료', krw: final.forwardingFee }]),
    { key: 'shipping', label: `국제배송비 (실측 ${kgOf(actualG)}kg)`, krw: final.shipping.totalKrw },
    ...(q.itemSurcharges?.rows ?? []).map((r) => ({ key: r.key, label: r.label, krw: r.krw })),
    ...(final.taxes.total > 0 ? [{ key: 'tax', label: '관세·부가세', krw: final.taxes.total }] : []),
    ...(final.paymentFee > 0 ? [{ key: 'payment', label: '결제 수수료', krw: final.paymentFee }] : []),
  ].filter((r) => r.krw > 0)

  return {
    ...header(order, 'final'),
    fxRate: rate,
    weight: {
      basis: '실측',
      estimatedG: q.weight?.chargeableG ?? 0,
      estimatedKg: kgOf(q.weight?.chargeableG),
      chargeableG: actualG,
      chargeableKg: kgOf(actualG),
      billableKg: final.shipping?.billableKg ?? null,
    },
    /** 운송 정보 — 청구서에서 옮긴 사실 정보만 (금액은 옮기지 않습니다) */
    shipment: {
      hawbNo: debitNote.hawbNo ?? '',
      mawbNo: debitNote.mawbNo ?? '',
      flight: debitNote.flight ?? '',
      etd: debitNote.etd ?? '',
      eta: debitNote.eta ?? '',
      package: debitNote.package ?? '',
      route: debitNote.route ?? 'SEOUL, KOREA → HANOI, VIETNAM',
    },
    lines: lines(rows, rate),
    recalculatedKrw: final.total,
    provisionalKrw,
    provisionalVnd: round(provisionalKrw * rate),
    diffKrw,
    diffVnd,
    adjust,
    adjustLabel: !adjust
      ? '차액 미만 — 임시 견적서 금액대로 확정'
      : diffKrw > 0 ? '추가 청구 대상' : '환불 대상',
    thresholdKrw,
    thresholdVnd,
    totalKrw: chargeKrw,
    totalVnd: round(chargeKrw * rate),
    notes: [
      `임시 견적 ${provisionalKrw.toLocaleString('ko-KR')}원 → 실측 재계산 ${final.total.toLocaleString('ko-KR')}원`,
      adjust
        ? `차액 ${Math.abs(diffVnd).toLocaleString('ko-KR')}동으로 기준(${thresholdVnd.toLocaleString('ko-KR')}동 = ${thresholdKrw.toLocaleString('ko-KR')}원) 이상이라 ${diffKrw > 0 ? '추가 청구' : '환불'} 대상입니다.`
        : `차액 ${Math.abs(diffVnd).toLocaleString('ko-KR')}동으로 기준(${thresholdVnd.toLocaleString('ko-KR')}동 = ${thresholdKrw.toLocaleString('ko-KR')}원) 미만이라 임시 견적서 금액 그대로 청구합니다.`,
    ],
  }
}

/** 주문 상태에 맞는 문서를 만듭니다 (청구서 정보가 있으면 최종). */
export function buildQuoteDoc(order, { kind, debitNote } = {}) {
  const note = debitNote ?? order.debitNote
  const useFinal = kind === 'final' || (!kind && note?.chargeableWeightKg > 0)
  return useFinal ? buildFinalQuote(order, note ?? {}) : buildProvisionalQuote(order)
}
