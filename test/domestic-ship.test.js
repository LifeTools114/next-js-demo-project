/**
 * 국내 배송비 규정 (쿠팡 판매자 → 한국 창고)
 *
 * 왜 생겼나 (26-09-06 사장님 화면 → "규정 넣어주세요")
 *   카라티 화면에 "배송비 3,000원" 이 찍혀 있는데 견적에 없었습니다.
 *   구매대행은 **저희가 쿠팡에 결제**하므로 이 돈도 저희가 냅니다 —
 *   주문마다 3,000원씩 빠지고 있었습니다.
 *
 * 규정
 *   ① 구매대행에서만 청구 (배송만은 고객이 쿠팡에 직접 냅니다)
 *   ② 판매자마다 한 번 — 개수만큼 곱하지 않습니다
 *   ③ "같은 판매자 상품 N원 이상 무료" 는 그 판매자 상품 합계로 판정
 *   ④ 못 읽었으면 청구하지 않습니다 (모르면 안 받습니다)
 *   ⑤ 판매자를 모르면 그 줄은 따로 셉니다
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { domesticShipping } from '../lib/pricing/domestic.js'
import { quote } from '../lib/pricing/landed.js'
import { normalizeOrderItem } from '../lib/order/normalize-items.js'
import { FEES } from '../config/fees.js'

const tee = (over = {}) => ({
  productName: '반팔 카라티', productPrice: 21800, quantity: 1,
  domesticShipKrw: 3000, freeShipOverKrw: 30000, seller: '마이티', ...over,
})

/* ─────────── 규정 ─────────── */

test('① 배송만에는 걷지 않는다 — 고객이 쿠팡에 직접 냅니다', () => {
  assert.equal(domesticShipping([tee()], 'forwarding').krw, 0)
  assert.equal(domesticShipping([tee()], 'agent').krw, 3000)
})

test('② 판매자마다 한 번 — 개수만큼 곱하지 않는다', () => {
  // 같은 판매자 상품 3줄, 무료 조건은 아직 미달(합계 27,000원)
  const items = [
    { productPrice: 9000, quantity: 1, domesticShipKrw: 3000, freeShipOverKrw: 30000, seller: '마이티' },
    { productPrice: 9000, quantity: 1, domesticShipKrw: 3000, freeShipOverKrw: 30000, seller: '마이티' },
    { productPrice: 9000, quantity: 1, domesticShipKrw: 3000, freeShipOverKrw: 30000, seller: '마이티' },
  ]
  const r = domesticShipping(items, 'agent')
  assert.equal(r.krw, 3000, '9,000원씩 3줄이어도 배송비는 한 번입니다')
  assert.equal(r.rows.length, 1)
  // 수량이 여러 개인 것도 마찬가지
  assert.equal(domesticShipping([tee({ productPrice: 9000, quantity: 3 })], 'agent').krw, 3000)
})

test('③ 무료 조건은 그 판매자 상품 합계로 판정한다', () => {
  // 21,800 × 2 = 43,600 ≥ 30,000 → 무료
  const waived = domesticShipping([tee({ quantity: 2 })], 'agent')
  assert.equal(waived.krw, 0)
  assert.deepEqual(waived.waived.map((w) => [w.seller, w.goodsKrw, w.feeKrw]), [['마이티', 43600, 3000]])
  // 21,800 × 1 < 30,000 → 청구
  assert.equal(domesticShipping([tee()], 'agent').krw, 3000)
  // 다른 판매자 상품을 아무리 담아도 이 판매자의 무료 조건은 채워지지 않습니다.
  const mixed = [tee(), { productPrice: 500000, quantity: 1, seller: '다른가게' }]
  assert.equal(domesticShipping(mixed, 'agent').krw, 3000)
})

test('④ 못 읽었으면 청구하지 않는다 — 모르면 안 받습니다', () => {
  const r = domesticShipping([{ productPrice: 21800, quantity: 1 }], 'agent')
  assert.equal(r.krw, 0)
  assert.equal(r.known, false, '못 읽은 것과 0원인 것은 구분되어야 합니다')
  // 짐작으로 걷는 기본값을 두면 무료배송 상품에도 붙습니다.
  assert.equal(FEES.domesticShip.fallbackKrw, 0, '기본값은 0 이어야 합니다')
})

test('⑤ 판매자를 모르면 줄마다 따로 센다 (묶어서 깎아주면 우리 손해)', () => {
  const items = [
    { productPrice: 9000, quantity: 1, domesticShipKrw: 3000 },
    { productPrice: 9000, quantity: 1, domesticShipKrw: 2500 },
  ]
  assert.equal(domesticShipping(items, 'agent').krw, 5500)
})

test('이상한 값은 막는다', () => {
  assert.equal(domesticShipping([tee({ domesticShipKrw: -5000, freeShipOverKrw: 0 })], 'agent').krw, 0)
  // 잘못 읽은 큰 값 — 국내 택배가 100만원일 수 없습니다.
  const huge = domesticShipping([tee({ domesticShipKrw: 1_000_000, freeShipOverKrw: 0 })], 'agent')
  assert.equal(huge.krw, FEES.domesticShip.maxKrw)
})

/* ─────────── 견적에 실제로 반영되는가 ─────────── */

