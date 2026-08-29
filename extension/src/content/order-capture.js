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
    card.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #f3d3dd;' +
      'border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:14px;width:260px;font:13px/1.5 sans-serif;color:#3d3644'
    card.innerHTML =
      '<b>🇻🇳 방금 결제하신 주문,<br>하노이로 받아보세요</b>' +
      '<div style="font-size:11.5px;color:#766b80;margin-top:4px">쿠팡 주문이 자동 연결되고, 국제배송비 청구서로 이어집니다.</div>' +
      '<button id="kb-fwd-go" style="margin-top:10px;width:100%;min-height:38px;border:0;border-radius:9px;' +
      'background:#ef4a76;color:#fff;font-weight:700;cursor:pointer">하노이 배송 신청</button>' +
      '<button id="kb-fwd-x" style="margin-top:6px;width:100%;min-height:30px;border:0;border-radius:9px;' +
      'background:transparent;color:#9a8fa5;cursor:pointer">닫기</button>'
    document.body.appendChild(card)
    card.querySelector('#kb-fwd-x').addEventListener('click', () => card.remove())
    card.querySelector('#kb-fwd-go').addEventListener('click', async () => {
      const res = await send('openCheckout', { coupangOrderNo })
      if (res?.ok) card.remove()
      else toast(res?.error ?? '견적함을 확인해 주세요.', false)
    })
  }

  /**
   * 결제와 동시에 배송요청 — 완료 화면을 감지하면 견적함의 배송대행
   * 상품 + 방금 쿠팡 주문번호로 배송비 결제(체크아웃)를 자동으로 엽니다.
   * 견적함이 비어 있으면 자동으로 열 수 없으므로 안내 카드로 대신합니다.
   */
  async function autoForward(coupangOrderNo) {
    const guard = `kb-fwd-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* 가드 불가 환경이면 카드 중복 정도만 감수합니다 */ }

    const res = await send('openCheckout', { coupangOrderNo })
    if (res?.ok) {
      toast('🇻🇳 하노이 배송 신청서를 새 탭에 열었습니다 — 수령인 정보만 입력하면 끝!', true)
    } else {
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
   * 결제창에서 직접 상품 읽기 — 고객이 [견적함에 담기] 없이 바로구매로
   * 와도 배송비 계산·자동 신청이 되도록, 주문 목록("상품명 / 수량 N개")과
   * 총 상품 가격을 본문에서 뽑아 견적함을 자동으로 채웁니다.
   */
  function extractCheckoutItems() {
    const text = document.body?.innerText ?? ''
    const items = []
    const re = /([^\n]{6,120})\n\s*수량\s*(\d+)\s*개/g
    let m
    while ((m = re.exec(text)) && items.length < 20) {
      const name = m[1].trim()
      if (/배송지|요청사항|결제|금액|쿠팡캐시|할인/.test(name)) continue
      items.push({ productName: name.slice(0, 120), quantity: Number(m[2]) || 1, productPrice: 0 })
    }
    const totalKrw = Number((text.match(/총\s*상품\s*가격\s*([\d,]+)\s*원/)?.[1] ?? '').replace(/,/g, ''))
    if (items.length === 0 || !Number.isFinite(totalKrw) || totalKrw <= 0) return []
    // 개별 단가는 화면에 없을 수 있어 합계를 첫 항목에 둡니다 (세금은 합계 기준이라 견적에 충분).
    items[0].productPrice = totalKrw
    return items
  }

  // 카드가 1.5초마다 다시 그려져도 서버 견적은 장바구니가 바뀔 때만 다시 부릅니다.
  let quoteCache = { key: null, fwd: null, agent: null }

  const won = (n) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('ko-KR')}원` : null)
  const dong = (n) => (Number.isFinite(n) ? `₫${Math.round(n).toLocaleString('ko-KR')}` : null)

  async function cartQuotes(cart) {
    const key = cart.map((i) => `${i.productId}x${i.quantity}`).join(',')
    if (quoteCache.key === key) return quoteCache
    const [fwd, agent] = await Promise.all([
      send('quoteCart', { track: 'forwarding' }),
      send('quoteCart', { track: 'agent' }),
    ])
    quoteCache = { key, fwd: fwd?.ok ? fwd : null, agent: agent?.ok ? agent : null }
    return quoteCache
  }

  async function renderCheckoutHelper() {
    try { if (sessionStorage.getItem('kb-helper-closed')) return } catch { /* 무시 */ }

    const cfg = await send('getConfig')
    const w = cfg?.config?.warehouse ?? {}
    const addr1 = w.address1 || '서울특별시 강서구 개화동로 11길 5'
    const zip = w.zip || '07504'
    const code = w.code || 'K-ECOM'

    const body = squash(document.body?.innerText ?? '')
    const okAddr = body.includes(squash(addr1)) || body.includes(squash('개화동로11길 5'))
    const okCode = body.includes(code)
    /**
     * 이 결제창의 상품을 항상 새로 읽습니다 — 견적함에 뭐가 남아 있든
     * 카드의 금액은 "지금 결제하는 상품" 기준이어야 합니다.
     * (수량을 바꾸면 다음 갱신 때 금액도 따라갑니다)
     */
    const pageItems = extractCheckoutItems().map((it, i) => ({
      ...it, productId: `chk-${i}`, track: 'forwarding',
    }))
    if (pageItems.length > 0) await send('setCheckoutDraft', { items: pageItems })

    const cartRes = await send('getCart')
    const fallbackCart = cartRes?.cart ?? []
    const cart = pageItems.length > 0 ? pageItems : fallbackCart
    const fwdCount = cart.filter((i) => i.track !== 'agent').length
    const quotes = cart.length > 0 ? await cartQuotes(cart) : { fwd: null, agent: null }
    const autoAdded = pageItems.length > 0

    let card = document.getElementById('kb-checkout-helper')
    if (!card) {
      card = document.createElement('div')
      card.id = 'kb-checkout-helper'
      card.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:280px;background:#fff;' +
        'border:1px solid #f3d3dd;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);' +
        'padding:13px;font:12.5px/1.55 sans-serif;color:#3d3644'
      document.body.appendChild(card)
    }

    const ok = okAddr && okCode
    const lt = cfg?.config?.leadTimeDays ?? { min: 5, max: 9 }

    // ── 배송대행: 결제할 금액과 결제 후 순서를 한눈에 ──
    const fwdKrw = won(quotes.fwd?.total)
    const moneyBlock =
      cart.length === 0
        ? '<div style="margin-top:8px;color:#766b80;font-size:11.5px">상품 페이지에서 [견적함에 담기]를 하면 ' +
          '배송비 계산과 자동 신청이 가능합니다.</div>'
        : (autoAdded
            ? `<div style="margin-top:7px;font-size:11px;color:#17916b">🛒 이 결제의 상품 ${cart.length}개 기준으로 계산했습니다.</div>`
            : '') +
          `<div style="margin-top:8px;padding:9px 10px;border-radius:10px;background:#faf7fb">` +
          (fwdKrw
            ? `<div style="display:flex;justify-content:space-between;align-items:baseline">` +
              `<span style="font-size:11.5px;color:#766b80">쿠팡 결제 후 내실 배송비</span>` +
              `<b style="font-size:15px;color:#d92e5c">${fwdKrw}</b></div>` +
              (dong(quotes.fwd?.totalVnd)
                ? `<div style="text-align:right;font-size:11px;color:#9a8fa5">≈ ${dong(quotes.fwd.totalVnd)}</div>`
                : '')
            : '<div style="font-size:11.5px;color:#766b80">배송비는 신청서에서 계산됩니다.</div>') +
          `<div style="margin-top:6px;font-size:11px;color:#574d61;line-height:1.7">` +
          `결제 후 진행 — <b>① 배송 신청서 자동 열림</b> → ② 배송비 입금(원화/동화) → ` +
          `③ 하노이 도착 ${lt.min}~${lt.max}일</div></div>`

    // ── 한국 결제수단이 없는 고객: 동화 구매대행으로 전환 ──
    const agentKrw = won(quotes.agent?.total)
    const agentVnd = dong(quotes.agent?.totalVnd)
    const agentBlock =
      cart.length === 0
        ? ''
        : '<div style="margin-top:9px;border-top:1px dashed #eee3ee;padding-top:9px">' +
          '<div style="font-size:11.5px;color:#574d61">💳 한국 카드·계좌가 없어 결제가 어려우신가요?</div>' +
          '<button id="kb-agent-go" style="margin-top:6px;width:100%;min-height:34px;border:1px solid #ef4a76;' +
          'border-radius:9px;background:#fff;color:#ef4a76;font-weight:700;cursor:pointer">동화(₫)로 구매대행 요청</button>' +
          `<div style="margin-top:4px;font-size:10.5px;color:#9a8fa5;line-height:1.6">` +
          (agentVnd ? `총 ${agentVnd}${agentKrw ? ` (${agentKrw})` : ''} — 상품가·수수료·배송비 포함. ` : '') +
          '주문서가 저장되고, 입금 확인 후 저희가 대신 주문해 드립니다.</div></div>'

    const cartLine = moneyBlock + agentBlock

    // 쿠팡 배송지 창과 같은 생김새의 3칸 미니 안내 — 어디에 뭘 넣는지 한눈에.
    const field = (icon, value, hint) =>
      `<div style="display:flex;align-items:center;gap:6px;border:1px solid #e5dbe6;border-radius:8px;` +
      `background:#fff;padding:6px 9px;margin-top:6px;font-size:12px;color:#3d3644">` +
      `<span>${icon}</span><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</b></div>` +
      `<div style="margin:2px 0 0 6px;font-size:10.5px;color:#a05a12">↑ ${esc(hint)}</div>`

    const miniForm =
      '<div style="margin-top:7px;padding:9px;border-radius:10px;background:#faf7fb">' +
      '<div style="font-size:11px;color:#766b80;text-align:center"><b>배송지 선택</b> 창에 이렇게 입력</div>' +
      field('👤', code, '이름 칸') +
      field('📍', addr1, '주소 검색(🔍)에 붙여넣기') +
      field('🏠', `${code} 본인이름`, '상세주소 — 본인 이름을 이어서') +
      '</div>' +
      `<button data-copy="${esc(addr1)}" style="margin-top:7px;width:100%;min-height:34px;border:0;border-radius:9px;` +
      'background:#ef4a76;color:#fff;font-weight:700;cursor:pointer">📋 주소 복사</button>'

    card.innerHTML =
      '<b>🇻🇳 하노이 배송</b>' +
      (ok
        ? '<div style="margin-top:7px;padding:8px 10px;border-radius:9px;background:#e6f6f0;color:#17916b">' +
          '<b>✓ 배송지 확인됨</b> — 안심하고 결제하세요.</div>'
        : '<div style="margin-top:7px;padding:8px 10px;border-radius:9px;background:#fff3e6;color:#a05a12">' +
          '<b>⚠️ 배송지가 한국 창고가 아닙니다</b></div>' + miniForm) +
      cartLine +
      '<button id="kb-helper-x" style="margin-top:8px;width:100%;min-height:28px;border:0;border-radius:8px;' +
      'background:#faf7fb;color:#9a8fa5;cursor:pointer">닫기</button>'

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
      try { sessionStorage.setItem('kb-helper-closed', '1') } catch { /* 무시 */ }
    })
    card.querySelector('#kb-agent-go')?.addEventListener('click', async () => {
      const res = await send('openCheckout', { track: 'agent' })
      if (res?.ok) toast('🛒 구매대행 신청서를 새 탭에 열었습니다 — 저장하면 동화 입금 안내가 나옵니다.', true)
      else toast(res?.error ?? '견적함을 확인해 주세요.', false)
    })
  }

  async function run() {
    if (looksLikeOrderComplete()) return runOrderComplete()
    if (location.host === 'checkout.coupang.com') return renderCheckoutHelper()
  }

  // 결제·완료 화면이 SPA 전환으로 나타나는 경우까지 재시도합니다.
  // 결제창에서는 수량 변경이 금액에 따라오도록 갱신을 멈추지 않습니다.
  let tries = 0
  const timer = setInterval(() => {
    tries += 1
    run()
    if (tries >= 8 && location.host !== 'checkout.coupang.com') clearInterval(timer)
  }, 1500)
  run()
})()
