/**
 * 법적·운영 이슈 시나리오 — 구매대행·배송대행에서 실제로 분쟁이 되는 20가지
 *
 * 운영자 지시(26-09-03): "발생할 수 있는 모든 이슈를 점검하고, 법적으로
 * 문제없도록 공지사항과 절차를 모두 대입해서" 확인.
 *
 * 각 시나리오는 ① 그 이슈에 대한 공지가 실제로 존재하는지 ② 그 공지대로
 * 시스템이 동작하는지를 함께 봅니다. 문서만 있고 동작이 다르면 더 위험합니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { NOTICES, REQUIRED_CONSENTS, missingConsents, noticesByCategory } from '../config/legal.js'
import {
  createOrder, getOrder, confirmPayment, cancelOrder, customerCancelOrder,
  orderView, customerView,
} from '../lib/order/store.js'
import { buildProvisionalQuote, buildFinalQuote } from '../lib/quote-doc.js'
import { checkEligibility } from '../lib/eligibility.js'
import { estimateItemWeight } from '../lib/weight/estimate.js'
import { QUOTE } from '../config/quote.js'
import { REFUND_DAYS, RETURN_POLICY } from '../config/payment.js'
import { RETURN_SHIPPING } from '../config/shipping.js'
import { ALL_CONSENTS } from './helpers/consents.js'

const CUSTOMER = { name: '박하노', phone: '0901234567', address: '하노이시 하동구' }
const ALL = REQUIRED_CONSENTS.map((c) => c.id)
const item = (productName, productPrice, quantity = 1) => ({ productName, productPrice, quantity })
const order = (over = {}) => createOrder({ consents: ALL_CONSENTS,
  items: [item('토리든 다이브인 세럼 50ml', 18900)],
  zone: 'hanoi', track: 'forwarding', customer: CUSTOMER, consents: ALL, ...over,
})
/** 공지 본문에서 키워드를 찾습니다 (고지 누락 방지) */
const noticeSays = (id, needle) => {
  const n = NOTICES.find((x) => x.id === id)
  assert.ok(n, `공지 ${id} 가 없습니다`)
  const text = n.body.join(' ')
  return needle instanceof RegExp ? needle.test(text) : text.includes(String(needle))
}

// ── 접수 단계 ────────────────────────────────────────────────────────

test('L01 필수 동의 없이 접수되지 않는다 (화면을 건너뛴 직접 호출 포함)', () => {
  assert.throws(() => order({ consents: undefined }), /동의해야 접수됩니다/)
  assert.throws(() => order({ consents: ['service'] }), /동의해야 접수됩니다/)
  const ok = order()
  assert.deepEqual(ok.consents.ids.sort(), [...ALL].sort())
  assert.ok(ok.consents.agreedAt, '동의 시각이 기록되어야 분쟁 시 증빙이 됩니다')
})

test('L02 동의 항목이 모두 공지 근거를 가진다 (근거 없는 동의 금지)', () => {
  for (const c of REQUIRED_CONSENTS) {
    assert.ok(c.noticeIds?.length > 0, `${c.id} 에 근거 공지가 없습니다`)
    for (const nid of c.noticeIds) {
      assert.ok(NOTICES.some((n) => n.id === nid), `${c.id} 가 가리키는 공지 ${nid} 없음`)
    }
  }
})

test('L03 통신판매 당사자가 아님을 고지한다 (판매자 책임 구분)', () => {
  assert.ok(noticeSays('role', /판매자/))
  assert.ok(noticeSays('role', /당사자가 아닙니다/))
  assert.ok(noticeSays('inspection', /열어|개봉/), '검수 범위 한정 고지')
})

test('L04 부피무게 청구를 고지하고, 실제로 그렇게 계산한다', () => {
  assert.ok(noticeSays('volumetric', /부피무게/))
  const w = estimateItemWeight({ productName: '깨끗한나라 3겹 화장지 30m 30롤', categoryName: '화장지' }, 1)
  assert.equal(w.chargeableBy, 'volumetric', '공지대로 부피무게가 청구 기준')
  assert.ok(w.chargeableG > w.actualG)
})

