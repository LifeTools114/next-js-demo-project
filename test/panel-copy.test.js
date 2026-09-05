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

test('제휴 링크는 배송만에서, 사용자가 누를 때만, 고지와 함께', () => {
  // 쿠팡 파트너스·크롬 웹스토어가 막는 것은 제휴 링크가 아니라
  //   (1) 고지 없이 (2) 클릭 없이 (3) 몰래 URL 바꾸기 입니다.
  // 셋 중 하나라도 어기면 계정 해지 + 확장 삭제 사유입니다.
  assert.ok(panel.includes('data-act="affiliate"'), '사용자가 누르는 버튼이어야 합니다')
  assert.ok(/제휴 링크로 열립니다|파트너스 제휴 링크/.test(panel), '버튼 옆 고지가 있어야 합니다')
  assert.ok(/금액은 똑같습니다|금액은 동일합니다/.test(panel), '가격이 같다는 고지가 있어야 합니다')

  // 구매대행에는 절대 붙지 않습니다 (본인 구매 = self-referral).
  assert.ok(main.includes("if (track !== 'forwarding') return"),
    '구매하고 배송까지 트랙은 제휴 호출 자체를 막아야 합니다')
  assert.ok(panel.includes("state.track === 'forwarding'"),
    '제휴 버튼은 배송만 트랙에서만 그려야 합니다')
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

test('배송만은 쿠팡 결제가 먼저 — 상품 화면에 주문서 버튼을 두지 않는다', () => {
  /*
   * 운영자 확정 (26-09-04): "배송대행은 계산(결제)까지 마무리된 후에 주문서
   * 작성이 나와야 함". 신청서는 결제가 끝난 주문완료 화면에서 저절로 열립니다.
   * 담자마자 주문서를 열면 쿠팡 주문번호 없는 신청서가 생기고, 결제 화면의
   * 배송지 검사도 건너뛰게 됩니다.
   */
  const src = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  const raw = src.slice(at(src, 'function renderButtons'), at(src, 'function render()'))
  // 구매하고 배송까지 분기 표식(주석)을 기준으로 앞뒤를 나눈 뒤, 각각 주석을 걷어내고 봅니다.
  const agentAt = at(raw, '// 담은 후 · 구매하고 배송까지')
  const before = stripComments(raw.slice(0, agentAt))   // 배송만 (담기 전·담은 후) 이 그려지는 쪽
  const after = stripComments(raw.slice(agentAt))        // 구매하고 배송까지 분기
  // 주문서 버튼은 구매하고 배송까지 분기에만, 딱 한 번.
  assert.equal((after.match(/data-act=["']?checkout["']?/g) ?? []).length, 1, '주문서 버튼은 구매하고 배송까지 분기에 한 번만')
  assert.ok(!/checkout/i.test(before), '배송만 쪽 어디에도 checkout 을 부르는 코드가 없어야 합니다')
  // 배송만의 다음 행동은 [쿠팡에서 결제하기] 뿐입니다.
  const fwd = before.slice(at(before, "if (state.track === 'forwarding') {"))
  assert.ok(/data-act=["']affiliate["']/.test(fwd), '배송만의 다음 행동은 [쿠팡에서 결제하기] 뿐입니다')
  // 순서를 눈에 보이게 — 그려지는 템플릿만 봅니다 (주석은 걷어냈습니다).
  const steps = before.slice(at(before, 'const fwdSteps'), at(before, 'const notice ='))
  assert.ok(steps.includes('<b>직접 결제</b>'), '"직접 결제" 가 먼저라고 적혀야 합니다')
  assert.ok(steps.includes('저절로 열립니다'), '결제 후 신청서가 저절로 열린다고 알려야 합니다 (autoForward)')
  assert.ok(steps.includes('[하노이 배송 신청]'), '안 열렸을 때 누를 것도 알려야 합니다')
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
  const run = async (cart, lateNo = '') => {
    const sent = [], alerts = []
    const notes = { 'order-note': { hidden: true }, 'late-no': { value: lateNo } }
    const ctx = vm.createContext({
      cart, send: async (type, payload) => { sent.push({ type, payload }); return { ok: true } },
      alert: (m) => alerts.push(m), $: (id) => notes[id],
      handlers: {},
    })
    const body = popup.slice(at(popup, 'const agentItemsInCart'), at(popup, "$('zone').addEventListener"))
      .replace("$('btn-order').addEventListener('click', ", 'handlers.order = (')
      .replace("$('order-late').addEventListener('click', ", 'handlers.late = (')
    vm.runInContext(body, ctx)
    await ctx.handlers.order()
    // vm 안에서 만든 객체는 프로토타입이 달라 deepStrictEqual 이 실패합니다 — JSON 으로 평평하게.
    const flat = () => JSON.parse(JSON.stringify(sent))
    return { get sent() { return flat() }, alerts, note: !notes['order-note'].hidden, late: ctx.handlers.late }
  }
  const F = { productName: 'x', productPrice: 1000, quantity: 1, track: 'forwarding' }
  const A = { productName: 'y', productPrice: 2000, quantity: 1, track: 'agent' }

  const onlyFwd = await run([F])
  assert.equal(onlyFwd.sent.length, 0, '배송만만 담겼으면 신청서를 열지 않습니다')
  assert.equal(onlyFwd.note, true, '대신 "결제가 먼저" 안내를 펼칩니다')

  const onlyAgent = await run([A])
  assert.deepEqual(onlyAgent.sent, [{ type: 'openCheckout', payload: { track: 'agent', items: [A] } }],
    '구매하고 배송까지만 담겼으면 그 상품을 실어 바로 신청서로')
  assert.equal(onlyAgent.note, false)

  const mixed = await run([F, A])
  assert.deepEqual(mixed.sent[0].payload.items, [A], '섞여 있으면 구매하고 배송까지 상품만 실어 보냅니다')
  assert.equal(mixed.note, true, '배송만 상품에 대해서는 결제 먼저 안내')

  // 결제 후 경로 — 주문번호 없이는 열리지 않습니다.
  const late = await run([F], '12')
  const before = late.sent.length
  await late.late()
  assert.equal(late.sent.length, before, '주문번호가 짧으면 열지 않습니다')
  assert.ok(late.alerts.some((m) => m.includes('주문번호')), '주문번호를 적으라고 말합니다')
  const late2 = await run([F], '1788621755836')
  await late2.late()
  assert.deepEqual(late2.sent.at(-1), { type: 'openCheckout', payload: { track: 'forwarding', coupangOrderNo: '1788621755836' } })
})

test('상품 화면 [주문서]는 고른 방식의 상품만 싣고, 방식·상품이 바뀌면 서버 안내를 지운다', () => {
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  const oc = main.slice(at(main, 'onCheckout:'), at(main, 'onShortcutOpen:'))
  assert.ok(oc.includes("filter((i) => i.track === track)"), '통째로 보내면 배송만 상품이 구매대행으로 바뀝니다')
  assert.ok(oc.includes('notice: res?.ok'), '실패 이유를 패널에 보여줍니다')
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
