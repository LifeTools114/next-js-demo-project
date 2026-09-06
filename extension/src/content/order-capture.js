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
  /**
   * 이 스크립트가 최상위 화면에서 도는지, 안쪽 프레임에서 도는지.
   * 카드·수집은 최상위에서만 합니다 (창 안에서 또 그리면 안 되니까요).
   */
  const IS_TOP = (() => { try { return window.top === window } catch { return false } })()

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
   * 보통은 아래 autoForward 가 주문완료를 감지해 신청서를 새 탭에 저절로
   * 엽니다. 이 카드는 그게 안 됐을 때(견적함 비었음·서버 응답 없음)의
   * 대비책입니다 — [하노이 배송 신청] 을 누르면 견적함의 배송만 상품 +
   * 쿠팡 주문번호를 들고 배송비 결제(체크아웃)로 넘어갑니다.
   *
   * @param reason 자동으로 열지 못한 이유 — 있으면 버튼 위에 먼저 보여줍니다.
   *        (예전에는 삼켰다가 버튼을 다시 눌러야 알려줬습니다 — 검토 26-09-04)
   */
  function offerForwarding(coupangOrderNo, reason) {
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
      '<div style="font-size:11.5px;color:#4e5968;margin-top:4px">쿠팡 주문이 자동 연결되고, 배송 신청서로 이어집니다.</div>' +
      '<button id="kb-fwd-go" style="margin-top:10px;width:100%;min-height:38px;border:0;border-radius:9px;' +
      'background:#3182f6;color:#fff;font-weight:700;cursor:pointer">하노이 배송 신청</button>' +
      '<button id="kb-fwd-x" style="margin-top:6px;width:100%;min-height:30px;border:0;border-radius:9px;' +
      'background:transparent;color:#8b95a1;cursor:pointer">닫기</button>'
    if (reason) {
      // 서버 주소가 섞일 수 있어 textContent 로만 넣습니다.
      const why = document.createElement('div')
      why.id = 'kb-fwd-why'
      why.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:9px;background:#fff4e5;color:#9a5b00;font-size:12px;line-height:1.5'
      why.textContent = reason
      card.insertBefore(why, card.querySelector('#kb-fwd-go'))
      // 이 카드를 닫아도 늘 있는 길 — 팝업의 [이 주문번호로 신청서 열기]
      const alt = document.createElement('div')
      alt.style.cssText = 'margin-top:6px;font-size:11px;color:#8b95a1;line-height:1.5'
      alt.textContent = `이 화면을 닫으셨다면: 브라우저 오른쪽 위 확장 아이콘(🇻🇳) → 쿠팡 주문번호 ${coupangOrderNo} 를 적고 [이 주문번호로 신청서 열기]`
      card.insertBefore(alt, card.querySelector('#kb-fwd-go'))
    }
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
      '🇻🇳 배송 신청서로 연결됩니다…</div>' +
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
      msg.textContent = '🇻🇳 배송 신청서가 새 탭에 열렸습니다'
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
      else send('openCheckout', { coupangOrderNo }).then((r) => { if (!r?.ok) toast(r?.error ?? '신청서를 열지 못했습니다.', false) })
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
      // 실패한 시도는 가드를 남기지 않습니다 — 담아둔 뒤 새로고침하면 다시 시도됩니다.
      try { sessionStorage.removeItem(guard); sessionStorage.removeItem(`kb-offered-${coupangOrderNo}`) } catch { /* 무시 */ }
      offerForwarding(coupangOrderNo, res?.error)
    }
  }

  async function runOrderComplete() {
    const cfg = await send('getConfig')
    globalThis.KBPatterns?.apply(cfg?.config?.coupang)
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
   * 결제합니다. 배송지가 창고 주소 + YS-ECOM 코드인지 자동 검사하고,
   * 아니면 복사 버튼으로 바로 붙여넣게 합니다.
   */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const squash = (s) => String(s ?? '').replace(/\s+/g, '')

  /**
   * 페이지 본문 텍스트에서 우리가 띄운 UI(data-kb-ui)를 뺀 값.
   *
   * 배송지 검사·상품 추출에 body.innerText 를 그대로 쓰면 안 됩니다 —
   * 경고 카드의 주소 안내(창고 주소·YS-ECOM)가 검사에 잡혀
   * "주소 있음 ↔ 없음"이 매 갱신마다 뒤집히고 카드가 깜박입니다.
   */
  function pageTextSansOurUi() {
    let out = ''
    for (const el of document.body?.children ?? []) {
      if (el.dataset?.kbUi) continue
      /**
       * 안 보이는 덩어리는 건너뜁니다.
       *
       * innerText 는 **화면에 그려지지 않는** 요소에서 textContent 로 떨어집니다
       * (표준 동작). 그래서 display:none 으로 숨어 있는 창(배송지 선택·배송
       * 요청사항)의 글까지 읽혀, 창을 열지도 않았는데 "주소가 창고로 맞다",
       * "요청사항이 맞다" 고 오판했습니다 (가짜 화면에서 확인 26-09-06).
       * 이 오판은 틀린 배송지로 결제하게 두는 쪽이라 특히 위험합니다.
       */
      let shown = true
      try { shown = el.getClientRects().length > 0 } catch { /* 판단 불가 — 읽습니다 */ }
      if (!shown) continue
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
  // 수동 입력 안내(칸별 따라 적기)는 접어둡니다 — ⚡ 자동입력이 기본 경로.
  /**
   * 배송지 자동 등록 — 단계 표시 (운영자 요청 26-09-04: "차례대로 표시를 단계별로")
   *
   * 자동으로 되는 것과 고객이 직접 눌러야 하는 것을 한눈에 보이게 합니다.
   * 어디서 멈췄는지도 이 표로 바로 보이므로, 사장님이 화면을 찍어 보내면
   * 실제 쿠팡 화면을 못 보는 상태에서도 원인을 좁힐 수 있습니다.
   *
   *   open   [배송지 변경] 열기          자동 → 안 되면 직접 (빨간 표시)
   *   add    [+ 배송지 추가]             자동 → 안 되면 직접
   *   fill   받는사람·휴대폰 채우기       자동
   *   zip    [우편번호 찾기] 열기        자동 → 안 되면 직접
   *   search 주소 검색·선택              자동 (다음 우편번호 창 안에서)
   *   detail 상세주소 채우기             자동
   *   save   [저장] 누르기               직접 — 마지막 확인은 고객 몫으로 남깁니다
   *   pick   저장된 창고 주소 [선택]     두 번째 이용부터 (자동 → 안 되면 직접)
   */
  const ADDR_STEPS = [
    ['open', '[배송지 변경] 열기'],
    ['add', '[+ 배송지 추가] 누르기'],
    ['fill', '받는사람·휴대폰 채우기'],
    ['zip', '[우편번호 찾기] 열기'],
    ['search', '주소 검색·선택'],
    ['detail', '상세주소 채우기'],
    ['save', '[저장] 누르기'],
  ]

  /**
   * 고객에게 보여줄 여섯 줄 — 배송지와 배송 요청사항이 **한 흐름**입니다.
   * 안쪽의 잔단계(우편번호·검색·상세주소…)는 이 여섯 줄로 묶습니다.
   */
  const FLOW_STEPS = [
    '배송지 창 열기',
    '창고 주소 채우기',
    '[저장] 누르기',
    '배송 요청사항 열기',
    '문 앞 · 비밀번호없이 출입',
    '[동의하고 저장하기]',
  ]

  // 배송지 자동 등록 진행/실패 상태 — 실패 시에만 수동 방법 버튼을 보여줍니다.
  let helperAddrFailed = false
  /**
   * 직구 주문 스위치 — **기본은 꺼짐**입니다 (운영자 확정 26-09-06).
   * 쿠팡에 들어오면 배너만 보이고, 배너를 눌러야 켜집니다.
   */
  let directOff = true
  // 자동 클릭이 통하지 않아 고객의 진짜 클릭을 기다리는 단계:
  //   '' 없음 · 'open' [배송지 변경] · 'zip' [우편번호 찾기]
  let helperAddrWaitManual = ''
  /** 마지막 렌더에서 배송지가 창고로 확인됐는가 — 자동 등록 루프가 끝낼 때를 알기 위해 */
  let helperAddrOk = false

  /**
   * 검색 대상 문서들 — 최상위 + 같은 출처 iframe 안까지.
   * 쿠팡이 배송지 창을 같은 출처 iframe 으로 띄우는 화면이 있으면 최상위
   * document 만 봐서는 창이 "안 열린 것"처럼 보입니다. 교차 출처(다음
   * 우편번호 등)는 접근 불가라 건너뜁니다 — 그쪽은 postcode-fill.js 담당.
   */
  /** 확장 버전 — 화면 표시·진단 문구가 같은 값을 쓰도록 한 곳에서 읽습니다. */
  const ver = (() => { try { return chrome.runtime.getManifest().version } catch { return '?' } })()

  function allDocs() {
    const list = [document]
    for (const f of document.querySelectorAll('iframe')) {
      try {
        const d = f.contentDocument
        if (d && d.body) list.push(d)
      } catch { /* 교차 출처 — 접근 불가 */ }
    }
    return list
  }

  /**
   * 검색 대상 뿌리들 — 문서들 + 그 안의 **열린 shadow root** 까지.
   * 쿠팡이 웹 컴포넌트로 창을 그리면 document.querySelectorAll 은 그 안을
   * 못 봅니다. 닫힌(closed) shadow root 는 어떤 방법으로도 못 보므로 제외.
   */
  function allRoots() {
    const roots = []
    const visit = (root) => {
      roots.push(root)
      let els
      try { els = root.querySelectorAll('*') } catch { return }
      for (const el of els) if (el.shadowRoot) visit(el.shadowRoot)
    }
    for (const d of allDocs()) visit(d)
    return roots
  }

  /**
   * 자동 등록이 찾는 문구들 — patterns.js 가 갖고 있습니다.
   * 서버(config/coupang-patterns.js)에서 문구를 더하면 확장 재배포 없이
   * 쿠팡 화면 변경에 대응할 수 있고, 서버가 죽어도 번들 기본값으로 동작합니다.
   * 진단 복사·자가진단도 같은 정의를 씁니다.
   */
  const PAT = globalThis.KBPatterns
  /** 이 키의 문구가 하나라도 맞는가 (공백 제거된 문자열 기준) */
  const hitsKey = (key, text) => PAT?.test(key, text) ?? false
  const lenOf = (key) => PAT?.maxLen(key) ?? 12
  /** 입력칸 셀렉터 — 서버 설정이 있으면 함께 시도합니다 */
  const fieldSel = (key) => PAT?.field(key) ?? ''

  /** 클릭 후보 — 쿠팡은 버튼을 <div>/<span>으로 만드는 화면이 많아 태그를 가리지 않습니다. */
  const CAND_SEL = 'button, a, [role="button"], label, span, div, input[type="button" i], input[type="submit" i]'
  const candText = (x) =>
    String(x.tagName === 'INPUT' ? (x.value ?? '') : (x.textContent || x.getAttribute?.('aria-label') || ''))
      .replace(/\s+/g, '')

  /**
   * 쿠팡 화면의 진짜 버튼을 **짚어줍니다**.
   *
   * "직접 눌러주세요" 라고 글로만 쓰면 고객은 결제 화면 어디를 봐야 할지
   * 모릅니다 (26-09-04 운영자 확인 — 배송지 창이 이미 열려 있는데도 다른
   * 버튼을 찾고 있었습니다). 빨간 테두리와 손가락 표시를 그 버튼 위에
   * 직접 얹어, 눈이 바로 가게 합니다.
   *
   * 겹쳐 그리기만 하고 클릭은 통과시킵니다(pointer-events:none) —
   * 우리가 만든 안내가 정작 버튼을 가리면 안 됩니다.
   */
  /**
   * 배송 요청사항이 이미 맞게 잡혀 있는가 — 화면 요약 글로만 봅니다.
   * 창고 공동현관에는 출입번호가 없어서 「문 앞 + 비밀번호없이 출입」이어야 합니다.
   */
  function noteLooksSet(text) {
    const t = squash(text ?? '')
    return t.includes('문앞') && (t.includes('비밀번호없이') || t.includes('출입번호없') || t.includes('비밀번호없음'))
  }

  /** 직구 주문 스위치 저장 — 화면들이 함께 씁니다 */
  async function setDirectOff(off) {
    directOff = Boolean(off)
    try { await chrome.storage.local.set({ kbOn: !directOff }) } catch { /* 무시 */ }
  }

  /**
   * 시작 배너 — 운영자가 보내주신 K-Global 광고 이미지 그대로 만든 버튼입니다
   * (26-09-06). 누르기 전에는 **꺼진 상태**, 누르면 켜집니다.
   *   파란 그라데이션 · 위 작은 라벨 · 국기와 큰 글씨 · 주황 [신청 ▶] · 아래 한 줄
   */
  function bannerHtml() {
    return '<div id="kb-banner" role="button" tabindex="0" style="' +
      'cursor:pointer;border-radius:14px;padding:14px 14px 12px;text-align:center;' +
      'background:linear-gradient(155deg,#1b4fd8 0%,#0a2e9c 55%,#0b2f7a 100%);' +
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);font-family:sans-serif">' +
      '<div style="font-size:10.5px;font-weight:700;color:#cfe0ff;letter-spacing:.2px">' +
      '<span style="color:#fff;font-weight:900">coupang</span> K-Global Extension</div>' +
      '<div style="margin-top:9px;font-size:19px;font-weight:900;color:#fff;line-height:1.32">' +
      '🇻🇳 베트남에서 🇰🇷<br>한국 직구하기</div>' +
      '<div style="margin-top:11px;display:inline-block;min-width:150px;padding:9px 20px;border-radius:22px;' +
      'background:linear-gradient(180deg,#ff9a1f 0%,#ff6a00 100%);color:#fff;font-size:15.5px;font-weight:900;' +
      'box-shadow:0 3px 10px rgba(255,106,0,.45)">신청 <span style="font-size:13px">▶</span></div>' +
      '<div style="margin-top:10px;font-size:10.5px;font-weight:700;color:#bfd3ff">' +
      '쉽고 빠른 한국 배송 서비스 <span style="opacity:.6">|</span> K-Global</div></div>'
  }

  /** 카드 만들기 — 켜짐·꺼짐 두 화면이 같은 상자를 씁니다 */
  function ensureCard() {
    let el = document.getElementById('kb-checkout-helper')
    if (el) return el
    el = document.createElement('div')
    el.id = 'kb-checkout-helper'
    el.dataset.kbUi = '1'
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:288px;background:#fff;' +
      'border:1px solid #dbe4f0;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);' +
      'padding:0;font:12.5px/1.55 sans-serif;color:#191f28;overflow:hidden;' +
      'max-height:calc(100vh - 32px);overflow-y:auto;overscroll-behavior:contain'
    document.body.appendChild(el)
    return el
  }

  /** 카드를 다시 그립니다 — card 변수는 renderCheckoutHelper 안에만 있으므로 id 로 찾습니다 */
  function redrawCard() {
    const el = document.getElementById('kb-checkout-helper')
    if (el) el.dataset.kbHtml = ''
    renderCheckoutHelper()
  }

  /** 이 문구로 잡히는 요소 수 (보이는 것만) — 자가진단·진단 복사 공통 */
  function countMatches(key) {
    const max = lenOf(key)
    let n = 0
    for (const d of allRoots()) {
      for (const el of d.querySelectorAll(CAND_SEL)) {
        if (!el.offsetParent || el.closest('[data-kb-ui]')) continue
        const t = candText(el)
        if (t && t.length <= max && hitsKey(key, t)) n += 1
      }
    }
    return n
  }

  /**
   * 자동 등록 실패 시 화면 구조 요약 — 고객이 [진단 정보 복사]로 복사해
   * 운영자에게 보내면, 어떤 요소가 몇 개 잡히는지/창이 프레임인지가 보여
   * 실제 쿠팡 DOM 을 못 보는 상태에서도 원인을 짚을 수 있습니다.
   * 개인정보는 담지 않습니다 — 태그·클래스 이름과 개수, 문구 주변 40자만.
   */
  function addrDiagnostics() {
    const out = { v: ver, path: location.pathname, at: new Date().toISOString(),
      failed: helperAddrFailed,
      frames: [], matches: {}, near: [] }
    // 접근 못 하는(교차 출처) 프레임 수 — 배송지 창이 그 안에 있으면 자동화 불가.
    const cross = [...document.querySelectorAll('iframe')].filter((f) => {
      try { return !f.contentDocument } catch { return true }
    }).length
    for (const d of allDocs()) {
      out.frames.push({
        host: d.location?.host ?? '?',
        inputs: [...d.querySelectorAll('input')].filter((x) => x.offsetParent).length,
        dialogs: d.querySelectorAll('[role="dialog"], [aria-modal="true"]').length,
        iframes: [...d.querySelectorAll('iframe')].map((f) => {
          try { return new URL(f.src, location.href).host } catch { return '?' }
        }).slice(0, 5),
      })
    }
    out.crossFrames = cross
    out.isTop = IS_TOP
    // 열린 shadow root 수 — 0 이 아니면 쿠팡이 웹 컴포넌트로 그리는 부분이 있습니다.
    out.shadowRoots = Math.max(0, allRoots().length - allDocs().length)
    // 손이 안 닿는(다른 출처) 프레임의 주소 호스트 — 배송지 창이 여기 있으면 프레임 도우미 몫.
    out.crossHosts = [...document.querySelectorAll('iframe')].filter((f) => {
      try { return !f.contentDocument } catch { return true }
    }).map((f) => {
      let host = '?'
      try { host = new URL(f.src, location.href).host } catch { /* 주소 없음 */ }
      const r = f.getBoundingClientRect()
      // 0x0·숨김이면 세션 동기화용 다리 프레임 — 배송지 창은 그 안에 없습니다.
      return `${host} ${Math.round(r.width)}x${Math.round(r.height)}${f.offsetParent && r.width > 0 ? '' : '(숨김)'}`
    }).slice(0, 8)
    // 프레임 도우미가 마지막으로 보고한 것 (없으면 프레임이 창을 못 봤거나 스크립트가 안 실림)
    out.frameState = lastFrameState
    const scan = (key) => {
      const found = []
      const max = lenOf(key)
      for (const d of allRoots()) {
        for (const el of d.querySelectorAll(CAND_SEL)) {
          if (el.closest('[data-kb-ui]')) continue
          const t = candText(el)
          if (!t || t.length > max || !hitsKey(key, t)) continue
          found.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}${el.offsetParent ? '' : '(숨김)'}`)
          if (found.length >= 6) return found
        }
      }
      return found
    }
    out.pat = PAT?.info().version ?? -1 // 어떤 문구 설정으로 찾았는지 (0 = 번들 기본값)
    out.matches = {
      open: scan('openAddr'), add: scan('addAddr'), zip: scan('zipSearch'), pick: scan('pick'),
    }
    /**
     * 느슨한 검색 — 태그·길이·보임 조건을 다 풀고 "문구가 문서에 있긴 한가"만 봅니다.
     * matches 는 비었는데 loose 에 잡히면 문구는 맞고 후보 조건이 문제, loose 도
     * 비면 문구 자체가 다르거나 안 보이는 곳(다른 출처 프레임·닫힌 shadow)에 있는 것.
     */
    const loose = (key) => {
      const found = []
      for (const d of allRoots()) {
        let els
        try { els = d.querySelectorAll('*') } catch { continue }
        for (const el of els) {
          if (el.closest?.('[data-kb-ui]') || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue
          const t = squash(el.textContent).slice(0, 60)
          if (!t || t.length > 40 || !hitsKey(key, t)) continue
          found.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)}(${t.length}${el.offsetParent ? '' : ',숨김'})`)
          if (found.length >= 4) return found
        }
      }
      return found
    }
    out.loose = { add: loose('addAddr'), pick: loose('pick'), zip: loose('zipSearch') }
    for (const d of allDocs()) {
      // 우리 카드에도 "[배송지 변경]" 이 적혀 있어 그대로 보면 진단이 우리 글로 채워집니다.
      const body = (d === document ? pageTextSansOurUi() : (d.body?.innerText ?? '')).replace(/\s+/g, '')
      const nearRe = new RegExp((PAT?.list('openAddr') ?? []).map((r) => r.source).join('|') || '배송지변경', 'g')
      for (const m of body.matchAll(nearRe)) {
        out.near.push(body.slice(Math.max(0, m.index - 15), m.index + 25))
        if (out.near.length >= 3) break
      }
      if (out.near.length >= 3) break
    }
    return JSON.stringify(out)
  }
  /**
   * ─────────────── 자가진단 ───────────────
   *
   * 쿠팡이 화면 문구를 바꾸면 자동입력이 조용히 멈추고, 그 사실은 보통
   * "안 돼요"라는 고객 연락으로 처음 알게 됩니다. 그때는 이미 늦습니다.
   * 여기서는 확장이 **스스로** 필요한 문구가 화면에 있는지 보고, 없으면
   * 운영자에게 알립니다 — 고객이 겪기 전에 서버 설정으로 고칠 수 있게.
   *
   * 보내는 것: 어떤 문구가 몇 개 잡혔는지 · 경로 · 확장/문구 설정 버전.
   * 보내지 않는 것: 이름·주소·전화·상품·금액 등 **개인정보 일체**.
   * 같은 증상은 6시간에 한 번만 보냅니다(운영자 알림이 도배되지 않게).
   */
  const HEALTH_KEY = 'kbHealthSent'
  const HEALTH_QUIET_MS = 6 * 60 * 60 * 1000

  async function reportHealth(kind, missing, found, extra = {}) {
    const sig = `${kind}|${missing.join(',')}|${PAT?.info().version ?? -1}`
    try {
      const store = (await chrome.storage.local.get(HEALTH_KEY))?.[HEALTH_KEY] ?? {}
      if (Date.now() - (store[sig] ?? 0) < HEALTH_QUIET_MS) return
      store[sig] = Date.now()
      // 오래된 기록은 버립니다 — storage 가 무한히 커지지 않게.
      for (const [k, at] of Object.entries(store)) {
        if (Date.now() - at > 7 * 24 * 60 * 60 * 1000) delete store[k]
      }
      await chrome.storage.local.set({ [HEALTH_KEY]: store })
    } catch { /* 저장 못 해도 보고는 시도합니다 */ }

    send('reportHealth', {
      kind,
      missing,
      found,
      host: location.host,
      path: location.pathname.slice(0, 80),
      ext: ver,
      pat: PAT?.info().version ?? -1,
      patSource: PAT?.info().source ?? 'bundled',
      rejected: PAT?.info().rejected ?? [],
      ...extra,
    })
  }

  /**
   * 이 화면에서 필요한 문구가 잡히는지 확인합니다.
   * @returns 못 찾은 문구 키 목록 (빈 배열이면 정상)
   */
  function healthMissing(kind) {
    const missing = []
    const found = {}
    for (const key of PAT?.require(kind) ?? []) {
      found[key] = countMatches(key)
      if (found[key] === 0) missing.push(key)
    }
    return { missing, found }
  }

  /** 결제 화면 진입 시 1회 — 필요한 문구가 하나도 없으면 화면 구조 변경 의심 */
  function selfCheckCheckout() {
    const text = squash(pageTextSansOurUi()).slice(0, 8000)
    if (!(PAT?.looksLikeCheckout(text) ?? false)) return
    const { missing, found } = healthMissing('checkout')
    if (missing.length > 0) reportHealth('checkout', missing, found)
  }

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

  const closedKey = () => `kb-helper-closed:${location.host}${location.pathname}`

  /** 닫아도 길을 남깁니다 — 작은 🇻🇳 버튼을 누르면 카드가 다시 열립니다. */
  function renderReopenChip() {
    if (document.getElementById('kb-helper-chip') || document.getElementById('kb-checkout-helper')) return
    const chip = document.createElement('button')
    chip.id = 'kb-helper-chip'
    chip.dataset.kbUi = '1'
    // 무슨 버튼인지 글로 씁니다 — 지름 46px 짜리 🇻🇳 동그라미는 눈에 띄지도,
    // 뜻이 통하지도 않았습니다 (운영자 26-09-06).
    chip.innerHTML = '<span style="font-size:25px;line-height:1">🇻🇳</span>' +
      '<span style="text-align:left">배송·구매대행 신청' +
      '<span style="display:block;font-size:11.5px;font-weight:700;opacity:.9;margin-top:2px">하노이 도착 가격 보기</span></span>'
    chip.title = '하노이 배송 도우미 다시 열기'
    chip.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;min-width:188px;min-height:60px;' +
      'display:flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;' +
      'border:0;border-radius:15px;background:#3182f6;color:#fff;font:800 16px/1.25 sans-serif;' +
      'cursor:pointer;box-shadow:0 6px 20px rgba(49,130,246,.42)'
    chip.addEventListener('click', () => {
      try { sessionStorage.removeItem(closedKey()) } catch { /* 무시 */ }
      chip.remove()
      renderCheckoutHelper()
    })
    document.body.appendChild(chip)
  }

  /**
   * 결제 직전 경고 — 배송지가 창고로 제대로 안 잡힌 채 [결제하기]를 누르면
   * 결제 전에 한 번 확인을 받습니다. [확인]이면 고객이 누른 원래 클릭이
   * 그대로 진행되고(자동 재클릭·자동 결제 없음), [취소]면 결제를 멈춥니다.
   * 카드를 닫아두면 일반 쇼핑으로 보고 경고하지 않습니다.
   */
  const payGuard = { armed: false, warn: '' }
  function armPayGuard() {
    if (payGuard.armed) return
    payGuard.armed = true
    document.addEventListener('click', (e) => {
      if (!payGuard.warn) return
      // [결제하기]가 <button>이 아니라 스타일 입힌 <div>인 화면도 있어 태그
      // 대신 "짧은 문구로 끝나는 가장 가까운 조상"으로 판정합니다.
      let node = e.target instanceof Element ? e.target : null
      let hit = null
      for (let up = 0; node && up < 5; up++) {
        if (!node.closest('[data-kb-ui]')) {
          const t = (node.textContent ?? '').replace(/\s+/g, '')
          if (t.length <= lenOf('payButton') && hitsKey('payButton', t)) { hit = node; break }
        }
        node = node.parentElement
      }
      if (!hit) return
      if (!window.confirm(payGuard.warn)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }, true)
  }

  async function renderCheckoutHelper() {
    /**
     * 성함을 치는 중이면 다시 그리지 않습니다 — 카드는 금액이 바뀔 때마다
     * 다시 그려지는데, 그때 입력칸이 새로 만들어지면 치던 글자가 날아갑니다.
     */
    try { if (document.activeElement?.id === 'kb-name-input') return } catch { /* 무시 */ }
    try {
      // 옛 전역 닫기 기록은 지웁니다 — 이미 걸려 있는 탭도 이 업데이트로 풀립니다.
      sessionStorage.removeItem('kb-helper-closed')
      if (sessionStorage.getItem(closedKey())) {
        payGuard.warn = '' // 카드를 닫았으면 일반 쇼핑 — 결제 전 경고도 끕니다
        return renderReopenChip()
      }
    } catch { /* 무시 */ }

    /**
     * 직구 주문 스위치 — 꺼져 있으면 이 도우미는 **아무것도 하지 않습니다.**
     * 자동도, 경고도, 결제 전 확인도 없습니다. 쿠팡 일반 주문 그대로입니다.
     */
    try { directOff = !(await chrome.storage.local.get('kbOn'))?.kbOn } catch { /* 무시 */ }
    if (directOff) {
      payGuard.warn = ''
      const off = ensureCard()
      off.style.border = '0'
      off.style.boxShadow = '0 8px 28px rgba(0,0,0,.22)'
      const offHtml = bannerHtml()
      if (off.dataset.kbHtml !== offHtml) {
        off.dataset.kbHtml = offHtml
        off.innerHTML = offHtml
        off.querySelector('#kb-banner')?.addEventListener('click', async () => {
          await setDirectOff(false)
          off.dataset.kbHtml = ''
          renderCheckoutHelper()
        })
      }
      return
    }

    const cfg = await send('getConfig')
    // 서버가 내려준 쿠팡 문구 설정 반영 — 쿠팡이 화면을 바꿔도 재배포 없이 대응.
    PAT?.apply(cfg?.config?.coupang)
    // 자가진단 — 필요한 문구가 화면에서 사라졌으면 조용히 운영자에게 보고합니다.
    try { selfCheckCheckout() } catch { /* 진단 실패가 카드를 막지 않게 */ }
    const w = cfg?.config?.warehouse ?? {}
    const addr1 = w.address1 || '서울특별시 강서구 개화동로 11길 5'
    const zip = w.zip || '07504'
    const code = w.code || 'YS-ECOM'
    const phone = w.phone || '010-7360-1156'

    // 배송지 다이얼로그가 열려 있으면 빈 칸을 조용히 채워둡니다 (받는사람·전화·상세주소).
    // 고객이 직접 하겠다고 했으면 손대지 않습니다 — 지우고 다시 치는 것을 방해합니다.
    // (자동 채우기 없음 — 쿠팡 화면은 우리가 손대지 않습니다)

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
    /**
     * 결제 화면의 배송비 — 이미 무료 조건까지 반영된 **최종** 금액이라
     * 그대로 씁니다. 구매대행으로 바꿔 보는 금액이 이만큼 비어 있었습니다.
     * 첫 줄에만 실어 한 번만 청구되게 합니다 (판매자별 한 번 규정과 같은 결과).
     */
    const shipKrw = (() => {
      const m = squash(allText).match(/배송비([\d,]{3,})원/)
      if (!m) return 0
      const n = Number(m[1].replace(/,/g, ''))
      return Number.isFinite(n) && n > 0 && n <= 50_000 ? n : 0
    })()
    const pageItems = raw.map((it, i) => ({
      ...it, productId: `chk-${i}`, track: 'forwarding',
      domesticShipKrw: i === 0 ? shipKrw : 0,
    }))
    /**
     * 금액 파싱 자가진단 — 결제 화면이고 결제 금액도 찍혀 있는데 상품을
     * 하나도 못 읽었다면, 쿠팡이 상품·금액 표기를 바꾼 것입니다.
     * 이 경우 카드는 견적함(옛 계획)으로 폴백하므로 **다른 금액**이 뜰 수
     * 있어, 고객이 이상한 견적을 받기 전에 운영자가 알아야 합니다.
     */
    if (!onCart && pageItems.length === 0 && PAT?.looksLikeCheckout(squash(allText))
        && /[\d,]{4,}원/.test(allText)) {
      reportHealth('price', ['items'], { items: 0 })
    }
    // 초안은 결제창에서만 남깁니다 — 주문완료 후 자동 신청이 이 초안을 씁니다.
    // (장바구니에서도 남기면 옛 초안이 다른 결제의 금액에 끼어들 수 있습니다)
    if (pageItems.length > 0 && !onCart) await send('setCheckoutDraft', { items: pageItems })

    // 화면에서 못 읽었을 때만 고객이 직접 담은 견적함으로 계산합니다.
    const cartRes = await send('getCart')
    const fallbackCart = cartRes?.cart ?? []
    const cart = pageItems.length > 0 ? pageItems : fallbackCart
    const quotes = cart.length > 0 ? await cartQuotes(cart, cfg?.config) : { fwd: null, agent: null }
    const autoAdded = pageItems.length > 0

    const card = ensureCard()

    const ok = okAddr && okCode
    helperAddrOk = ok && !onCart
    // 주소가 맞아졌으면 단계 표시도 끝. 단, 배송 요청사항을 맞추는 중이면
    // 그쪽이 짚어 둔 표시까지 지우면 안 됩니다 (0.5초마다 다시 그려집니다).


    const lt = cfg?.config?.leadTimeDays ?? { min: 5, max: 9 }

    /**
     * 결제 전 경고 갱신 — 배송지가 창고가 아니거나(오배송 위험) 상세주소에
     * 본인 이름이 빠졌으면(주인 못 찾음) [결제하기] 클릭 때 확인을 받습니다.
     * 장바구니에는 결제 버튼이 없으므로 걸지 않습니다.
     */
    /**
     * 상세주소에 "코드 + 이름"이 들어갔는가.
     *
     * 형식(괄호·공백·하이픈)은 따지지 않습니다. 창고 입고 매칭은 라벨에
     * **이름이 들어 있는지**만 봅니다(findByInbound 의 이름 폴백). 그런데
     * 예전에는 `YS-ECOM(` 이라는 괄호 형식만 인정해서, 안내 문구대로
     * `YS-ECOM 홍길동` 이라고 제대로 적은 고객에게 매번 헛경고가 떴습니다.
     * 헛경고가 반복되면 고객은 경고를 습관적으로 넘기게 되고, 그 창은
     * **진짜 오배송(집 주소로 결제)을 막는 유일한 장치**와 같은 창입니다.
     */
    const detailKey = (t) => squash(t).replace(/[^0-9A-Za-z가-힣]/g, '')
    const okDetail = (() => {
      const hay = detailKey(body)
      const c = detailKey(code)
      if (!c) return false
      const nm = detailKey(getRecipientName() ?? '')
      // 이름을 알면 "코드+이름"이 붙어 있는지, 모르면 코드 뒤에 두 글자 이상이 있는지
      if (nm.length >= 2) return hay.includes(c + nm)
      return new RegExp(`${c}[0-9A-Za-z가-힣]{2,}`).test(hay)
    })()
    armPayGuard()
    const noteBad = !onCart && helperTrack === 'forwarding' && ok && !noteLooksSet(allText)
    if (onCart || (ok && okDetail && !noteBad)) {
      payGuard.warn = ''
    } else if (ok && okDetail && noteBad) {
      // 배송지는 맞았지만 요청사항이 안 맞습니다 — 기사님이 공동현관에서 막힙니다.
      payGuard.warn =
        '⚠️ 배송 요청사항을 확인해 주세요\n\n' +
        '창고 공동현관에는 출입번호가 없습니다.\n' +
        '「문 앞」 + 「비밀번호없이 출입 가능해요」 로 맞춰주세요.\n\n' +
        '· [취소] 누른 뒤 카드의 [🚪 배송 요청사항 자동 선택]\n' +
        '· 이미 맞추셨으면 [확인]'
    } else if (!ok) {
      payGuard.warn =
        '⚠️ 하노이 배송 경고\n\n' +
        `배송지가 한국 창고(${code})로 설정되어 있지 않습니다.\n` +
        '이대로 결제하면 상품이 하노이가 아니라 현재 배송지로 갑니다.\n\n' +
        '· 하노이로 보내려면 → [취소] 누른 뒤 카드의 [⚡ 배송지 자동 등록]\n' +
        '· 집으로 받는 일반 주문이면 → [확인]'
    } else {
      payGuard.warn =
        '⚠️ 상세주소에 본인 이름이 없습니다\n\n' +
        `배송지는 한국 창고가 맞지만, 상세주소에 본인 이름이 없으면\n` +
        '창고에서 소포 주인을 찾기 어렵습니다.\n\n' +
        `· [취소] 누른 뒤 배송지 [수정]에서 상세주소에 "${code} 본인이름" 을 넣어주세요.\n` +
        '· 그래도 진행하려면 [확인] — 신청서의 이름·연락처로 찾아 처리합니다.'
    }

    // ── 가격 두 줄이 카드의 전부 — 행을 눌러 진행 방식을 고릅니다 ──
    // 선택된 행은 파란 배경 + 흰 글씨 + ✓ 로 누가 봐도 "선택됨"이게.
    const priceRow = (id, label, sub, q) => {
      const sel = helperTrack === id
      return (
        `<button data-kb-sel="${id}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;` +
        'width:100%;padding:13px 13px;border:0;cursor:pointer;text-align:left;font:inherit;' +
        `background:${sel ? '#3182f6' : '#fff'}">` +
        `<span><span style="display:block;font-weight:800;font-size:15.5px;color:${sel ? '#fff' : '#191f28'}">` +
        `${sel ? '✓ ' : ''}${label}</span>` +
        `<span style="font-size:11px;color:${sel ? '#cfe0fc' : '#8b95a1'}">${sub}</span></span>` +
        (q && won(q.total)
          ? '<span style="text-align:right">' +
            `<span style="display:block;font-weight:800;font-size:19px;color:${sel ? '#fff' : '#3182f6'};white-space:nowrap">${won(q.total)}</span>` +
            (dong(q.totalVnd)
              ? `<span style="display:block;font-size:11.5px;font-weight:700;color:${sel ? '#ffd9d9' : '#f04452'};white-space:nowrap">≈ ${dong(q.totalVnd)}</span>`
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
      : '<div style="margin-top:8px;border:1.5px solid #dbe4f0;border-radius:12px;overflow:hidden;background:#fff">' +
        priceRow('forwarding', '📦 배송만', '쿠팡 결제는 직접 · 배송만', quotes.fwd) +
        '<div style="border-top:1px solid #f2f4f6"></div>' +
        priceRow('agent', '🛒 구매하고 배송까지', '저희가 대신 사드려요', quotes.agent) +
        '</div>'

    // ── 선택한 방식의 다음 행동 — 카드가 결제/신청으로 유도합니다 ──
    const ctaBlock = cart.length === 0
      ? ''
      : helperTrack === 'agent' && quotes.agent?.agentLimit?.exceeded
        ? '<div style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#fff0f0;color:#c92a2a;' +
          'font-size:11.5px;font-weight:700">한 번에 상품값 합계 ' +
          `${won(quotes.agent.agentLimit.maxGoodsKrw)}까지 접수합니다 — 나눠서 신청해 주세요.</div>`
        : helperTrack === 'agent'
        ? '<style>@keyframes kbPulse{0%,100%{box-shadow:0 0 0 0 rgba(49,130,246,.55)}50%{box-shadow:0 0 0 7px rgba(49,130,246,0)}}</style>' +
          '<button id="kb-agent-go" style="margin-top:8px;width:100%;min-height:46px;border:0;border-radius:10px;' +
          'background:#3182f6;color:#fff;font-weight:800;font-size:15px;cursor:pointer;' +
          'animation:kbPulse 1.5s ease-in-out infinite">🛒 대신 사달라고 신청하기</button>' +
          '<div style="margin-top:4px;font-size:10.5px;color:#8b95a1;text-align:center">' +
          '쿠팡 결제 없이 보내기 · 개인 쿠폰은 못 씁니다</div>'
        : onCart
          ? '<div style="margin-top:8px;padding:10px;border-radius:10px;background:#e6f6f0;color:#17916b;' +
            'font-size:12.5px;font-weight:800;text-align:center">다음: [주문하기]로 이동하세요</div>'
          : ok
            ? '<div style="margin-top:8px;padding:10px;border-radius:10px;background:#e6f6f0;color:#17916b;' +
              'font-size:12.5px;font-weight:800;text-align:center">이제 쿠팡 [결제하기]를 누르세요<br>' +
              '<span style="font-weight:700;font-size:10.5px">결제 후 배송 신청서가 자동으로 열립니다</span></div>'
            : ''

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
        (autoAdded
          ? `<div style="margin-top:6px;font-size:10.5px;color:#17916b">🛒 이 화면의 상품 ${cart.length}개 기준</div>`
          : '') +
        weightLine +
        detailHead('📦 배송만 — 쿠팡 결제는 내가') +
        steps('쿠팡 결제 후 <b>① 신청서가 저절로 열림</b> → ② 배송비 보내기(원화/동화) → ' +
          `③ 한국창고 도착 <b>1~3영업일</b> → ④ 하노이 도착 <b>+${lt.min}~${lt.max}영업일</b>`) +
        steps('본인 결제라 <b>쿠폰·회원 할인을 모두 그대로</b> 쓸 수 있습니다.') +
        steps('무게 기준: 1kg까지 기본요금 · 이후 kg 단위(0.5 이하 버림·초과 올림)') +
        bdRows(quotes.fwd) +
        detailHead('🛒 구매하고 배송까지 — 결제도 저희가') +
        steps('쿠팡 결제가 필요 없습니다 — <b>① 신청서 저장</b> → ② 원화/동화 보내기 → ③ 저희가 대신 주문 → ' +
          `④ 한국창고 <b>1~3영업일</b> → ⑤ 하노이 <b>+${lt.min}~${lt.max}영업일</b>`) +
        steps(`수수료: <b>기본 ${won(K.currentPolicy().agencyBaseKrw)}</b>(상품가 10만원·5종까지) — 대리 주문·검수·발주 실비. ` +
          '초과분은 10만원 초과금액의 5% + 종류 초과 종당 1,000원.') +
        steps('와우회원가는 되도록 반영합니다. <b>쿠폰·신규가입 할인 등 개인 혜택은 사용할 수 없고</b>, ' +
          '타임세일·마감임박 등 기간 한정 할인가는 발주 시점에 끝나면 반영되지 않을 수 있습니다.') +
        steps(`한 번에 신청할 수 있는 한도: 상품값 합계 ${won(quotes.agent?.agentLimit?.maxGoodsKrw ?? 1_000_000)} (넘으면 나눠서).`) +
        bdRows(quotes.agent) +
        '<div style="margin-top:7px;padding:7px 9px;border-radius:9px;background:#fff8e6;color:#d9480f;' +
        'font-size:10.5px;font-weight:700;line-height:1.6">📦 배송 기간은 모두 영업일 기준(주말·공휴일 제외) · ' +
        '해외직구 상품은 한국창고 도착까지 +2~3영업일</div>' +
        // 환불·교환·반품 — 최종 결제 전 인지 (운영자 확정 26-08-30)
        '<div style="margin-top:7px;padding:7px 9px;border-radius:9px;background:#fff0f0;color:#c92a2a;' +
        'font-size:10.5px;font-weight:700;line-height:1.6">💳 환불은 영업일 3~7일 내 지급 · ' +
        '반품·변심 취소는 대신 사드린 수수료 제외 / 배송만 $1 차감 후 돌려드립니다 (당사 사유는 전액)<br>' +
        '↩️ 하노이 도착 후 교환·반품 반송비(하노이→한국)·쿠팡 반품비는 전액 구매자 부담 — ' +
        '2kg까지 $20 · 이후 kg당 $11 · 대신 사드린 건은 처리비 5,000원 추가 · 미리 알려주셔야 합니다. ' +
        '교환은 반송비 + 재배송비(위 국제배송비)를 상품가와 비교하세요<br>' +
        '⚠️ 액체(스킨·세럼 등)·배터리 내장 제품·현금·대량 화물은 반송 불가 — 교환·반품이 불가합니다</div>'

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

    /**
     * ─────────── 입력 방법 안내 (자동 없음) ───────────
     *
     * 자동 클릭·자동 채우기는 전부 걷어냈습니다 (운영자 확정 26-09-06:
     * "오류가 많아서 일단 자동 입력은 모두 빼주세요. 입력방법만 정리해주고,
     * 복사기능만 넣고"). 쿠팡 화면은 우리가 손대지 않습니다 — 값만 정확히
     * 보여주고, 한 번 눌러 복사하게 합니다.
     */
    const nm = getRecipientName()
    const detail = `${code} ${nm || '성함'}`

    /** 복사되는 한 줄 — 라벨 / 값 / [복사] */
    const copyRow = (no, label, value, hot) =>
      '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 9px;' +
      `border:${hot ? '2px solid #f59f00' : '1px solid #e5e8eb'};border-radius:9px;` +
      `background:${hot ? '#fff8e6' : '#fff'}">` +
      `<span style="flex-shrink:0;width:17px;height:17px;border-radius:50%;background:${hot ? '#f59f00' : '#c9d3e0'};` +
      `color:#fff;font-size:10.5px;font-weight:800;text-align:center;line-height:17px">${no}</span>` +
      '<span style="flex:1;min-width:0">' +
      `<span style="display:block;font-size:10px;color:#8b95a1">${esc(label)}</span>` +
      `<b style="display:block;font-size:13px;color:${hot ? '#d9480f' : '#191f28'};` +
      `white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</b></span>` +
      `<button data-copy="${esc(value)}" style="flex-shrink:0;min-height:30px;padding:0 10px;border:0;` +
      `border-radius:7px;background:${hot ? '#f59f00' : '#eef4fb'};color:${hot ? '#fff' : '#3182f6'};` +
      'font-size:11.5px;font-weight:800;cursor:pointer">복사</button></div>'

    const addrHelpBody =
      '<div style="margin-top:7px;padding:10px 9px;border-radius:12px;background:#f9fafb;border:1px solid #e5e8eb">' +
      '<div style="font-size:12px;font-weight:900;color:#191f28">쿠팡 [배송지 변경] 창에 이대로 넣어주세요</div>' +
      copyRow(1, '받는 사람', code) +
      copyRow(2, '휴대폰', phone) +
      copyRow(3, '우편번호 찾기 → 붙여넣고 검색', addr1) +
      copyRow(4, '상세주소 — 이게 빠지면 소포 주인을 못 찾습니다', detail, true) +
      (nm ? '' : '<div style="margin-top:5px;font-size:11px;font-weight:800;color:#d9480f;line-height:1.5">' +
        '↑ 위 칸에 성함을 넣으면 «성함» 자리가 채워집니다</div>') +
      '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e8eb">' +
      '<div style="font-size:12px;font-weight:900;color:#191f28">배송 요청사항은 이렇게 골라주세요</div>' +
      '<div style="margin-top:4px;font-size:12px;font-weight:800;color:#7a4b00;line-height:1.8">' +
      '① 문 앞<br>② 비밀번호없이 출입 가능해요</div>' +
      '<div style="margin-top:2px;font-size:10.5px;color:#8b95a1;line-height:1.5">' +
      '창고 공동현관은 출입번호가 없습니다.</div></div></div>'

    /** 소포에 적을 성함 — 창고가 소포 주인을 찾는 유일한 단서입니다 */
    const nameBlock =
      '<div style="margin-top:7px;padding:9px 10px;border-radius:10px;background:#fff8e6;border:1px solid #ffe0a3">' +
      '<div style="font-size:13.5px;font-weight:900;color:#7a4b00;line-height:1.5">' +
      '주문하는 고객님의 성함을 입력하세요.</div>' +
      `<input id="kb-name-input" value="${esc(nm)}" placeholder="여기에 받으시는 분 성함을 입력" ` +
      'style="margin-top:6px;width:100%;min-height:44px;box-sizing:border-box;padding:0 11px;' +
      'border:1.5px solid #f0b429;border-radius:8px;font-size:14.5px;font-weight:700;color:#191f28;background:#fff">' +
      (nm
        ? '<button id="kb-name-clear" style="margin-top:4px;border:0;background:transparent;color:#8b95a1;' +
          'font-size:10.5px;cursor:pointer;text-decoration:underline">이 이름 지우기</button>'
        : '') +
      '</div>'

    /** 배송지가 창고가 아닐 때만 안내를 보여줍니다 — 맞으면 조용히 있습니다 */
    const miniForm = onCart || ok || helperTrack !== 'forwarding' ? '' : nameBlock + addrHelpBody
    const noteBlock = onCart || !ok || helperTrack !== 'forwarding'
      ? ''
      : (noteLooksSet(allText)
          ? '<div style="margin-top:7px;padding:8px 10px;border-radius:9px;background:#e6f6f0;color:#17916b;' +
            'font-size:12px;font-weight:800">✓ 배송 요청사항 확인됨 — 문 앞 · 비밀번호없이 출입</div>'
          : '<div style="margin-top:7px;padding:9px 10px;border-radius:10px;background:#fff8e6;border:1.5px solid #f0b429">' +
            '<div style="font-size:12.5px;font-weight:900;color:#7a4b00">🚪 배송 요청사항: ① 문 앞 ② 비밀번호없이 출입</div>' +
            '<div style="margin-top:2px;font-size:11px;color:#7a4b00;line-height:1.5">' +
            '창고 공동현관은 <b>출입번호가 없습니다.</b></div></div>')

    const statusBlock = onCart
      ? ''
      : ok
        ? '<div style="margin-top:7px;padding:7px 10px;border-radius:9px;background:#e6f6f0;color:#17916b;font-size:12px">' +
          '<b>✓ 배송지 확인됨 — 이대로 결제하세요</b></div>'
        : '<style>@keyframes kbAlert{0%,100%{box-shadow:0 0 0 0 rgba(217,45,32,.5)}' +
          '50%{box-shadow:0 0 0 8px rgba(217,45,32,0)}}</style>' +
          '<div style="margin-top:7px;padding:11px 12px;border-radius:11px;background:#fff0f0;' +
          'border:2px solid #d92d20;animation:kbAlert 1.6s ease-out 3">' +
          '<div style="font-size:14px;font-weight:900;color:#d92d20;line-height:1.4">' +
          '🚨 주소를 변경해 주세요</div>' +
          // 본문은 한 문장 — 운영자 확정 문구 (26-09-04). 길면 읽지 않습니다.
          '<div style="margin-top:6px;font-size:12.5px;color:#912018;line-height:1.6">' +
          '지금 배송지가 <b>저희 창고가 아닙니다.</b><br>' +
          '아래 값을 <b>복사</b>해서 쿠팡 배송지에 넣어주세요.</div></div>'

    /**
     * 주소가 틀렸을 때는 순서를 바꿉니다 — 고칠 방법이 금액보다 위에.
     * 금액은 흐리게 둡니다: 주소가 틀리면 그 금액은 성립하지 않습니다.
     */
    const wrongAddr = !onCart && !ok && helperTrack === 'forwarding'
    const dimmedPrice = wrongAddr
      ? `<div style="opacity:.45;filter:grayscale(.5)">${priceBlock}</div>`
      : priceBlock
    const cartLine = (wrongAddr ? miniForm + dimmedPrice : priceBlock + noteBlock) + ctaBlock +
      (cart.length > 0
        ? '<button id="kb-detail" style="margin-top:7px;width:100%;min-height:32px;border:1px solid #e5e8eb;' +
          'border-radius:8px;background:#fff;color:#4e5968;font-weight:700;font-size:12px;cursor:pointer">' +
          (helperDetailOpen ? '접기 ▴' : '자세히 보기 ▾') + '</button>'
        : '') +
      detailBlock

    /**
     * 도우미 버전 — 사장님이 [git pull → 확장 🔄] 을 하셨는지 화면에서
     * 바로 확인할 수 있어야 합니다. 이게 없어서 "고쳤는데 그대로다" 인지
     * "아직 옛 버전이다" 인지 두 번이나 헷갈렸습니다 (26-09-04).
     */

    /**
     * 맨 위 스위치 — 이 도우미를 통째로 끄고 켜는 자리입니다 (운영자 26-09-06).
     * 끄면 자동도 경고도 없습니다. 하노이가 아니라 한국으로 받으실 때 씁니다.
     */
    const html =
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<b style="flex:1;min-width:0">🇻🇳 하노이 직구 주문</b>' +
      `<span style="font-size:10px;color:#b0b8c1">v${ver}</span>` +
      '<button id="kb-mode-off" style="flex-shrink:0;border:1px solid #e5e8eb;border-radius:6px;background:#fff;' +
      'color:#8b95a1;font-size:11px;font-weight:800;padding:4px 9px;cursor:pointer">끄기</button></div>' +
      statusBlock +
      cartLine +
      '<button id="kb-helper-x" style="margin-top:8px;width:100%;min-height:28px;border:0;border-radius:8px;' +
      'background:#f9fafb;color:#8b95a1;cursor:pointer">닫기</button>'

    // 카드 테두리 — 주소가 틀리면 곁눈으로도 보이게 빨갛게 바꿉니다.
    card.style.border = wrongAddr ? '2.5px solid #d92d20' : '1px solid #dbe4f0'
    card.style.boxShadow = wrongAddr
      ? '0 8px 28px rgba(217,45,32,.28)'
      : '0 8px 28px rgba(0,0,0,.18)'

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
      // 카드를 닫으면 짚어 둔 표시도 함께 치웁니다 — 카드가 없는데 빨간
      // 동그라미만 남아 있으면 무엇을 하라는 것인지 알 수 없습니다.
      clearSpotlight()
      // 이 결제 화면에서만 닫힘 — 다른 결제·장바구니에는 그대로 나타납니다.
      try { sessionStorage.setItem(closedKey(), '1') } catch { /* 무시 */ }
      renderReopenChip()
    })
    /**
     * 소포에 적을 성함 — 창고가 소포 주인을 찾는 유일한 단서입니다.
     * 예전에는 window.prompt 로 물었는데, 한 번 넣은 값이 어디에 쓰이는지
     * 보이지 않아 시험 삼아 넣은 이름이 그대로 남았습니다 (운영자 26-09-06).
     * 이제 카드 안 입력칸에 항상 보이고, 지우기도 그 자리에서 됩니다.
     */
    const nameInput = card.querySelector('#kb-name-input')
    const saveName = (v) => {
      try { localStorage.setItem(NAME_KEY, String(v ?? '').trim()) } catch { /* 무시 */ }
      // 포커스를 놓아야 다시 그려집니다 — 치는 중에는 그리지 않도록 막아 두었으니까요.
      try { nameInput?.blur() } catch { /* 무시 */ }
      clearSpotlight() // "성함을 넣어주세요" 표시는 넣는 순간 치웁니다
      card.dataset.kbHtml = ''
      renderCheckoutHelper()
    }
    nameInput?.addEventListener('change', (e) => saveName(e.target.value))
    nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(e.target.value) })
    card.querySelector('#kb-name-clear')?.addEventListener('click', () => saveName(''))
    card.querySelector('#kb-mode-off')?.addEventListener('click', async () => {
      await setDirectOff(true)
      redrawCard()
    })
    card.querySelector('#kb-diag')?.addEventListener('click', async (e) => {
      const b = e.currentTarget
      const text = addrDiagnostics()
      try {
        await navigator.clipboard.writeText(text)
        b.textContent = '✓ 복사됨 — 채팅에 붙여넣어 보내주세요'
      } catch {
        // 클립보드 권한이 없으면 창으로 띄워 직접 복사하게 합니다.
        window.prompt('아래 내용을 복사해 관리자에게 보내주세요', text)
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
        // 고객에게는 쉬운 말, 운영자 브라우저(토큰 있음)에는 고칠 방법.
        const st = await send('getAdminState')
        toast(st?.hasToken
          ? '⚠️ 백엔드 서버가 꺼져 있어 신청서를 열 수 없습니다 — start-server 를 실행한 뒤 다시 눌러주세요.'
          : '지금은 연결이 안 됩니다. 잠시 후 다시 눌러 주세요. 계속 안 되면 저희에게 알려 주세요.', false)
        return
      }
      btn.disabled = true
      btn.textContent = '신청서 여는 중…'
      // 카드에 보인 금액 그대로 신청서로 — 지금 화면의 상품을 들려 보냅니다.
      const res = await send('openCheckout', { track: 'agent', items: cart })
      if (res?.ok) {
        toast('🛒 신청서를 새 탭에 열었습니다 — 저장하면 어디로 보낼지 알려드립니다.', true)
      } else {
        toast(res?.error ?? '신청서를 열지 못했습니다 — 다시 눌러주세요.', false)
      }
      btn.disabled = false
      btn.textContent = '🛒 대신 사달라고 신청하기'
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

  /**
   * 시작 배너 — 쿠팡 어느 화면에서나, **꺼져 있을 때만** 보입니다.
   * 누르면 켜지고, 상품 화면이면 견적이 바로 뜹니다. 상품을 고르기 전이라면
   * 먼저 상품을 고르시라고 알려줍니다 (운영자 확정 26-09-06).
   */
  const PRODUCT_PATH = /\/(vp|vm)\/products\//
  const LAUNCH_CLOSED_KEY = 'kb-launch-closed'

  async function renderLauncher() {
    if (!IS_TOP || !document.body) return
    // 결제·장바구니 화면은 카드가 배너를 대신 보여줍니다.
    if (MONEY_HOSTS.includes(location.host)) return
    let on = false
    try { on = Boolean((await chrome.storage.local.get('kbOn'))?.kbOn) } catch { /* 무시 */ }
    const wrapOld = document.getElementById('kb-launch')
    // 켜져 있으면 배너는 물러납니다 — 상품 화면의 견적 패널이 대신합니다.
    if (on) { wrapOld?.remove(); return }
    try { if (sessionStorage.getItem(LAUNCH_CLOSED_KEY)) return } catch { /* 무시 */ }
    if (wrapOld) return

    const wrap = document.createElement('div')
    wrap.id = 'kb-launch'
    wrap.dataset.kbUi = '1'
    wrap.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483646;width:232px;' +
      'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.28)'
    wrap.innerHTML = bannerHtml() +
      '<button id="kb-launch-x" title="이 탭에서 숨기기" style="position:absolute;right:-7px;top:-7px;' +
      'width:24px;height:24px;border:0;border-radius:50%;background:#fff;color:#8b95a1;font-size:12px;' +
      'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)">✕</button>'
    wrap.querySelector('#kb-banner').addEventListener('click', async () => {
      try { await chrome.storage.local.set({ kbOn: true }) } catch { /* 무시 */ }
      wrap.remove()
      /**
       * 상품을 고르기 전이면 견적을 낼 것이 없습니다 — 무엇을 해야 하는지
       * 알려줍니다 (운영자 지시 26-09-06).
       */
      if (!PRODUCT_PATH.test(location.pathname)) {
        toast('먼저 사고 싶은 상품을 골라주세요 — 상품 화면에서 하노이 도착 가격이 바로 보입니다.', true)
      }
    })
    wrap.querySelector('#kb-launch-x').addEventListener('click', (e) => {
      e.stopPropagation()
      try { sessionStorage.setItem(LAUNCH_CLOSED_KEY, '1') } catch { /* 무시 */ }
      wrap.remove()
    })
    document.body.appendChild(wrap)
  }

  async function run() {
    if (looksLikeOrderComplete()) return runOrderComplete()
    if (MONEY_HOSTS.includes(location.host)) return renderCheckoutHelper()
    // 그 밖의 쿠팡 화면 — 꺼져 있으면 시작 배너를 띄웁니다.
    return renderLauncher()
  }

  if (IS_TOP) {
    // 결제·완료 화면이 SPA 전환으로 나타나는 경우까지 재시도합니다.
    // 결제창에서는 수량 변경이 금액에 따라오도록 갱신을 멈추지 않습니다.
    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      run()
      // 결제·장바구니가 아니면 몇 번만 시도합니다 (시작 버튼은 한 번 뜨면 끝).
      if (tries >= 8 && !MONEY_HOSTS.includes(location.host)) clearInterval(timer)
    }, 1500)
    run()
  }
})()
