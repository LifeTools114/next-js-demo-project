/**
 * 고객 풀 — 회원가입 없이 개인 링크로 내 주문 보기 (운영자 26-09-06).
 * "쉽게 확인하되 보안은 철저하게, 고객 정보는 사장님이 소유."
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, confirmPayment, listOrders, getOrder, _reset } from '../lib/order/store.js'
import {
  phoneKey, findByKey, findByPhone, visibleOrders, recoverKey, issueKey, revokeKeys, listCustomers,
  setPin, checkPin, hasPin, hashKey, _resetCustomers,
} from '../lib/customer/store.js'
import { makeUnlock, checkUnlock } from '../lib/customer/session.js'
import { ALL_CONSENTS } from './helpers/consents.js'
import myHandler from '../pages/api/my/index.js'
import unlockHandler from '../pages/api/my/unlock.js'
import recoverHandler from '../pages/api/my/recover.js'
import adminHandler from '../pages/api/admin/customers.js'
import { toCustomersCsv, escapeCsv } from '../pages/api/admin/customers-export.js'

const ITEMS = [{ productId: '7001', productName: '토리든 다이브인 세럼 50ml', productPrice: 19900, quantity: 1 }]
const order = (phone, extra = {}) =>
  createOrder({ consents: ALL_CONSENTS, items: ITEMS, zone: 'hanoi', customer: { name: '응웬 마이', phone, address: 'Hanoi' }, ...extra })
let ipSeq = 0
const call = (handler, { method = 'GET', query = {}, body = {} } = {}) => {
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this }, json(o) { this.body = o; return this }, send(o) { this.body = o; return this } }
  handler({ method, query, body, headers: { 'x-forwarded-for': `10.0.0.${++ipSeq}` }, socket: {} }, res)
  return res
}

test.beforeEach(() => { _reset(); _resetCustomers() })

test('전화번호 정규화 — +84 9xx 와 09xx 는 같은 고객', () => {
  assert.equal(phoneKey('+84 912 345 678'), '0912345678')
  assert.equal(phoneKey('0912-345-678'), '0912345678')
  assert.equal(phoneKey('0084912345678'), '0912345678')
  assert.equal(phoneKey('010-4803-6031'), '01048036031')
})

test('첫 주문 → 미확인 열쇠 한 번 발급, 서버에는 해시만, 그 열쇠로는 그 주문만 보인다', () => {
  const o = order('0912 345 678')
  const key = o._issuedKey
  assert.ok(key && key.length >= 30, '평문 열쇠는 응답용으로만')
  assert.ok(!JSON.stringify(o).includes(key), '주문 JSON 에 평문 열쇠가 남으면 안 됩니다')
  assert.equal(o.keyHash, hashKey(key))
  const found = findByKey(key)
  assert.equal(found.customer.phoneKey, '0912345678')
  assert.equal(found.entry.verified, false)
  // 같은 번호로 열쇠 없이 낸 두 번째 주문은 아직 안 보입니다 (입금 전)
  const o2 = order('+84 912 345 678')
  assert.equal(o2._issuedKey, null, '기존 고객인데 열쇠가 없으면 새로 주지 않습니다')
  assert.deepEqual(visibleOrders(found, listOrders()).map((x) => x.orderNo), [o.orderNo])
})

test('열쇠를 들고 낸 주문은 그 열쇠에 묶이고, 입금이 확인되면 전화번호 전체가 보인다', () => {
  const o = order('0912345678'); const key = o._issuedKey
  const o2 = order('0912345678', { myKey: key })
  assert.equal(o2._issuedKey, null); assert.equal(o2.keyHash, o.keyHash)
  const o3 = order('0912345678') // 열쇠 없이(다른 기기) — 아직 안 보임
  assert.deepEqual(visibleOrders(findByKey(key), listOrders()).map((x) => x.orderNo).sort(), [o.orderNo, o2.orderNo].sort())
  confirmPayment(o.id, { confirmedBy: 'admin' })
  assert.equal(findByKey(key).entry.verified, true, '입금 = 전화번호 주인 증명')
  assert.equal(visibleOrders(findByKey(key), listOrders()).length, 3)
  assert.ok(visibleOrders(findByKey(key), listOrders()).some((x) => x.orderNo === o3.orderNo))
})

test('남의 번호로 신청서만 내는 사람은 결제하지 않으므로 그 사람의 주문을 볼 수 없다', () => {
  const attacker = order('0999 000 111') // 피해자 번호로 먼저 신청 — 미확인 열쇠
  const aKey = attacker._issuedKey
  const victim = order('0999000111')       // 진짜 주인 — 열쇠 없이 신청, 입금함
  confirmPayment(victim.id, { confirmedBy: 'admin' })
  assert.deepEqual(visibleOrders(findByKey(aKey), listOrders()).map((x) => x.orderNo), [attacker.orderNo], '공격자 열쇠는 자기 주문만')
  // 진짜 주인은 입금 끝난 주문번호로 확인된 열쇠를 받고 전부 봅니다
  const vKey = recoverKey({ phone: '+84 999 000 111', orderNo: victim.orderNo, getOrder })
  assert.ok(vKey)
  assert.equal(findByKey(vKey).entry.verified, true)
  assert.equal(visibleOrders(findByKey(vKey), listOrders()).length, 2)
})

test('복구 — 입금 전 주문번호·다른 번호로는 안 되고, 잊은 PIN 도 함께 풀린다', () => {
  const o = order('0912345678')
  assert.equal(recoverKey({ phone: '0912345678', orderNo: o.orderNo, getOrder }), null, '입금 전')
  confirmPayment(o.id, { confirmedBy: 'admin' })
  assert.equal(recoverKey({ phone: '0912345679', orderNo: o.orderNo, getOrder }), null, '다른 번호')
  const c = findByPhone('0912345678'); setPin(c.id, '1234'); assert.ok(hasPin(c))
  assert.ok(recoverKey({ phone: '0912345678', orderNo: o.orderNo.toLowerCase(), getOrder }))
  assert.equal(hasPin(findByPhone('0912345678')), false, '복구하면 PIN 도 풀립니다')
})

test('PIN — scrypt 해시, 5번 틀리면 15분 잠금 · 잠금 해제 표시는 열쇠에 묶임', () => {
  const o = order('0912345678'); const c = findByPhone('0912345678')
  assert.throws(() => setPin(c.id, '12'), /4~6자리/)
  setPin(c.id, '2468')
  assert.ok(!JSON.stringify(c).includes('2468'))
  assert.equal(checkPin(c.id, '0000'), 'wrong'); assert.equal(checkPin(c.id, '2468'), 'ok')
  for (let i = 0; i < 5; i++) checkPin(c.id, '1111')
  assert.equal(checkPin(c.id, '2468'), 'locked')
  const u = makeUnlock(o.keyHash)
  assert.equal(checkUnlock(o.keyHash, u), true)
  assert.equal(checkUnlock('other-hash', u), false)
  assert.equal(checkUnlock(o.keyHash, u.replace(/.$/, 'x')), false)
})

test('API /api/my — 열쇠로 내 주문, PIN 이 있으면 unlock 뒤에만', () => {
  const o = order('0912345678'); const key = o._issuedKey
  let r = call(myHandler, { query: { k: key } })
  assert.equal(r.statusCode, 200); assert.equal(r.body.orders.length, 1); assert.equal(r.body.customer.verified, false)
  assert.ok(!('procurement' in r.body.orders[0]) && !JSON.stringify(r.body).includes('costUsd'), '고객용 뷰만')
  assert.equal(call(myHandler, { query: { k: 'nope' } }).statusCode, 404)
  setPin(findByPhone('0912345678').id, '7777')
  r = call(myHandler, { query: { k: key } }); assert.equal(r.statusCode, 403); assert.equal(r.body.pinRequired, true)
  assert.equal(call(unlockHandler, { method: 'POST', body: { k: key, pin: '0000' } }).statusCode, 403)
  const ok = call(unlockHandler, { method: 'POST', body: { k: key, pin: '7777' } })
  assert.equal(ok.statusCode, 200); assert.ok(ok.body.unlock); assert.equal(ok.body.orders.length, 1)
  assert.equal(call(myHandler, { query: { k: key, u: ok.body.unlock } }).statusCode, 200)
})

test('API /api/my/recover — 같은 곳에서 5분에 5번, 성공하면 확인된 열쇠', () => {
  const o = order('0912345678'); confirmPayment(o.id, { confirmedBy: 'admin' })
  const ip = `10.9.9.${++ipSeq}`
  const hit = (body) => { const res = { statusCode: 0, body: null, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this }, json(x) { this.body = x; return this } }; recoverHandler({ method: 'POST', body, headers: { 'x-forwarded-for': ip }, socket: {} }, res); return res }
  for (let i = 0; i < 5; i++) assert.equal(hit({ phone: '0912345678', orderNo: 'HN0000000000' }).statusCode, 404)
  assert.equal(hit({ phone: '0912345678', orderNo: o.orderNo }).statusCode, 429, '6번째는 막힘')
  const good = call(recoverHandler, { method: 'POST', body: { phone: '0912345678', orderNo: o.orderNo } })
  assert.equal(good.statusCode, 200); assert.equal(findByKey(good.body.key).entry.verified, true)
})

test('운영자 — 고객 목록은 전화번호별로 묶이고, 개인 링크 발급·무효가 된다', () => {
  const a = order('0912345678'); order('0912-345-678'); confirmPayment(a.id, { confirmedBy: 'admin' })
  order('0987654321', { marketing: true })
  const rows = listCustomers(listOrders())
  assert.equal(rows.length, 2)
  const mai = rows.find((r) => r.phone.replace(/\D/g, '') === '0912345678')
  assert.equal(mai.orderCount, 2); assert.equal(mai.paidCount, 1); assert.ok(mai.totalKrw > 0)
  assert.equal(rows.find((r) => r.phone === '0987654321').marketing.agreed, true, '선택 동의가 기록됩니다')
  const issued = call(adminHandler, { method: 'POST', body: { action: 'issueLink', phone: '0912345678', base: 'https://example.com' } })
  assert.equal(issued.statusCode, 200); assert.ok(issued.body.url.startsWith('https://example.com/my?k='))
  assert.equal(findByKey(issued.body.key).entry.verified, true, '운영자 발급은 확인된 열쇠')
  assert.equal(call(adminHandler, { method: 'POST', body: { action: 'revoke', phone: '0912345678' } }).statusCode, 200)
  assert.equal(findByKey(issued.body.key), null, '무효화되면 못 엽니다')
  assert.equal(call(adminHandler, {}).body.customers.length, 2)
})

test('고객 CSV — 동의 고객만 거르고, 엑셀 수식 주입을 막는다', () => {
  order('0912345678', { marketing: true }); order('0987654321')
  const rows = listCustomers(listOrders())
  const csv = toCustomersCsv(rows.filter((r) => r.marketing.agreed))
  assert.ok(csv.includes('0912345678') && !csv.includes('0987654321'))
  assert.equal(escapeCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
  assert.equal(escapeCsv('+84 912'), "'+84 912")
})
