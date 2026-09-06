/**
 * 확장 패널의 "화면에 보이는 말" 지키기
 *
 * 패널은 번들이 아니라 원본 그대로 브라우저에 실려서, 문구를 잘못 바꿔도
 * 테스트가 잡아주지 않으면 그대로 고객 화면에 나갑니다.
 * 여기서는 **돈과 규정에 걸린 문구 두 가지**만 지킵니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COUPANG_PATTERNS, PATTERN_LABELS } from '../config/coupang-patterns.js'

const panel = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')

/** 테스트 기준점이 사라지면 조용히 통과하지 말고 이름을 대며 실패합니다 (검토 26-09-04). */
const at = (src, needle) => {
  const i = src.indexOf(needle)
  assert.notEqual(i, -1, `테스트 기준점이 사라졌습니다: ${needle}`)
  return i
}
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')

test('제휴 링크: 구매하고 배송까지에는 절대 붙지 않고, 붙는 곳에는 고지가 함께 있다', () => {
  // 쿠팡 파트너스·크롬 웹스토어가 막는 것은 제휴 링크가 아니라
  //   (1) 고지 없이 (2) 클릭 없이 (3) 몰래 URL 바꾸기 입니다.
  // 상품 패널의 제휴 버튼은 운영자 지시(26-09-04)로 빠졌습니다 — [결제하기]가
  // 배송만에서는 회색이고 고객은 쿠팡의 [바로구매]로 직접 결제합니다.
  assert.ok(main.includes("if (track !== 'forwarding') return"),
    '구매하고 배송까지 트랙은 제휴 호출 자체를 막아야 합니다')
  assert.ok(!/data-act=["']affiliate["'][^>]*>/.test(stripComments(panel).replace(/querySelectorAll\([^)]*\)/g, '')),
    '상품 패널에 제휴 버튼을 그리지 않습니다 (운영자 지시 26-09-04)')
})

test('바로가기 만들기 안내가 패널 맨 위에 있다', () => {
  // 이 확장은 쿠팡 페이지에서만 뜹니다. 바탕화면·홈 화면 아이콘이 없으면
  // 고객이 우리 서비스로 돌아올 길이 없습니다.
  assert.ok(panel.includes('바로가기 만들기'), '띠 제목')
  assert.ok(panel.includes('앞으로는 배송 걱정 끝'), '운영자가 정한 문구')
  assert.ok(panel.includes('홈 화면에 추가'), '폰 안내')
  assert.ok(panel.includes('바탕화면에 아이콘이 생깁니다'), 'PC 안내')
  // 한 번 거절하면 다시 조르지 않습니다.
  assert.ok(panel.includes('kbShortcutDismissed'), '"다음에" 를 기억해야 합니다')
  // 맨 위 — 머리말 바로 다음에 그려야 합니다.
  const head = panel.indexOf('renderShortcut()')
  const body = panel.indexOf('${renderBody()}')
  assert.ok(head > 0 && head < body, '바로가기 띠가 본문보다 위에 있어야 합니다')
})

test('배송지가 틀리면 강하게 알리고, 고칠 방법을 바로 준다', () => {
  // 이 서비스에서 가장 비싼 실수입니다 — 창고가 아닌 주소로 결제되면
  // 물건이 한국에서 멈추고, 반송비를 고객이 또 내야 합니다.
  // 예전에는 연한 주황색 한 줄이라 결제 화면에 묻혔습니다 (26-09-04).
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')

  assert.ok(cap.includes('주소를 변경해 주세요'), '할 일을 바로 말합니다 (운영자 확정 26-09-04)')
  assert.ok(cap.includes('#d92d20'), '경고는 빨간색이어야 합니다')
  assert.ok(cap.includes("card.style.border = wrongAddr"), '카드 테두리 전체가 빨개져야 합니다')
  assert.ok(cap.includes('grayscale'), '주소가 틀리면 금액은 흐리게 — 그 금액은 성립하지 않습니다')
  assert.ok(cap.includes('wrongAddr ? miniForm + dimmedPrice'), '고칠 방법(입력 안내)이 금액보다 위에 와야 합니다')
  assert.ok(cap.includes('저희 창고가 아닙니다'), '운영자 확정 문구 (26-09-04)')
  // 자동입력은 오류가 많아 전부 걷어냈습니다 (운영자 확정 26-09-06).
  // 이제 안내와 복사만 남습니다 — 아래 문구도 그에 맞춰야 합니다.
  assert.ok(cap.includes('쿠팡 [배송지 변경] 창에 이대로 넣어주세요'), '무엇을 어디에 넣는지 말합니다')
  assert.ok(cap.includes('data-copy='), '값은 눌러서 복사합니다')
})

test('결제 화면 2번 칸이 "하노이 주소" 임을 눈에 띄게 알린다', () => {
  // 여기에 한국 주소를 적는 분이 실제로 계십니다 (운영자 지시 26-09-04).
  const checkout = readFileSync(new URL('../pages/checkout.js', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')
  assert.ok(checkout.includes('하노이 주소 입력'), '제목에 "하노이 주소 입력" 이 보여야 합니다')
  assert.ok(checkout.includes('panel__head--accent'), '다른 칸과 구분되는 강조 제목이어야 합니다')
  assert.ok(checkout.includes('한국 주소 아님'), '입력칸 라벨에서도 못 박아야 합니다')
  assert.ok(css.includes('.panel__head--accent'), '강조 제목 스타일이 있어야 합니다')
})

test('상품 화면: 두 줄은 방식 고르기, 버튼은 [결제하기] [담아두기] 둘뿐', () => {
  /*
   * 운영자 지시 (26-09-04): "결제하기, 담아두기 버튼을 배치해서 배송만 선택할
   * 경우 결제하기 비활성화, 단 누르면 결제부터 하라고 멘트. 담아두기는 현재
   * 기능 그대로 유지." 그리고 단계 설명은 없앰 — 최대한 단순하게.
   */
  const src = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  // 끝 기준점은 함수 이름으로 — '바로가기 만들기' 문구는 위쪽 CSS 주석에도 있어 빈 조각이 잘립니다.
  const raw = src.slice(at(src, 'function renderButtons'), at(src, 'function renderShortcut'))
  const fn = stripComments(raw)
  const whole = stripComments(src)

  // 두 줄은 방식 고르기 (누르면 담기지 않습니다).
  assert.ok(whole.includes("handlers.onTrackChange?.(b.dataset.track)"), '가격 줄을 누르면 방식이 바뀝니다')
  assert.ok(!whole.includes('onPick'), '줄을 누른다고 담기지 않습니다')
  // 버튼은 둘뿐: pay + add. 주문서·제휴·1개 더 담기·단계 설명은 없습니다.
  const acts = [...fn.matchAll(/data-act=["']([a-z]+)["']/g)].map((m) => m[1]).sort()
  assert.deepEqual(acts, ['add', 'pay'], `견적 화면 버튼은 [결제하기] [담아두기] 둘뿐이어야 합니다: ${acts}`)
  assert.equal((fn.match(/<button/g) ?? []).length, 2)
  assert.ok(!/<ol|class="steps"|1개 더 담기|주문서 바로 작성/.test(fn), '단계 설명·1개 더 담기·주문서 버튼이 없어야 합니다')
  // 배송만이면 [결제하기]는 회색(off)이지만 눌러서 멘트를 볼 수 있어야 합니다 — disabled 속성 금지.
  assert.ok(fn.includes("fwd ? ' off' : ''"), '배송만이면 회색')
  assert.ok(fn.includes('aria-disabled="${fwd}"'), '보조기기에도 비활성으로')
  assert.ok(!/\sdisabled[\s=>]/.test(fn), '진짜 disabled 로 막으면 눌러도 아무 일이 없어 고장난 줄 압니다')
  assert.ok(whole.includes('handlers.onPay?.()'), '[결제하기] 가 onPay 로 이어집니다')
  assert.ok(whole.includes('handlers.onAdd?.()'), '[담아두기] 는 지금 기능 그대로 (onAdd)')
  assert.ok(src.includes('.btn.off'), '회색 스타일')
})

test('[결제하기]: 배송만이면 열지 않고 "결제부터" 멘트, 구매까지면 담고 신청서로', async () => {
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  const vm = await import('node:vm')
  // vm 안에서 const 는 전역 속성이 되지 않으므로 var 로 바꿔 ctx.handlers 로 꺼냅니다.
  const body = main.slice(at(main, 'const handlers = {'), at(main, 'onShortcutOpen:')).replace('const handlers = {', 'var handlers = {') + '}'
  const run = async (track, alreadyAdded) => {
    const sent = [], states = []
    const ctx = vm.createContext({
      track, product: { productId: 'p1', productName: 'x', productPrice: 1000 }, safeQty: 1,
      addedProductId: alreadyAdded ? 'p1' : null, compute() {},
      KBPanel: { setState: (st) => states.push(JSON.parse(JSON.stringify(st))) },
      send: async (type, payload) => {
        sent.push({ type, payload: JSON.parse(JSON.stringify(payload ?? null)) })
        if (type === 'getCart') return { ok: true, cart: [{ productId: 'p1', productName: 'x', track }] }
        if (type === 'addToCart') return { ok: true, count: 1 }
        return { ok: true }
      },
    })
    vm.runInContext(body, ctx)
    await ctx.handlers.onPay()
    return { sent, states }
  }
  const fwd = await run('forwarding', false)
  assert.ok(!fwd.sent.some((s) => s.type === 'openCheckout' || s.type === 'addToCart'), '배송만은 아무것도 열지 않습니다')
  assert.ok(fwd.states.some((st) => /먼저 쿠팡에서 결제/.test(st.notice ?? '')), '"결제부터 하라" 는 멘트를 띄웁니다')

  const agent = await run('agent', false)
  const types = agent.sent.map((s) => s.type)
  assert.ok(types.indexOf('addToCart') >= 0 && types.indexOf('addToCart') < types.indexOf('openCheckout'), '안 담겼으면 담은 뒤 신청서로')
  assert.deepEqual(agent.sent.find((s) => s.type === 'openCheckout').payload.items.map((i) => i.track), ['agent'])

  const agent2 = await run('agent', true)
  assert.ok(!agent2.sent.some((s) => s.type === 'addToCart'), '이미 담겼으면 다시 담지 않습니다')
  assert.ok(agent2.sent.some((s) => s.type === 'openCheckout'))
})

test('팝업 [주문 요청하기]: 담긴 상품의 방식으로 판단하고, 탭은 백그라운드만 연다', async () => {
  const popup = readFileSync(new URL('../extension/src/popup/popup.js', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../extension/src/popup/popup.html', import.meta.url), 'utf8')
  // 어떤 철자로든 팝업이 /checkout 주소를 직접 만들면 안 됩니다 — 트랙 걸러내기·서버 확인을 건너뜁니다.
  assert.ok(!/\/checkout\?/.test(stripComments(popup)), '팝업이 /checkout 주소를 직접 만들면 안 됩니다')
  assert.ok(!popup.includes('chrome.tabs.create'), '팝업은 탭을 직접 열지 않고 openCheckout 으로 보냅니다')
  assert.ok(html.includes('쿠팡 결제가 먼저입니다'), '팝업 안내 문구')
  assert.ok(html.includes('id="late-no"'), '결제 후 화면을 놓친 분은 주문번호를 적어야 엽니다')

  // 실제 핸들러를 실행합니다 — return 하나가 빠져도 배송만 견적함이 구매대행 신청서로 열립니다.
  const vm = await import('node:vm')
  const run = async (cart, lateNo = '', noteHidden = true) => {
    const sent = [], alerts = []
    const els = { 'order-note': { hidden: noteHidden }, 'order-agent': { hidden: true }, 'late-no': { value: lateNo } }
    const ctx = vm.createContext({
      cart, send: async (type, payload) => { sent.push({ type, payload }); return { ok: true } },
      alert: (m) => alerts.push(m), $: (id) => els[id], handlers: {},
    })
    const body = popup.slice(at(popup, 'const agentItemsInCart'), at(popup, "$('zone').addEventListener"))
      .replace("$('btn-order').addEventListener('click', ", 'handlers.order = (')
      .replace("$('order-agent').addEventListener('click', ", 'handlers.agent = (')
      .replace("$('order-late').addEventListener('click', ", 'handlers.late = (')
    vm.runInContext(body, ctx)
    await ctx.handlers.order()
    // vm 안에서 만든 객체는 프로토타입이 달라 deepStrictEqual 이 실패합니다 — JSON 으로 평평하게.
    const flat = () => JSON.parse(JSON.stringify(sent))
    return { get sent() { return flat() }, alerts, note: !els['order-note'].hidden, agentBtn: !els['order-agent'].hidden,
      agent: ctx.handlers.agent, late: ctx.handlers.late }
  }
  const F = { productName: 'x', productPrice: 1000, quantity: 1, track: 'forwarding' }
  const A = { productName: 'y', productPrice: 2000, quantity: 1, track: 'agent' }

  const onlyFwd = await run([F])
  assert.equal(onlyFwd.sent.length, 0, '배송만만 담겼으면 신청서를 열지 않습니다')
  assert.equal(onlyFwd.note, true, '대신 "결제가 먼저" 안내를 펼칩니다')
  assert.equal(onlyFwd.agentBtn, false, '구매하고 배송까지 상품이 없으면 그 버튼도 없습니다')

  const onlyAgent = await run([A])
  assert.deepEqual(onlyAgent.sent, [{ type: 'openCheckout', payload: { track: 'agent', items: [A] } }],
    '구매하고 배송까지만 담겼으면 그 상품을 실어 바로 신청서로')
  assert.equal(onlyAgent.note, false)

  // 섞인 견적함: 첫 클릭은 안내만 — 같은 클릭에서 탭을 열면 크롬이 팝업을 닫아 안내를 못 읽습니다.
  const mixed = await run([F, A])
  assert.equal(mixed.sent.length, 0, '첫 클릭에는 탭을 열지 않습니다')
  assert.equal(mixed.note, true, '배송만 상품에 대해 결제 먼저 안내')
  assert.equal(mixed.agentBtn, true, '구매하고 배송까지 상품은 안내 안의 버튼으로 엽니다')
  await mixed.agent()
  assert.deepEqual(mixed.sent[0].payload.items, [A], '그 버튼은 구매하고 배송까지 상품만 실어 보냅니다')
  // 안내가 이미 펼쳐진 뒤의 두 번째 클릭은 열어도 됩니다 (안내를 읽었으므로).
  const mixed2 = await run([F, A], '', false)
  assert.deepEqual(mixed2.sent[0]?.payload.items, [A])

  // 결제 후 경로 — 주문번호 없이는 열리지 않고, 9자리가 경계이며, 숫자 아닌 글자는 걷어냅니다.
  for (const [no, opens, label] of [['12', false, '2자리'], ['12345678', false, '8자리'], ['123456789', true, '9자리'],
                                     ['1788-6217 55836', true, '하이픈·공백 섞임'], ['abc', false, '글자만']]) {
    const late = await run([F], no)
    const before = late.sent.length
    await late.late()
    assert.equal(late.sent.length > before, opens, `주문번호 ${label}(${no}) → ${opens ? '열림' : '막힘'}`)
    if (!opens) assert.ok(late.alerts.some((m) => m.includes('주문번호')), '주문번호를 적으라고 말합니다')
  }
  const late = await run([F, A], '1788621755836'); await late.late()
  assert.deepEqual(late.sent.at(-1), { type: 'openCheckout', payload: { track: 'forwarding', coupangOrderNo: '1788621755836', items: [F] } },
    '팝업이 보여준 배송만 상품을 그대로 싣습니다 (초안이 끼어들지 않게)')
})

test('팝업 버튼 이름과 안내 접기는 담긴 상품을 따른다', async () => {
  const popup = readFileSync(new URL('../extension/src/popup/popup.js', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../extension/src/popup/popup.html', import.meta.url), 'utf8')
  const vm = await import('node:vm')
  // render() 끝자락(라벨·안내 접기)만 잘라 실행합니다 — render() 전체는 K/prefs 의존이 많습니다.
  const tail = popup.slice(at(popup, 'const hasAgent = cart.some'), at(popup, "document.querySelectorAll('.tabs button')")).replace(/\}\s*$/, '')
  const render = (cart) => {
    const els = { 'btn-order': {}, 'order-note': { hidden: false } }
    vm.runInContext(tail, vm.createContext({ cart, $: (id) => els[id] }))
    return { label: els['btn-order'].textContent, note: !els['order-note'].hidden }
  }
  const F = { track: 'forwarding' }, A = { track: 'agent' }
  assert.deepEqual(render([F]), { label: '쿠팡에서 먼저 결제하세요 — 순서 보기', note: true })
  assert.deepEqual(render([A]), { label: '주문 요청하기', note: false })
  assert.deepEqual(render([F, A]), { label: '주문 요청하기 — 순서 보기', note: true }, '배송만이 섞여 있으면 안내를 접지 않습니다')
  assert.deepEqual(render([]), { label: '주문 요청하기', note: false })
  // 고객 화면(설정 탭 포함)에 업계 용어가 없어야 합니다.
  const visible = html.replace(/<!--[\s\S]*?-->/g, '')
  assert.ok(!/배송대행|구매대행/.test(visible), 'popup.html 고객 문구에 배송대행/구매대행 — config/tracks.js 의 쉬운 말을 쓰세요')
})

test('상품 화면 [주문서]는 고른 방식의 상품만 싣고, 방식·상품이 바뀌면 서버 안내를 지운다', async () => {
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  const oc = main.slice(at(main, 'onCheckout:'), at(main, 'onShortcutOpen:'))
  assert.ok(oc.includes('notice: res?.ok'), '실패 이유를 패널에 보여줍니다')
  // 실제 핸들러를 실행합니다 — 문자열 검사만으로는 filter 결과를 안 쓰는 회귀를 못 잡습니다.
  const vm = await import('node:vm')
  const F = { productName: 'x', track: 'forwarding' }, A = { productName: 'y', track: 'agent' }
  for (const track of ['agent', 'forwarding']) {
    const sent = []
    const ctx = vm.createContext({ track, KBPanel: { setState() {} },
      send: async (type, payload) => { sent.push({ type, payload }); return type === 'getCart' ? { ok: true, cart: [F, A] } : { ok: true } } })
    vm.runInContext('h = {' + oc.replace(/,\s*$/, '') + '}', ctx)
    await ctx.h.onCheckout()
    const items = JSON.parse(JSON.stringify(sent.find((x) => x.type === 'openCheckout').payload.items))
    assert.deepEqual(items, [track === 'agent' ? A : F], `${track}: 고른 방식의 상품만 실어야 합니다`)
  }
  const tc = main.slice(at(main, 'onTrackChange:'), at(main, 'onAdd:'))
  assert.ok(tc.includes("notice: ''"), '방식을 바꾸면 이전 안내를 지웁니다')
  const nav = main.slice(at(main, 'const onNav ='), at(main, "for (const fn of ['pushState'"))
  assert.ok(nav.includes("notice: ''"), '다른 상품으로 가면 이전 안내를 지웁니다')
  // compute 안에서 지우면 쿠팡 화면 변화로 0.6초마다 다시 계산돼 곧바로 사라집니다.
  const compute = main.slice(at(main, 'async function compute()'), at(main, 'compute()\n\n'))
  assert.ok(!/notice: ''/.test(compute), 'compute 안에서는 지우지 않습니다')
})

test('주문완료 화면에서 저절로 열지 못하면 그 이유를 카드에 먼저 보여준다', () => {
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  assert.ok(cap.includes('function offerForwarding(coupangOrderNo, reason)'), '이유를 받는 자리')
  assert.ok(cap.includes('why.textContent = reason'), '서버 주소가 섞이니 textContent 로만')
  assert.ok(cap.includes('offerForwarding(coupangOrderNo, res?.error)'), 'autoForward 가 이유를 넘겨야 합니다')
  // 실패 안내는 고객에게 쉬운 말, 운영자에게 고칠 방법.
  assert.ok(cap.includes('잠시 후 다시 눌러 주세요'), '고객 브라우저에는 쉬운 말')
})

test('신청서의 하노이 주소 입력칸은 언제나 보인다', () => {
  /*
   * 저장된 값이 있으면 입력칸을 접고 요약만 보여줬더니 "하노이 주소 입력하는
   * 곳이 없고 바로 신청이 된다"는 일이 생겼습니다 (운영자 26-09-06).
   * 배송지는 이 서비스에서 가장 비싼 실수가 나는 자리입니다.
   */
  const checkout = readFileSync(new URL('../pages/checkout.js', import.meta.url), 'utf8')
  assert.ok(!checkout.includes('editRecipient'), '입력칸을 접는 상태가 남아 있으면 안 됩니다')
  assert.ok(checkout.includes('하노이 주소 * (한국 주소 아님)'), '주소 입력칸이 있어야 합니다')
  assert.ok(checkout.includes('setRecipientRestored'), '불러온 값임을 알려야 합니다')
  assert.ok(checkout.includes('이 주소가 맞는지 확인해 주세요'), '확인하라고 말해야 합니다')
})

test('배송지 안내의 이름 자리는 "예시"임이 보이고, 내 이름은 눈에 띈다', () => {
  /*
   * 운영자 26-09-06: 「YS-ECOM 박승우」 처럼 브라우저에 저장된 이름이
   * 안내문에 그대로 떠서, 남의 이름을 자기 이름인 줄 알고 그대로 넣는 일이
   * 생겼습니다. 예시는 누가 봐도 예시(홍길동)여야 하고, 진짜 내 이름은
   * 칠해서 "여기가 당신 이름"임이 보여야 합니다.
   */
  const send = readFileSync(new URL('../pages/send.js', import.meta.url), 'utf8')
  assert.ok(send.includes("const SAMPLE_NAME = '홍길동'"), '예시 이름은 홍길동')
  assert.ok(!send.includes('박하노') && !send.includes('박승우'), '사람 이름처럼 보이는 옛 예시가 남으면 안 됩니다')
  assert.ok(send.includes('placeholder={`예) ${SAMPLE_NAME}`}'), '입력칸 안내도 같은 예시로')
  assert.ok(send.includes('자리에 <b>본인 이름</b>을 넣어주세요'), '무엇을 바꿔 넣어야 하는지 말해야 합니다')
  // 이름 부분을 칠합니다 (예시는 회색, 내 이름은 노랑).
  assert.ok(send.includes('markStyle') && send.includes('sampleStyle'), '예시와 내 이름을 다르게 보여야 합니다')
  assert.ok(/background: '#ffe98a'/.test(send), '내 이름은 눈에 띄게 칠합니다')
  // 지난번 이름이 남아 있으면 한 번에 지웁니다.
  assert.ok(send.includes('>지우기</button>'), '저장된 이름을 지우는 버튼이 있어야 합니다')

  const order = readFileSync(new URL('../pages/orders/[id].js', import.meta.url), 'utf8')
  assert.ok(order.includes('const NAME_MARK'), '주문 화면의 세부주소도 이름을 칠해야 합니다')
  assert.equal(order.split('style={NAME_MARK}').length - 1, 2, '안내 문장과 세부주소 줄 두 곳')
})

test('숨어 있는 창의 글을 화면 글로 읽지 않는다 (틀린 주소로 결제하게 두는 오판)', () => {
  /*
   * innerText 는 그려지지 않는 요소에서 textContent 로 떨어집니다. 그래서
   * display:none 으로 숨어 있는 배송지 창·요청사항 창의 글까지 읽혀,
   * 창을 열지도 않았는데 "주소가 창고로 맞다" 고 오판했습니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const fn = cap.slice(at(cap, 'function pageTextSansOurUi'), at(cap, 'const NOT_A_NAME'))
  assert.ok(fn.includes('getClientRects().length > 0'), '보이는 덩어리만 읽어야 합니다')
})


test('자동 클릭·자동 채우기는 코드에 남아 있지 않다', () => {
  /*
   * 운영자 확정 26-09-06: "오류가 많아서 일단 자동 입력은 모두 빼주세요.
   * 입력방법만 정리해주고, 복사기능만 넣고."
   * 쿠팡 화면은 우리가 손대지 않습니다 — 값만 정확히 보여주고 복사만 합니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  for (const gone of ['runAddrAutofill', 'runDeliveryNote', 'frameAddressHelper', 'autofillAddressDialog',
    'fireClick', 'clickExact', 'clickChoice', 'spotlight', 'setNativeValue', 'kbPostcodeQuery']) {
    assert.ok(!cap.includes(gone), `자동 동작이 남아 있습니다: ${gone}`)
  }
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
  const entry = manifest.content_scripts.find((c) => c.js.includes('src/content/order-capture.js'))
  assert.ok(!entry.all_frames, '창 안(프레임)에서 돌 이유가 없습니다')
  assert.ok(!manifest.content_scripts.some((c) => c.js.some((f) => f.includes('postcode-fill'))),
    '우편번호 자동검색 스크립트는 없어야 합니다 — 고객이 본인 주소를 찾을 수 있어야 합니다')
})

test('입력 방법은 네 줄, 값마다 [복사]', () => {
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  assert.ok(cap.includes('쿠팡 [배송지 변경] 창에 이대로 넣어주세요'), '무엇을 어디에 넣는지')
  for (const label of ['받는 사람', '휴대폰', '우편번호 찾기 → 붙여넣고 검색', '상세주소']) {
    assert.ok(cap.includes(label), `안내 줄: ${label}`)
  }
  assert.ok(cap.includes('data-copy=') && cap.includes('>복사</button>'), '값마다 복사 버튼')
  // 배송 요청사항은 고르는 방법만 적습니다 (우리가 누르지 않습니다).
  assert.ok(cap.includes('① 문 앞') && cap.includes('② 비밀번호없이 출입 가능해요'), '요청사항 두 줄')
  assert.ok(cap.includes('주문하는 고객님의 성함을 입력하세요.'), '성함 안내')
})

test('시작 배너 — 누르기 전에는 꺼짐, 상품을 고르기 전이면 알려준다', () => {
  /*
   * 운영자 확정 26-09-06: 쿠팡에 들어오면 배너만 보이고, 눌러야 켜집니다.
   * 배너 모양은 보내주신 K-Global 광고 이미지를 그대로 옮겼습니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  assert.ok(cap.includes('function bannerHtml'), '배너를 그리는 곳')
  for (const line of ['coupang', 'K-Global Extension', '베트남에서', '한국 직구하기', '신청', '쉽고 빠른 한국 배송 서비스']) {
    assert.ok(cap.includes(line), `배너 문구: ${line}`)
  }
  assert.ok(/linear-gradient\(180deg,#ff9a1f/.test(cap), '[신청] 은 주황색 알약 버튼')
  // 기본은 꺼짐 — 눌러야 켜집니다.
  assert.ok(cap.includes('let directOff = true'), '기본은 꺼짐')
  assert.ok(cap.includes("chrome.storage.local.set({ kbOn: true })"), '누르면 켜집니다')
  assert.ok(cap.includes('먼저 사고 싶은 상품을 골라주세요'), '상품을 고르기 전이면 알려줍니다')
  // 켜져 있으면 배너는 물러납니다 (견적 패널·카드가 대신합니다).
  assert.ok(cap.includes('if (on) { wrapOld?.remove(); return }'), '켜져 있으면 배너는 사라집니다')
})
