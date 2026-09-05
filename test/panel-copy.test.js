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
  assert.ok(cap.includes('✍️ 직접 입력할게요'), '직접 입력 길이 항상 보여야 합니다')
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
