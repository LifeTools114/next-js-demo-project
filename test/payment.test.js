import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, startPurchase, recordPurchase, recordWeighing,
  getOrder, listOrders, _reset,
} from '../lib/order/store.js'
import { extractOrderNo, dueFor, matchDeposit } from '../lib/payment/deposit-match.js'
import { availableMethods } from '../lib/payment/methods.js'
import webhookHandler from '../pages/api/payment/webhook.js'

const ITEMS = [
  { productId: '7001', productName: '토리든 다이브인 세럼 50ml', productPrice: 19900, quantity: 2 },
]
const newOrder = (paymentMethod = 'manual-bank') =>
  createOrder({
    items: ITEMS, zone: 'hanoi', track: 'agent',
    customer: { name: 'Mai', phone: '0912', address: 'Hanoi' },
    paymentMethod,
  })

test.beforeEach(() => _reset())

// ─────────────── 이중통화 수단 ───────────────

test('결제 수단: KRW·VND 은행이체가 모두 제공된다', () => {
  const methods = availableMethods()
  const currencies = methods.filter((m) => m.id.startsWith('manual-bank')).map((m) => m.currency)
  assert.ok(currencies.includes('VND'))
  assert.ok(currencies.includes('KRW'))

  const o = newOrder('manual-bank-krw')
  assert.equal(o.paymentRequest.chargeCurrency, 'KRW')
  assert.ok(o.paymentRequest.instructions.some((l) => l.includes(o.orderNo)))
})

// ─────────────── 입금 대조 ───────────────

test('입금 대조: 메모 어디에 있든 주문번호를 찾는다', () => {
  assert.equal(extractOrderNo('HN2608280001'), 'HN2608280001')
  assert.equal(extractOrderNo('홍길동 hn2608280001 감사합니다'), 'HN2608280001')
  assert.equal(extractOrderNo('그냥 입금'), null)
  assert.equal(extractOrderNo(''), null)
})

test('입금 대조: 청구액 이상이면 확인, 미만이면 검토로 남긴다', () => {
  const o = newOrder()
  const { amountKrw, amountVnd } = o.invoice

  const krwOk = matchDeposit({ amount: amountKrw, currency: 'KRW', memo: `Mai ${o.orderNo}` }, listOrders())
  assert.equal(krwOk.matched, true)
  assert.equal(krwOk.kind, 'invoice')
  assert.equal(krwOk.surplus, 0)

  const vndOver = matchDeposit({ amount: amountVnd + 5000, currency: 'VND', memo: o.orderNo }, listOrders())
  assert.equal(vndOver.matched, true)
  assert.equal(vndOver.surplus, 5000)

  const under = matchDeposit({ amount: amountKrw - 100, currency: 'KRW', memo: o.orderNo }, listOrders())
  assert.equal(under.matched, false)
  assert.equal(under.reason, 'underpaid')
})

test('입금 대조: 결제 대기 상태가 아니면 자동 확인하지 않는다', () => {
  const o = newOrder()
  confirmPayment(o.id, { confirmedBy: 'op' })
  const r = matchDeposit({ amount: o.invoice.amountKrw, currency: 'KRW', memo: o.orderNo }, listOrders())
  assert.equal(r.matched, false)
  assert.equal(r.reason, 'not-payable')
})

test('입금 대조: 차액 정산도 KRW·VND 로 받는다', () => {
  let o = confirmPayment(newOrder().id, { confirmedBy: 'op' })
  o = startPurchase(o.id, 'op')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-1', amountKrw: 40000 })
  // 허용오차를 확실히 넘는 초과 중량 → SETTLEMENT_DUE 자동 진입
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG + 2500 })
  assert.equal(o.state, 'SETTLEMENT_DUE')

  const due = dueFor(o)
  assert.equal(due.kind, 'settlement')
  assert.ok(due.krw > 0)
  assert.ok(due.vnd > 0)

  const r = matchDeposit({ amount: due.vnd, currency: 'VND', memo: `chuyen tien ${o.orderNo}` }, listOrders())
  assert.equal(r.matched, true)
  assert.equal(r.kind, 'settlement')
})

// ─────────────── 웹훅 엔드포인트 ───────────────

function mockRes() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v },
    status(c) { this.statusCode = c; return this },
    json(o) { this.body = o; return this },
  }
}
const post = (body, { token, query = {} } = {}) => {
  const res = mockRes()
  webhookHandler(
    { method: 'POST', headers: token ? { 'x-webhook-token': token } : {}, query, body },
    res,
  )
  return res
}

test('웹훅: 토큰 미설정이면 비활성, 오토큰이면 401', () => {
  delete process.env.PAYMENT_WEBHOOK_TOKEN
  assert.equal(post({}).statusCode, 503)

  process.env.PAYMENT_WEBHOOK_TOKEN = 'secret-1'
  try {
    assert.equal(post({}, { token: 'wrong' }).statusCode, 401)
  } finally {
    delete process.env.PAYMENT_WEBHOOK_TOKEN
  }
})

test('웹훅: 입금 한 건으로 결제 확인까지 자동 처리된다', () => {
  process.env.PAYMENT_WEBHOOK_TOKEN = 'secret-1'
  try {
    const o = newOrder()
    // Casso 계열 별칭(content) + 쿼리 통화 지정도 처리돼야 합니다.
    const res = post(
      { transferAmount: o.invoice.amountVnd, content: `NGUYEN MAI ${o.orderNo}`, txId: 'tx-99' },
      { token: 'secret-1', query: { currency: 'VND' } },
    )
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.matched, true)
    assert.equal(getOrder(o.id).state, 'PAID', '입금 확인이 자동으로 끝나야 합니다')

    // 같은 입금이 다시 오면(재전송) 상태가 이미 넘어가 검토로만 남습니다.
    const dup = post(
      { amount: o.invoice.amountVnd, currency: 'VND', memo: o.orderNo },
      { token: 'secret-1' },
    )
    assert.equal(dup.body.matched, false)
  } finally {
    delete process.env.PAYMENT_WEBHOOK_TOKEN
  }
})
