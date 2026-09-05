/**
 * 쿠팡 화면 변경 대응 — 원격 문구 설정 + 자가진단
 *
 * 지키려는 성질
 *   ① 서버 문구는 **더하기만** 한다 — 서버 설정이 어떻든 번들 기본값은 계속 통한다
 *   ② 위험한 값(터무니없이 긴 정규식·ReDoS·깨진 셀렉터)은 채택하지 않는다
 *   ③ 자가진단 보고에는 개인정보가 들어갈 자리가 없다
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { COUPANG_PATTERNS, coupangPatternPayload } from '../config/coupang-patterns.js'

// 확장 콘텐츠 스크립트를 그대로 불러 검증합니다 (배포되는 코드 = 테스트하는 코드).
await import('../extension/src/content/patterns.js')
const P = globalThis.KBPatterns

test('번들 기본값만으로 쿠팡 기본 문구를 찾는다 (서버가 죽어도 동작)', () => {
  assert.equal(P.info().source, 'bundled')
  assert.ok(P.test('openAddr', '배송지변경'))
  assert.ok(P.test('addAddr', '배송지추가'))
  assert.ok(P.test('zipSearch', '우편번호찾기'))
  assert.ok(P.test('pick', '선택'))
  assert.ok(P.test('payButton', '결제하기'))
  assert.ok(!P.test('openAddr', '받는곳변경')) // 아직 모르는 새 문구
})

test('서버 문구를 받으면 새 문구도 찾는다 — 재배포 없이 대응', () => {
  P.apply({ ...coupangPatternPayload(), version: 7, text: { openAddr: { source: '배송지변경|받는곳변경', maxLen: 12 } } })
  assert.ok(P.test('openAddr', '받는곳변경'), '새 문구를 찾아야 합니다')
  assert.ok(P.test('openAddr', '배송지변경'), '기존 문구도 계속 찾아야 합니다')
  assert.equal(P.info().version, 7)
  assert.equal(P.info().source, 'server')
})

test('서버 설정이 엉터리여도 기존 동작은 멈추지 않는다', () => {
  P.apply({ version: 8, text: { openAddr: { source: '(((' } }, fields: { name: 'input[bad' } })
  assert.ok(P.test('openAddr', '배송지변경'), '깨진 정규식이 와도 기본 문구는 살아 있어야 합니다')
  assert.ok(P.field('name').includes('placeholder*="받는"'), '깨진 셀렉터가 와도 기본 셀렉터는 남아야 합니다')
  assert.deepEqual(P.info().rejected, ['text.openAddr', 'fields.name'])
})

test('위험한 정규식은 채택하지 않는다 — 검사 자체가 멈추지 않아야 한다', () => {
  // 시간을 재서 거르면 재는 동안 이미 화면이 멎습니다. 무한 반복(*, +, {n,})을
  // 아예 금지해 정적으로 걸러야 검사가 즉시 끝납니다.
  const t0 = Date.now()
  assert.equal(P.safeRegExp('(a+)+$'), null, '역추적 폭발 패턴은 거부')
  assert.equal(P.safeRegExp('(배송지|배송지)*변경'), null, '무한 반복은 거부')
  assert.equal(P.safeRegExp('배송지{1,999}'), null, '반복 횟수 지정도 거부')
  assert.ok(Date.now() - t0 < 100, `검사가 즉시 끝나야 합니다 (${Date.now() - t0}ms)`)

  assert.equal(P.safeRegExp('x'.repeat(400)), null, '지나치게 긴 패턴은 거부')
  assert.equal(P.safeRegExp('['), null, '컴파일 실패는 거부')
  assert.ok(P.safeRegExp('배송지변경|받는곳변경'), '정상 패턴은 채택')
  assert.ok(P.safeRegExp('^선택(하기)?$'), '선택(?)은 안전하므로 채택')
})

test('서버 설정의 모든 문구가 확장의 안전 검사를 통과한다', () => {
  // 운영자가 config/coupang-patterns.js 에 * 나 + 를 쓰면 확장이 조용히
  // 버립니다. 그 실수를 배포 전에 여기서 잡습니다.
  for (const [key, def] of Object.entries(COUPANG_PATTERNS.text)) {
    assert.ok(P.safeRegExp(def.source), `text.${key} 가 안전 검사를 통과해야 합니다: ${def.source}`)
  }
  assert.ok(P.safeRegExp(COUPANG_PATTERNS.health.checkoutMarks.source))
  for (const [key, sel] of Object.entries(COUPANG_PATTERNS.fields)) {
    assert.ok(P.safeSelector(sel), `fields.${key} 셀렉터가 유효해야 합니다`)
  }
})

test('확장이 모르는 키는 무시한다 — 서버가 임의 동작을 주입할 수 없다', () => {
  P.apply({ version: 9, text: { evilKey: { source: '.*' } } })
  assert.equal(P.list('evilKey').length, 0)
})

test('maxLen 은 번들값보다 줄어들지 않는다 — 서버 실수로 후보가 사라지지 않게', () => {
  P.apply({ version: 10, text: { pick: { source: '^선택(하기)?$', maxLen: 1 } } })
  assert.ok(P.maxLen('pick') >= 8)
})

test('서버 설정에 번들 기본 문구가 모두 살아 있다 — 배포본과 서버가 어긋나지 않게', () => {
  for (const [key, def] of Object.entries(P.BUNDLED.text)) {
    const server = COUPANG_PATTERNS.text[key]
    assert.ok(server, `서버 설정에 ${key} 가 있어야 합니다`)
    for (const alt of def.source.split('|')) {
      assert.ok(server.source.includes(alt), `${key}: 서버 문구가 번들 문구 "${alt}" 를 포함해야 합니다`)
    }
  }
  for (const key of Object.keys(P.BUNDLED.fields)) {
    assert.ok(COUPANG_PATTERNS.fields[key], `서버 설정에 fields.${key} 가 있어야 합니다`)
  }
})

test('자가진단 요구 항목은 실제 문구 키만 가리킨다', () => {
  for (const kind of ['checkout', 'addrForm']) {
    for (const key of P.require(kind)) {
      assert.ok(P.list(key).length > 0, `${kind} 요구 항목 ${key} 는 문구가 있어야 합니다`)
    }
  }
  assert.ok(P.looksLikeCheckout('주문결제최종결제금액25,600원결제하기'))
  assert.ok(!P.looksLikeCheckout('상품상세이니스프리수분크림'))
})

/* ─────────────── 자가진단 수집 API ─────────────── */

