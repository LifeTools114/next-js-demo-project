/**
 * 배송지 창이 **다른 출처 프레임**에 그려질 때 — 프레임 도우미 계약
 *
 * 26-09-06 운영자 화면: 배송지 선택 창이 열려 있고 저장된 YS-ECOM 행과
 * [+ 배송지 추가]가 보이는데, 확장은 ① [배송지 변경] 열기에서 멈춰 창 뒤에
 * 가려진 버튼을 짚고 있었습니다. 최상위 문서에서는 창 안이 안 보인 것입니다.
 *
 * 대응: manifest all_frames 로 프레임 안에서도 실행하고, 프레임 쪽 도우미가
 * chrome.storage(kbAddrJob / kbAddrJobState)로 최상위와 말하며 이어받습니다.
 * 실제 동작은 가짜 결제 화면(scratchpad steps-frame.mjs)에서 확인했고,
 * 여기서는 그 구조가 조용히 되돌아가지 않도록 지킵니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cap = readFileSync(new URL('../extension/src/content/order-capture.js', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))

/** 기준점이 사라지면 조용히 통과하지 말고 이름을 대며 실패합니다 */
const at = (src, needle) => {
  const i = src.indexOf(needle)
  assert.notEqual(i, -1, `테스트 기준점이 사라졌습니다: ${needle}`)
  return i
}
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')
/** 들여쓰기 2칸의 함수/화살표 하나 — 시작 문구부터 같은 깊이의 닫는 괄호까지 */
const block = (start) => {
  const s = at(cap, start)
  const e = cap.indexOf('\n  }', s)
  assert.notEqual(e, -1, `${start} 의 끝을 못 찾음`)
  return cap.slice(s, e + 4)
}

test('결제 화면 스크립트가 프레임 안에서도 실행된다 (all_frames) — 상품 패널은 아니다', () => {
  const entry = manifest.content_scripts.find((c) => c.js.includes('src/content/order-capture.js'))
  assert.ok(entry, 'order-capture.js 를 싣는 content_scripts 항목')
  assert.equal(entry.all_frames, true, '배송지 창이 다른 출처 iframe 이면 프레임 안에서 실행돼야 창 안이 보입니다')
  for (const host of ['checkout.coupang.com', 'cart.coupang.com', 'mc.coupang.com', 'www.coupang.com', 'm.coupang.com']) {
    assert.ok(entry.matches.some((m) => m.includes(host)), `${host} 프레임에도 실려야 합니다`)
  }
  // 상품 화면 패널(main.js)이 프레임마다 뜨면 화면에 패널이 여러 개 겹칩니다.
  const product = manifest.content_scripts.find((c) => c.js.includes('src/content/main.js'))
  assert.ok(product && !product.all_frames, '상품 패널은 최상위에서만')
})

