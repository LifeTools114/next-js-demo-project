import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrder, confirmPayment, startPurchase, recordPurchase, recordWeighing,
  getOrder, _reset,
} from '../lib/order/store.js'
import { manifestRow, toManifestCsv } from '../lib/manifest.js'
import { MANIFEST } from '../config/manifest.js'
import manifestHandler from '../pages/api/admin/manifest.js'
import { ALL_CONSENTS } from './helpers/consents.js'

const settledOrder = (name = 'Mai') => {
  let o = createOrder({ consents: ALL_CONSENTS,
    items: [{ productId: '1', productName: '수분크림, "특별판" 100ml', productPrice: 27600, quantity: 2 }],
    zone: 'hanoi', track: 'agent',
    customer: { name, phone: '0912', address: 'Ba Đình, Hà Nội' },
  })
  o = confirmPayment(o.id, { confirmedBy: 'op' })
  o = startPurchase(o.id, 'op')
  o = recordPurchase(o.id, { coupangOrderNo: 'CP-77', amountKrw: 50000 })
  o = recordWeighing(o.id, { actualWeightG: o.quote.weight.chargeableG }) // 허용오차 이내 → SETTLED
  assert.equal(o.state, 'SETTLED')
  return o
}

function mockRes() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v },
    status(c) { this.statusCode = c; return this },
    json(o) { this.body = o; return this },
    send(o) { this.body = o; return this },
  }
}
const call = (method, { query = {}, body } = {}) => {
  const res = mockRes()
  manifestHandler({ method, headers: {}, query, body }, res)
  return res
}

test.beforeEach(() => _reset())

test('매니페스트: 실측 무게·신고가치·품목이 행에 담긴다', () => {
  const o = settledOrder()
  const row = manifestRow(o, 0)
  assert.equal(row.orderNo, o.orderNo)
  assert.equal(row.quantity, 2)
  assert.equal(row.weightKg, (o.procurement.actualWeightG / 1000).toFixed(2))
  // 신고가치는 동결 환율 기준 상품가 합계
  assert.equal(row.declaredUsd, (27600 * 2 / o.fx.usdToKrw).toFixed(2))
  assert.ok(row.items.includes('x2'))
})

test('매니페스트 CSV: BOM·헤더·따옴표 이스케이프가 올바르다', () => {
  const o = settledOrder()
  const csv = toManifestCsv([o])
  assert.ok(csv.startsWith('﻿'), '엑셀 한글 호환용 BOM 이 있어야 합니다')
  const [header, line] = csv.replace('﻿', '').trim().split('\r\n')
  assert.equal(header.split(',').length, MANIFEST.columns.length)
  // 상품명의 쉼표·따옴표가 셀 하나로 유지돼야 합니다
  assert.ok(line.includes('"수분크림, ""특별판"" 100ml x2"'))
})

test('매니페스트 API: SETTLED 전체 CSV → 마스터 AWB 일괄 발송', () => {
  const a = settledOrder('Mai')
  const b = settledOrder('Linh')

  const csv = call('GET')
  assert.equal(csv.statusCode, 200)
  assert.ok(csv.headers['Content-Type'].includes('text/csv'))
  assert.ok(csv.body.includes(a.orderNo) && csv.body.includes(b.orderNo))

  const ship = call('POST', { body: { ids: [a.id, b.id], masterAwb: 'HAN-260901-01' } })
  assert.equal(ship.statusCode, 200)
  assert.deepEqual(ship.body.shipped.sort(), [a.orderNo, b.orderNo].sort())
  assert.equal(getOrder(a.id).state, 'SHIPPED')
  assert.equal(getOrder(a.id).delivery.trackingNo, 'HAN-260901-01')

  // 이미 발송된 주문을 다시 보내면 실패 목록으로 남는다
  const again = call('POST', { body: { ids: [a.id], masterAwb: 'HAN-2' } })
  assert.equal(again.statusCode, 409)
  assert.equal(again.body.failed.length, 1)
})

test('매니페스트 API: 발송 준비가 없으면 404, AWB 없으면 400', () => {
  assert.equal(call('GET').statusCode, 404)
  const o = settledOrder()
  assert.equal(call('POST', { body: { ids: [o.id] } }).statusCode, 400)
})