test('구매대행 총액에 들어가고, 배송만 총액은 그대로다', () => {
  const one = [tee()]
  const fwd = quote(one, { track: 'forwarding' })
  const agent = quote(one, { track: 'agent' })
  assert.equal(fwd.domestic.krw, 0)
  assert.equal(agent.domestic.krw, 3000)

  const row = agent.breakdown.find((r) => r.key === 'domestic')
  assert.ok(row, '내역에 국내 배송비 줄이 보여야 합니다 — 모르는 돈을 받으면 안 됩니다')
  assert.equal(row.krw, 3000)
  assert.ok(row.label.includes('국내 배송비'))

  // 총액 차이는 정확히 배송비만큼입니다.
  const free = quote([tee({ domesticShipKrw: 0 })], { track: 'agent' })
  assert.equal(agent.total - free.total, 3000)
  // 배송만은 한 푼도 달라지지 않습니다.
  assert.equal(quote([tee({ domesticShipKrw: 0 })], { track: 'forwarding' }).total, fwd.total)
})

test('무료 조건을 넘으면 줄이 사라진다', () => {
  const q = quote([tee({ quantity: 2 })], { track: 'agent' })
  assert.equal(q.domestic.krw, 0)
  assert.equal(q.breakdown.find((r) => r.key === 'domestic'), undefined)
  assert.equal(q.domestic.waived.length, 1, '왜 안 받았는지는 남겨 둡니다')
})

test('수수료는 상품가 기준 — 배송비에는 수수료를 붙이지 않는다', () => {
  const withShip = quote([tee()], { track: 'agent' })
  const without = quote([tee({ domesticShipKrw: 0 })], { track: 'agent' })
  assert.equal(withShip.agency.fee, without.agency.fee)
})

/* ─────────── 값이 서버까지 살아서 가는가 ─────────── */

test('서버 정규화가 배송비 정보를 버리지 않는다 (패널 금액 = 신청서 금액)', () => {
  const n = normalizeOrderItem(tee())
  assert.equal(n.domesticShipKrw, 3000)
  assert.equal(n.freeShipOverKrw, 30000)
  assert.equal(n.seller, '마이티')
  // 클라이언트 입력이므로 범위는 강제합니다.
  assert.equal(normalizeOrderItem({ domesticShipKrw: 9_999_999 }).domesticShipKrw, 50_000)
  assert.equal(normalizeOrderItem({ domesticShipKrw: -1 }).domesticShipKrw, 0)
})

test('확장 백그라운드도 버리지 않는다', () => {
  const sw = readFileSync(new URL('../extension/src/background/service-worker.js', import.meta.url), 'utf8')
  const fn = sw.slice(sw.indexOf('function sanitizeItems'), sw.indexOf('function sanitizeItems') + 900)
  for (const k of ['domesticShipKrw', 'freeShipOverKrw', 'seller']) {
    assert.ok(fn.includes(k), `sanitizeItems 가 ${k} 를 버리면 신청서 금액이 패널보다 쌉니다`)
  }
})

await import('../extension/src/content/extract.js')
const E = globalThis.KBExtract

/** 쿠팡 상품 화면의 글만 있는 가짜 화면 — 배송비 문구는 본문 글에서 읽습니다 */
const readPage = (body) => {
  const prevDoc = globalThis.document
  const prevLoc = globalThis.location
  globalThis.document = {
    body: { innerText: body },
    querySelector: (sel) =>
      (sel.includes('prod-buy-header') ? { textContent: '반팔 카라티' }
        : sel.includes('total-price') ? { textContent: '21,800원' }
          : null),
    querySelectorAll: () => [],
  }
  globalThis.location = { pathname: '/vp/products/1', search: '', href: 'https://www.coupang.com/vp/products/1' }
  try { return E.extractProduct() } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc
    if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc
  }
}

test('상품 화면에서 배송비·무료 조건·판매자를 읽는다', () => {
  const p = readPage([
    '31% 31,600원', '21,800원', '배송비 3,000원',
    '같은 판매자 상품 30,000원 이상 구매 시 무료배송',
    '수요일 9/9 도착 예정',
    '판매자: 마이티 판매자 상품 보러가기',
    '판매자 평가 94% (18)',
    '장바구니 담기 바로구매',
    // 아래는 추천 상품 — 이 상품의 배송비가 아닙니다.
    '추천 이런건 어때요? 배송비 9,900원 판매자: 딴가게',
  ].join('\n'))
  assert.equal(p.ok, true)
  assert.equal(p.domesticShipKrw, 3000)
  assert.equal(p.freeShipOverKrw, 30000)
  assert.equal(p.seller, '마이티', '같은 줄의 버튼 글자는 잘라내야 합니다')
})

test('구매 버튼 아래(추천 상품)의 배송비는 읽지 않는다', () => {
  const p = readPage('21,800원\n장바구니 담기\n추천 상품 배송비 9,900원')
  assert.equal(p.domesticShipKrw, 0, '다른 상품의 배송비를 물리면 안 됩니다')
})

test('도서산간 추가배송비·반품배송비는 기본 배송비가 아니다', () => {
  assert.equal(readPage('21,800원\n무료배송\n제주도서산간 추가배송비 5,000원\n장바구니 담기').domesticShipKrw, 0)
  assert.equal(readPage('21,800원\n반품배송비 6,000원\n장바구니 담기').domesticShipKrw, 0)
  assert.equal(readPage('21,800원\n배송비 2,500원\n반품배송비 6,000원\n장바구니 담기').domesticShipKrw, 2500)
})