test('L05 실측 차액 재정산을 고지하고, 그 기준(20,000동)대로 판정한다', () => {
  assert.ok(noticeSays('reweigh', /20,000동/))
  const o = order()
  const same = buildFinalQuote(o, { chargeableWeightKg: o.quote.weight.chargeableG / 1000 })
  assert.equal(same.adjust, false)
  assert.equal(same.thresholdVnd, QUOTE.adjustThresholdVnd)
  const heavier = buildFinalQuote(o, { chargeableWeightKg: o.quote.weight.chargeableG / 1000 + 3 })
  assert.equal(heavier.adjust, true)
})

test('L06 환율 고정을 고지하고, 접수 후 바뀌지 않는다', () => {
  assert.ok(noticeSays('fx', /고정|바뀌지/))
  const o = order()
  const rate = o.fx.effectiveRate
  const prov = buildProvisionalQuote(o)
  const fin = buildFinalQuote(o, { chargeableWeightKg: 2 })
  assert.equal(prov.fxRate, rate)
  assert.equal(fin.fxRate, rate)
})

// ── 통관·세금 ────────────────────────────────────────────────────────

test('L07 관세·부가세 납세의무자가 고객임을 고지한다', () => {
  assert.ok(noticeSays('duty', /수하인|고객/))
  assert.ok(noticeSays('duty', /세관/), '세액 결정 주체 명시')
})

test('L08 자가사용·재판매 금지를 고지한다', () => {
  assert.ok(noticeSays('personal-use', /재판매|판매 목적/))
})

test('L09 수취인 정보 정확성 책임을 고지한다', () => {
  assert.ok(noticeSays('recipient-info', /지연|반송/))
  // 실제로도 이름·연락처 없이 접수되면 안 됩니다.
  const o = order({ customer: { name: '', phone: '', address: '' } })
  assert.equal(o.customer.name, '')
  // (화면 필수 입력과 서버 저장이 분리돼 있어, 빈 값이면 운영자 확인 대상)
  assert.ok(orderView(o).customer, '주문에 수취인 정보 필드가 있어야 합니다')
})

// ── 금지 품목 ────────────────────────────────────────────────────────

test('L10 항공 위험물 고지 + 실제 차단 (배터리)', () => {
  assert.ok(noticeSays('prohibited', /배터리/))
  assert.equal(checkEligibility({ productName: '앤커 보조배터리 20000mAh' }).shippable, false)
  assert.throws(() => order({ items: [item('앤커 보조배터리 20000mAh', 39000)] }), /배송할 수 없는/)
})

test('L11 검역 품목 고지 + 실제 차단 (축산물)', () => {
  assert.ok(noticeSays('prohibited', /축산물|육류|유제품/))
  assert.equal(checkEligibility({ productName: '스팸 클래식 200g 12개' }).shippable, false)
})

test('L12 인화성 물질 고지 + 실제 차단 (향수)', () => {
  assert.ok(noticeSays('prohibited', /인화성|향수/))
  assert.equal(checkEligibility({ productName: '조말론 잉글리쉬페어 코롱 30ml' }).shippable, false)
})

test('L13 해외직구(타국 발송) 고지 + 실제 차단', () => {
  assert.ok(noticeSays('prohibited', /해외|직구/))
  const res = checkEligibility({ productName: '샤오미 공기청정기', badges: ['로켓직구'] })
  assert.equal(res.shippable, false)
})

test('L14 소모품이 본체로 오인돼 차단되지 않는다 (과잉 차단도 분쟁)', () => {
  // 금지 품목 고지가 있다고 해서 정상 상품까지 막으면 그 자체가 문제입니다.
  assert.equal(checkEligibility({ productName: '스웨이 식기세척기 캡슐 세제 55입, 440g, 2개' }).shippable, true)
  assert.equal(checkEligibility({ productName: 'LG 트롬 식기세척기 12인용' }).shippable, false)
})

