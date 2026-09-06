import test from 'node:test'
import assert from 'node:assert/strict'
import { ocrImage } from '../lib/ocr.js'

const runnerWith = (text) => async () => text

test('ocrImage — 임시 파일로 읽고 파싱 결과를 돌려주며, 아무것도 못 읽으면 ok:false', async () => {
  const r = await ocrImage(Buffer.from('fake-png'), 'image/png', { runner: runnerWith('로켓배송\n분유 360g, 2개\n★ 12,345개 상품평\n31,800원\n옵션: 360g, 2개') })
  assert.equal(r.ok, true); assert.equal(r.productPrice, 31800); assert.equal(r.productName, '분유 360g, 2개'); assert.equal(r.option, '360g, 2개')
  const none = await ocrImage(Buffer.from('x'), 'image/jpeg', { runner: runnerWith('ㅋㅋ\n---') })
  assert.equal(none.ok, false); assert.equal(none.reason, 'nothing-read')
})

test('ocrImage — 빈 이미지·너무 큰 이미지·tesseract 없음', async () => {
  assert.equal((await ocrImage(Buffer.alloc(0))).reason, 'empty')
  assert.equal((await ocrImage(Buffer.alloc(9 * 1024 * 1024))).reason, 'too-large')
  const missing = await ocrImage(Buffer.from('x'), 'image/png', { runner: async () => { const e = new Error('spawn tesseract ENOENT'); throw e } })
  assert.equal(missing.reason, 'ocr-not-installed')
})
