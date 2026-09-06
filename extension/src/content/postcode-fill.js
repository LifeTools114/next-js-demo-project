/**
 * 다음(카카오) 우편번호 위젯 자동 검색·선택
 *
 * 쿠팡 배송지 창의 [우편번호 찾기]는 postcode.map.daum.net 프레임을 띄웁니다.
 * 페이지(다른 출처)에서는 이 프레임을 건드릴 수 없지만, 확장 콘텐츠
 * 스크립트는 all_frames 로 프레임 안에서도 실행됩니다.
 *
 * 동작: 결제창 카드의 [⚡ 배송지 자동입력]이 chrome.storage 에 검색 요청을
 * 남기고 [우편번호 찾기]를 눌러 이 프레임을 엽니다. 여기서는 그 요청을
 * 읽어 창고 주소를 검색하고, 결과에서 도로명이 일치하는 항목을 눌러
 * 선택까지 마칩니다. 요청이 없으면(고객이 직접 연 경우) 아무것도 하지
 * 않습니다 — 일반 사용을 방해하면 안 됩니다.
 */
;(async () => {
  const KEY = 'kbPostcodeQuery'
  const FRESH_MS = 90_000

  let req
  try {
    /*
     * 손대지 않아야 하는 두 경우 — 고객이 본인 주소를 찾는 중일 수 있습니다.
     *   · 직구 주문을 꺼 두셨다
     *   · [✋ 자동 끄고 직접 입력]을 누르셨다
     */
    const mode = await chrome.storage.local.get(['kbDirectOff', 'kbAutoStopped'])
    if (mode?.kbDirectOff || mode?.kbAutoStopped) return
    req = (await chrome.storage.local.get(KEY))?.[KEY]
  } catch { return }
  if (!req?.q || !req.at || Date.now() - req.at > FRESH_MS) return

  /**
   * 서버 문구 설정 반영 — 다음(카카오) 위젯이 [검색] 버튼 문구를 바꿔도
   * 서버(config/coupang-patterns.js)에서 고치면 재배포 없이 따라갑니다.
   * 캐시된 설정을 그대로 쓰므로 여기서 네트워크를 기다리지 않습니다.
   */
  const PAT = globalThis.KBPatterns
  try {
    const { config } = await chrome.storage.local.get('config')
    PAT?.apply(config?.coupang)
  } catch { /* 설정이 없으면 번들 기본값 */ }
  const hitsKey = (key, text) => PAT?.test(key, text) ?? /검색/.test(text)

  const norm = (s) => String(s ?? '').replace(/\s+/g, '')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  async function waitFor(fn, timeoutMs = 9000, stepMs = 250) {
    const until = Date.now() + timeoutMs
    while (Date.now() < until) {
      const v = fn()
      if (v) return v
      await sleep(stepMs)
    }
    return null
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
    if (setter) setter.call(input, value)
    else input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // 1) 검색 입력창 — 위젯 개편에 대비해 보이는 텍스트 입력을 폭넓게 찾습니다.
  const input = await waitFor(() =>
    [...document.querySelectorAll('input[type="text"], input:not([type])')]
      .find((el) => el.offsetParent && !el.readOnly))
  if (!input) return

  setNativeValue(input, req.q)
  // 검색 실행 — Enter + 검색 버튼/폼 제출 모두 시도
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
  input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  const searchBtn = [...document.querySelectorAll('button, a')].find((el) =>
    el.offsetParent && hitsKey('zipSubmit', norm(el.textContent)))
  searchBtn?.click()

  // 2) 결과에서 도로명(공백 무시)이 일치하는 첫 항목 클릭 → 선택 완료
  const roadToken = norm(req.road || req.q)
  const hit = await waitFor(() =>
    [...document.querySelectorAll('a, button, li, td, span')].find((el) => {
      if (!el.offsetParent || el.childElementCount > 4) return false
      const t = norm(el.textContent)
      return t.length < 200 && t.includes(roadToken)
    }))
  if (!hit) return

  // 요청 소진 — 같은 요청으로 두 번 동작하지 않게 클릭 전에 지웁니다.
  try { await chrome.storage.local.remove(KEY) } catch { /* 무시 */ }
  // li/td 같은 컨테이너가 먼저 걸리면 실제 핸들러가 있는 안쪽 링크를 눌러야 합니다.
  const target = hit.matches('a, button') ? hit
    : (hit.querySelector('a, button') ?? hit.closest('a, button') ?? hit)
  target.click()
})()
