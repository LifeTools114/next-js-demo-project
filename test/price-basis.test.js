/**
 * "얼마짜리로 계산하는가" — 화면에 보이는 값이 기준입니다
 *
 * 왜 생겼나 (26-09-06, 사장님 화면)
 *
 *   카라티(남녀공용 18컬러 S-5L 빅사이즈). 화면 가격 21,800원, 수량 2.
 *   그런데 패널은 10,900원짜리로 계산했습니다. 쿠팡의 상품 정보(JSON-LD)에
 *   담긴 값이 **옵션 중 가장 싼 것**(AggregateOffer 의 lowPrice)이었기
 *   때문입니다. 고객이 고른 옵션은 21,800원인데 말입니다.
 *
 *   구매대행이면 우리가 21,800원을 내고 10,900원만 청구합니다 —
 *   한 벌당 10,900원, 두 벌이면 21,800원을 우리가 물어냅니다.
 *
 * 반대 방향도 똑같이 위험합니다. 로켓 상품은 수량을 올리면 화면의 큰 금액이
 * **이미 곱해진 총액**이라, 그걸 낱개 값으로 오해하고 개수를 또 곱하면
 * 청구액이 개수의 제곱으로 부풀어 오릅니다.
 *
 * 그래서 규칙은 이렇습니다.
 *   · 상품 정보가 **이 상품 하나의 확정값**(offers.price)일 때
 *       화면이 그 정수배  → 곱해진 총액. 낱개 값은 확정값, 배수가 개수.
 *       화면이 더 싸다     → 회원가·할인. 총액은 낱개보다 작을 수 없으니 확실합니다.
 *       화면이 더 비싼데 배수가 아니다 → 할인 섞인 총액일 수 있어 확정값을 지킵니다.
 *   · 상품 정보가 **옵션 묶음의 최저가**일 때 → 화면 값이 고른 옵션의 값입니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { quote } from '../lib/pricing/landed.js'
import { FEES } from '../config/fees.js'

await import('../extension/src/content/extract.js')
const E = globalThis.KBExtract

/* ─────────── 가짜 화면 ─────────── */

const el = (over = {}) => ({
  tagName: 'SPAN', type: 'text', value: '', id: '', className: '', textContent: '', children: [],
  attrs: {},
  getAttribute(k) { return this.attrs[k] ?? null },
  getBoundingClientRect() { return this.rect ?? { top: 150, bottom: 180, left: 720, right: 800, width: 80, height: 30 } },
  closest: () => null,
  previousElementSibling: null, nextElementSibling: null, parentElement: null,
  ...over,
})
/** 값이 적힌 금액 글씨 — 글자 크기와 취소선까지 흉내 냅니다 */
const price = (text, { size = 24, deco = 'none', rect } = {}) =>
  el({ tagName: 'STRONG', textContent: text, style: { fontSize: `${size}px`, textDecoration: deco }, rect })
const BUY = el({
  tagName: 'BUTTON', textContent: '장바구니 담기',
  rect: { top: 690, bottom: 730, left: 815, right: 1385, width: 570, height: 40 },
})

const run = (nodes, { ld = null, single = {} } = {}) => {
  const all = [...nodes]
  if (ld) all.unshift(el({ tagName: 'SCRIPT', textContent: JSON.stringify({ '@type': 'Product', name: '테스트 상품', ...ld }) }))
  const prevDoc = globalThis.document
  const prevLoc = globalThis.location
  globalThis.document = {
    querySelector: (sel) => single[sel] ?? null,
    querySelectorAll: (sel) => (sel.includes('aria-checked')
      ? all.filter((x) => x.attrs?.['aria-checked'] === 'true')
      : all.filter((x) => new RegExp(`(^|[^a-z-])${x.tagName.toLowerCase()}([^a-z-]|$)`).test(sel.toLowerCase()))),
  }
  globalThis.location = { pathname: '/vp/products/7412573396', search: '', href: 'https://www.coupang.com/vp/products/7412573396' }
  try { return E.extractProduct() } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc
    if (prevLoc === undefined) delete globalThis.location; else globalThis.location = prevLoc
  }
}

/* ─────────── 사장님 화면 그대로 ─────────── */

test('옵션 묶음의 최저가가 아니라 화면에 보이는 값으로 계산한다 (카라티 10,900 → 21,800)', () => {
  const p = run(
    [price('21,800원'), price('31,600원', { size: 15, deco: 'line-through' }), BUY,
      el({ tagName: 'INPUT', type: 'number', value: '2' })],
    { ld: { offers: { '@type': 'AggregateOffer', lowPrice: 10900, highPrice: 25800 } } },
  )
  assert.equal(p.ok, true)
  assert.equal(p.price, 21800, '고객이 화면에서 보는 값으로 계산해야 합니다')
  assert.equal(p.priceBasis, 'screen')
  assert.equal(p.catalogPrice, 10900, '쿠팡 목록값도 함께 넘겨 화면에서 밝힙니다')
  assert.equal(p.quantity, 2, '수량 칸의 2개')
  assert.deepEqual(E.safeQuantity(p), { quantity: 2, uncertain: false }, '화면 값은 낱개 값이라 곱해도 됩니다')

  // 돈으로 확인 — 구매대행은 우리가 실제로 내는 값이어야 합니다.
  const items = [{ productName: p.productName, productPrice: p.price, quantity: p.quantity }]
  const diff = quote(items, { track: 'agent' }).total - quote(items, { track: 'forwarding' }).total
  assert.equal(diff, 21800 * 2 + FEES.agencyBaseKrw, '상품값 43,600원 + 구매대행료가 들어가야 합니다')
})

