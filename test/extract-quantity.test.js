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

/** { value, found } 만 비교 — how(어떻게 찾았나)는 따로 봅니다 */
const vf = (r) => ({ value: r.value, found: r.found })

test('수량 칸을 읽는다', () => {
  assert.deepEqual(vf(withFakeDom({ value: '82' }, () => E.readQuantity())), { value: 82, found: true })
  assert.deepEqual(vf(withFakeDom({ value: '1' }, () => E.readQuantity())), { value: 1, found: true })
  // 쉼표·공백이 섞여 들어와도 숫자만 봅니다.
  assert.deepEqual(vf(withFakeDom({ value: ' 12 ' }, () => E.readQuantity())), { value: 12, found: true })
  assert.equal(withFakeDom({ value: '82' }, () => E.readQuantity()).how, 'selector')
})

test('수량 칸이 없거나 이상하면 1개로 두되 못 읽었다고 알린다', () => {
  // 못 읽은 것을 "1개"로 조용히 넘기면, 82개를 고른 고객이 1개를 받습니다.
  assert.deepEqual(vf(withFakeDom(null, () => E.readQuantity())), { value: 1, found: false })
  assert.deepEqual(vf(withFakeDom({ value: '' }, () => E.readQuantity())), { value: 1, found: false })
  assert.deepEqual(vf(withFakeDom({ value: '0' }, () => E.readQuantity())), { value: 1, found: false })
  // 오타·자동입력으로 말도 안 되는 수가 들어오면 믿지 않습니다.
  assert.deepEqual(vf(withFakeDom({ value: '99999' }, () => E.readQuantity())), { value: 1, found: false })
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

/* ─────────── 셀렉터가 다 빗나갔을 때의 그물 (26-09-06 운영자 화면: 수량 15 인데 1개) ─────────── */

/** 넓은 그물이 만지는 만큼만 흉내 낸 요소 */
const el = (over = {}) => ({
  tagName: 'INPUT', type: 'text', value: '', id: '', className: '', textContent: '',
  attrs: {},
  getAttribute(k) { return this.attrs[k] ?? null },
  getBoundingClientRect() { return this.rect ?? { top: 500, bottom: 530, left: 800, width: 60, height: 30 } },
  closest: () => null,
  previousElementSibling: null, nextElementSibling: null, parentElement: null,
  ...over,
})
/** querySelectorAll(sel) 은 sel 문자열에 태그 이름이 든 요소만 돌려줍니다 (셀렉터 엔진 없이) */
const withWideDom = (all, fn, single = null) => {
  const prev = globalThis.document
  globalThis.document = {
    querySelector: (sel) => single?.[sel] ?? null,
    querySelectorAll: (sel) => sel.includes('aria-checked')
      ? all.filter((x) => x.attrs?.['aria-checked'] === 'true') // 선택된 수량 옵션 (selectedOptionOverride)
      : all.filter((x) => new RegExp(`(^|[^a-z-])${x.tagName.toLowerCase()}([^a-z-]|$)`).test(sel.toLowerCase())),
  }
  try { return fn() } finally {
    if (prev === undefined) delete globalThis.document
    else globalThis.document = prev
  }
}
const buyBtn = (top) => el({ tagName: 'BUTTON', textContent: '장바구니 담기', rect: { top, bottom: top + 40, left: 900, width: 300, height: 40 } })

test('이름표에 "수량" 이 있는 칸이면 셀렉터가 없어도 읽는다', () => {
  const r = withWideDom([el({ value: '15', attrs: { 'aria-label': '수량' } })], () => E.readQuantity())
  assert.deepEqual([r.value, r.found, r.how], [15, true, 'labeled'])
})

test('숫자 입력칸이 하나뿐이면 그것이 수량이다 — 상품 화면에서 숫자 칸은 수량뿐', () => {
  const r = withWideDom([el({ type: 'number', value: '15' }), el({ value: '3' })], () => E.readQuantity())
  assert.deepEqual([r.value, r.found, r.how], [15, true, 'number-input'])
})

test('숫자 칸이 여럿이면 [장바구니 담기] 와 같은 줄에 있는 것', () => {
  const dom = [
    el({ type: 'number', value: '5', rect: { top: 2000, bottom: 2030, left: 100, width: 60, height: 30 } }), // 리뷰 필터 같은 것
    el({ type: 'number', value: '15' }),
    buyBtn(495),
  ]
  const r = withWideDom(dom, () => E.readQuantity())
  assert.deepEqual([r.value, r.found, r.how], [15, true, 'near-buy'])
})

test('검색창·헤더 안의 숫자는 수량이 아니다', () => {
  const dom = [
    el({ value: '15', attrs: { name: 'q' }, closest: () => ({}) }), // 헤더 안
    el({ type: 'search', value: '15' }),
  ]
  const r = withWideDom(dom, () => E.readQuantity())
  assert.deepEqual([r.value, r.found], [1, false])
})

test('[+]·[−] 사이의 숫자(입력칸 아님)도 읽는다', () => {
  const num = el({ tagName: 'SPAN', textContent: ' 15 ' })
  const plus = el({ tagName: 'BUTTON', textContent: '+', previousElementSibling: num })
  const r = withWideDom([plus, num], () => E.readQuantity())
  assert.deepEqual([r.value, r.found, r.how], [15, true, 'stepper'])
  // 말이 안 되는 수는 여기서도 안 믿습니다.
  const bad = el({ tagName: 'SPAN', textContent: '1000' })
  const r2 = withWideDom([el({ tagName: 'BUTTON', textContent: '+', previousElementSibling: bad }), bad], () => E.readQuantity())
  assert.equal(r2.found, false)
})

/* ─────────── 화면 금액 ÷ 낱개 가격 — 수량 칸을 끝내 못 찾았을 때 ─────────── */

/**
 * 26-09-06 운영자 화면: 설화수 순행클렌징폼, 수량 15, 화면 금액 321,300원.
 * JSON-LD 낱개 값은 21,420원 → 321,300 = 21,420 × 15. 수량 칸은 못 찾았지만
 * 이 셈으로 15개임을 알 수 있습니다.
 */
const productDom = ({ unit = 21420, shown = '321,300원', extra = [], single = {}, opt = null } = {}) => {
  const ld = el({ tagName: 'SCRIPT', textContent: JSON.stringify({ '@type': 'Product', name: '설화수 순행클렌징폼, 100ml, 1개', offers: { price: unit } }) })
  const all = [ld, ...extra]
  if (opt) all.push(el({ tagName: 'DIV', innerText: opt, attrs: { 'aria-checked': 'true' } }))
  const prev = globalThis.location
  globalThis.location = { pathname: '/vp/products/4854934446', search: '?itemId=25798413980', href: 'https://www.coupang.com/vp/products/4854934446?itemId=25798413980' }
  try {
    return withWideDom(all, () => E.extractProduct(), {
      '.prod-sale-price .total-price strong': shown ? el({ tagName: 'STRONG', textContent: shown }) : null,
      ...single,
    })
  } finally {
    if (prev === undefined) delete globalThis.location
    else globalThis.location = prev
  }
}

test('"2개 세트" 옵션 보정과 겹쳐도 두 번 곱하지 않는다', () => {
  // 옵션이 2개 42,840원이고 화면도 42,840원이면 개수 1 (옵션 가격 그대로).
  const one = productDom({ shown: '42,840원', opt: '2개\n42,840원' })
  assert.equal(one.price, 42840, '옵션 가격이 낱개 값을 대신합니다')
  assert.ok(one.productName.endsWith(', 2개'))
  assert.deepEqual([one.quantity, one.quantityFound], [1, false])
  // 그 옵션을 3개 골라 화면이 128,520원이면 개수 3 — 옵션 가격 × 3 = 화면 금액.
  const three = productDom({ shown: '128,520원', opt: '2개\n42,840원' })
  assert.deepEqual([three.price, three.quantity, three.quantityHow], [42840, 3, 'ratio'])
})

test('수량 칸이 없어도 화면 금액이 낱개 값의 정수배면 그 배수가 개수다', () => {
  const p = productDom()
  assert.equal(p.ok, true)
  assert.equal(p.price, 21420, '낱개 값은 JSON-LD 그대로')
  assert.deepEqual([p.quantity, p.quantityFound, p.quantityHow, p.shownPrice], [15, true, 'ratio', 321300])
  // 견적에 쓰는 개수도 15 — json-ld 낱개 값이라 곱해도 안전합니다.
  assert.deepEqual(E.safeQuantity(p), { quantity: 15, uncertain: false })
})

test('나누어떨어지지 않으면(할인가·다른 옵션) 개수를 지어내지 않는다', () => {
  for (const shown of ['320,000원', '21,420원', '19,900원', '28,000원']) {
    const p = productDom({ shown })
    assert.deepEqual([p.quantity, p.quantityFound], [1, false], `화면 ${shown}`)
  }
  // 화면 금액이 없어도 조용히 1개
  assert.deepEqual([productDom({ shown: null }).quantity, productDom({ shown: null }).quantityFound], [1, false])
  // 1,000 배 같은 말도 안 되는 배수도 안 믿습니다
  assert.equal(productDom({ unit: 100, shown: '100,000원' }).quantityFound, false)
})

test('수량 칸을 찾았으면 그 값이 우선이다 (화면 금액과 달라도)', () => {
  // 칸은 15 인데 화면 금액이 낱개 값 그대로인 화면 — 칸을 믿습니다.
  const p = productDom({ shown: '21,420원', extra: [el({ type: 'number', value: '15' })] })
  assert.deepEqual([p.quantity, p.quantityHow], [15, 'number-input'])
})

test('가격을 화면 셀렉터에서 읽은 경우(총액)에는 되짚지 않는다', () => {
  // JSON-LD 도 meta 도 없으면 화면 금액이 곧 가격이라 비교할 낱개 값이 없습니다.
  const prev = globalThis.location
  globalThis.location = { pathname: '/vp/products/1', search: '', href: 'https://www.coupang.com/vp/products/1' }
  try {
    const p = withWideDom([], () => E.extractProduct(), {
      'h1.prod-buy-header__title': el({ tagName: 'H1', textContent: '상품' }),
      '.prod-sale-price .total-price strong': el({ tagName: 'STRONG', textContent: '321,300원' }),
    })
    assert.equal(p.priceBasis, 'selector')
    assert.deepEqual([p.quantity, p.quantityFound, p.shownPrice], [1, false, null])
  } finally { globalThis.location = prev }
})

test('패널은 되짚은 개수의 셈을 함께 보여준다 (화면 321,300원 = 21,420원 × 15개)', async () => {
  const { readFileSync } = await import('node:fs')
  const panel = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  assert.ok(panel.includes("state.quantityHow === 'ratio'"), '되짚은 경우를 구분')
  assert.ok(/× \$\{qty\}개/.test(panel), '셈을 그대로 보여줍니다')
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  for (const k of ['quantityHow: extracted.quantityHow', 'unitPrice: extracted.price', 'shownPrice: extracted.shownPrice']) {
    assert.ok(main.includes(k), `패널 상태에 ${k}`)
  }
})

/* ─────────── 오른쪽 장바구니 미리보기에 속지 않기 (26-09-06 셔츠 5벌) ─────────── */

test('오른쪽 장바구니 미리보기의 수량 칸을 상품 수량으로 착각하지 않는다', () => {
  /*
   * 쿠팡 상품 화면 오른쪽에는 장바구니 미리보기가 붙어 있고, 거기에도
   * 수량 칸(1, 2 …)이 있습니다. 그걸 집으면 5벌을 골라도 1벌로 계산됩니다.
   * 구매 버튼의 오른쪽 끝을 본문 경계로 봅니다.
   */
  const main = el({ type: 'number', value: '5' }) // 본문 수량 칸 (left 800)
  const side = el({ type: 'number', value: '1', rect: { top: 300, bottom: 330, left: 1400, width: 40, height: 30 } })
  const r = withWideDom([side, main, buyBtn(495)], () => E.readQuantity())
  assert.deepEqual([r.value, r.found], [5, true], '본문 칸(5)을 봐야 합니다')
})

test('화면 금액이 낱개 값의 5배면, 수량 칸이 1이라 해도 5개로 본다', () => {
  /*
   * 26-09-06 사장님 화면: 와이셔츠 수량 5, 화면 139,700원(= 27,940 × 5).
   * 그런데 견적은 1벌(배송만 10,792원)로 나왔습니다 — 수량 칸을 엉뚱한 곳에서
   * 읽은 것입니다. 고객이 실제로 낼 돈이 화면에 찍혀 있으므로, 둘이 다르면
   * **금액 쪽을 믿습니다.**
   */
  const wrong = el({ type: 'number', value: '1' }) // 엉뚱하게 잡힌 칸
  const p = productDom({ unit: 27940, shown: '139,700원', extra: [wrong, buyBtn(495)] })
  assert.equal(p.price, 27940, '낱개 값은 상품 정보 쪽')
  assert.deepEqual([p.quantity, p.quantityHow], [5, 'ratio'])
  assert.deepEqual(E.safeQuantity(p), { quantity: 5, uncertain: false })
})

test('금액이 낱개 값 그대로면 수량 칸을 그대로 믿는다 (금액이 개수를 덮어쓰지 않게)', () => {
  // 마켓플레이스 상품은 수량을 올려도 화면 금액이 낱개 값 그대로입니다.
  const p = productDom({ unit: 27940, shown: '27,940원', extra: [el({ type: 'number', value: '3' }), buyBtn(495)] })
  assert.deepEqual([p.quantity, p.quantityHow], [3, 'number-input'])
})

test('수량을 바꾸면 그 자리에서 다시 계산한다', async () => {
  const { readFileSync } = await import('node:fs')
  /*
   * 입력칸 값 변경은 MutationObserver 로 잡히지 않습니다. 그래서 수량을
   * 늘려도 금액이 그대로였습니다 (운영자 26-09-06).
   */
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  assert.ok(/characterData: true/.test(main), '가격 글자만 바뀌는 경우도 봐야 합니다')
  assert.ok(/for \(const type of \['input', 'change', 'click'\]\)/.test(main), '입력·클릭에도 다시 계산해야 합니다')
})
