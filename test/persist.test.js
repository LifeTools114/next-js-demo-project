import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// Windows 호환: URL.pathname 은 "/C:/..." 를 돌려줘 경로가 깨지고,
// 백슬래시 경로를 -e 문자열에 넣으면 이스케이프로 해석됩니다.
// 그래서 cwd 는 fileURLToPath, 동적 import 는 file:// href 를 씁니다.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STORE_URL = new URL('../lib/order/store.js', import.meta.url).href

/**
 * 별도 프로세스에서 스토어를 구동합니다 — 진짜 "재시작"을 흉내내는 유일한 방법.
 * NODE_TEST_CONTEXT 를 지워야 자식에서 영속화가 켜집니다.
 */
function runInFreshProcess(dir, code) {
  const env = { ...process.env, ORDER_STORE_DIR: dir }
  delete env.NODE_TEST_CONTEXT
  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `const S = await import('${STORE_URL}')\n${code}`],
    { env, encoding: 'utf8', cwd: ROOT },
  ).trim()
}

const CREATE = `
const o = S.createOrder({
  items: [{ productName: '수분크림 100ml', productPrice: 25000, quantity: 1 }],
  zone: 'hanoi',
  track: 'agent',
  customer: { name: 'Mai', phone: '0912', address: 'Hanoi' },
})
console.log(o.orderNo)`

test('영속화: 프로세스를 재시작해도 주문·연번이 남는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-orders-'))

  const firstNo = runInFreshProcess(dir, CREATE)
  assert.match(firstNo, /^HN\d{6}0001$/)

  // "재시작" — 새 프로세스가 스냅샷을 복원해야 합니다.
  const out = runInFreshProcess(
    dir,
    `const list = S.listOrders()
     console.log(list.length, list[0].orderNo, list[0].state)`,
  )
  assert.equal(out, `1 ${firstNo} AWAITING_PAYMENT`)

  // 연번도 복원돼야 주문번호가 겹치지 않습니다.
  const secondNo = runInFreshProcess(dir, CREATE)
  assert.match(secondNo, /^HN\d{6}0002$/)

  // 상태 전이도 재시작을 건너 이어집니다.
  runInFreshProcess(
    dir,
    `S.confirmPayment('${firstNo}', { confirmedBy: 'op', reference: 'r1' })`,
  )
  const state = runInFreshProcess(dir, `console.log(S.getOrder('${firstNo}').state)`)
  assert.equal(state, 'PAID')
})

test('영속화: 깨진 스냅샷은 보존하고 빈 상태로 기동한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-orders-'))
  writeFileSync(join(dir, 'orders.json'), '{"broken json')

  const out = runInFreshProcess(dir, `console.log(S.listOrders().length)`)
  assert.equal(out, '0')
  // 원본이 .corrupt-* 로 남아 수동 복구가 가능해야 합니다.
  assert.ok(readdirSync(dir).some((f) => f.startsWith('orders.json.corrupt-')))
})

test('영속화: 테스트 러너 안에서는 기본으로 꺼져 파일을 만들지 않는다', async () => {
  // 이 파일 자체가 NODE_TEST_CONTEXT 안에서 돌므로, 직접 import 하면 꺼져 있어야 합니다.
  const { saveSnapshot, loadSnapshot } = await import('../lib/order/persist.js')
  const before = existsSync(join(ROOT, '.data', 'orders.json'))
  saveSnapshot({ counter: 99, orders: [] })
  assert.equal(existsSync(join(ROOT, '.data', 'orders.json')), before, '스냅샷 파일이 생기면 안 됩니다')
  assert.equal(loadSnapshot(), null)
})
