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

const panel = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')

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

  assert.ok(cap.includes('하노이로 못 갑니다'), '결과를 먼저 말해야 합니다')
  assert.ok(cap.includes('#d92d20'), '경고는 빨간색이어야 합니다')
  assert.ok(cap.includes("card.style.border = wrongAddr"), '카드 테두리 전체가 빨개져야 합니다')
  assert.ok(cap.includes('grayscale'), '주소가 틀리면 금액은 흐리게 — 그 금액은 성립하지 않습니다')
  assert.ok(cap.includes('wrongAddr ? miniForm + dimmedPrice'), '고칠 방법이 금액보다 위에 와야 합니다')
  assert.ok(cap.includes('저희 창고가 아닙니다'), '운영자 확정 문구 (26-09-04)')
  assert.ok(cap.includes('수동입력</b> 또는 <b>자동입력</b>을 선택하세요'), '한 문장으로 선택지를 줍니다')
  assert.ok(cap.includes('✍️ 수동입력'), '수동입력 길이 항상 보여야 합니다')
  assert.ok(cap.includes('⚡ 자동입력'), '버튼 이름이 문장과 같은 말이어야 합니다')
})

test('직접 눌러달라고 할 때는 그 버튼을 화면에서 짚어준다', () => {
  // 글로만 "직접 눌러주세요" 하면 고객은 결제 화면 어디를 볼지 모릅니다.
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  assert.ok(cap.includes('function spotlight'), '버튼에 표시를 얹는 기능이 있어야 합니다')
  assert.ok(cap.includes('👆 여기를 눌러주세요'), '무엇을 하라는지 버튼 옆에 써야 합니다')
  assert.ok(cap.includes('pointer-events:none'), '표시가 정작 버튼 클릭을 막으면 안 됩니다')
  assert.ok(cap.includes("spotlight(findExact('openAddr')"), '[배송지 변경] 을 짚어야 합니다')
  assert.ok(cap.includes('spotlight(addBtn'), '[+ 배송지 추가] 도 짚어야 합니다')
  assert.ok(cap.includes('clearSpotlight()'), '끝나면 표시를 지워야 합니다')
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

test('배송지 창이 열리면 표시가 곧바로 [+ 배송지 추가]로 옮겨간다', () => {
  /*
   * 창이 열리면 그 창이 [배송지 변경] 버튼을 덮어버립니다. 그런데 예전에는
   * 안내 문구가 바뀔 때(2.6초 뒤)까지 표시를 옮기지 않아서, 그 사이 표시가
   * 창 위의 엉뚱한 자리를 짚고 있었습니다 (26-09-04 운영자 화면 —
   * "여기를 눌러주세요. 잘못 누르고 있어요").
   * 짚는 자리가 틀리면 안 짚느니만 못합니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')

  // [+ 배송지 추가] 를 짚는 호출이 안내 문구 조건(askedAdd) 뒤에 숨어 있으면 안 됩니다.
  const branch = cap.slice(cap.indexOf('const addBtn = findExact'), cap.indexOf("} else if (Date.now() - started"))
  assert.ok(branch.includes('spotlight(addBtn'), '창이 열리면 바로 짚어야 합니다')
  assert.ok(!/if \(askedAdd\) spotlight\(addBtn/.test(branch),
    'askedAdd 를 기다렸다 짚으면 그동안 엉뚱한 곳을 가리킵니다')
  // 짚는 순서: 자동 클릭 시도 → 즉시 표시 → (그래도 안 되면) 문구 안내
  assert.ok(branch.indexOf('spotlight(addBtn') < branch.indexOf('askedAdd = true'),
    '표시가 문구보다 먼저 옮겨가야 합니다')
})

test('입력폼까지 와서 멈춰도 [우편번호 찾기] 를 짚어준다 + 버전이 카드에 보인다', () => {
  // "배송지 입력부분까지 들어가서 멈춘다" (26-09-04 운영자) — 거기서 고객이
  // 눌러야 할 것은 [우편번호 찾기] 하나인데, 글로만 안내하고 있었습니다.
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const zipStage = cap.slice(cap.indexOf('const zipStart = Date.now()'), cap.indexOf("'✓ 배송지 자동입력 완료!"))
  assert.ok(zipStage.includes("spotlight(findExact('zipSearch')"), '[우편번호 찾기] 를 짚어야 합니다')
  assert.ok(zipStage.includes('clearSpotlight()'), '검색창이 열리면 표시를 치워야 합니다')

  // 사장님이 새 버전을 받으셨는지 화면에서 바로 알 수 있어야 합니다.
  assert.ok(/v\$\{ver\}/.test(cap), '카드에 도우미 버전이 보여야 합니다')
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/)
})


/** 테스트 기준점이 사라지면 조용히 통과하지 말고 이름을 대며 실패합니다 (검토 26-09-04). */
const at = (src, needle) => {
  const i = src.indexOf(needle)
  assert.notEqual(i, -1, `테스트 기준점이 사라졌습니다: ${needle}`)
  return i
}
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')

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
