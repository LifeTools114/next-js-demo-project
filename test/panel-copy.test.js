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
  assert.ok(cap.includes('wrongAddr ? stepsBlock + miniForm + dimmedPrice'), '고칠 방법(단계 표·버튼)이 금액보다 위에 와야 합니다')
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

test('배송지 자동 등록은 단계별로 보여주고, 마지막 [저장]은 고객 몫으로 남긴다', () => {
  /*
   * 운영자 질문 (26-09-04): "배송지변경 → 배송지추가 → 받는사람 → 우편번호 →
   * 휴대폰 → 저장 → 선택까지 모두 자동인가, 처음 탭만 열어주는가?"
   * 답: [저장]만 빼고 자동으로 시도하고, 쿠팡이 클릭을 막는 단계는 빨갛게
   * 짚어 직접 누르게 합니다. 어디서 멈췄는지 단계 표로 보입니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const steps = cap.slice(at(cap, 'const ADDR_STEPS = ['), at(cap, "let helperAddrStep"))
  for (const label of ['[배송지 변경] 열기', '[+ 배송지 추가] 누르기', '받는사람·휴대폰 채우기', '[우편번호 찾기] 열기', '주소 검색·선택', '상세주소 채우기', '[저장] 누르기']) {
    assert.ok(steps.includes(label), `단계 표에 "${label}"`)
  }
  // 흐름의 각 지점에서 단계가 갱신됩니다.
  for (const mark of ["helperAddrStep = 'open'", "setStep('add')", "setStep('fill')", "setStep('zip')", "setStep('search')", "helperAddrStep = 'save'", "helperAddrStep = 'pick'"]) {
    assert.ok(cap.includes(mark), `단계 갱신: ${mark}`)
  }
  // 자동입력이 끝나면 [저장] 버튼을 짚어주고, 빨간 경고 대신 초록 안내를 보여줍니다.
  assert.ok(cap.includes("spotlight(findExact('save'), '👆 저장을 눌러주세요')"), '[저장] 을 짚어줘야 합니다')
  assert.ok(cap.includes("helperAddrStep === 'save'"), '자동입력이 끝난 상태를 화면이 구분해야 합니다')
  assert.ok(cap.includes('거의 다 됐습니다'), '끝났다고 알려야 합니다')
  // 진단 정보에 어느 단계에서 멈췄는지 들어갑니다.
  assert.ok(/step: helperAddrStep/.test(cap), '진단·건강 보고에 단계 포함')
  // 주소가 맞아지면 단계 표는 사라집니다.
  assert.ok(cap.includes("if (ok) { helperAddrStep = ''"), '주소가 맞으면 단계 표를 지웁니다')
})

test('접힌 상태의 버튼은 무슨 버튼인지 글로 쓰고, 눈에 띄게 크다', () => {
  /*
   * 예전에는 지름 46~56px 짜리 🇻🇳 동그라미였습니다. "우측에 작게 표시되는
   * VN 로고" 가 무슨 버튼인지 알 수 없다는 지적(운영자 26-09-06)에 따라
   * 하는 일을 글로 쓴 큰 버튼으로 바꿨습니다.
   */
  const panel = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  for (const [name, src] of [['상품 화면', panel], ['결제 화면', cap]]) {
    assert.ok(src.includes('배송·구매대행 신청'), `${name}: 버튼에 하는 일을 써야 합니다`)
    assert.ok(/min-width:\s*188px/.test(src) && /min-height:\s*60px/.test(src), `${name}: 예전(46~56px)보다 확실히 커야 합니다`)
  }
  // 동그라미로 되돌아가지 않게 (border-radius:50% + 고정 46/56px)
  assert.ok(!/width:\s*46px;height:\s*46px/.test(cap), '작은 동그라미로 되돌리면 안 됩니다')
  assert.ok(!/\.fab \{ width: 56px; height: 56px/.test(panel), '작은 동그라미로 되돌리면 안 됩니다')
})

test('쿠팡 어느 화면에서나 시작 버튼이 뜬다 — 단 상품·결제 화면은 빼고', () => {
  // "쿠팡 접속하면 바로 뜨도록" (운영자 26-09-06). 홈·검색·카테고리에는
  // 아무 입구가 없었습니다. 상품 화면에는 견적 패널이, 결제 화면에는
  // 도우미 카드가 이미 뜨므로 거기서는 겹치지 않게 뺍니다.
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const fn = cap.slice(at(cap, 'async function renderLauncher'), at(cap, "wrap.append(btn, x)"))
  assert.ok(fn.includes('MONEY_HOSTS.includes(location.host)') && fn.includes('PRODUCT_PATH.test(location.pathname)'),
    '상품·결제 화면에서는 그리지 않아야 합니다')
  assert.ok(/PRODUCT_PATH = \/\\\/\(vp\|vm\)\\\/products\\\//.test(cap), '상품 화면 경로를 알아봐야 합니다')
  assert.ok(fn.includes("send('openSite')"), '누르면 우리 화면으로 갑니다')
  assert.ok(cap.includes('return renderLauncher()'), 'run() 이 시작 버튼을 그려야 합니다')
  // 이 탭에서 닫을 수 있어야 합니다 (쇼핑을 가릴 수 있으니).
  assert.ok(fn.includes('LAUNCH_CLOSED_KEY'), '닫으면 이 탭에서는 다시 뜨지 않아야 합니다')
})

test('소포에 적을 성함은 창(prompt)이 아니라 카드 안 입력칸에서 받는다', () => {
  /*
   * 창으로 물으면 한 번 넣은 값이 어디에 쓰이는지 다시 보이지 않아, 시험 삼아
   * 넣은 이름이 그대로 남습니다 (운영자 26-09-06: "박승우는 샘플" ).
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  assert.ok(!/window\.prompt\([^)]*이름/.test(stripComments(cap)), '이름을 창으로 묻지 않습니다')
  assert.ok(cap.includes('id="kb-name-input"'), '카드 안에 성함 입력칸이 있어야 합니다')
  assert.ok(cap.includes('kb-name-clear'), '지우는 방법도 그 자리에 있어야 합니다')
  // 안내는 입력칸 **안에** — 치기 시작하면 저절로 사라집니다 (운영자 26-09-06).
  assert.ok(cap.includes('placeholder="여기에 받으시는 분 성함을 입력"'), '입력칸 안에 무엇을 넣는지 써야 합니다')
  // 칸 아래 한 줄은 굵게 — 첫눈에 보여야 합니다 (운영자 26-09-06)
  assert.ok(cap.includes('주문하는 고객님의 성함을 입력하세요.'), '누구 이름인지 한 줄로 말해야 합니다')
  assert.ok(/font-size:13.5px;font-weight:900;color:#7a4b00/.test(cap), '그 한 줄은 굵고 크게')
  assert.ok(!/<div[^>]*>🏷 소포에 적을 성함/.test(cap), '칸 위에 따로 라벨을 두지 않습니다')
  // 이름이 비어 있으면 자동 등록을 시작하지 않습니다 — 주인을 못 찾는 배송지가 됩니다.
  // 이름을 확인한 **바로 뒤**에 막아야 합니다 (사이에 다른 일이 끼면 이미 늦습니다)
  const flow = cap.slice(at(cap, 'const name = getRecipientName()')).slice(0, 900)
  assert.ok(flow.includes('성함을 먼저 넣어주세요') && flow.includes('return'), '이름 없이 진행하면 안 됩니다')
  // 치는 도중에 카드가 다시 그려지면 글자가 날아갑니다.
  assert.ok(cap.includes("document.activeElement?.id === 'kb-name-input'"), '치는 중에는 다시 그리지 않습니다')
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

test('배송 요청사항 — 창고는 「문 앞 + 비밀번호없이 출입」이어야 합니다', () => {
  /*
   * 운영자 확정 26-09-06: 창고 공동현관에는 **출입번호가 없습니다.**
   * 기사님이 번호를 물어보는 설정으로 두면 배송이 그 자리에서 막힙니다.
   *   1번 문 앞 · 2번 비밀번호없이 출입 가능해요
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  // (아래 두 값은 파일 맨 위에서 import 합니다)
  for (const key of ['noteOpen', 'noteChange', 'noteDoor', 'noteNoCode', 'noteSave']) {
    assert.ok(COUPANG_PATTERNS.text[key], `문구 설정에 ${key} (서버에서 고칠 수 있어야 합니다)`)
    assert.ok(PATTERN_LABELS[key], `${key} 의 사람이 읽을 이름`)
  }
  // 카드에 두 가지가 글로 적혀 있어야 합니다 — 자동이 안 되면 직접 고를 수 있게.
  assert.ok(cap.includes('문 앞 · 비밀번호없이 출입'), '두 가지를 그대로 보여줍니다')
  assert.ok(cap.includes('출입번호가 없습니다'), '왜 필요한지 말해야 합니다')
  // 버튼은 [⚡ 자동입력] 하나로 합쳤습니다 — 배송지 다음에 이어서 합니다 (운영자 26-09-06).
  assert.ok(!cap.includes('kb-note-fix'), '따로 버튼을 두지 않습니다 — 한 흐름입니다')
  assert.ok(cap.includes("if (helperAddrOk) runDeliveryNote()"), '주소가 맞으면 바로 요청사항으로')
  // 결제 전에도 막아 세웁니다.
  assert.ok(cap.includes('⚠️ 배송 요청사항을 확인해 주세요'), '요청사항이 안 맞으면 결제 전에 알립니다')
})

test('배송 요청사항 판정이 화면 요약 글에 속지 않는다', () => {
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  /*
   * ① 창이 열렸는지는 [동의하고 저장하기]로 판단합니다. "비밀번호없이 출입"은
   *    저장하고 나면 **화면 요약에도** 나타나서, 창이 닫혔는데 열린 줄 알고
   *    영영 ✓ 를 못 답니다.
   * ② 창을 여는 것은 제목 글자가 아니라 그 옆 [변경] 버튼입니다.
   * ③ 보기(문 앞)는 창 **안에서만** 찾습니다 — 요약에도 "문 앞"이 있습니다.
   */
  assert.ok(cap.includes("const noteModalOpen = () => Boolean(findExact('noteSave'))"), '창 판별은 저장 버튼으로')
  assert.ok(cap.includes('function noteOpenTarget'), '제목 옆 [변경] 을 찾아야 창이 열립니다')
  assert.ok(cap.includes("findExactIn(node, 'noteChange')"), '[변경] 버튼을 줄 안에서 찾습니다')
  assert.ok(cap.includes('clickChoice(key, noteModalRoot())'), '보기는 창 안에서만 고릅니다')
  assert.ok(cap.includes('function findExactIn'), '덩어리 안에서만 찾는 방법이 있어야 합니다')
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

test('맨 위 [직구 주문] 스위치 — 끄면 아무것도 하지 않는다', () => {
  /*
   * 운영자 26-09-06: "직구 주문 끄기 옵션을 맨 위에". 하노이가 아니라 한국으로
   * 받으실 때는 우리가 참견할 일이 없습니다. 끄면 자동도, 경고도, 결제 전
   * 확인도 없습니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  const post = readFileSync(new URL('../extension/src/content/postcode-fill.js', import.meta.url), 'utf8')

  assert.ok(cap.includes('kb-mode-off') && cap.includes('kb-mode-on'), '결제 화면 카드에 끄기·켜기')
  assert.ok(cap.includes('직구 주문 <span style="color:#8b95a1">꺼짐</span>'), '꺼진 상태를 보여줍니다')
  // 꺼지면 경고도 자동도 없습니다.
  const offBranch = cap.slice(at(cap, 'if (directOff) {')).slice(0, 1400)
  assert.ok(offBranch.includes("payGuard.warn = ''"), '결제 전 경고도 끕니다')
  assert.ok(offBranch.includes('return'), '나머지는 아예 하지 않습니다')
  // 상품 화면·시작 버튼·우편번호 자동검색까지 같은 스위치를 따릅니다.
  assert.ok(main.includes("kbDirectOff") && main.includes("view: 'off'"), '상품 화면도 조용해집니다')
  assert.ok(panel.includes("state.view === 'off'"), '상품 패널에 꺼짐 화면')
  assert.ok(panel.includes('data-act="mode-off"') && panel.includes('data-act="mode-on"'), '패널에도 스위치')
  assert.ok(post.includes('kbDirectOff'), '우편번호 자동검색도 멈춥니다')
})

test('막히면 [✋ 자동 끄고 직접 입력] 으로 빠져나올 수 있다', () => {
  /*
   * 운영자 26-09-06: "자동입력될 때 막히더라도 기능 해제하고 다시 수동으로
   * 입력 가능하게." 자동이 도는 동안 우리가 계속 버튼을 누르고 칸을 채우면
   * 고객이 직접 고칠 수 없습니다.
   */
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const post = readFileSync(new URL('../extension/src/content/postcode-fill.js', import.meta.url), 'utf8')
  assert.ok(cap.includes('✋ 자동 끄고 직접 입력'), '탈출구 버튼')
  assert.ok(cap.includes('function stopAutomation'), '전부 멈추는 함수')
  const stop = cap.slice(at(cap, 'function stopAutomation'), at(cap, '/** 카드 만들기'))
  assert.ok(stop.includes('helperStopped = true') && stop.includes('clearSpotlight()'), '표시도 치웁니다')
  assert.ok(stop.includes('JOB_KEY, JOB_STATE_KEY, NOTE_JOB_KEY, NOTE_STATE_KEY'), '프레임 쪽 도우미도 멈춥니다')
  assert.ok(stop.includes("'kbPostcodeQuery'") && stop.includes('kbAutoStopped'),
    '우편번호 창에서 고객이 본인 주소를 찾을 수 있어야 합니다')
  assert.ok(post.includes('kbAutoStopped'), '우편번호 자동검색이 그 신호를 봐야 합니다')
  // 도는 루프들이 멈춤을 존중해야 실제로 멈춥니다.
  assert.ok(cap.split('if (helperStopped)').length - 1 >= 5, '모든 루프가 멈춤을 확인해야 합니다')
  // 자동이 도는 동안에는 항상 보여야 합니다 (막힌 뒤에 찾을 수 없으면 소용없습니다).
  assert.ok(cap.includes("+ stopBtn + diagBtn"), '진행 중 화면에 늘 붙어 있어야 합니다')
  // 손대지 않기 — 멈춘 뒤에는 칸을 다시 채우지 않습니다.
  assert.ok(cap.includes('if (!helperStopped) autofillAddressDialog({ code, phone })'), '멈춘 뒤에는 채우지 않습니다')
})

test('배송지와 배송 요청사항은 한 흐름 — 여섯 줄로 보여준다', () => {
  // 운영자 26-09-06: "입력을 분리하지 말고 한 번에 차례대로".
  const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
  const steps = cap.slice(at(cap, 'const FLOW_STEPS = ['), at(cap, 'let helperAddrStep = \'\'\n\n  /**') + 1)
  for (const label of ['배송지 창 열기', '창고 주소 채우기', '[저장] 누르기',
    '배송 요청사항 열기', '문 앞 · 비밀번호없이 출입', '[동의하고 저장하기]']) {
    assert.ok(cap.includes(label), `여섯 줄에 "${label}"`)
  }
  assert.ok(cap.includes('function flowStage'), '지금 어느 줄인지 알려주는 함수')
  assert.ok(cap.includes('창고 주소와 배송 요청사항을 차례대로 넣어드립니다'), '버튼도 한 번에라고 말합니다')
  // 주소가 맞아지면 이어서 요청사항으로 — 두 번 누르지 않게.
  assert.ok(cap.includes('if (helperChain && ok'), '주소 다음에 이어서 진행합니다')
})
