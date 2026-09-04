/**
 * 고객에게 보이는 "말"이 흐트러지지 않게 지키는 테스트
 *
 * 화면 문구는 코드 여기저기에 흩어지기 쉽고, 한 곳만 고치면 다른 화면과
 * 어긋납니다. 확장은 config/ 를 import 할 수 없어(별도 번들) 같은 문구를
 * 손으로 복사해 두는데, 그 복사본이 낡는 것을 여기서 잡습니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRACKS, trackName, trackFormal, trackDocLabel, trackButton } from '../config/tracks.js'
import { WORDS, paired } from '../config/words.js'
import { ORDER_STATES } from '../lib/order/states.js'
import { copyText } from '../lib/copy.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('두 가지 방법의 말이 갖춰져 있다', () => {
  for (const id of ['forwarding', 'agent']) {
    const t = TRACKS[id]
    assert.equal(t.id, id)
    for (const key of ['emoji', 'name', 'line', 'who', 'formal']) {
      assert.ok(t[key], `${id}.${key} 가 있어야 합니다`)
    }
    assert.ok(Array.isArray(t.steps) && t.steps.length >= 2, `${id}.steps`)
  }
  assert.equal(trackName('forwarding'), '배송만')
  assert.equal(trackName('agent'), '구매하고 배송까지')
  assert.equal(trackFormal('agent'), '구매대행')
})

test('모르는 값이 와도 화면이 깨지지 않는다', () => {
  // 옛 주문이나 손상된 값이 들어와도 기본값으로 떨어져야 합니다.
  for (const bad of [undefined, null, '', 'nope', 123]) {
    assert.equal(trackName(bad), TRACKS.forwarding.name, `${String(bad)} → 기본값`)
    assert.ok(trackButton(bad).includes(TRACKS.forwarding.name))
  }
})

test('견적서에는 쉬운 말과 정식 용어를 함께 쓴다', () => {
  // 거래 문서라 정식 용어가 빠지면 나중에 곤란해질 수 있습니다.
  assert.equal(trackDocLabel('agent'), '구매하고 배송까지 (구매대행)')
  assert.equal(trackDocLabel('forwarding'), '배송만 (배송대행)')
  assert.equal(paired('보내기', '입금'), '보내기(입금)')
  assert.equal(paired('보내기', ''), '보내기')
})

test('확장에 적어둔 말이 config/tracks.js 와 어긋나지 않는다', () => {
  // 확장은 config 를 import 할 수 없어 문구를 복사해 둡니다 — 낡으면 여기서 걸립니다.
  const card = read('extension/src/content/order-capture.js')
  const panel = read('extension/src/content/panel.js')
  for (const src of [card, panel]) {
    assert.ok(src.includes(TRACKS.forwarding.name), `확장에 "${TRACKS.forwarding.name}" 가 있어야 합니다`)
    assert.ok(src.includes(TRACKS.agent.name), `확장에 "${TRACKS.agent.name}" 가 있어야 합니다`)
  }
})

test('고객 화면에는 업계 용어가 남아 있지 않다', () => {
  // 주석은 봐주되(개발자용), 화면에 그려지는 문자열에는 없어야 합니다.
  // 블록 주석과 줄 주석(줄 끝 주석 포함)을 걷어냅니다. URL 의 :// 는 건드리지 않게.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')

  for (const p of ['pages/index.js', 'pages/checkout.js', 'pages/send.js', 'pages/orders/[id].js']) {
    const body = stripComments(read(p))
    for (const word of ['배송대행', '구매대행']) {
      assert.ok(!body.includes(word), `${p} 에 "${word}" 가 남아 있습니다 — 쉬운 말로 바꾸세요`)
    }
  }
})

test('모든 주문 상태에 이름과 설명이 있다', () => {
  // 상태 표시는 운영자 확정(26-09-04)에 따라 기존 용어를 그대로 씁니다 —
  // '입금 대기·결제 완료'처럼 짧고 익숙한 말이 오히려 명확하다는 판단입니다.
  for (const [key, info] of Object.entries(ORDER_STATES)) {
    assert.ok(info.label, `${key}.label`)
    assert.ok(info.description, `${key}.description`)
  }
})

test('쉬운 말 사전이 갖춰져 있다', () => {
  assert.equal(WORDS.pay.action, '보내기')
  assert.equal(WORDS.pay.formal, '입금')
  for (const group of Object.values(WORDS)) {
    assert.equal(typeof group, 'object')
    for (const v of Object.values(group)) assert.equal(typeof v, 'string')
  }
})


/**
 * navigator 갈아끼우기 — Node 22 에서 globalThis.navigator 는 getter 라
 * 그냥 대입이 되지 않습니다. defineProperty 로 덮고 끝나면 되돌립니다.
 */
const setNavigator = (v) =>
  Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true })
const clearNavigator = () =>
  Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true, writable: true })

/* ─────────────── 눌러서 복사 ─────────────── */

test('복사: 클립보드가 되면 그것을 쓴다', async () => {
  const seen = []
  setNavigator({ clipboard: { writeText: async (v) => { seen.push(v) } } })
  try {
    assert.equal(await copyText('HN2609040012'), true)
    assert.deepEqual(seen, ['HN2609040012'])
  } finally { clearNavigator() }
})

test('복사: 클립보드가 막히면 폴백으로 넘어간다', async () => {
  // HTTPS 가 아닌 곳(폰에서 사장님 PC 주소로 접속)에서 실제로 일어나는 상황입니다.
  const el = { value: '', style: {}, setAttribute() {}, select() {}, setSelectionRange() {}, remove() {} }
  let copied = false
  setNavigator({ clipboard: { writeText: async () => { throw new Error('not allowed') } } })
  globalThis.document = {
    createElement: () => el,
    body: { appendChild() {} },
    execCommand: (cmd) => { copied = cmd === 'copy'; return true },
  }
  try {
    assert.equal(await copyText('700-032-202396'), true)
    assert.equal(el.value, '700-032-202396', '폴백에도 값이 실려야 합니다')
    assert.ok(copied)
  } finally { clearNavigator(); delete globalThis.document }
})

test('복사: 둘 다 막히면 false 로 알린다 (조용히 실패 금지)', async () => {
  setNavigator({ clipboard: { writeText: async () => { throw new Error('no') } } })
  globalThis.document = {
    createElement: () => { throw new Error('no dom') },
    body: { appendChild() {} },
  }
  try {
    // 화면이 "길게 눌러 복사해 주세요"를 띄울 수 있어야 합니다.
    assert.equal(await copyText('123'), false)
  } finally { clearNavigator(); delete globalThis.document }
})

test('복사: 빈 값은 시도하지 않는다', async () => {
  assert.equal(await copyText(''), false)
  assert.equal(await copyText(null), false)
})
