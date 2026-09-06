/**
 * 주문번호만 아는 사람은 진행 상태만 — 이름·전화·주소·상품·취소·견적서는
 * 신청한 브라우저(열쇠)·개인 링크·운영자만 (운영자 26-09-06).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, confirmPayment, _reset } from '../lib/order/store.js'
import { _resetCustomers } from '../lib/customer/store.js'
import { orderAccess, publicView, myKeyFrom } from '../lib/order/access.js'
import { maskName, maskPhone } from '../lib/mask.js'
import getHandler from '../pages/api/orders/[id]/index.js'
import cancelHandler from '../pages/api/orders/[id]/cancel.js'
import linkHandler from '../pages/api/orders/[id]/link-coupang.js'
import quoteDocHandler from '../pages/api/orders/[id]/quote-doc.js'
import { ALL_CONSENTS } from './helpers/consents.js'

const ITEMS = [{ productId: '7001', productName: '토리든 다이브인 세럼 50ml', productPrice: 19900, quantity: 1 }]
const order = (phone = '0912345678', extra = {}) =>
  createOrder({ consents: ALL_CONSENTS, items: ITEMS, zone: 'hanoi', track: 'forwarding',
    customer: { name: '박승우', phone, address: 'Số 1 Hoàn Kiếm, Hà Nội' }, ...extra })

const call = (handler, { method = 'GET', query = {}, body = {}, headers = {} } = {}) => {
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this }, json(o) { this.body = o; return this } }
  handler({ method, query, body, headers: { 'x-forwarded-for': '10.0.0.9', ...headers }, socket: {} }, res)
  return res
}

test.beforeEach(() => { _reset(); _resetCustomers(); delete process.env.ADMIN_TOKEN })

test('마스킹 — 첫 글자만, 전화는 가운데를 가림', () => {
  assert.equal(maskName('박승우'), '박**')
  assert.equal(maskName('Nguyễn Thị Mai'), 'N***')
  assert.equal(maskName(''), '')
  assert.equal(maskPhone('0912345678'), '091****5678')
})

test('접근 판정 — 주문번호만이면 public, 열쇠면 owner, 운영자 토큰이면 admin', () => {
  const o = order(); const key = o._issuedKey
  assert.ok(key, '새 고객은 열쇠를 받습니다')
  assert.equal(orderAccess({ headers: {}, query: {} }, o), 'public')
  assert.equal(orderAccess({ headers: { 'x-my-key': key }, query: {} }, o), 'owner')
  assert.equal(orderAccess({ headers: {}, query: { k: key } }, o), 'owner', '?k= 로도 됩니다')
  assert.equal(orderAccess({ headers: { 'x-my-key': 'x'.repeat(40) }, query: {} }, o), 'public', '엉뚱한 열쇠는 공개 수준')
  process.env.ADMIN_TOKEN = 'tok-abc'
  assert.equal(orderAccess({ headers: { 'x-admin-token': 'tok-abc' }, query: {} }, o), 'admin')
  assert.equal(myKeyFrom({ headers: { 'x-my-key': ['a'.repeat(20)] }, query: {} }), 'a'.repeat(20))
})

test('남의 열쇠로는 남의 주문이 열리지 않습니다 (입금 확인 뒤 같은 전화번호만)', () => {
  const mine = order('0912345678'); const myKey = mine._issuedKey
  const other = order('0987654321')
  assert.equal(orderAccess({ headers: { 'x-my-key': myKey }, query: {} }, other), 'public')
  // 입금 확인된 열쇠는 같은 전화번호의 다른 주문도 봅니다
  confirmPayment(mine.id, { confirmedBy: 'admin' })
  const mine2 = order('0912345678')
  assert.equal(orderAccess({ headers: { 'x-my-key': myKey }, query: {} }, mine2), 'owner')
})

test('공개 뷰 — 이름·전화 마스킹, 주소·이메일·상품명·쇼핑몰 주문번호 없음, 상태·금액은 있음', () => {
  const o = order()
  const v = publicView(o)
  assert.equal(v.customer.name, '박**')
  assert.equal(v.customer.phone, '091****5678')
  assert.equal(v.customer.address, '')
  assert.equal(v.items[0].productName, '상품 1')
  assert.equal(v.items[0].quantity, 1)
  assert.equal(v.inbound, null)
  assert.equal(v.state, o.state)
  assert.ok(v.quote.total > 0)
  assert.ok(v.forwardingGuide.addressDetail.includes('박**'), '상세주소 안내도 이름을 가립니다')
  assert.ok(!v.forwardingGuide.addressDetail.includes('박승우'))
  assert.ok(!JSON.stringify(v).includes('Hoàn Kiếm'), '주소가 어디에도 새지 않습니다')
  assert.ok(!JSON.stringify(v).includes('토리든'), '상품명이 어디에도 새지 않습니다')
})

test('GET /api/orders/:id — 열쇠 없으면 public 뷰, 열쇠 있으면 customer 뷰', () => {
  const o = order(); const key = o._issuedKey
  const pub = call(getHandler, { query: { id: o.orderNo } })
  assert.equal(pub.statusCode, 200)
  assert.equal(pub.body.view, 'public')
  assert.equal(pub.body.order.customer.address, '')
  const own = call(getHandler, { query: { id: o.orderNo }, headers: { 'x-my-key': key } })
  assert.equal(own.body.view, 'customer')
  assert.equal(own.body.order.customer.name, '박승우')
  assert.equal(own.body.order.customer.address, 'Số 1 Hoàn Kiếm, Hà Nội')
})

test('취소·쇼핑몰 주문 연결·견적서 — 주문번호만으로는 403, 열쇠가 있으면 됩니다', () => {
  const o = order(); const key = o._issuedKey
  assert.equal(call(quoteDocHandler, { query: { id: o.orderNo, kind: 'provisional' } }).statusCode, 403)
  assert.equal(call(quoteDocHandler, { query: { id: o.orderNo, kind: 'provisional' }, headers: { 'x-my-key': key } }).statusCode, 200)
  assert.equal(call(linkHandler, { method: 'POST', query: { id: o.orderNo }, body: { coupangOrderNo: '3102787036952' } }).statusCode, 403)
  const linked = call(linkHandler, { method: 'POST', query: { id: o.orderNo }, body: { coupangOrderNo: '3102787036952' }, headers: { 'x-my-key': key } })
  assert.equal(linked.statusCode, 200)
  assert.equal(call(cancelHandler, { method: 'POST', query: { id: o.orderNo }, body: {} }).statusCode, 403)
  const cancelled = call(cancelHandler, { method: 'POST', query: { id: o.orderNo }, body: {}, headers: { 'x-my-key': key } })
  assert.equal(cancelled.statusCode, 200)
  assert.equal(cancelled.body.order.state, 'CANCELLED')
})

test('운영자 토큰으로는 전부 열립니다 (운영자 브라우저에서 주문 화면·견적서)', () => {
  process.env.ADMIN_TOKEN = 'tok-abc'
  const o = order()
  const r = call(getHandler, { query: { id: o.orderNo }, headers: { 'x-admin-token': 'tok-abc' } })
  assert.equal(r.body.view, 'admin')
  assert.equal(call(quoteDocHandler, { query: { id: o.orderNo }, headers: { 'x-admin-token': 'tok-abc' } }).statusCode, 200)
})