process.env.ADMIN_TOKEN = 'testtoken'
// 알림 기록을 확인하려면 로그를 켜야 합니다 (이 파일은 주문 스토어를 쓰지 않습니다).
const { mkdtempSync } = await import('node:fs')
const { join } = await import('node:path')
const { tmpdir } = await import('node:os')
process.env.ORDER_STORE_DIR = mkdtempSync(join(tmpdir(), 'kb-health-'))

const { default: healthHandler, resetHealth, healthSummary } =
  await import('../pages/api/extension/health.js')
const { readLog } = await import('../lib/order/persist.js')

const mockRes = () => ({
  statusCode: 0, body: null,
  setHeader() {},
  status(c) { this.statusCode = c; return this },
  json(o) { this.body = o; return this },
})

const post = (body) => {
  const res = mockRes()
  healthHandler({ method: 'POST', headers: {}, query: {}, body }, res)
  return res
}

test('자가진단 보고를 받아 같은 증상은 한 줄로 모은다', () => {
  resetHealth()
  const body = {
    kind: 'addrAutofill', missing: ['openAddr'], found: { openAddr: 0, addAddr: 0 },
    host: 'checkout.coupang.com', path: '/order/pc', ext: '0.5.0', pat: 1, patSource: 'server', stage: 'open',
  }
  assert.equal(post(body).statusCode, 202)
  post(body); post(body)

  const sum = healthSummary()
  assert.equal(sum.total, 3, '3회로 합산되어야 합니다')
  assert.equal(sum.items.length, 1, '같은 증상은 한 줄')
  assert.equal(sum.autofillFailures, 3)
  assert.deepEqual(sum.items[0].missing, ['openAddr'])
})

test('개인정보가 섞여 들어와도 저장되지 않는다', () => {
  resetHealth()
  post({
    kind: 'checkout', missing: ['payButton'], host: 'checkout.coupang.com', path: '/order',
    customerName: '박하노', phone: '010-1234-5678', address: '하노이 어딘가', amountKrw: 25600,
    found: { payButton: 0 },
  })
  const dump = JSON.stringify(healthSummary())
  for (const leak of ['박하노', '010-1234-5678', '하노이 어딘가', '25600', 'customerName']) {
    assert.ok(!dump.includes(leak), `개인정보가 남으면 안 됩니다: ${leak}`)
  }
})

test('보고 값은 좁혀 받는다 — 이상한 kind·긴 문자열·숫자 아닌 개수', () => {
  resetHealth()
  post({ kind: 'evil<script>', missing: ['openAddr'], host: 'a'.repeat(200), path: '/x?q=1', found: { openAddr: 'NaN' } })
  const item = healthSummary().items[0]
  assert.equal(item.kind, 'unknown')
  assert.ok(item.host.length <= 40)
  assert.ok(!item.path.includes('?'))
  assert.equal(item.found.openAddr, 0)
})

