/**
 * 쿠팡 주문완료 자동 수집 (운영자 모드 전용)
 *
 * 운영자가 구매대행 발주를 쿠팡에서 결제하면, 주문완료 화면에서
 * 주문번호·결제액을 읽어 백엔드로 보냅니다. 매입 중 주문이 하나뿐이면
 * 서버가 매입 완료까지 자동 기록합니다 — 운영자는 결제 클릭만 합니다.
 *
 * 일반 고객에게는 아무 일도 하지 않습니다(토큰이 없으면 즉시 종료).
 * 추출 실패는 조용히 넘어갑니다 — 팝업의 수동 기록 폼이 보장 경로입니다.
 * 셀렉터는 /api/extension/config 의 selectors.orderNo / orderTotal 로
 * 재배포 없이 갱신할 수 있습니다.
 */
;(() => {
  const send = (type, payload) =>
    new Promise((resolve) => chrome.runtime.sendMessage({ type, payload }, (r) => resolve(r ?? { ok: false })))

  /** 주문완료 화면으로 보이는가 — URL 또는 본문 문구 */
  function looksLikeOrderComplete() {
    const text = (document.body?.innerText ?? '').slice(0, 6000)
    // 주문/결제 화면에도 브레드크럼 "주문결제 > 주문완료" 가 있으므로,
    // 결제 버튼이 살아 있는 화면은 완료로 보지 않습니다.
    if (/최종\s*결제\s*금액/.test(text) && /결제하기/.test(text)) return false
    if (/order.*(complete|done|success)|orderResult|thankyou/i.test(location.href)) return true
    return /주문이\s*완료|결제가\s*완료|구매가\s*완료/.test(text)
  }

  function bySelectors(selectors) {
    for (const sel of selectors ?? []) {
      try {
        const el = document.querySelector(sel)
        if (el?.textContent?.trim()) return el.textContent.trim()
      } catch { /* 잘못된 셀렉터는 건너뜀 */ }
    }
    return null
  }

  function extract(config) {
    const text = document.body?.innerText ?? ''
    const noRaw =
      bySelectors(config?.selectors?.orderNo) ??
      text.match(/주문\s*번호[^\d]{0,10}(\d{9,20})/)?.[1] ??
      new URLSearchParams(location.search).get('orderId')
    const amtRaw =
      bySelectors(config?.selectors?.orderTotal) ??
      text.match(/(?:총\s*결제\s*금액|결제\s*금액|총\s*주문\s*금액)[^\d]{0,20}([\d,]{4,})\s*원/)?.[1]

    const coupangOrderNo = String(noRaw ?? '').replace(/\D/g, '')
    const amountKrw = Number(String(amtRaw ?? '').replace(/[^\d]/g, ''))
    return { coupangOrderNo, amountKrw }
  }

  function toast(text, ok) {
    const el = document.createElement('div')
    el.dataset.kbUi = '1'
    el.textContent = text
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:10px;' +
      `font:600 13px/1.4 sans-serif;color:#fff;background:${ok ? '#17916b' : '#b3801d'};box-shadow:0 4px 14px rgba(0,0,0,.2)`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 6000)
  }

  /**
   * 고객 흐름 — 쿠팡 결제가 먼저입니다.
   * 주문완료 트랜잭션(주문번호)을 받아 [하노이 배송 신청] 버튼을 띄우고,
   * 누르면 견적함의 배송대행 상품 + 쿠팡 주문번호를 들고 배송비 결제
   * (체크아웃)로 넘어갑니다. 자동으로 열지 않습니다 — 사용자 클릭만.
   */
  function offerForwarding(coupangOrderNo) {
    const guard = `kb-offered-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* 안내가 두 번 떠도 해는 없습니다 */ }

    const card = document.createElement('div')
    card.dataset.kbUi = '1'
    card.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #dbe4f0;' +
      'border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:14px;width:260px;font:13px/1.5 sans-serif;color:#191f28'
    card.innerHTML =
      '<b>🇻🇳 방금 결제하신 주문,<br>하노이로 받아보세요</b>' +
      '<div style="font-size:11.5px;color:#4e5968;margin-top:4px">쿠팡 주문이 자동 연결되고, 국제배송비 청구서로 이어집니다.</div>' +
      '<button id="kb-fwd-go" style="margin-top:10px;width:100%;min-height:38px;border:0;border-radius:9px;' +
      'background:#3182f6;color:#fff;font-weight:700;cursor:pointer">하노이 배송 신청</button>' +
      '<button id="kb-fwd-x" style="margin-top:6px;width:100%;min-height:30px;border:0;border-radius:9px;' +
      'background:transparent;color:#8b95a1;cursor:pointer">닫기</button>'
    document.body.appendChild(card)
    card.querySelector('#kb-fwd-x').addEventListener('click', () => card.remove())
    card.querySelector('#kb-fwd-go').addEventListener('click', async () => {
      const res = await send('openCheckout', { coupangOrderNo })
      if (res?.ok) card.remove()
      else toast(res?.error ?? '견적함을 확인해 주세요.', false)
    })
  }

  /**
   * 결제와 동시에 배송요청 — 완료 화면을 감지하면 먼저 "배송대행 결제창으로
   * 연결됩니다"를 깜박이며 예고한 뒤(3초), 신청서를 **새 탭**에 엽니다.
   * 쿠팡 완료 화면은 사라지지 않고 그대로 남으며, 그 위의 안내 카드가
   * "열렸습니다 + [신청서 다시 열기]"로 바뀝니다 — 예고 없이 화면이 바로
   * 덮여 "쿠팡 화면이 사라졌다"고 느끼는 혼란을 막습니다.
   * 견적함이 비어 있으면 자동으로 열 수 없으므로 안내 카드로 대신합니다.
   */
  const FORWARD_NOTICE_MS = 3000

  function showForwardNotice() {
    document.getElementById('kb-fwd-notice')?.remove()
    if (!document.getElementById('kb-blink-style')) {
      const style = document.createElement('style')
      style.id = 'kb-blink-style'
      style.dataset.kbUi = '1'
      style.textContent = '@keyframes kbBlink{0%,100%{opacity:1}50%{opacity:.25}}'
      document.head.appendChild(style)
    }
    const card = document.createElement('div')
    card.id = 'kb-fwd-notice'
    card.dataset.kbUi = '1'
    card.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;background:#fff;' +
      'border:2px solid #3182f6;border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,.25);' +
      'padding:16px;font:13px/1.6 sans-serif;color:#191f28'
    card.innerHTML =
      '<b style="font-size:14px">✅ 쿠팡 결제 완료</b>' +
      '<div id="kb-fwd-msg" style="margin-top:8px;padding:10px;border-radius:10px;background:#e8f1ff;' +
      'font-weight:800;color:#1b64da;animation:kbBlink .9s ease-in-out infinite">' +
      '🇻🇳 배송대행 결제창으로 연결됩니다…</div>' +
      '<div style="margin-top:8px;font-size:11.5px;color:#4e5968">이 쿠팡 화면은 사라지지 않고 그대로 유지됩니다.</div>'
    document.body.appendChild(card)
    return card
  }

  /** 새 탭이 열린 뒤 — 깜박임을 멈추고, 돌아온 고객이 다시 열 수 있게 합니다. */
  function forwardNoticeDone(card, checkoutUrl, coupangOrderNo) {
    if (!card?.isConnected) return
    const msg = card.querySelector('#kb-fwd-msg')
    if (msg) {
      msg.style.animation = 'none'
      msg.textContent = '🇻🇳 배송대행 결제창이 새 탭에 열렸습니다'
    }
    if (card.querySelector('#kb-fwd-reopen')) return
    const wrap = document.createElement('div')
    wrap.style.cssText = 'margin-top:10px;display:grid;gap:6px'
    wrap.innerHTML =
      '<button id="kb-fwd-reopen" style="min-height:36px;border:0;border-radius:9px;background:#3182f6;' +
      'color:#fff;font-weight:700;cursor:pointer">신청서 다시 열기</button>' +
      '<button id="kb-fwd-close" style="min-height:28px;border:0;border-radius:8px;background:#f9fafb;' +
      'color:#8b95a1;cursor:pointer">닫기</button>'
    card.appendChild(wrap)
    wrap.querySelector('#kb-fwd-reopen').addEventListener('click', () => {
      // 같은 신청서 URL 재사용 — 드래프트가 소진돼도 다시 열립니다.
      if (checkoutUrl) window.open(checkoutUrl, '_blank')
      else send('openCheckout', { coupangOrderNo })
    })
    wrap.querySelector('#kb-fwd-close').addEventListener('click', () => card.remove())
  }

  async function autoForward(coupangOrderNo) {
    const guard = `kb-fwd-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* 가드 불가 환경이면 카드 중복 정도만 감수합니다 */ }

    // 1) 완료 화면 위에 예고를 먼저 깜박입니다 — 전환의 이유를 알린 뒤 엽니다.
    const notice = showForwardNotice()
    await new Promise((resolve) => setTimeout(resolve, FORWARD_NOTICE_MS))

    // 2) 신청서는 새 탭 — 이 쿠팡 완료 화면은 그대로 남습니다.
    const res = await send('openCheckout', { coupangOrderNo })
    if (res?.ok) {
      forwardNoticeDone(notice, res.url, coupangOrderNo)
    } else {
      notice.remove()
      offerForwarding(coupangOrderNo)
    }
  }

  async function runOrderComplete() {
    const cfg = await send('getConfig')
    const { coupangOrderNo, amountKrw } = extract(cfg?.config ?? {})
    if (!coupangOrderNo || coupangOrderNo.length < 9) return

    const st = await send('getAdminState')

    // ── 고객: 결제 감지 → 배송요청 자동 (운영자 토큰이 없는 브라우저) ──
    if (!st?.hasToken) {
      await autoForward(coupangOrderNo)
      return
    }

    // ── 운영자: 구매대행 매입 자동 기록 ──
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) return
    // 같은 주문번호를 이 탭에서 두 번 보내지 않습니다 (새로고침 대비).
    const guard = `kb-captured-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* sessionStorage 불가 환경이면 서버 쪽 상태가 중복을 막습니다 */ }

    const res = await send('captureCoupangOrder', { coupangOrderNo, amountKrw })
    if (res?.ok && res.data?.matched) {
      toast(`✓ 매입 기록됨 — ${res.data.order.orderNo} (쿠팡 ${coupangOrderNo})`, true)
    } else if (res?.ok) {
      toast('매입 자동 기록 보류 — 확장 팝업의 발주 목록에서 직접 기록하세요.', false)
    }
  }

  /**
   * ── 주문/결제 화면 도우미 ──
   * 결제 순간에도 "하노이 배송이 붙어 있다"가 보여야 고객이 안심하고
   * 결제합니다. 배송지가 창고 주소 + K-ECOM 코드인지 자동 검사하고,
   * 아니면 복사 버튼으로 바로 붙여넣게 합니다.
   */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const squash = (s) => String(s ?? '').replace(/\s+/g, '')

  /**
   * 페이지 본문 텍스트에서 우리가 띄운 UI(data-kb-ui)를 뺀 값.
   *
   * 배송지 검사·상품 추출에 body.innerText 를 그대로 쓰면 안 됩니다 —
   * 경고 카드의 주소 안내(창고 주소·K-ECOM)가 검사에 잡혀
   * "주소 있음 ↔ 없음"이 매 갱신마다 뒤집히고 카드가 깜박입니다.
   */
  function pageTextSansOurUi() {
    let out = ''
    for (const el of document.body?.children ?? []) {
      if (el.dataset?.kbUi) continue
      out += (el.innerText ?? '') + '\n'
    }
    return out
  }

  /**
   * 결제창에서 직접 상품 읽기 — 고객이 [견적함에 담기] 없이 바로구매로
   * 와도 배송비 계산·자동 신청이 되도록, 주문 목록("상품명 / 수량 N개")과
   * 총 상품 가격을 본문에서 뽑아 견적함을 자동으로 채웁니다.
   */
  // 파서 본체는 parse-page.js (globalThis.KBPageParse) — IIFE 밖의 순수
  // 함수라 노드 테스트(test/page-parse.test.js)가 배포 코드를 그대로 검증합니다.
  const NOT_A_NAME = globalThis.KBPageParse?.NOT_A_NAME
    ?? /배송지|요청사항|결제|금액|쿠팡캐시|할인|수량|삭제|선택|쿠폰|무료배송|도착|장바구니|주문/

  function extractCheckoutItems() {
    if (!globalThis.KBPageParse) return []
    return globalThis.KBPageParse.extractItemsFromText(pageTextSansOurUi())
  }

  /**
   * 장바구니 DOM 추출 — 체크된 상품만.
   *
   * 장바구니 본문에는 "수량 N개" 라벨이 없고(스테퍼 UI) 옵션("옵션: 100ml, 3개")도
   * 별도 줄이라 텍스트 파싱이 자주 빗나갑니다. 예전엔 그 실패가 옛 결제 초안
   * 폴백으로 이어져 전혀 다른 금액이 떴습니다. 여기서는 체크박스가 선택된
   * 상품 블록에서 직접 읽습니다:
   *   이름 = 첫 유효 줄 (+ 옵션 줄 — 용량·개수가 무게 추정에 필요)
   *   수량 = 스테퍼 입력값 · 가격 = 블록 안 "N,NNN원" 최솟값(취소선 정가 배제)
   * 장바구니 가격 표시는 수량이 곱해진 줄 합계라 수량으로 나눠 단가로 만듭니다.
   */
  function extractCartItemsDom() {
    const entries = []
    const seen = new Set()
    for (const box of document.querySelectorAll('input[type="checkbox"]:checked')) {
      let root = box.closest('li, tr')
      for (let up = 0; !(root?.innerText ?? '').includes('원') && up < 6; up++) {
        root = (root ?? box).parentElement
      }
      const textAll = root?.innerText ?? ''
      // 전체선택 체크박스는 목록 전체를 감싸는 조상까지 올라가므로 길이로 거릅니다.
      if (!root || !textAll.includes('원') || textAll.length > 1200 || seen.has(root)) continue
      seen.add(root)

      const lines = textAll.split('\n').map((l) => l.trim()).filter(Boolean)
      let name = ''
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (l.length < 6 || l.length > 160 || NOT_A_NAME.test(l) ||
            /^[\d,.]+원?$/.test(l) || /^옵션/.test(l)) continue
        name = l
        const opt = lines.slice(i + 1, i + 4).find((x) => /^옵션\s*[:：]/.test(x))
        if (opt) name += ` (${opt.replace(/^옵션\s*[:：]\s*/, '')})`
        break
      }
      if (!name) continue

      const stepper = Number(root.querySelector(
        'input[type="number"], input[type="tel"], input[name*="quantity" i], input[class*="quantity" i]',
      )?.value)
      const qty = stepper >= 1 && stepper <= 99
        ? stepper
        : Number(lines.find((l) => /^\d{1,2}$/.test(l))) || 1

      /**
       * 줄합계 산정은 KBPageParse.cartLineTotal (순수 함수, 노드 테스트 대상):
       *   "77% 14,800원" 할인가 줄 우선 → 취소선 정가(65,000원) 배제,
       *   개인 쿠폰("30,000원 쿠폰할인 적용됨")은 판매가로 되돌림.
       * 취소선 금액은 DOM 태그(del/s)에서 모아 후보 제외에 씁니다.
       */
      const struck = []
      for (const el of root.querySelectorAll('del, s, strike, [class*="strike" i], [style*="line-through"]')) {
        for (const pm of (el.textContent ?? '').matchAll(/([\d,]{3,})원/g)) struck.push(pm[1])
      }
      const lineTotal = globalThis.KBPageParse?.cartLineTotal
        ? globalThis.KBPageParse.cartLineTotal(lines, { struck, rowText: textAll })
        : (() => {
            const prices = lines
              .filter((l) => /^[\d,]{3,}원$/.test(l))
              .map((l) => Number(l.replace(/[^\d]/g, '')))
              .filter((n) => n > 0)
            return prices.length > 0 ? Math.min(...prices) : 0
          })()

      entries.push({
        root,
        item: {
          productName: name.slice(0, 160),
          quantity: qty,
          productPrice: Math.round(lineTotal / qty),
        },
      })
      if (entries.length >= 20) break
    }

    // 전체선택이 만든 "목록 전체" 블록은 개별 상품 블록을 포함합니다 — 조상 블록 제거.
    const items = entries
      .filter((e) => !entries.some((o) => o !== e && e.root.contains(o.root)))
      .map((e) => e.item)
    // 가격을 하나도 못 읽었으면 실패로 보고 텍스트 방식에 넘깁니다.
    return items.some((i) => i.productPrice > 0) ? items : []
  }

  // 카드가 1.5초마다 다시 그려져도 서버 견적은 장바구니가 바뀔 때만 다시 부릅니다.
  let quoteCache = { key: null, fwd: null, agent: null }
  // [이용 방법 보기] 펼침 상태 — 카드는 가격만 먼저, 설명은 클릭해야 보입니다.
  let helperDetailOpen = false
  // 내역 줄 비용 안내(ⓘ) 펼침 상태 — 눌린 줄의 key(없으면 라벨)
  let helperRowInfoKey = null
  // 카드에서 고객이 고른 진행 방식 — 행을 눌러 선택하고, 그에 맞는 다음 행동을 안내합니다.
  let helperTrack = 'forwarding'

  const won = (n) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('ko-KR')}원` : null)
  const dong = (n) => (Number.isFinite(n) ? `₫${Math.round(n).toLocaleString('ko-KR')}` : null)

  /**
   * 서버 견적이 안 올 때의 로컬 계산 — 상품 페이지 패널과 같은 내장
   * 계산기(KBCalc)를 씁니다. 서버가 꺼져 있어도 카드가 '계산 중…'에
   * 머물지 않습니다. (주문 생성 시 서버가 어차피 다시 계산합니다)
   */
  function localQuote(cart, track, config) {
    const K = globalThis.KBCalc
    if (!K) return null
    try {
      if (config?.policy) K.applyConfig(config.policy)
      const zone = config?.preferences?.zone ?? 'hanoi'
      const q = K.quote(cart.map((i) => ({ ...i, track })), { track, zone })
      return {
        ok: true,
        total: q.total,
        totalVnd: q.totalVnd,
        chargeableG: q.weight?.chargeableG,
        billableKg: q.shipping?.billableKg,
        breakdown: (q.breakdown ?? []).map((l) => ({ label: l.label, krw: l.krw })),
        agentLimit: q.agentLimit ?? null,
        local: true,
      }
    } catch { return null }
  }

  async function cartQuotes(cart, config) {
    // 항상 지금 화면에서 읽은 items 를 그대로 보냅니다 — 백그라운드에 남은
    // 옛 초안·견적함이 금액에 끼어들 수 없습니다. 키는 내용 전체라
    // 수량·옵션(이름)·가격이 바뀌면 즉시 다시 견적합니다.
    const key = cart.map((i) => `${i.productName}|${i.quantity}|${i.productPrice}`).join(',')
    // 서버 견적 성공분은 내용이 바뀔 때까지 재사용, 로컬 대체분은 10초마다
    // 서버를 다시 시도 — 서버가 살아나면 자동으로 서버 값으로 돌아갑니다.
    const bothServer = Boolean(quoteCache.fwd && !quoteCache.fwd.local && quoteCache.agent && !quoteCache.agent.local)
    if (quoteCache.key === key && (bothServer || Date.now() - (quoteCache.at ?? 0) < 10_000)) return quoteCache
    const [fwd, agent] = await Promise.all([
      send('quoteCart', { track: 'forwarding', items: cart }),
      send('quoteCart', { track: 'agent', items: cart }),
    ])
    quoteCache = {
      key,
      at: Date.now(),
      fwd: fwd?.ok ? fwd : localQuote(cart, 'forwarding', config),
      agent: agent?.ok ? agent : localQuote(cart, 'agent', config),
    }
    return quoteCache
  }

  /**
   * 배송지 입력창 자동 입력 — 배송지 다이얼로그 안에서만 채웁니다.
   * 기본(passive)은 빈 칸만 채워 사용자가 적은 값을 덮지 않고,
   * [⚡ 자동입력] 버튼(force)은 명시적 클릭이므로 덮어씁니다.
   * (쿠팡은 React 라 네이티브 setter 로 넣어야 값이 인식됩니다)
   *
   * 기본주소(도로명)는 쿠팡이 우편번호 검색(다음 위젯, 별도 프레임)을
   * 강제해 스크립트로 넣을 수 없습니다 — 버튼이 자동 복사 + 안내로 잇습니다.
   */
  const NAME_KEY = 'kb-recipient-name'
  const getRecipientName = () => {
    try { return (localStorage.getItem(NAME_KEY) ?? '').trim() } catch { return '' }
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
    if (setter) setter.call(input, value)
    else input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dataset.kbFilled = '1'
  }

  /** 배송지 다이얼로그 안의 특정 칸을 찾아 채웁니다. @returns 채운 개수 */
  function fillDialogInputs(selector, value, { force = false } = {}) {
    if (!value) return 0
    let filled = 0
    for (const input of document.querySelectorAll(selector)) {
      if (!input.offsetParent) continue
      const dialog = input.closest('[role="dialog"], form') ?? input.parentElement?.parentElement
      if (!dialog || !/배송지/.test((dialog.innerText ?? '').slice(0, 2000))) continue
      const current = input.value.trim()
      if (!force && (input.dataset.kbFilled || current !== '')) continue
      if (current === value) continue
      setNativeValue(input, value)
      filled += 1
    }
    return filled
  }

  const DIALOG_FIELDS = {
    name: 'input[name*="name" i], input[placeholder*="받는"], input[placeholder*="이름"]',
    phone: 'input[type="tel"], input[name*="phone" i], input[placeholder*="휴대폰"], input[placeholder*="전화"]',
    detail: 'input[name*="detail" i], input[name*="addr2" i], input[placeholder*="상세"]',
  }

  /** 받는사람·휴대폰·상세주소를 한 번에. 상세주소는 이름을 알 때만. */
  function autofillAddressDialog({ code, phone, force = false } = {}) {
    const name = getRecipientName()
    let n = 0
    n += fillDialogInputs(DIALOG_FIELDS.name, code, { force })
    n += fillDialogInputs(DIALOG_FIELDS.phone, phone, { force })
    if (name) n += fillDialogInputs(DIALOG_FIELDS.detail, `${code}(${name})`, { force })
    return n
  }

  /**
   * 카드 닫기 기록 — "이 결제 화면(경로)"에서만 유효합니다.
   * 예전에는 전역 키 하나였는데, 한 번 닫으면 sessionStorage 가 살아있는
   * 내내(탭을 닫기 전까지) 모든 결제창에서 카드가 사라졌습니다.
   * "배송대행 하러 왔는데 화면이 안 뜬다"의 원인이 이것이었습니다.
   */
  const closedKey = () => `kb-helper-closed:${location.host}${location.pathname}`

  /** 닫아도 길을 남깁니다 — 작은 🇻🇳 버튼을 누르면 카드가 다시 열립니다. */
  function renderReopenChip() {
    if (document.getElementById('kb-helper-chip') || document.getElementById('kb-checkout-helper')) return
    const chip = document.createElement('button')
    chip.id = 'kb-helper-chip'
    chip.dataset.kbUi = '1'
    chip.textContent = '🇻🇳'
    chip.title = '하노이 배송 도우미 다시 열기'
    chip.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:46px;height:46px;' +
      'border:1px solid #dbe4f0;border-radius:50%;background:#fff;font-size:21px;cursor:pointer;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.2)'
    chip.addEventListener('click', () => {
      try { sessionStorage.removeItem(closedKey()) } catch { /* 무시 */ }
      chip.remove()
      renderCheckoutHelper()
    })
    document.body.appendChild(chip)
  }

  async function renderCheckoutHelper() {
    try {
      // 옛 전역 닫기 기록은 지웁니다 — 이미 걸려 있는 탭도 이 업데이트로 풀립니다.
      sessionStorage.removeItem('kb-helper-closed')
      if (sessionStorage.getItem(closedKey())) return renderReopenChip()
    } catch { /* 무시 */ }

    const cfg = await send('getConfig')
    const w = cfg?.config?.warehouse ?? {}
    const addr1 = w.address1 || '서울특별시 강서구 개화동로 11길 5'
    const zip = w.zip || '07504'
    const code = w.code || 'K-ECOM'
    const phone = w.phone || '010-7360-1156'

    // 배송지 다이얼로그가 열려 있으면 빈 칸을 조용히 채워둡니다 (받는사람·전화·상세주소).
    autofillAddressDialog({ code, phone })

    /**
     * 배송지 검사는 "배송지 섹션"만 봅니다 — 페이지 전체를 보면 주소록
     * (배송지 변경 목록)에 저장된 창고 주소가 잡혀서, 고객이 개인 주소로
     * 바꿔도 ✓ 확인됨으로 오판합니다. 섹션 경계를 못 찾으면 전체로 폴백.
     */
    const allText = pageTextSansOurUi()
    const addrSection = allText.match(
      /배송지[\s\S]{0,500}?(?=배송\s*요청사항|결제\s*수단|결제수단|주문\s*상품|배송\s*1건|최종\s*결제)/,
    )?.[0] ?? allText
    const body = squash(addrSection)
    const okAddr = body.includes(squash(addr1)) || body.includes(squash('개화동로11길 5'))
    const okCode = body.includes(code)
    const onCart = location.host === 'cart.coupang.com'
    /**
     * 이 화면의 상품을 항상 새로 읽습니다 — 견적함·옛 초안에 뭐가 남아 있든
     * 카드의 금액은 "지금 화면의 상품" 기준이어야 합니다.
     * 장바구니는 체크된 상품만 DOM 에서 직접 읽고, 실패하면 텍스트 방식.
     */
    let raw = onCart ? extractCartItemsDom() : []
    if (raw.length === 0) raw = extractCheckoutItems()
    const pageItems = raw.map((it, i) => ({ ...it, productId: `chk-${i}`, track: 'forwarding' }))
    // 초안은 결제창에서만 남깁니다 — 주문완료 후 자동 신청이 이 초안을 씁니다.
    // (장바구니에서도 남기면 옛 초안이 다른 결제의 금액에 끼어들 수 있습니다)
    if (pageItems.length > 0 && !onCart) await send('setCheckoutDraft', { items: pageItems })

    // 화면에서 못 읽었을 때만 고객이 직접 담은 견적함으로 계산합니다.
    const cartRes = await send('getCart')
    const fallbackCart = cartRes?.cart ?? []
    const cart = pageItems.length > 0 ? pageItems : fallbackCart
    const quotes = cart.length > 0 ? await cartQuotes(cart, cfg?.config) : { fwd: null, agent: null }
    const autoAdded = pageItems.length > 0

    let card = document.getElementById('kb-checkout-helper')
    if (!card) {
      card = document.createElement('div')
      card.id = 'kb-checkout-helper'
      card.dataset.kbUi = '1'
      card.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:280px;background:#fff;' +
        'border:1px solid #dbe4f0;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);' +
        'padding:13px;font:12.5px/1.55 sans-serif;color:#191f28;' +
        // 상세·비용 안내를 펼치면 카드가 화면보다 길어질 수 있어 내부 스크롤로 감쌉니다.
        'max-height:calc(100vh - 32px);overflow-y:auto;overscroll-behavior:contain'
      document.body.appendChild(card)
    }

    const ok = okAddr && okCode
    const lt = cfg?.config?.leadTimeDays ?? { min: 5, max: 9 }

    // ── 가격 두 줄이 카드의 전부 — 행을 눌러 진행 방식을 고릅니다 ──
    // 선택된 행은 파란 배경 + 흰 글씨 + ✓ 로 누가 봐도 "선택됨"이게.
    const priceRow = (id, label, sub, q) => {
      const sel = helperTrack === id
      return (
        `<button data-kb-sel="${id}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;` +
        'width:100%;padding:9px 11px;border:0;cursor:pointer;text-align:left;font:inherit;' +
        `background:${sel ? '#3182f6' : '#fff'}">` +
        `<span><span style="display:block;font-weight:800;font-size:13px;color:${sel ? '#fff' : '#191f28'}">` +
        `${sel ? '✓ ' : ''}${label}</span>` +
        `<span style="font-size:10.5px;color:${sel ? '#cfe0fc' : '#8b95a1'}">${sub}</span></span>` +
        (q && won(q.total)
          ? '<span style="text-align:right">' +
            `<span style="display:block;font-weight:800;font-size:17px;color:${sel ? '#fff' : '#3182f6'};white-space:nowrap">${won(q.total)}</span>` +
            (dong(q.totalVnd)
              ? `<span style="display:block;font-size:11px;font-weight:700;color:${sel ? '#ffd9d9' : '#f04452'};white-space:nowrap">≈ ${dong(q.totalVnd)}</span>`
              : '') +
            '</span>'
          : `<span style="font-size:11px;color:${sel ? '#cfe0fc' : '#8b95a1'}">계산 중…</span>`) +
        '</button>'
      )
    }

    // 금액의 근거 — 두 트랙이 같은 무게를 쓰므로 무게 줄은 하나만 보여줍니다.
    // 여유 무게(같은 요금 구간의 남은 g)를 함께 보여 "수량을 늘렸는데 배송비가
    // 그대로"인 이유가 장점(더 담아도 동일)으로 읽히게 합니다.
    const wq = quotes.fwd ?? quotes.agent
    const headroomG = wq?.billableKg
      ? Math.floor((wq.billableKg * 1000 + 500 - (wq.chargeableG ?? 0)) / 10) * 10
      : 0
    const weightLine = wq?.billableKg
      ? `<div style="margin-top:3px;font-size:10.5px;color:#8b95a1">📦 실측 추정 ${(
          (wq.chargeableG ?? 0) / 1000
        ).toFixed(1)}kg → 청구 <b>${wq.billableKg}kg</b>` +
        (headroomG >= 50
          ? ` · <b style="color:#17916b">${headroomG}g 더 담아도 배송비 동일</b>`
          : '') +
        '</div>'
      : ''

    const priceBlock = cart.length === 0
      ? '<div style="margin-top:8px;color:#4e5968;font-size:12px">상품 페이지에서 [견적함에 담기]를 하면 ' +
        '금액 계산과 자동 신청이 가능합니다.</div>'
      : '<div style="margin-top:7px;border:1px solid #e5e8eb;border-radius:10px;overflow:hidden;background:#fff">' +
        priceRow('forwarding', '배송대행', '배송비 · 쿠팡 결제는 내가', quotes.fwd) +
        '<div style="border-top:1px solid #f2f4f6"></div>' +
        priceRow('agent', '구매대행', '총액 · 결제까지 맡김', quotes.agent) +
        '</div>' +
        (autoAdded
          ? `<div style="margin-top:5px;font-size:10.5px;color:#17916b">🛒 이 화면의 상품 ${cart.length}개 기준</div>`
          : '') +
        weightLine

    // ── 선택한 방식의 다음 행동 — 카드가 결제/신청으로 유도합니다 ──
    const ctaBlock = cart.length === 0
      ? ''
      : helperTrack === 'agent' && quotes.agent?.agentLimit?.exceeded
        ? '<div style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#fff0f0;color:#c92a2a;' +
          'font-size:11.5px;font-weight:700">구매대행은 1회 상품가 합계 ' +
          `${won(quotes.agent.agentLimit.maxGoodsKrw)}까지 접수합니다 — 나눠서 신청해 주세요.</div>`
        : helperTrack === 'agent'
        ? '<style>@keyframes kbPulse{0%,100%{box-shadow:0 0 0 0 rgba(49,130,246,.55)}50%{box-shadow:0 0 0 7px rgba(49,130,246,0)}}</style>' +
          '<button id="kb-agent-go" style="margin-top:8px;width:100%;min-height:40px;border:0;border-radius:9px;' +
          'background:#3182f6;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer;' +
          'animation:kbPulse 1.5s ease-in-out infinite">구매대행 신청서 작성 →</button>' +
          '<div style="margin-top:4px;font-size:10.5px;color:#8b95a1;text-align:center">' +
          '쿠팡 결제 없이 원화/동화 입금 · 쿠폰·가입혜택 등 개인 할인은 사용 불가 (와우회원가는 반영)</div>'
        : onCart
          ? '<div style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#e6f6f0;color:#17916b;' +
            'font-size:11.5px;font-weight:700">다음: [주문하기]로 이동해 쿠팡 결제를 진행하세요 — ' +
            '결제가 끝나면 배송 신청서가 자동으로 열립니다.</div>'
          : '<div style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#e6f6f0;color:#17916b;' +
            'font-size:11.5px;font-weight:700">다음: 아래 쿠팡 [결제하기]를 누르세요 — ' +
            '결제가 끝나면 배송 신청서가 자동으로 열립니다.</div>'

    // ── 접힌 설명 영역 — 단계 안내와 구매대행 신청 버튼 ──
    const steps = (text) =>
      `<div style="margin-top:4px;font-size:11px;color:#4e5968;line-height:1.7">${text}</div>`
    const detailHead = (text) =>
      `<div style="margin-top:9px;font-size:11.5px;font-weight:800;color:#333d4b">${text}</div>`

    // 금액 내역 줄들 — 견적 응답의 근거(배송비·관세·VAT·수수료)를 그대로 보여줍니다.
    // 할증 줄에는 ⓘ — 올리면(title) 또는 누르면 왜 붙는 비용인지 보여줍니다.
    const rowInfoText = (l) => {
      const k = l.key ?? ''
      const t = l.label ?? ''
      if (k === 'surcharge-device' || t.includes('기기 취급')) {
        return '물류사 항공특송의 전자·가전 특수 취급비 — 기기당 $40, 대수만큼 부과됩니다. ' +
          '파손 위험 화물 검수·별도 포장 비용이며, 한국 기기는 베트남에서 A/S 가 어렵습니다.'
      }
      if (k === 'surcharge-fragile' || t.includes('파손주의')) return '유리·도자기 등 파손 위험 품목의 완충 보강 포장비 — 개당 $2.'
      if (k === 'surcharge-bulky' || t.includes('대형 화물')) return '청구무게 10kg 이상 대형 화물 취급비 — 건당 $5.'
      return null
    }
    const bdRows = (q) => !q?.breakdown?.length
      ? ''
      : '<div style="margin-top:5px;border-top:1px dashed #e5e8eb;padding-top:5px">' +
        q.breakdown.map((l) => {
          const info = rowInfoText(l)
          const id = l.key ?? l.label
          const btn = info
            ? `<button data-kb-rowinfo="${esc(id)}" title="${esc(info)}" aria-label="비용 안내" ` +
              'style="border:0;background:#eef4fb;color:#3182f6;border-radius:50%;width:15px;height:15px;' +
              'font-size:10px;line-height:1;cursor:pointer;padding:0;margin-left:4px;vertical-align:1px">ⓘ</button>'
            : ''
          const note = info && helperRowInfoKey === id
            ? '<div style="margin:1px 0 4px;padding:6px 8px;border-radius:8px;background:#f2f6fb;color:#4e5968;' +
              `font-size:10px;line-height:1.6">${esc(info)}</div>`
            : ''
          return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:#4e5968;line-height:1.8">` +
            `<span>${esc(l.label)}${btn}</span><b style="white-space:nowrap">${won(l.krw) ?? ''}</b></div>${note}`
        }).join('') +
        '</div>'

    const detailBlock = !helperDetailOpen || cart.length === 0
      ? ''
      : (onCart
          ? '<div style="margin-top:8px;padding:7px 9px;border-radius:9px;background:#eef4fb;color:#2b5e9e;font-size:11px">' +
            '주문 단계로 가면 배송지(한국 창고) 입력을 도와드립니다.</div>'
          : '') +
        detailHead('배송대행 — 결제는 내가, 배송만 맡김') +
        steps('쿠팡 결제 후 <b>① 배송 신청서 자동 열림</b> → ② 배송비 입금(원화/동화) → ' +
          `③ 한국창고 도착 <b>1~3영업일</b> → ④ 하노이 도착 <b>+${lt.min}~${lt.max}영업일</b>`) +
        steps('본인 결제라 <b>쿠폰·회원 할인을 모두 그대로</b> 쓸 수 있습니다.') +
        steps('무게 기준: 1kg까지 기본요금 · 이후 kg 단위(0.5 이하 버림·초과 올림)') +
        bdRows(quotes.fwd) +
        detailHead('구매대행 — 결제까지 맡김') +
        steps('쿠팡 결제가 필요 없습니다 — <b>① 신청서 저장</b> → ② 원화/동화 입금 → ③ 저희가 대신 주문 → ' +
          `④ 한국창고 <b>1~3영업일</b> → ⑤ 하노이 <b>+${lt.min}~${lt.max}영업일</b>`) +
        steps('수수료: <b>기본 5,000원</b>(상품가 10만원·5종까지) — 대리 주문·검수·발주 실비. ' +
          '초과분은 10만원 초과금액의 5% + 종류 초과 종당 1,000원.') +
        steps('와우회원가는 되도록 반영합니다. <b>쿠폰·신규가입 할인 등 개인 혜택은 사용할 수 없고</b>, ' +
          '타임세일·마감임박 등 기간 한정 할인가는 발주 시점에 끝나면 반영되지 않을 수 있습니다.') +
        steps(`1회 접수 한도: 상품가 합계 ${won(quotes.agent?.agentLimit?.maxGoodsKrw ?? 1_000_000)} (초과 시 나눠서 신청).`) +
        bdRows(quotes.agent) +
        '<div style="margin-top:7px;padding:7px 9px;border-radius:9px;background:#fff8e6;color:#d9480f;' +
        'font-size:10.5px;font-weight:700;line-height:1.6">📦 배송 기간은 모두 영업일 기준(주말·공휴일 제외) · ' +
        '해외직구 상품은 한국창고 도착까지 +2~3영업일</div>' +
        // 환불·교환·반품 — 최종 결제 전 인지 (운영자 확정 26-08-30)
        '<div style="margin-top:7px;padding:7px 9px;border-radius:9px;background:#fff0f0;color:#c92a2a;' +
        'font-size:10.5px;font-weight:700;line-height:1.6">💳 환불은 영업일 3~7일 내 지급 · ' +
        '반품·변심 취소는 구매대행 수수료 제외 / 배송대행 $1 차감 후 환불 (당사 사유는 전액 환불)<br>' +
        '↩️ 하노이 도착 후 교환·반품 반송비(하노이→한국)·쿠팡 반품비는 전액 구매자 부담 — ' +
        '2kg까지 $20 · 이후 kg당 $11 · 구매대행은 처리 기본 5,000원 추가 · 사전 접수 필수. ' +
        '교환은 반송비 + 재배송비(위 국제배송비)를 상품가와 비교하세요<br>' +
        '⚠️ 액체(스킨·세럼 등)·배터리 내장 제품·현금·대량 화물은 반송 불가 — 교환·반품이 불가합니다</div>'

    const cartLine = priceBlock + ctaBlock +
      (cart.length > 0
        ? '<button id="kb-detail" style="margin-top:7px;width:100%;min-height:30px;border:1px solid #e5e8eb;' +
          'border-radius:8px;background:#fff;color:#4e5968;font-weight:700;font-size:11.5px;cursor:pointer">' +
          (helperDetailOpen ? '접기 ▴' : '이용 방법 자세히 ▾') + '</button>'
        : '') +
      detailBlock

    /**
     * 쿠팡 「배송지 선택」 창의 실제 생김새·칸 순서 그대로 흉내낸 안내 —
     * 받는 사람 → 우편번호 찾기 → 휴대폰 번호 → 상세주소.
     * 사용자가 두 창을 나란히 놓고 칸별로 그대로 옮겨 적을 수 있습니다.
     * 상세주소(+본인 이름)는 소포 주인 매칭의 열쇠라 색·배지로 강조합니다.
     */
    const dlgRow = (icon, label, value, opts = {}) =>
      `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:7px 9px;` +
      `border:${opts.hot ? '2px solid #f59f00' : '1px solid #e5e8eb'};border-radius:8px;` +
      `background:${opts.hot ? '#fff8e6' : '#fff'}">` +
      `<span style="font-size:14px">${icon}</span>` +
      '<span style="flex:1;min-width:0">' +
      `<span style="display:block;font-size:10px;color:#8b95a1">${esc(label)}</span>` +
      `<b style="display:block;font-size:12.5px;color:${opts.hot ? '#d9480f' : '#191f28'};` +
      `white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</b></span>` +
      (opts.badge
        ? `<span style="flex-shrink:0;font-size:9.5px;font-weight:800;color:#fff;background:#f59f00;` +
          `border-radius:6px;padding:2px 6px">${opts.badge}</span>`
        : '') +
      (opts.tail ? `<span style="color:#8b95a1">${opts.tail}</span>` : '') +
      '</div>'

    const miniForm =
      '<div style="margin-top:7px;padding:10px 9px;border-radius:12px;background:#f9fafb;border:1px solid #e5e8eb">' +
      '<div style="font-size:11.5px;font-weight:800;color:#191f28;text-align:center">쿠팡 「배송지 선택」 창에 이렇게 입력</div>' +
      dlgRow('👤', '받는 사람', code) +
      dlgRow('📍', '우편번호 찾기 — 아래 [주소 복사] 후 붙여넣어 검색', addr1, { tail: '🔍' }) +
      dlgRow('📱', '휴대폰 번호 — 자동으로 입력됩니다', phone) +
      dlgRow('🏠', '상세주소 — 주소 선택 후 나타나는 칸', `${code} 본인이름`, { hot: true, badge: '중요' }) +
      '<div style="margin-top:6px;font-size:10.5px;font-weight:700;color:#d9480f;text-align:center;line-height:1.5">' +
      '⭐ 상세주소의 <u>본인 이름</u>으로 소포 주인을 찾습니다 — 꼭 넣어주세요!</div>' +
      '</div>' +
      // 주소 입력이 어려운 고객용 — 버튼 한 번으로 채울 수 있는 칸은 전부 자동입력.
      '<button id="kb-addr-fill" style="margin-top:7px;width:100%;min-height:38px;border:0;border-radius:9px;' +
      'background:#17916b;color:#fff;font-weight:800;cursor:pointer">⚡ 배송지 자동입력 (받는사람·전화·상세주소)</button>' +
      `<button data-copy="${esc(addr1)}" style="margin-top:6px;width:100%;min-height:32px;border:0;border-radius:9px;` +
      'background:#3182f6;color:#fff;font-weight:700;cursor:pointer">📋 주소 복사 — 우편번호 찾기에 붙여넣기</button>' +
      (getRecipientName()
        ? `<button id="kb-addr-name" style="margin-top:5px;width:100%;min-height:24px;border:0;background:transparent;` +
          `color:#8b95a1;font-size:10.5px;cursor:pointer">상세주소 이름: ${esc(getRecipientName())} (누르면 변경)</button>`
        : '')

    // 장바구니 화면에는 배송지가 아직 없으므로 검사하지 않습니다 (안내는 접힌 영역에).
    // 주소가 틀렸을 때의 경고·입력 안내만은 항상 보입니다 — 결제 실패로 직결되므로.
    const statusBlock = onCart
      ? ''
      : ok
        ? '<div style="margin-top:7px;padding:7px 10px;border-radius:9px;background:#e6f6f0;color:#17916b;font-size:12px">' +
          '<b>✓ 배송지 확인됨</b></div>'
        : '<div style="margin-top:7px;padding:7px 10px;border-radius:9px;background:#fff3e6;color:#a05a12;font-size:12px">' +
          '<b>⚠️ 배송지가 한국 창고가 아닙니다</b></div>' + miniForm

    const html =
      '<b>🇻🇳 하노이 배송</b>' + statusBlock +
      cartLine +
      '<button id="kb-helper-x" style="margin-top:8px;width:100%;min-height:28px;border:0;border-radius:8px;' +
      'background:#f9fafb;color:#8b95a1;cursor:pointer">닫기</button>'

    // 내용이 그대로면 다시 그리지 않습니다 — 주기 갱신 때 깜박이지 않게.
    if (card.dataset.kbHtml === html) return
    card.dataset.kbHtml = html
    card.innerHTML = html

    card.querySelectorAll('button[data-copy]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy)
          const orig = b.textContent
          b.textContent = '✓ 복사됨'
          setTimeout(() => { b.textContent = orig }, 1200)
        } catch { /* 클립보드 권한 없으면 값이 보이니 수동 복사 가능 */ }
      }),
    )
    card.querySelector('#kb-helper-x').addEventListener('click', () => {
      card.remove()
      // 이 결제 화면에서만 닫힘 — 다른 결제·장바구니에는 그대로 나타납니다.
      try { sessionStorage.setItem(closedKey(), '1') } catch { /* 무시 */ }
      renderReopenChip()
    })
    card.querySelector('#kb-addr-name')?.addEventListener('click', () => {
      const next = window.prompt('상세주소에 넣을 본인 이름 (신청서의 받는 분과 동일하게)', getRecipientName())
      if (next === null) return
      try { localStorage.setItem(NAME_KEY, next.trim()) } catch { /* 무시 */ }
      card.dataset.kbHtml = ''
      renderCheckoutHelper()
    })
    /**
     * [⚡ 배송지 자동입력] — 주소 입력이 어려운 고객용 원버튼 흐름:
     *   ① 배송지 입력창이 닫혀 있으면 열기 시도
     *   ② 받는사람·휴대폰 채움  ③ 우편번호 검색을 자동 실행·선택
     *   (postcode-fill.js 가 검색 프레임 안에서 창고 주소를 찾아 클릭)
     *   ④ 선택 후 나타나는 상세주소 칸에 K-ECOM(이름) 자동 입력
     */
    card.querySelector('#kb-addr-fill')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget
      let name = getRecipientName()
      if (!name) {
        name = (window.prompt('소포 주인 확인용 — 본인 이름을 입력하세요 (신청서의 받는 분과 동일하게)', '') ?? '').trim()
        if (name) { try { localStorage.setItem(NAME_KEY, name) } catch { /* 무시 */ } }
      }
      btn.disabled = true
      const orig = btn.textContent
      btn.textContent = '자동입력 중…'

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const clickByText = (re) => {
        const el = [...document.querySelectorAll('button, a')].find((x) =>
          x.offsetParent && !x.closest('[data-kb-ui]') && re.test((x.textContent ?? '').replace(/\s+/g, '')))
        el?.click()
        return Boolean(el)
      }
      const dialogOpen = () =>
        [...document.querySelectorAll('input')].some((i) => {
          if (!i.offsetParent) return false
          const d = i.closest('[role="dialog"], form')
          return d && /배송지/.test((d.innerText ?? '').slice(0, 2000))
        })

      if (!dialogOpen()) {
        clickByText(/배송지변경/)
        await sleep(900)
        clickByText(/배송지추가|신규배송지|새배송지/)
        await sleep(900)
      }

      autofillAddressDialog({ code, phone, force: true })

      // 우편번호 검색 자동화 — 프레임 스크립트가 읽을 검색 요청을 남기고 창을 엽니다.
      try {
        await chrome.storage.local.set({
          kbPostcodeQuery: { q: addr1, road: addr1.split(/\s+/).slice(-3).join(' '), at: Date.now() },
        })
      } catch { /* 저장 불가 시 수동 검색 폴백 */ }
      const opened = clickByText(/우편번호찾기|우편번호검색|주소찾기|주소검색/)

      // 주소 선택이 끝나면 상세주소 칸이 생깁니다 — 나타나는 즉시 채웁니다.
      let detailDone = 0
      for (let i = 0; i < 20 && !detailDone; i++) {
        await sleep(700)
        detailDone = name ? fillDialogInputs(DIALOG_FIELDS.detail, `${code}(${name})`, { force: true }) : 0
      }

      btn.disabled = false
      btn.textContent = orig
      if (detailDone) {
        toast('✓ 배송지 자동입력 완료! 내용 확인 후 [저장]만 눌러주세요.', true)
      } else if (opened) {
        toast('주소 검색창에서 자동 선택 중입니다 — 잠시 후 상세주소까지 채워집니다.', true)
      } else {
        toast('쿠팡 [배송지 변경] 창을 찾지 못했습니다 — 창을 연 상태에서 다시 눌러주세요.', false)
      }
    })
    card.querySelector('#kb-agent-go')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget
      /**
       * 서버가 꺼져 있으면 신청서 탭이 "연결할 수 없음"으로 열려 아무것도
       * 안 되는 것처럼 보입니다. 지금 견적이 로컬 대체분(local)이라는 건
       * 서버 응답이 없다는 뜻이므로, 죽은 탭 대신 이유를 알려줍니다.
       */
      if (quotes.agent?.local || quotes.fwd?.local) {
        toast('⚠️ 백엔드 서버가 꺼져 있어 신청서를 열 수 없습니다 — PowerShell에서 npm run dev 를 켠 뒤 다시 눌러주세요.', false)
        return
      }
      btn.disabled = true
      btn.textContent = '신청서 여는 중…'
      // 카드에 보인 금액 그대로 신청서로 — 지금 화면의 상품을 들려 보냅니다.
      const res = await send('openCheckout', { track: 'agent', items: cart })
      if (res?.ok) {
        toast('🛒 구매대행 신청서를 새 탭에 열었습니다 — 저장하면 입금 안내가 나옵니다.', true)
      } else {
        toast(res?.error ?? '신청서를 열지 못했습니다 — 다시 눌러주세요.', false)
      }
      btn.disabled = false
      btn.textContent = '구매대행 신청서 작성 →'
    })
    card.querySelectorAll('[data-kb-sel]').forEach((b) =>
      b.addEventListener('click', () => {
        helperTrack = b.dataset.kbSel === 'agent' ? 'agent' : 'forwarding'
        card.dataset.kbHtml = ''
        renderCheckoutHelper()
      }),
    )
    card.querySelector('#kb-detail')?.addEventListener('click', () => {
      helperDetailOpen = !helperDetailOpen
      card.dataset.kbHtml = ''
      renderCheckoutHelper()
    })
    card.querySelectorAll('[data-kb-rowinfo]').forEach((b) =>
      b.addEventListener('click', () => {
        helperRowInfoKey = helperRowInfoKey === b.dataset.kbRowinfo ? null : b.dataset.kbRowinfo
        card.dataset.kbHtml = ''
        renderCheckoutHelper()
      }),
    )
  }

  const MONEY_HOSTS = ['checkout.coupang.com', 'cart.coupang.com']

  async function run() {
    if (looksLikeOrderComplete()) return runOrderComplete()
    if (MONEY_HOSTS.includes(location.host)) return renderCheckoutHelper()
  }

  // 결제·완료 화면이 SPA 전환으로 나타나는 경우까지 재시도합니다.
  // 결제창에서는 수량 변경이 금액에 따라오도록 갱신을 멈추지 않습니다.
  let tries = 0
  const timer = setInterval(() => {
    tries += 1
    run()
    if (tries >= 8 && !MONEY_HOSTS.includes(location.host)) clearInterval(timer)
  }, 1500)
  run()
})()
