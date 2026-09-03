import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, startPurchase, recordPurchase, recordWeighing, _reset,
} from '../lib/order/store.js'
import exportHandler, { toOrdersCsv, COLUMNS } from '../pages/api/admin/orders-export.js'
import { ALL_CONSENTS } from './helpers/consents.js'

function mockRes() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v },
    status(c) { this.statusCode = c; return this },
    json(o) { this.body = o; return this },
    send(o) { this.body = o; return this },
  }
}
const call = (method, query = {}) => {
  const res = mockRes()
  exportHandler({ method, headers: {}, query }, res)
  return res
}

test.beforeEach(() => _reset())

test('주문 엑셀: 구매대행 행에 쿠팡 주문번호·실측 무게가 담긴다', () => {
  let o = createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '1', productName: '수분크림 100ml', productPrice: 27600, quantity: 2 }],
    zone: 'hanoi', track: 'agent',
    customer: { name: 'Mai', phone: '0912 345 678', address: 'Ba Đình, Hà Nội', email: 'mai@x.vn' },
  })
  o = confirmPayment(o.id, { confirmedBy: 'op' })
  o = startPurchase(o.id, 'op')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-77', amountKrw: 50000 })
  o = recordWeighing(o.id, { actualWeightG: 1234 })

  const csv = toOrdersCsv([o])
  assert.ok(csv.startsWith('﻿'), '엑셀 한글 호환용 BOM 이 있어야 합니다')
  const [header, line] = csv.replace('﻿', '').trim().split('\r\n')
  assert.equal(header.split(',').length, COLUMNS.length)
  assert.ok(line.includes(o.orderNo))
  assert.ok(line.includes('구매대행'))
  assert.ok(line.includes('CP-77'), '매입 쿠팡 주문번호가 나와야 합니다')
  assert.ok(line.includes('1.23'), '실측 무게(kg)가 나와야 합니다')
  assert.ok(line.includes('"Ba Đình, Hà Nội"'), '쉼표 든 주소는 따옴표로 감싸야 합니다')
})

test('주문 엑셀: 배송대행 행은 고객이 연결한 쿠팡 주문번호를 쓴다', () => {
  const o = createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '2', productName: '선크림 50ml', productPrice: 15000, quantity: 1 }],
    zone: 'hanoi', track: 'forwarding',
    customer: { name: 'Linh', phone: '09', address: 'Hà Nội' },
    coupangOrderNo: '12345678901234',
  })
  const line = toOrdersCsv([o]).split('\r\n')[1]
  assert.ok(line.includes('배송대행'))
  assert.ok(line.includes('12345678901234'))
})

test('주문 엑셀 API: 전체 CSV, 상태 필터, 빈 목록 404, POST 405', () => {
  const a = createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '1', productName: 'A', productPrice: 30000, quantity: 1 }],
    zone: 'hanoi', track: 'agent', customer: { name: 'A', phone: '1', address: 'x' },
  })
  confirmPayment(a.id, { confirmedBy: 'op' })
  const b = createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '2', productName: 'B', productPrice: 30000, quantity: 1 }],
    zone: 'hanoi', track: 'agent', customer: { name: 'B', phone: '2', address: 'y' },
  })

  const all = call('GET')
  assert.equal(all.statusCode, 200)
  assert.ok(all.headers['Content-Type'].includes('text/csv'))
  assert.ok(all.body.includes(a.orderNo) && all.body.includes(b.orderNo))

  const paidOnly = call('GET', { state: 'PAID' })
  assert.ok(paidOnly.body.includes(a.orderNo) && !paidOnly.body.includes(b.orderNo))

  assert.equal(call('GET', { state: 'SHIPPED' }).statusCode, 404)
  assert.equal(call('POST').statusCode, 405)
})

test('구매대행 접수 한도: 초과 주문은 생성 자체가 거절된다', () => {
  assert.throws(
    () => createOrder({ consents: ALL_CONSENTS,
      items: [{ productId: '1', productName: '수분크림 50ml', productPrice: 550000, quantity: 2 }],
      zone: 'hanoi', track: 'agent', customer: { name: 'A', phone: '1', address: 'HN' },
    }),
    /나눠서 신청/,
  )
  // 배송대행은 상품값을 받지 않으므로 같은 금액이어도 접수됩니다.
  const fw = createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '1', productName: '수분크림 50ml', productPrice: 550000, quantity: 2 }],
    zone: 'hanoi', track: 'forwarding', customer: { name: 'A', phone: '1', address: 'HN' },
  })
  assert.ok(fw.orderNo)
})