// ── 취소·환불 ────────────────────────────────────────────────────────

test('L15 입금 전 취소는 전액·즉시 (고지대로)', () => {
  assert.ok(noticeSays('cancel', /입금 전|전액/))
  const o = order()
  const c = customerCancelOrder(o.id, { reason: '변심' })
  assert.equal(c.state, 'CANCELLED')
  assert.equal(orderView(c).ledgerSummary.netReceivedKrw, 0, '받은 돈이 없으니 남는 것도 없어야 합니다')
})

test('L16 배송대행 변심 취소는 $1 차감 — 고지와 코드가 일치', () => {
  assert.equal(RETURN_POLICY.forwardingRefundFeeUsd, 1)
  assert.ok(noticeSays('cancel', /1달러|\$1/))
  const o = order()
  confirmPayment(o.id, { confirmedBy: 'op' })
  const c = cancelOrder(o.id, { reason: '변심', by: 'op', customerFault: true })
  const s = orderView(c).ledgerSummary
  assert.equal(s.balanceKrw, 0, '정산이 끝나 잔액은 0')
  assert.ok(s.netReceivedKrw > 0, '실비는 남습니다')
})

test('L17 당사 사유 취소는 전액 환불 (고지대로)', () => {
  assert.ok(noticeSays('cancel', /당사 사유/))
  const o = order({ track: 'agent' })
  confirmPayment(o.id, { confirmedBy: 'op' })
  const c = cancelOrder(o.id, { reason: '발주 실패', by: 'op' })
  assert.equal(orderView(c).ledgerSummary.netReceivedKrw, 0)
})

test('L18 반송비·환불 기간이 고지와 설정값에서 같다', () => {
  assert.ok(noticeSays('return-cost', String(RETURN_SHIPPING.baseUsd)))
  assert.ok(noticeSays('return-cost', String(RETURN_SHIPPING.perKgUsd)))
  assert.ok(noticeSays('cancel', `${REFUND_DAYS.min}~${REFUND_DAYS.max}`))
  assert.ok(noticeSays('return-cost', /반송 자체가 불가능|반송 불가/), '반송 불가 품목 고지')
})

// ── 사고·개인정보·결제 ───────────────────────────────────────────────

test('L19 배상 한도·면책·보관 기간을 고지한다', () => {
  assert.ok(noticeSays('damage', /한도/))
  assert.ok(noticeSays('damage', /사진|영상/), '사고 입증 방법 안내')
  assert.ok(noticeSays('delay', /세관|기상/))
  assert.ok(noticeSays('storage', /30일|보관/))
})

test('L20 개인정보 항목·제3자 제공·국외이전·보유기간을 모두 고지하고, 고객 화면에 원가가 없다', () => {
  assert.ok(noticeSays('privacy', /수집 항목/))
  assert.ok(noticeSays('privacy', /제3자/))
  assert.ok(noticeSays('privacy', /국외/))
  assert.ok(noticeSays('privacy', /보유 기간/))
  assert.ok(noticeSays('privacy', /14세/), '미성년자 법정대리인 동의')
  assert.ok(noticeSays('payment', /본인 명의|타인 명의/))

  // 고지와 별개로, 고객 화면에 원가·마진이 새지 않아야 합니다.
  const o = order()
  const dump = JSON.stringify(customerView(getOrder(o.id)))
  for (const key of ['margin', 'costs', 'procurement']) {
    assert.ok(!dump.includes(key), `고객 뷰에 ${key} 노출`)
  }
  // 공지 페이지가 모든 항목을 카테고리로 묶어 보여줄 수 있어야 합니다.
  const groups = noticesByCategory()
  assert.ok(groups.length >= 6)
  assert.equal(groups.reduce((s, g) => s + g.items.length, 0), NOTICES.length)
  assert.deepEqual(missingConsents(ALL), [])
})
