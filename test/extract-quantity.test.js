/**
 * 쿠팡 화면에서 "몇 개"를 읽는 부분
 *
 * 왜 생겼나 (26-09-04, 사장님 화면에서 발견)
 *
 *   바쏘인 팬티 2매 세트, 낱개 3,000원. 화면에서 수량을 **82개**로 올리면
 *   쿠팡은 큰 가격을 246,000원(= 82 × 3,000)으로 바꿔 보여줍니다.
 *   그런데 확장은 개수를 아예 읽지 않고 **무조건 1개**로 계산했습니다.
 *
 *     화면에 고른 것   82개
 *     견적·담기         1개    ← 고객은 82개를 기대하는데 1개가 신청됩니다
 *
 *   반대 방향이 더 무섭습니다. JSON-LD 가 없어 CSS 셀렉터로 떨어지면
 *   가격이 **이미 곱해진 246,000원**으로 잡히는데, 여기에 개수를 또 곱하면
 *   청구액이 개수의 제곱(82배)으로 부풀어 오릅니다.
 *
 * 그래서 규칙은 하나입니다 — **낱개 가격이라고 확신할 때만 개수를 곱한다.**
 */
import test from 'node:test'
import assert from 'node:assert/strict'

await import('../extension/src/content/extract.js')
const E = globalThis.KBExtract

/* ─────────── 개수를 곱해도 되는지 판단 (순수 규칙) ─────────── */

test('낱개 가격이 확실하면 화면에서 고른 개수를 그대로 쓴다', () => {
  for (const basis of ['json-ld', 'meta']) {
    const r = E.safeQuantity({ quantity: 82, priceBasis: basis })
    assert.equal(r.quantity, 82, `${basis} 는 낱개 값이라 곱해도 안전합니다`)
    assert.equal(r.uncertain, false)
  }
})

test('가격이 화면 총액(셀렉터)이면 개수를 곱하지 않는다', () => {
  // 곱하면 82배 과다청구가 됩니다. 1개로 계산하고 화면이 그렇다고 말합니다.
  const r = E.safeQuantity({ quantity: 82, priceBasis: 'selector' })
  assert.equal(r.quantity, 1)
  assert.equal(r.uncertain, true, '조용히 1개로 바꾸지 말고 알려야 합니다')
})

test('1개일 때는 어느 출처든 그냥 1개 (경고 없음)', () => {
  for (const basis of ['json-ld', 'meta', 'selector', undefined]) {
    const r = E.safeQuantity({ quantity: 1, priceBasis: basis })
    assert.deepEqual(r, { quantity: 1, uncertain: false })
  }
})

test('개수가 이상하면 1개로 떨어진다', () => {
  for (const bad of [undefined, null, 0, -5, NaN, '많이', Infinity]) {
    const r = E.safeQuantity({ quantity: bad, priceBasis: 'json-ld' })
    assert.equal(r.quantity, 1, `${String(bad)} → 1개`)
  }
  // 소수점은 내림 — 2.9개를 3개로 올려 청구하면 안 됩니다.
  assert.equal(E.safeQuantity({ quantity: 2.9, priceBasis: 'json-ld' }).quantity, 2)
})

/* ─────────── 화면의 수량 칸 읽기 ─────────── */

/** extract.js 는 document.querySelector 만 씁니다 — 그만큼만 흉내 냅니다. */
const withFakeDom = (found, fn) => {
  const prev = globalThis.document
  globalThis.document = { querySelector: () => found, querySelectorAll: () => [] }
  try { return fn() } finally {
    if (prev === undefined) delete globalThis.document
    else globalThis.document = prev
  }
}

test('수량 칸을 읽는다', () => {
  assert.deepEqual(withFakeDom({ value: '82' }, () => E.readQuantity()), { value: 82, found: true })
  assert.deepEqual(withFakeDom({ value: '1' }, () => E.readQuantity()), { value: 1, found: true })
  // 쉼표·공백이 섞여 들어와도 숫자만 봅니다.
  assert.deepEqual(withFakeDom({ value: ' 12 ' }, () => E.readQuantity()), { value: 12, found: true })
})

test('수량 칸이 없거나 이상하면 1개로 두되 못 읽었다고 알린다', () => {
  // 못 읽은 것을 "1개"로 조용히 넘기면, 82개를 고른 고객이 1개를 받습니다.
  assert.deepEqual(withFakeDom(null, () => E.readQuantity()), { value: 1, found: false })
  assert.deepEqual(withFakeDom({ value: '' }, () => E.readQuantity()), { value: 1, found: false })
  assert.deepEqual(withFakeDom({ value: '0' }, () => E.readQuantity()), { value: 1, found: false })
  // 오타·자동입력으로 말도 안 되는 수가 들어오면 믿지 않습니다.
  assert.deepEqual(withFakeDom({ value: '99999' }, () => E.readQuantity()), { value: 1, found: false })
})

/* ─────────── 세 단계 폴백이 진짜로 이어지는가 ─────────── */

test('가격이 없는 단계에서 멈추지 않고 다음 단계로 넘어간다', () => {
  // 쿠팡에는 og:title 이 항상 있습니다. 예전 코드는 2단계가 "이름만 있고
  // 가격 없음" 을 돌려주는 순간 3단계(CSS 셀렉터)를 아예 건너뛰어서,
  // 화면에 가격이 멀쩡히 떠 있어도 "가격을 읽지 못했습니다" 만 나왔습니다.
  const src = E.extractProduct.toString() + E.safeQuantity.toString()
  assert.ok(!src.includes('fromJsonLd() ?? fromMeta() ?? fromSelectors()'),
    '단계를 ?? 로 이어붙이면 가격 없는 단계에서 멈춥니다')
})

test('수량 셀렉터가 갖춰져 있다 (쿠팡 화면이 바뀌면 원격으로 교체)', () => {
  const list = E.DEFAULT_SELECTORS.quantity
  assert.ok(Array.isArray(list) && list.length >= 3, '후보를 여러 개 두어야 한 번에 안 깨집니다')
  assert.ok(list.some((s) => s.includes('quantity')), 'name/class 에 quantity 가 든 칸을 봐야 합니다')
})