test('취소선 정가와 장바구니 미리보기 금액은 상품 가격이 아니다', () => {
  const p = run(
    [
      price('31,600원', { size: 26, deco: 'line-through' }),               // 정가 — 더 크게 보여도 제외
      price('21,800원'),                                                    // 진짜 판매가
      price('137,700원', { size: 30, rect: { top: 545, bottom: 575, left: 1400, right: 1520, width: 120, height: 30 } }), // 오른쪽 장바구니 미리보기
      price('9,900원', { size: 40, rect: { top: 960, bottom: 1000, left: 740, right: 860, width: 120, height: 40 } }),    // 구매 버튼 아래 추천 상품
      BUY,
    ],
    { ld: { offers: { '@type': 'AggregateOffer', lowPrice: 10900 } } },
  )
  assert.equal(p.price, 21800)
})

/* ─────────── 반대 방향 — 곱해진 총액을 낱개 값으로 오해하지 않기 ─────────── */

test('확정값의 정수배는 곱해진 총액 — 낱개 값을 지키고 배수를 개수로 읽는다', () => {
  // 설화수 사례: 확정값 21,420원, 화면 321,300원(= × 15), 수량 칸은 못 찾음
  const p = run([price('321,300원'), BUY], { ld: { offers: { price: 21420 } } })
  assert.equal(p.price, 21420, '낱개 값은 상품 정보 쪽')
  assert.equal(p.priceBasis, 'json-ld')
  assert.deepEqual([p.quantity, p.quantityHow], [15, 'ratio'])
})

test('확정값보다 비싼데 배수가 아니면 확정값을 지킨다 (총액으로 오해하면 몇 배가 됩니다)', () => {
  const p = run([price('320,000원'), BUY, el({ tagName: 'INPUT', type: 'number', value: '15' })],
    { ld: { offers: { price: 21420 } } })
  assert.equal(p.price, 21420, '화면 값을 낱개로 오해하면 15배 과다청구가 됩니다')
  assert.equal(p.priceBasis, 'json-ld')
})

test('화면이 더 싸면 회원가 — 그대로 쓴다 (총액은 낱개보다 쌀 수 없습니다)', () => {
  const p = run([price('21,800원'), BUY], { ld: { offers: { price: 31600 } } })
  assert.deepEqual([p.price, p.priceBasis, p.catalogPrice], [21800, 'screen', 31600])
})

test('옵션 값 범위를 넘고 개수로 나누어떨어지면 나눠서 낱개 값으로 되돌린다', () => {
  // 옵션 최저 10,900 · 최고 25,800 인데 화면이 43,600원, 수량 2 → 21,800 × 2
  const p = run([price('43,600원'), BUY, el({ tagName: 'INPUT', type: 'number', value: '2' })],
    { ld: { offers: { '@type': 'AggregateOffer', lowPrice: 10900, highPrice: 25800 } } })
  assert.deepEqual([p.price, p.quantity], [21800, 2])
})

test('화면 값과 상품 정보가 같으면 아무 일도 일어나지 않는다', () => {
  const p = run([price('18,000원'), BUY], { ld: { offers: { price: 18000 } } })
  assert.deepEqual([p.price, p.priceBasis, p.catalogPrice, p.shownPrice], [18000, 'json-ld', null, null])
})

test('상품 정보가 아예 없으면 예전 그대로 — 화면 총액일 수 있어 1개로 계산한다', () => {
  const p = run([price('43,600원'), BUY, el({ tagName: 'INPUT', type: 'number', value: '2' })],
    { single: { 'h1.prod-buy-header__title': el({ tagName: 'H1', textContent: '이름만 있는 상품' }) } })
  assert.equal(p.priceBasis, 'selector')
  assert.deepEqual(E.safeQuantity(p), { quantity: 1, uncertain: true })
})

/* ─────────── 화면에 밝히기 ─────────── */

test('어느 값으로 계산했는지 패널이 밝힌다', () => {
  const panel = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  assert.ok(panel.includes("state.priceBasis === 'screen'"), '화면 값을 쓴 경우를 구분해야 합니다')
  assert.ok(panel.includes('화면 가격'), '어느 값 기준인지 적어야 합니다')
  assert.ok(panel.includes('쿠팡 목록값'), '다른 값이 있었다는 것도 보여줘야 합니다')
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  for (const k of ['priceBasis: extracted.priceBasis', 'catalogPrice: extracted.catalogPrice']) {
    assert.ok(main.includes(k), `패널 상태에 ${k}`)
  }
})