test('프레임에서는 카드·수집을 하지 않고 배송지 창 도우미만 돈다', () => {
  const tail = stripComments(cap.slice(at(cap, 'const MONEY_HOSTS')))
  assert.ok(/if \(IS_TOP\) \{[\s\S]*run\(\)[\s\S]*\} else \{[\s\S]*frameAddressHelper\(\)/.test(tail),
    '최상위만 run()·재시도 타이머, 프레임은 frameAddressHelper() 만')
  // 같은 출처 프레임은 최상위가 allDocs 로 이미 보므로 손대지 않습니다 (같은 버튼 두 번 누름 방지).
  const helper = cap.slice(at(cap, 'async function frameAddressHelper'), at(cap, 'const readJob'))
  assert.ok(helper.includes('if (IS_TOP || topReachable()) return'), '최상위·같은 출처 프레임에서는 빠져야 합니다')
  assert.ok(cap.includes('window.top.document'), '같은 출처 판별은 최상위 문서에 손이 닿는지로')
})

test('최상위와 프레임은 chrome.storage 로 말한다 — 요청에 이름까지 싣고, 끝나면 지운다', () => {
  assert.ok(cap.includes("const JOB_KEY = 'kbAddrJob'") && cap.includes("const JOB_STATE_KEY = 'kbAddrJobState'"), '두 키')
  // 프레임은 최상위의 localStorage(이름)를 못 읽습니다 — 요청에 실어야 상세주소에 이름이 들어갑니다.
  assert.ok(cap.includes('[JOB_KEY]: { code, phone, name, addr1, at: jobAt }'), '작업 요청에 code·phone·name·addr1')
  const helper = cap.slice(at(cap, 'async function frameAddressHelper'), at(cap, '카드 닫기 기록'))
  assert.ok(helper.includes('autofillAddressDialog({ code, phone, name, force: true })'), '프레임은 요청에 실린 이름으로 채웁니다')
  assert.ok(cap.includes('const name = nameIn ?? getRecipientName()'), 'autofillAddressDialog 가 이름을 인자로 받습니다')
  for (const step of ["set('pick')", "set('pick', true)", "set('done-pick')", "set('add')", "set('add', true)",
    "set('fill')", "set('zip')", "set('zip', true)", "set('search')", "set('detail')", "set('save')", "set('failed')"]) {
    assert.ok(helper.includes(step), `프레임 보고 단계: ${step}`)
  }
  // 표시는 버튼이 있는 문서에 그려야 자리가 맞습니다 — 프레임이 자기 안의 버튼을 짚습니다.
  for (const spot of ["spotlight(sel, '👆 여기를 눌러주세요')", "spotlight(addBtn, '👆 여기를 눌러주세요')",
    "spotlight(findExact('zipSearch'), '👆 여기를 눌러주세요')", "spotlight(findExact('save'), '👆 저장을 눌러주세요')"]) {
    assert.ok(helper.includes(spot), `프레임 안에서 짚기: ${spot}`)
  }
  // 최상위 감시 루프는 프레임 보고를 단계 표에 그대로 비춥니다.
  const loop = cap.slice(at(cap, 'while (!mode) {'), at(cap, "if (mode) { clearSpotlight(); setWait('', '') }"))
  assert.ok(loop.includes('const fs = await readFrameState(jobAt)'), '루프마다 프레임 보고를 읽습니다')
  assert.ok(loop.includes('setStep(fs.step)'), '보고된 단계를 단계 표에')
  assert.ok(loop.includes("if (fs.step === 'done-pick' || fs.step === 'save' || fs.step === 'failed')"), '끝 상태를 알아봅니다')
  assert.ok(loop.includes("if (helperAddrOk) { mode = 'ok'; break }"),
    '주소가 창고로 바뀌면(프레임이 [선택]을 눌러 창이 통째로 사라진 경우) 더 기다리지 않습니다')
  assert.ok(cap.includes('helperAddrOk = ok && !onCart'), '렌더가 확인 결과를 남겨야 루프가 압니다')
  // 끝나면 요청을 지워 다음 창이 옛 작업을 잇지 않게.
  assert.ok(cap.includes('chrome.storage.local.remove([JOB_KEY, JOB_STATE_KEY])'), 'finish 에서 요청 정리')
  // 오래된 요청은 무시 — 어제 걸어 둔 작업으로 오늘 창에서 움직이면 안 됩니다.
  assert.ok(helper.includes('Date.now() - j.at < JOB_FRESH_MS'), '요청 신선도 검사')
})

test('저장된 창고 주소를 [선택]하는 길이 ReferenceError 로 죽지 않는다', () => {
  /*
   * savedSel 이 while 블록 안 const 였습니다 — 루프 밖(select 모드)에서 쓰는
   * 순간 ReferenceError 가 나서, 창고 주소를 이미 저장해 둔 고객(두 번째
   * 이용)에게는 "등록 중…" 이 영영 안 끝났습니다. 가짜 화면(same-saved)으로
   * 재현·확인했습니다 (26-09-06).
   */
  const fn = stripComments(cap.slice(at(cap, 'async function runAddrAutofill'), at(cap, 'const priceRow')))
  assert.ok(/\n\s*let savedSel = null/.test(fn), '루프 밖 let 으로 선언해야 합니다')
  assert.ok(!/const savedSel/.test(fn), '블록 안 const 로 되돌리면 루프 밖에서 죽습니다')
  assert.ok(fn.includes('savedSel = findSavedSelect(code)') && fn.includes('if (savedSel) fireClick(savedSel)'),
    '루프 안에서 찾고 루프 밖에서 누릅니다')
})

test('🩺 진단은 진행 중에도 보이고, 프레임·shadow 정보를 담는다', () => {
  // 운영자는 75초를 못 기다리고 캡처만 보냈습니다 — 멈춘 자리에서 바로 복사할 수 있어야 합니다.
  assert.ok(cap.includes('const diagBtn = helperAddrBusy || helperAddrFailed'), '실패 뒤에만이 아니라 진행 중에도')
  const src = stripComments(cap)
  assert.equal(src.split('id="kb-diag"').length - 1, 1, '진단 버튼 HTML 은 한 곳(diagBtn)에서만')
  const diag = cap.slice(at(cap, 'function addrDiagnostics'), at(cap, 'return JSON.stringify(out)'))
  for (const k of ['out.isTop', 'out.shadowRoots', 'out.crossHosts', 'out.frameState', 'out.loose']) {
    assert.ok(diag.includes(k), `진단에 ${k} — 창이 프레임인지·shadow 인지·문구가 있긴 한지 구분하는 정보`)
  }
  // 개인정보 금지 — 진단은 태그·클래스·개수·문구 주변만. 입력값을 담는 코드가 없어야 합니다.
  assert.ok(!/\.value\b/.test(diag), '진단에 입력칸 값(이름·전화)을 담으면 안 됩니다')
})

test('클릭 대상·저장된 행·입력칸 찾기는 열린 shadow root 까지 본다', () => {
  for (const name of ['const findExact = ', 'const findSavedSelect = ', 'function countMatches', 'function fillDialogInputs', 'const addressChosen = ']) {
    const body = block(name)
    assert.ok(body.includes('allRoots()'), `${name.trim()} 는 allRoots() 를 써야 합니다`)
    assert.ok(!body.includes('allDocs()'), `${name.trim()} 가 allDocs() 만 보면 웹 컴포넌트 안을 놓칩니다`)
  }
  const roots = block('function allRoots')
  assert.ok(roots.includes('el.shadowRoot'), 'shadowRoot 를 따라 들어갑니다')
})