test('요약 조회는 운영자 토큰이 있어야 한다 — 어떤 문구가 깨졌는지는 운영 정보', () => {
  resetHealth()
  post({ kind: 'checkout', missing: ['openAddr'], host: 'checkout.coupang.com' })

  const anon = mockRes()
  healthHandler({ method: 'GET', headers: {}, query: {} }, anon)
  assert.equal(anon.statusCode, 401)

  const admin = mockRes()
  healthHandler({ method: 'GET', headers: { 'x-admin-token': 'testtoken' }, query: {} }, admin)
  assert.equal(admin.statusCode, 200)
  assert.equal(admin.body.patternVersion, COUPANG_PATTERNS.version)
  assert.equal(admin.body.items.length, 1)
})

test('빈 보고는 거부한다', () => {
  resetHealth()
  assert.equal(post({}).statusCode, 400)
})


/* ─────────────── 이상 발견 시 알림 ─────────────── */

test('처음 발견하면 즉시 알린다 — 관리자 화면을 열어볼 때까지 기다리지 않는다', () => {
  resetHealth()
  const before = readLog('operator-alerts.jsonl').length
  const res = post({
    kind: 'addrAutofill', missing: ['openAddr'], found: { openAddr: 0 },
    host: 'checkout.coupang.com', path: '/order/pc', ext: '0.5.0', pat: 1, patSource: 'server',
  })
  assert.equal(res.body.alerted, true, '첫 보고는 알려야 합니다')

  const sent = readLog('operator-alerts.jsonl')
  assert.equal(sent.length, before + 1)
  assert.ok(sent[0].title.includes('쿠팡 화면 변경'), sent[0].title)
  assert.ok(sent[0].message.includes('배송지 변경'), '무엇을 못 찾았는지 사람 말로 적혀야 합니다')
  assert.ok(sent[0].message.includes('coupang-patterns.js'), '고치는 방법이 함께 가야 합니다')
})

test('같은 증상이 쏟아져도 폰은 한 번만 울린다', () => {
  resetHealth()
  const body = {
    kind: 'checkout', missing: ['openAddr'], found: { openAddr: 0 },
    host: 'checkout.coupang.com', path: '/order/pc', ext: '0.5.0', pat: 1,
  }
  const alerts = []
  for (let i = 0; i < 12; i += 1) alerts.push(post(body).body.alerted)
  assert.deepEqual(alerts.filter(Boolean).length, 1, '고객 12명이 겪어도 알림은 1건이어야 합니다')
  assert.equal(alerts[0], true, '첫 보고에서 바로 알려야 합니다')
  assert.equal(healthSummary().total, 12, '알림은 줄여도 집계는 전부 남아야 합니다')
})

test('다른 증상은 따로 알린다 — 한 건에 묻히지 않게', () => {
  resetHealth()
  const at = { host: 'checkout.coupang.com', path: '/order/pc', ext: '0.5.0', pat: 1 }
  assert.equal(post({ kind: 'checkout', missing: ['openAddr'], ...at }).body.alerted, true)
  assert.equal(post({ kind: 'price', missing: ['items'], ...at }).body.alerted, true)
})

test('알림이 실패해도 보고 수집은 계속된다', () => {
  resetHealth()
  // 잘못된 웹훅 주소 — fetch 가 실패해도 202 로 받고 요약에는 남아야 합니다.
  const prev = process.env.NOTIFY_WEBHOOK_URL
  process.env.NOTIFY_WEBHOOK_URL = 'http://127.0.0.1:1/none'
  try {
    assert.equal(post({ kind: 'price', missing: ['items'], host: 'checkout.coupang.com' }).statusCode, 202)
    assert.equal(healthSummary().total, 1)
  } finally {
    if (prev === undefined) delete process.env.NOTIFY_WEBHOOK_URL
    else process.env.NOTIFY_WEBHOOK_URL = prev
  }
})

test('[저장] 문구 — 배송지 입력폼의 저장 버튼만 잡고 "저장된 주소" 같은 긴 글은 안 잡는다', async () => {
  await import('../extension/src/content/patterns.js')
  const P = globalThis.KBPatterns
  assert.ok(P.test('save', '저장'))
  assert.ok(P.test('save', '저장하기'))
  assert.ok(!P.test('save', '저장된배송지'), '앞뒤에 글이 붙으면 다른 요소입니다')
  assert.ok(!P.test('save', '임시저장'))
  assert.ok(P.maxLen('save') <= 8)
  // 서버 설정에도 같은 키가 있어 원격으로 고칠 수 있습니다.
  const { COUPANG_PATTERNS, PATTERN_LABELS } = await import('../config/coupang-patterns.js')
  assert.ok(COUPANG_PATTERNS.text.save, 'config/coupang-patterns.js 에 save')
  assert.equal(PATTERN_LABELS.save, '저장')
})
