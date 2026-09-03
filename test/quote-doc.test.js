/**
 * 견적서(임시·최종) — 발행 흐름과 무게 차이 판정
 *
 * 운영자 지시(26-09-01): 임시 견적서를 고객에게 전달하고, 물류사 청구서를
 * 받으면 실측 무게로 최종 견적서를 만든다. 차액이 20,000동 이상이면
 * 추가청구·환불 대상이고, 그 미만이면 임시 견적서 금액대로 확정한다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, saveDebitNote, getOrder } from '../lib/order/store.js'
import { buildProvisionalQuote, buildFinalQuote, buildQuoteDoc } from '../lib/quote-doc.js'
import { QUOTE } from '../config/quote.js'
import { ALL_CONSENTS } from './helpers/consents.js'

const newOrder = () => createOrder({ consents: ALL_CONSENTS,
  items: [{ productName: '토리든 다이브인 세럼 50ml', productPrice: 18000, quantity: 3 }],
  zone: 'hanoi',
  track: 'forwarding',
  customer: { name: '박하노', phone: '0901234567', address: '하노이시 하동구' },
})

test('임시 견적서 — 추정 무게와 동결 견적을 그대로 담는다', () => {
  const order = newOrder()
  const doc = buildProvisionalQuote(order)

  assert.equal(doc.kind, 'provisional')
  assert.equal(doc.docNo, `Q-${order.orderNo}`)
  assert.equal(doc.totalKrw, order.quote.total)
  assert.equal(doc.weight.basis, '추정')
  assert.ok(doc.lines.length > 0)
  assert.ok(doc.lines.every((l) => l.vnd > 0), '동화 금액이 모든 줄에 있어야 합니다')
  assert.ok(doc.validUntil, '임시 견적서에는 유효기간이 있습니다')
})

test('최종 견적서 — 차액이 기준 미만이면 임시 견적서 금액대로 확정', () => {
  const order = newOrder()
  // 추정과 같은 무게로 청구서가 오면 차액이 없습니다.
  const sameKg = order.quote.weight.chargeableG / 1000
  const doc = buildFinalQuote(order, { chargeableWeightKg: sameKg, hawbNo: 'S1K452019' })

  assert.equal(doc.kind, 'final')
  assert.equal(doc.adjust, false)
  assert.equal(doc.totalKrw, order.quote.total, '조정 대상이 아니면 임시 견적 금액')
  assert.match(doc.adjustLabel, /임시 견적서 금액대로/)
})

test('최종 견적서 — 무게가 늘어 차액이 기준 이상이면 추가 청구 대상', () => {
  const order = newOrder()
  const heavier = order.quote.weight.chargeableG / 1000 + 2 // 2kg 초과 입고
  const doc = buildFinalQuote(order, { chargeableWeightKg: heavier })

  assert.equal(doc.adjust, true)
  assert.ok(doc.diffKrw > 0)
  assert.ok(Math.abs(doc.diffVnd) >= QUOTE.adjustThresholdVnd)
  assert.equal(doc.totalKrw, doc.recalculatedKrw, '조정 대상이면 재계산 금액으로 청구')
  assert.match(doc.adjustLabel, /추가 청구/)
})

test('최종 견적서에 물류사 원가(단가·청구액)가 들어가지 않는다', () => {
  const order = newOrder()
  // 청구서에 원가가 섞여 들어와도 문서에는 남지 않아야 합니다.
  const doc = buildFinalQuote(order, {
    chargeableWeightKg: 3, hawbNo: 'S1K452019', unitPriceUsd: 7, amountUsd: 21, amountVnd: 556290,
  })
  const dump = JSON.stringify(doc)
  assert.ok(!dump.includes('556290'), '물류사 청구액이 문서에 남으면 안 됩니다')
  assert.ok(!dump.includes('unitPrice'), '물류사 단가가 문서에 남으면 안 됩니다')
  assert.equal(doc.shipment.hawbNo, 'S1K452019', '운송 정보(사실)는 옮깁니다')
})

test('청구서를 저장하면 이후 문서는 최종 견적서가 된다', () => {
  const order = newOrder()
  assert.equal(buildQuoteDoc(order).kind, 'provisional')

  saveDebitNote(order.id, { chargeableWeightKg: 3.0, hawbNo: 'S1K452019', flight: 'KE0361' })
  const saved = getOrder(order.id)
  assert.equal(saved.debitNote.chargeableWeightKg, 3.0)
  assert.equal(buildQuoteDoc(saved).kind, 'final')

  // 저장된 청구서에도 금액 항목이 없어야 합니다.
  assert.ok(!('amountVnd' in saved.debitNote))
  assert.ok(!('unitPrice' in saved.debitNote))
})

test('실측 무게가 없으면 최종 견적서를 만들지 않는다', () => {
  const order = newOrder()
  assert.throws(() => buildFinalQuote(order, {}), /실측 무게/)
})
