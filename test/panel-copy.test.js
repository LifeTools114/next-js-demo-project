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

test('배송만은 쿠팡 결제가 먼저 — 상품 화면에 주문서 버튼을 두지 않는다', () => {
  /*
   * 운영자 확정 (26-09-04): "배송대행은 계산(결제)까지 마무리된 후에 주문서
   * 작성이 나와야 함". 신청서는 결제가 끝난 주문완료 화면의 [하노이 배송 신청]
   * 으로만 엽니다. 담자마자 주문서를 열면 쿠팡 주문번호 없는 신청서가 생기고,
   * 결제 화면의 배송지 검사도 건너뛰게 됩니다.
   */
  const src = readFileSync(new URL('../extension/src/content/panel.js', import.meta.url), 'utf8')
  const fn = src.slice(src.indexOf('function renderButtons'), src.indexOf('function render()'))
  const fwd = fn.slice(fn.indexOf("if (state.track === 'forwarding') {"), fn.indexOf('// 담은 후 · 구매하고 배송까지'))
  const agent = fn.slice(fn.indexOf('// 담은 후 · 구매하고 배송까지'))

  assert.ok(!fwd.includes('data-act="checkout"'), '배송만 분기에는 주문서 버튼이 없어야 합니다')
  assert.ok(fwd.includes('data-act="affiliate"'), '배송만의 다음 행동은 [쿠팡에서 결제하기] 뿐입니다')
  assert.ok(agent.includes('data-act="checkout"'), '구매하고 배송까지는 바로 신청서로 갑니다')
  // 순서를 눈에 보이게 — ① 담기 ② 쿠팡 직접 결제 ③ 결제 후 [하노이 배송 신청]
  assert.ok(fn.includes('직접 결제'), '"직접 결제" 가 먼저라고 적혀야 합니다')
  assert.ok(fn.includes('[하노이 배송 신청]'), '결제 후 무엇을 누를지 미리 알려야 합니다')
})

test('팝업도 배송만은 결제 먼저 · 견적함을 트랙 안 가리고 /checkout 에 싣지 않는다', () => {
  const popup = readFileSync(new URL('../extension/src/popup/popup.js', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../extension/src/popup/popup.html', import.meta.url), 'utf8')
  // 두 방식이 섞인 견적함이 첫 상품 기준으로만 계산되던 원인 — 직접 URL 조립 금지.
  assert.ok(!popup.includes('/checkout?cart=${payload}'), '팝업이 /checkout 주소를 직접 만들면 안 됩니다')
  assert.ok(popup.includes("send('openCheckout', { track: 'agent' })"), '구매하고 배송까지는 백그라운드가 트랙별로 걸러 엽니다')
  assert.ok(popup.includes("prefs.track === 'forwarding'"), '배송만이면 결제 먼저 안내')
  assert.ok(html.includes('쿠팡 결제가 먼저입니다'), '팝업 안내 문구')
  assert.ok(html.includes('order-late'), '결제 후 화면을 놓친 분을 위한 길은 남겨둡니다')
})

test('서버가 꺼져 있으면 빈 탭 대신 이유를 돌려준다', () => {
  // 패널은 캐시로 멀쩡해 보여도 서버가 꺼져 있으면 /checkout 탭이
  // "사이트에 연결할 수 없음" 이 됩니다 — 고객에게는 그냥 에러 페이지입니다.
  const sw = readFileSync(new URL('../extension/src/background/service-worker.js', import.meta.url), 'utf8')
  const oc = sw.slice(sw.indexOf("case 'openCheckout'"), sw.indexOf("case 'quoteCart'"))
  assert.ok(oc.includes('/api/extension/config'), '탭을 열기 전에 서버를 찔러봐야 합니다')
  assert.ok(oc.indexOf('fetch(') < oc.indexOf('chrome.tabs.create'), '확인이 탭 열기보다 먼저')
  assert.ok(oc.includes('start-server'), '고칠 방법(서버 켜기)을 알려줘야 합니다')
  const main = readFileSync(new URL('../extension/src/content/main.js', import.meta.url), 'utf8')
  assert.ok(main.includes('notice: res?.ok'), '패널이 그 이유를 보여줘야 합니다')
})
