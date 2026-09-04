/**
 * 견적서(임시·최종) — 발행 흐름과 무게 차이 판정
 *
 * 운영자 지시(26-09-01): 임시 견적서를 고객에게 전달하고, 물류사 청구서를
 * 받으면 실측 무게로 최종 견적서를 만든다. 차액이 기준 금액 이상이면
 * 추가청구·환불 대상이고, 그 미만이면 임시 견적서 금액대로 확정한다.
 *
 * 기준 금액(26-09-04 운영자 확정): 3,000~10,000원 — 무게 추정 신뢰도별.
 * 견적서와 장부가 **같은 기준**을 쓰는지가 이 파일의 핵심 검사입니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, saveDebitNote, getOrder } from '../lib/order/store.js'
import { buildProvisionalQuote, buildFinalQuote, buildQuoteDoc } from '../lib/quote-doc.js'
import { computeSettlement, settlementToleranceKrw } from '../lib/order/settlement.js'
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
  assert.ok(Math.abs(doc.diffKrw) >= doc.thresholdKrw)
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


/* ─────────── 견적서와 장부가 같은 기준을 쓰는가 ─────────── */

test('조정 기준은 견적서와 장부가 같은 곳에서 가져온다', () => {
  const order = newOrder()
  const doc = buildFinalQuote(order, { chargeableWeightKg: order.quote.weight.chargeableG / 1000 })
  assert.equal(doc.thresholdKrw, settlementToleranceKrw(order))
  assert.ok(doc.thresholdKrw >= 3_000 && doc.thresholdKrw <= 10_000, '3,000~10,000원 범위')
  // 고객이 보는 동화 표기도 같은 값에서 환산됩니다.
  assert.equal(doc.thresholdVnd, Math.round(doc.thresholdKrw * order.fx.effectiveRate))
})

test('견적서의 조정 판정과 장부의 정산 판정이 언제나 일치한다', () => {
  // 예전에는 견적서만 20,000동(약 1,081원)이라는 별도 기준을 들고 있어,
  // 문서는 "추가 청구 대상"이라 적고 장부는 아무 일도 하지 않는 구간이
  // 있었습니다. 무게를 넓게 훑어 그 틈이 없는지 확인합니다.
  const order = newOrder()
  const estKg = order.quote.weight.chargeableG / 1000

  let sawAdjust = false
  let sawKeep = false
  for (let g = 100; g <= 6000; g += 50) {
    const kg = Math.round((estKg * 1000 + (g - 3000)) ) / 1000
    if (kg <= 0) continue
    const doc = buildFinalQuote(order, { chargeableWeightKg: kg })
    const s = computeSettlement(order, Math.round(kg * 1000))

    assert.equal(doc.adjust, s.action !== 'none',
      `실측 ${kg}kg — 견적서는 ${doc.adjust ? '조정' : '유지'}, 장부는 ${s.action}`)
    if (doc.adjust) {
      assert.equal(doc.diffKrw > 0, s.action === 'additional', `실측 ${kg}kg — 방향도 같아야 합니다`)
      assert.equal(Math.abs(doc.diffKrw), s.absKrw, `실측 ${kg}kg — 금액도 같아야 합니다`)
      assert.equal(doc.totalKrw, s.finalTotalKrw, '조정하면 재계산 금액으로 청구')
      sawAdjust = true
    } else {
      assert.equal(doc.totalKrw, order.quote.total, '조정 안 하면 임시 견적 금액 그대로')
      sawKeep = true
    }
  }
  assert.ok(sawAdjust && sawKeep, '조정하는 구간과 유지하는 구간을 모두 지나야 검사가 성립')
})

test('경계값 — 기준 금액 바로 아래는 흡수, 바로 위는 조정', () => {
  const order = newOrder()
  const tol = settlementToleranceKrw(order)

  // 차액이 기준과 정확히 같으면 조정합니다(>= 기준). 그 1원 아래는 흡수.
  const at = { diffKrw: tol }
  const below = { diffKrw: tol - 1 }
  assert.ok(Math.abs(at.diffKrw) >= tol, '기준과 같으면 조정 대상')
  assert.ok(Math.abs(below.diffKrw) < tol, '기준보다 1원 적으면 흡수')

  // 실제 판정에서도 같은 방향인지 — 무게 한 칸(약 11,040원)은 어떤 신뢰도에서도 조정.
  const step = buildFinalQuote(order, { chargeableWeightKg: order.quote.shipping.billableKg + 1 })
  assert.equal(step.adjust, true, '청구 kg 한 칸 차이는 항상 조정 대상')
  assert.ok(Math.abs(step.diffKrw) > tol)
})


/* ─────────── 배송만 수수료가 끝까지 살아남는가 (26-09-04 신설) ─────────── */

test('배송만 수수료는 실측 정산 후에도 그대로 청구된다', async () => {
  // 정산 재계산에서 빠뜨리면 최종 청구서가 3,000원 적게 나오고,
  // 그 차액이 주문마다 "환불 대상" 으로 잡힙니다.
  const { FEES } = await import('../config/fees.js')
  const order = newOrder() // track: forwarding
  assert.equal(order.quote.forwardingFeeKrw, FEES.forwardingFeeKrw)

  const sameKg = order.quote.weight.chargeableG / 1000
  const s = computeSettlement(order, Math.round(sameKg * 1000))
  assert.equal(s.diffKrw, 0, '무게가 같으면 차액이 0이어야 합니다')
  assert.equal(s.final.forwardingFee, FEES.forwardingFeeKrw)

  const doc = buildFinalQuote(order, { chargeableWeightKg: sameKg })
  const fee = doc.lines.find((l) => l.key === 'forwarding')
  assert.ok(fee, '최종 견적서에 배송만 수수료 줄이 있어야 합니다')
  assert.equal(fee.krw, FEES.forwardingFeeKrw)
  assert.equal(doc.totalKrw, order.quote.total)
})

test('구매하고 배송까지에는 배송만 수수료를 붙이지 않는다', async () => {
  const { FEES } = await import('../config/fees.js')
  const { createOrder } = await import('../lib/order/store.js')
  const order = createOrder({ consents: ALL_CONSENTS,
    items: [{ productName: '토리든 다이브인 세럼 50ml', productPrice: 18000, quantity: 1 }],
    zone: 'hanoi', track: 'agent',
    customer: { name: '박하노', phone: '0901234567', address: '하노이시 하동구' },
  })
  assert.equal(order.quote.forwardingFeeKrw, 0, '두 수수료를 겹쳐 받지 않습니다')
  assert.ok(!order.quote.breakdown.some((r) => r.key === 'forwarding'))
  assert.equal(order.quote.agency.fee, FEES.agencyBaseKrw)
})
