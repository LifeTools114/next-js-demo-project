import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ORDER_STORE_DIR 을 명시하면 테스트 러너 안에서도 로그가 켜집니다.
// (이 파일은 주문 스토어를 import 하지 않으므로 스냅샷 오염이 없습니다)
process.env.ORDER_STORE_DIR = mkdtempSync(join(tmpdir(), 'kb-review-'))

const { appendLog, readLog } = await import('../lib/order/persist.js')
const { default: reviewHandler } = await import('../pages/api/admin/review.js')

test('운영 로그: 최신순으로 읽고 limit 을 지킨다', () => {
  appendLog('payment-review.jsonl', { event: 'unmatched-deposit', reason: 'underpaid', orderNo: 'HN2608280001' })
  appendLog('payment-review.jsonl', { event: 'unmatched-deposit', reason: 'no-order-no' })
  appendLog('payment-review.jsonl', { event: 'overpaid', orderNo: 'HN2608280002', surplus: 5000 })

  const all = readLog('payment-review.jsonl')
  assert.equal(all.length, 3)
  assert.equal(all[0].event, 'overpaid', '최신 건이 먼저 와야 합니다')
  assert.ok(all.every((r) => r.at), '기록 시각이 붙어야 합니다')

  assert.equal(readLog('payment-review.jsonl', { limit: 1 }).length, 1)
  assert.deepEqual(readLog('없는파일.jsonl'), [])
})

test('검토 큐 API: 세 로그를 한 번에 돌려준다', () => {
  appendLog('coupang-capture-review.jsonl', { event: 'unmatched-capture', reason: 'ambiguous', coupangOrderNo: '29' })

  const res = {
    statusCode: 0, body: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this },
    json(o) { this.body = o; return this },
  }
  reviewHandler({ method: 'GET', headers: {}, query: {} }, res)

  assert.equal(res.statusCode, 200)
  assert.ok(res.body.paymentReview.length >= 3)
  assert.equal(res.body.captureReview[0].reason, 'ambiguous')
  assert.ok(Array.isArray(res.body.notifications))
})
