/**
 * 백그라운드(service-worker) openCheckout — 진짜 코드를 실행해서 지킵니다
 *
 * 문자열 검사만으로는 `await` 하나가 빠져 모든 [주문서] 가 "연결 안 됨" 이
 * 되는 것을 못 잡습니다 (검토 26-09-04). 그래서 service-worker.js 를 그대로
 * 불러 chrome API 만 흉내 내고, 메시지를 보내 결과를 봅니다.
 *
 * 지키는 것
 *   · 탭을 열기 전에 서버를 찔러보고, 죽어 있으면 탭을 열지 않는다
 *   · 그때 고객에게는 쉬운 말, 운영자(토큰 있음)에게는 고칠 방법
 *   · 실린 상품(items)이 최우선 — 배송만은 구매대행 상품을 걸러내고,
 *     구매대행은 실린 것만 연다 (견적함 통째로 바꾸지 않는다)
 *   · 결제 후 경로는 쿠팡 주문번호를 주소에 싣는다
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const SRC = readFileSync(new URL('../extension/src/background/service-worker.js', import.meta.url), 'utf8')

/** chrome 을 흉내 내고 service-worker.js 를 실행해 메시지 함수를 돌려줍니다 */
function boot({ serverUp = true, storage = {} } = {}) {
  const store = { ...storage }
  const tabs = []
  let listener = null
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(fn) { listener = fn } },
      getManifest: () => ({ version: 't' }),
    },
    storage: { local: {
      get: (keys, cb) => {
        const ks = Array.isArray(keys) ? keys : [keys]
        cb(Object.fromEntries(ks.map((k) => [k, store[k]])))
      },
      set: (obj, cb) => { Object.assign(store, obj); cb?.() },
    } },
    tabs: { create: async (o) => { tabs.push(o.url) } },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  }
  const fetched = []
  const fetch = async (url) => {
    fetched.push(String(url))
    if (!serverUp) throw new TypeError('Failed to fetch')
    // 진짜 서버처럼: 살아 있는 길만 200, 나머지는 404 — 찔러보는 주소가 틀리면 여기서 잡힙니다.
    if (String(url) !== 'http://localhost:3000/api/extension/config') return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({}) }
  }
  const ctx = vm.createContext({ chrome, fetch, console, setTimeout, clearTimeout, AbortController, URL, Date, encodeURIComponent, JSON })
  vm.runInContext(SRC, ctx)
  assert.ok(listener, 'onMessage 리스너가 등록돼야 합니다')
  // 크롬 MV3 규칙: 비동기로 답하려면 리스너가 true 를 돌려줘야 합니다.
  // 안 그러면 포트가 닫혀 모든 응답이 undefined 가 되고, 팝업은 "열지 못했습니다" 만 봅니다.
  const ask = (msg) => new Promise((resolve, reject) => {
    const keep = listener(msg, {}, resolve)
    if (keep !== true) reject(new Error('onMessage 리스너는 비동기 응답을 위해 true 를 돌려줘야 합니다'))
  })
  return { ask, tabs, store, fetched }
}

const itemsOf = (url) => JSON.parse(decodeURIComponent(new URL(url).searchParams.get('cart'))).items
const F = { productId: 'f', productName: '배송만 상품', productPrice: 1000, quantity: 1, track: 'forwarding' }
const A = { productId: 'a', productName: '구매까지 상품', productPrice: 2000, quantity: 1, track: 'agent' }

test('서버가 살아 있으면 실린 구매까지 상품만으로 신청서를 연다', async () => {
  const { ask, tabs, fetched } = boot()
  const res = await ask({ type: 'openCheckout', payload: { track: 'agent', items: [A] } })
  assert.equal(res.ok, true)
  assert.deepEqual(fetched, ['http://localhost:3000/api/extension/config'], '살아 있는지 확인하는 주소')
  assert.equal(tabs.length, 1, '탭 하나')
  assert.match(tabs[0], /\/checkout\?cart=/)
  assert.deepEqual(itemsOf(tabs[0]).map((i) => [i.productName, i.track]), [['구매까지 상품', 'agent']])
})

test('서버가 죽어 있으면 탭을 열지 않고, 고객에게는 쉬운 말로 알린다', async () => {
  const { ask, tabs } = boot({ serverUp: false })
  const res = await ask({ type: 'openCheckout', payload: { track: 'agent', items: [A] } })
  assert.equal(res.ok, false)
  assert.equal(tabs.length, 0, '죽은 서버로 탭을 열면 크롬의 "연결할 수 없음" 이 뜹니다')
  assert.ok(res.error.includes('잠시 후 다시 눌러 주세요'), `고객 문구: ${res.error}`)
  assert.ok(!res.error.includes('start-server') && !res.error.includes('localhost'),
    '고객에게 서버 주소·명령어를 보여주지 않습니다')
})

test('운영자 브라우저(토큰 있음)에는 고칠 방법을 알려준다', async () => {
  const { ask } = boot({ serverUp: false, storage: { adminToken: 'x' } })
  const res = await ask({ type: 'openCheckout', payload: { track: 'agent', items: [A] } })
  assert.equal(res.ok, false)
  assert.ok(res.error.includes('start-server'), `운영자 문구: ${res.error}`)
})

test('배송만: 견적함에서 구매까지 상품을 걸러내고 쿠팡 주문번호를 싣는다', async () => {
  const { ask, tabs } = boot({ storage: { cart: [F, A] } })
  const res = await ask({ type: 'openCheckout', payload: { track: 'forwarding', coupangOrderNo: '1788621755836' } })
  assert.equal(res.ok, true)
  const u = new URL(tabs[0])
  assert.equal(u.searchParams.get('coupang'), '1788621755836', '결제 후 경로는 주문번호가 증거입니다')
  assert.deepEqual(itemsOf(tabs[0]).map((i) => i.productName), ['배송만 상품'])
})

test('배송만 상품이 하나도 없으면 열지 않고, 실제 버튼 이름으로 이유를 준다', async () => {
  const { ask, tabs } = boot({ storage: { cart: [A] } })
  const res = await ask({ type: 'openCheckout', payload: { track: 'forwarding' } })
  assert.equal(res.ok, false)
  assert.equal(tabs.length, 0)
  assert.ok(res.error.includes('[담아두기]'), `없는 버튼 이름([견적함에 담기])을 말하면 안 됩니다: ${res.error}`)
})

test('결제 후 경로에 실린 배송만 상품이 초안보다 우선한다', async () => {
  // 팝업이 보여준 상품과 다른 최근 결제창 초안이 주문번호에 붙으면 안 됩니다.
  const { ask, tabs } = boot({ storage: { cart: [F], checkoutDraft: [{ ...F, productName: '다른 초안 상품' }], checkoutDraftAt: Date.now() } })
  await ask({ type: 'openCheckout', payload: { track: 'forwarding', coupangOrderNo: '1788621755836', items: [F] } })
  assert.deepEqual(itemsOf(tabs[0]).map((i) => i.productName), ['배송만 상품'])
})

test('구매까지에 실린 상품은 견적함이 아니라 실린 것 그대로 (초안·견적함 무시)', async () => {
  // 팝업이 보여주고 계산한 상품과 신청서의 상품이 달라지면 안 됩니다.
  const { ask, tabs } = boot({ storage: { cart: [F, A], checkoutDraft: [F], checkoutDraftAt: Date.now() } })
  await ask({ type: 'openCheckout', payload: { track: 'agent', items: [A] } })
  assert.deepEqual(itemsOf(tabs[0]).map((i) => i.productName), ['구매까지 상품'])
})
