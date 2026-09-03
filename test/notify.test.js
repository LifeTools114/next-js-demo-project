import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { composeNotification } from '../lib/notify.js'
import { ALL_CONSENTS } from './helpers/consents.js'

// Windows 호환 — persist.test.js 의 주석 참조
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STORE_URL = new URL('../lib/order/store.js', import.meta.url).href

const baseOrder = {
  orderNo: 'HN2608280001',
  customer: { name: 'Mai', phone: '0912', email: 'mai@example.com' },
  invoice: { amountKrw: 120000 },
  settlement: { action: 'additional', label: '추가 청구', absKrw: 8400 },
  delivery: { trackingNo: 'HAN-01' },
}

test('알림 구성: 상태별로 고객이 알아야 할 내용이 담긴다', () => {
  const wait = composeNotification(baseOrder, 'AWAITING_PAYMENT')
  assert.ok(wait.title.includes('HN2608280001'))
  assert.ok(wait.message.includes('120,000원'), '청구액이 담겨야 합니다')
  assert.equal(wait.customerFacing, true)

  const due = composeNotification(baseOrder, 'SETTLEMENT_DUE')
  assert.ok(due.message.includes('추가 청구') && due.message.includes('8,400원'))

  const shipped = composeNotification(baseOrder, 'SHIPPED')
  assert.ok(shipped.message.includes('HAN-01'), '운송장이 담겨야 합니다')

  // 내부 처리 단계는 고객 대상이 아닙니다
  assert.equal(composeNotification(baseOrder, 'PURCHASING').customerFacing, false)
})

test('알림 기록: 주문 생성부터 상태가 바뀔 때마다 jsonl 에 쌓인다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-notify-'))
  const env = { ...process.env, ORDER_STORE_DIR: dir }
  delete env.NODE_TEST_CONTEXT

  execFileSync(process.execPath, ['--input-type=module', '-e', `
    const S = await import('${STORE_URL}')
    const o = S.createOrder({ consents: (await import('file://' + process.cwd() + '/config/legal.js')).REQUIRED_CONSENTS.map((c) => c.id),
      items: [{ productName: '수분크림 100ml', productPrice: 25000, quantity: 1 }],
      zone: 'hanoi', track: 'agent',
      customer: { name: 'Mai', phone: '0912', address: 'Hanoi', email: 'mai@example.com' },
    })
    S.confirmPayment(o.id, { confirmedBy: 'op' })
  `], { env, cwd: ROOT })

  const file = join(dir, 'notifications.jsonl')
  assert.ok(existsSync(file), '알림 기록 파일이 생겨야 합니다')
  const records = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const states = records.map((r) => r.state)
  assert.deepEqual(states, ['AWAITING_PAYMENT', 'PAID'])
  assert.equal(records[0].customerEmail, 'mai@example.com')
  assert.ok(records.every((r) => r.at && r.title && r.message !== undefined))
})
