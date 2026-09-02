/**
 * 전 과정 시나리오 테스트 — 접수부터 배송 완료·정산까지
 *
 * 운영자 지시(26-09-01): "지금까지 모든 방식을 시나리오로 만들고 무게
 * 적용계산, 견적서 등 빠지는 내용 없이 처음부터 끝까지" 확인.
 *
 * 각 시나리오는 실제 모듈(주문 저장소·요금·무게·견적서·청구서 파싱)을
 * 그대로 호출합니다. 화면만 통과하는 테스트가 아니라 서버 로직 그대로입니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'

import {
  createOrder, getOrder, confirmPayment, linkInbound, recordPurchase, startPurchase,
  recordWeighing, applySettlement, closeSettlement, markShipped, markDelivered,
  cancelOrder, customerCancelOrder, findDuplicateOrder, saveDebitNote, orderView,
  customerView,
} from '../lib/order/store.js'
import { buildProvisionalQuote, buildFinalQuote, buildQuoteDoc } from '../lib/quote-doc.js'
import { extractPdfText } from '../lib/debit-note/extract-text.js'
import { parseDebitNote } from '../lib/debit-note/parse.js'
import { checkEligibility } from '../lib/eligibility.js'
import { estimateItemWeight } from '../lib/weight/estimate.js'
import { QUOTE } from '../config/quote.js'
import { SHIPPING } from '../config/shipping.js'
import { RETURN_POLICY } from '../config/payment.js'

// ── 공통 도우미 ───────────────────────────────────────────────────────
const CUSTOMER = { name: '박하노', phone: '0901234567', address: '하노이시 하동구 응우옌짜이 123' }
const item = (productName, productPrice, quantity = 1) => ({ productName, productPrice, quantity })

/** 물류사 청구서 PDF 를 만듭니다 (금액 줄 포함 — 읽히면 안 됨) */
function debitNotePdf({ kg, hawb = 'S1K452019', flight = 'KE0361', etd = '2026-08-30', eta = '2026-08-31' }) {
  const lines = [
    'S1 EXPRESS CO.,LTD.', 'DEBIT NOTE',
    'Invoice No : HINV26090012   Billing Date : 2026-09-01',
    `HAWB No : ${hawb}   E.T.D : ${etd}   Package : 1 CARTON`,
    `MAWB No : 18043690426   E.T.A : ${eta}   C/Weight : ${kg} KGS`,
    `Departure : SEOUL,KOREA   Flight : ${flight}`,
    'FREIGHT CHARGE  USD  26,490.00  KG  7.000  21.00  556,290',
  ]
  const body = ['BT /F1 10 Tf 40 800 Td 14 TL']
  for (const l of lines) body.push(`(${l.replace(/([()\\])/g, '\\$1')}) Tj T*`)
  body.push('ET')
  const stream = zlib.deflateSync(Buffer.from(body.join('\n'), 'latin1'))
  const head = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n4 0 obj\n'
    + `<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`, 'latin1')
  return Buffer.concat([head, stream, Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')])
}

/** 청구서 업로드 경로와 동일하게: 파일 → 텍스트 → 항목 → 저장 → 최종 견적서 */
function uploadDebitNote(order, kg, extra = {}) {
  const parsed = parseDebitNote(extractPdfText(debitNotePdf({ kg, ...extra })))
  assert.equal(parsed.chargeableWeightKg, kg, '청구서에서 무게를 읽지 못했습니다')
  const saved = saveDebitNote(order.id, parsed)
  return { parsed, doc: buildQuoteDoc(saved, { kind: 'final' }) }
}

/** 문서 어디에도 원가가 남지 않았는지 */
function assertNoCostLeak(doc, where) {
  const dump = JSON.stringify(doc)
  for (const cost of ['556,290', '556290', '26,490', '7.000', 'FREIGHT']) {
    assert.ok(!dump.includes(cost), `${where}: 원가 ${cost} 노출`)
  }
}

const paid = (order) => confirmPayment(order.id, { confirmedBy: 'op' })

// ── 시나리오 ──────────────────────────────────────────────────────────

test('S01 배송대행 — 접수 → 임시 견적서 → 입금 → 입고 → 청구서 업로드 → 최종 견적서 → 배송 완료', () => {
  const order = createOrder({
    items: [item('토리든 다이브인 세럼 50ml', 18900, 2)],
    zone: 'hanoi', track: 'forwarding', customer: CUSTOMER, coupangOrderNo: '2600000001',
  })
  assert.equal(order.state, 'AWAITING_PAYMENT')

  const prov = buildProvisionalQuote(order)
  assert.equal(prov.docNo, `Q-${order.orderNo}`)
  assert.equal(prov.totalKrw, order.quote.total)
  assert.ok(prov.totalVnd > 0)
  assertNoCostLeak(prov, 'S01 임시')

  paid(order)
  assert.equal(getOrder(order.id).state, 'PURCHASED', '쿠팡 주문이 연결돼 있으면 창고 배송까지 자동 진행')

  const { doc } = uploadDebitNote(order, 1.0)
  assert.equal(doc.kind, 'final')
  assert.equal(doc.weight.chargeableKg, 1)
  assert.equal(doc.shipment.hawbNo, 'S1K452019')
  assertNoCostLeak(doc, 'S01 최종')

  // recordWeighing 이 실측 → 정산까지 자동으로 잇습니다(autoSettle 기본값).
  recordWeighing(order.id, { actualWeightG: 1000, by: 'op' })
  if (getOrder(order.id).state === 'SETTLEMENT_DUE') closeSettlement(order.id, { by: 'op' })
  assert.equal(getOrder(order.id).state, 'SETTLED')
  markShipped(order.id, { trackingNo: 'VN123', by: 'op' })
  markDelivered(order.id, 'op')
  assert.equal(getOrder(order.id).state, 'DELIVERED')
})

test('S02 구매대행 — 상품가·수수료 포함 견적 → 발주 → 입고 → 최종 견적서', () => {
  const order = createOrder({
    items: [item('아누아 어성초 토너 250ml', 21000, 2)],
    zone: 'hanoi', track: 'agent', customer: CUSTOMER,
  })
  const prov = buildProvisionalQuote(order)
  const keys = prov.lines.map((l) => l.key)
  assert.ok(keys.includes('goods'), '구매대행은 상품가가 견적에 포함')
  assert.ok(keys.includes('agency'), '구매대행 수수료 포함')
  assert.ok(prov.totalKrw > order.quote.goods)

  paid(order)
  startPurchase(order.id, 'op')
  recordPurchase(order.id, { coupangOrderNo: '2600000002', amountKrw: 42000, by: 'op' })
  const { doc } = uploadDebitNote(order, 2.0)
  assert.ok(doc.lines.some((l) => l.key === 'goods'))
  assert.equal(doc.weight.chargeableKg, 2)
})

test('S03 무게 증가 → 차액 기준 이상 → 추가 청구 대상', () => {
  const order = createOrder({
    items: [item('메디힐 마스크팩 10매', 12900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const before = order.quote.total
  const { doc } = uploadDebitNote(order, order.quote.weight.chargeableG / 1000 + 3)
  assert.equal(doc.adjust, true)
  assert.ok(doc.diffKrw > 0)
  assert.ok(Math.abs(doc.diffVnd) >= QUOTE.adjustThresholdVnd)
  assert.equal(doc.totalKrw, doc.recalculatedKrw, '조정 대상이면 재계산 금액 청구')
  assert.ok(doc.totalKrw > before)
  assert.match(doc.adjustLabel, /추가 청구/)
})

test('S04 무게 감소 → 환불 대상', () => {
  const order = createOrder({
    items: [item('삼다수 2L 6병', 6000)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const estKg = order.quote.weight.chargeableG / 1000
  assert.ok(estKg > 3, '무거운 상품이어야 감소 시나리오가 성립')
  const { doc } = uploadDebitNote(order, 1.0)
  assert.equal(doc.adjust, true)
  assert.ok(doc.diffKrw < 0)
  assert.match(doc.adjustLabel, /환불/)
  assert.equal(doc.totalKrw, doc.recalculatedKrw)
})

test('S05 차액이 기준(20,000동) 미만 → 임시 견적서 금액 그대로 확정', () => {
  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const sameKg = order.quote.weight.chargeableG / 1000
  const { doc } = uploadDebitNote(order, sameKg)
  assert.equal(doc.adjust, false)
  assert.equal(doc.totalKrw, order.quote.total)
  assert.match(doc.adjustLabel, /임시 견적서 금액대로/)
})

test('S06 금지 품목은 접수 자체가 거절된다', () => {
  assert.throws(
    () => createOrder({
      items: [item('보조배터리 20000mAh', 39000)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
    }),
    /배송할 수 없는/,
  )
})

test('S07 해외직구(중국 등 타국 발송) 상품 차단', () => {
  const res = checkEligibility({
    productName: '샤오미 공기청정기', categoryName: '가전', price: 90000, quantity: 1,
    badges: ['로켓직구'],
  })
  assert.equal(res.shippable, false)
  assert.equal(res.verdict, 'blocked')
  assert.match(res.reason ?? '', /해외/)
})

test('S08 전자·가전 기기 할증이 견적과 최종 견적서에 모두 반영된다', () => {
  const order = createOrder({
    items: [item('다이슨 에어랩 컴플리트 롱 HS05', 599000)],
    zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const surcharge = order.quote.itemSurcharges?.rows ?? []
  assert.ok(surcharge.length > 0, '기기 할증이 잡혀야 합니다')
  const prov = buildProvisionalQuote(order)
  assert.ok(prov.lines.some((l) => /기기|할증/.test(l.label)))
  const { doc } = uploadDebitNote(order, 2.5)
  assert.ok(doc.lines.some((l) => /기기|할증/.test(l.label)), '최종 견적서에도 할증 유지')
})

test('S09 부피 큰 상품은 부피무게로 청구된다', () => {
  const w = estimateItemWeight({ productName: '깨끗한나라 3겹 화장지 30m 30롤', categoryName: '화장지' }, 1)
  assert.equal(w.chargeableBy, 'volumetric')
  assert.ok(w.chargeableG > w.actualG)
})

test('S10 중복 주문 감지 — 같은 상품·같은 고객', () => {
  const items = [item('클리오 킬커버 쿠션 15g', 25000)]
  const first = createOrder({ items, zone: 'hanoi', track: 'forwarding', customer: CUSTOMER })
  const dup = findDuplicateOrder({ track: 'forwarding', customer: CUSTOMER, items })
  assert.ok(dup, '중복이 감지되어야 합니다')
  assert.ok(dup.openOrderNos.includes(first.orderNo))
})

test('S11 고객 셀프 취소 — 입금 전에는 스스로 취소 가능', () => {
  const order = createOrder({
    items: [item('라운드랩 독도 토너 200ml', 17000)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const cancelled = customerCancelOrder(order.id, { reason: '다시 담을게요' })
  assert.equal(cancelled.state, 'CANCELLED')
  // 같은 요청을 다시 보내도 안전해야 합니다 (버튼 두 번 누름)
  assert.equal(customerCancelOrder(order.id, {}).state, 'CANCELLED')
})

test('S12 입금 후 고객 변심 취소 — 수수료(실비) 차감 후 환불, 원장 잔액 0', () => {
  const order = createOrder({
    items: [item('아누아 토너 250ml', 21000)], zone: 'hanoi', track: 'agent', customer: CUSTOMER,
  })
  paid(order)
  const cancelled = cancelOrder(order.id, { reason: '고객 변심', by: 'op', customerFault: true })
  assert.equal(cancelled.state, 'CANCELLED')
  const view = orderView(cancelled)
  assert.equal(view.ledgerSummary.balanceKrw, 0, '변심 취소 후 잔액은 0이어야 합니다')
  assert.ok(view.ledgerSummary.netReceivedKrw > 0, '수수료(실비)는 남습니다')
})

test('S13 당사 사유 취소 — 전액 환불, 남는 금액 없음', () => {
  const order = createOrder({
    items: [item('아누아 토너 250ml', 21000)], zone: 'hanoi', track: 'agent', customer: CUSTOMER,
  })
  paid(order)
  const cancelled = cancelOrder(order.id, { reason: '재고 없음', by: 'op' })
  const view = orderView(cancelled)
  assert.equal(view.ledgerSummary.netReceivedKrw, 0, '당사 사유면 전액 환불')
})

test('S14 청구서 업로드 — PDF 에서 무게·운송정보를 읽고 금액은 읽지 않는다', () => {
  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const { parsed, doc } = uploadDebitNote(order, 3.0, { hawb: 'S1K999', flight: 'VJ961' })
  assert.equal(parsed.hawbNo, 'S1K999')
  assert.equal(parsed.flight, 'VJ961')
  assert.equal(parsed.etd, '2026-08-30')
  assert.equal(parsed.eta, '2026-08-31')
  assertNoCostLeak(parsed, 'S14 파싱')
  assertNoCostLeak(doc, 'S14 문서')
  assert.equal(getOrder(order.id).debitNote.chargeableWeightKg, 3.0)
})

test('S15 청구서가 이미지·스캔본이면 자동 인식 실패 → 수동 무게로 최종 견적서', () => {
  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  // PNG 헤더 — 텍스트가 없습니다
  assert.equal(extractPdfText(Buffer.from([0x89, 0x50, 0x4e, 0x47])), '')
  assert.equal(parseDebitNote('').chargeableWeightKg, null)
  // 운영자가 무게만 직접 입력하면 최종 견적서는 정상 발행됩니다.
  const doc = buildFinalQuote(order, { chargeableWeightKg: 2.5 })
  assert.equal(doc.weight.chargeableKg, 2.5)
})

test('S16 무게 없이는 최종 견적서를 만들지 않는다', () => {
  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  assert.throws(() => buildFinalQuote(order, {}), /실측 무게/)
  assert.equal(buildQuoteDoc(order).kind, 'provisional', '청구서 전에는 임시 견적서')
})

test('S17 다품목 합산 — 무게·금액이 품목 수에 맞게 커진다', () => {
  const one = createOrder({
    items: [item('메디힐 마스크팩 10매', 12900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const many = createOrder({
    items: [
      item('메디힐 마스크팩 10매', 12900),
      item('아누아 토너 250ml', 21000, 2),
      item('라운드랩 독도 토너 200ml', 17000),
    ],
    zone: 'hanoi', track: 'forwarding', customer: { ...CUSTOMER, phone: '0907654321' },
  })
  assert.ok(many.quote.weight.chargeableG > one.quote.weight.chargeableG)
  assert.ok(many.quote.total >= one.quote.total)
  assert.equal(buildProvisionalQuote(many).lines.length >= 1, true)
})

test('S18 환율은 접수 시점에 동결 — 최종 견적서도 같은 환율로 계산', () => {
  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const rate = order.fx.effectiveRate
  const prov = buildProvisionalQuote(order)
  const { doc } = uploadDebitNote(order, 2.0)
  assert.equal(prov.fxRate, rate)
  assert.equal(doc.fxRate, rate)
  assert.equal(doc.totalVnd, Math.round(doc.totalKrw * rate))
})

test('S19 고객 화면·견적서에 원가·마진이 없다', () => {
  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  linkInbound(order.id, { coupangOrderNo: '2600000019', by: 'op' })
  paid(order)
  recordWeighing(order.id, { actualWeightG: 900, costs: { FREIGHT: 9000, WAREHOUSE: 1000 }, by: 'op' })

  const dump = JSON.stringify(customerView(getOrder(order.id)))
  for (const key of ['costs', 'margin', 'procurementKrw', 'COST']) {
    assert.ok(!dump.includes(key), `고객 뷰에 ${key} 노출`)
  }
  const { doc } = uploadDebitNote(order, 0.9)
  assertNoCostLeak(doc, 'S19 최종 견적서')
})

test('S20 정책 값이 문서·요금에 일관되게 적용된다', () => {
  // 국제배송비 단가와 반송 정책은 설정 한 곳에서 나옵니다.
  assert.ok(SHIPPING.zones.hanoi, '하노이 구간 요율 존재')
  assert.equal(RETURN_POLICY.forwardingRefundFeeUsd, 1)
  assert.equal(QUOTE.adjustThresholdVnd, 20000)

  const order = createOrder({
    items: [item('토리든 세럼 50ml', 18900)], zone: 'hanoi', track: 'forwarding', customer: CUSTOMER,
  })
  const prov = buildProvisionalQuote(order)
  assert.ok(prov.notes.some((n) => n.includes('20,000')), '임시 견적서에 조정 기준 안내')
  assert.ok(prov.notes.some((n) => n.includes('최종 견적서')), '최종 견적서 예고 안내')
  assert.ok(prov.validUntil, '유효기간 표기')
  assert.equal(prov.customer.address, undefined, '견적서에 배송지 주소를 싣지 않습니다')
})
