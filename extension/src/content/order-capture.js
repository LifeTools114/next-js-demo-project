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
  const NOT_A_NAME = /배송지|요청사항|결제|금액|쿠팡캐시|할인|수량|삭제|선택|쿠폰|무료배송|도착|장바구니|주문/

  function extractCheckoutItems() {
    const text = pageTextSansOurUi()
    const items = []

    // 형식 1 (결제창): "상품명 \n 수량 N개"
    const re = /([^\n]{6,120})\n\s*수량\s*(\d+)\s*개/g
    let m
    while ((m = re.exec(text)) && items.length < 20) {
      let name = m[1].trim()
      // "옵션: 100ml, 3개" 줄이 수량 바로 앞이면 진짜 상품명은 그 앞 줄 —
      // 옵션의 용량·개수는 무게 추정에 필요하므로 이름 뒤에 붙입니다.
      if (/^옵션\s*[:：]/.test(name)) {
        const prev = text.slice(0, m.index).split('\n').map((l) => l.trim()).filter(Boolean).pop()
        if (prev && prev.length >= 6 && !NOT_A_NAME.test(prev) && !/^[\d,]+원?$/.test(prev)) {
          name = `${prev} (${name.replace(/^옵션\s*[:：]\s*/, '')})`
        }
      }
      if (NOT_A_NAME.test(name)) continue
      items.push({ productName: name.slice(0, 160), quantity: Number(m[2]) || 1, productPrice: 0 })
    }

    // 형식 2 (장바구니): "수량" 라벨과 숫자가 줄로 분리 — 가장 가까운 앞줄을 상품명으로
    if (items.length === 0) {
      const lines = text.split('\n').map((l) => l.trim())
      for (let i = 0; i < lines.length && items.length < 20; i++) {
        const qm = lines[i].match(/^수량\s*(\d*)$/)
        if (!qm) continue
        const qty = Number(qm[1] || lines[i + 1]?.match(/^(\d{1,3})$/)?.[1] || 1)
        for (let back = i - 1; back >= Math.max(0, i - 5); back--) {
          const cand = lines[back]
          if (cand.length >= 6 && cand.length <= 120 && !NOT_A_NAME.test(cand) &&
              !/^[\d,]+원?$/.test(cand) && !/^옵션/.test(cand)) {
            items.push({ productName: cand.slice(0, 160), quantity: qty || 1, productPrice: 0 })
            break
          }
        }
      }
    }

    // 두 형식 공통: 상품명 다음 몇 줄 안의 "옵션:" 줄을 이름에 붙입니다.
    // 용량·개수(예: 100ml, 3개)가 옵션 줄에만 있으면 무게 추정이 빗나갑니다.
    if (items.length > 0) {
      const all = text.split('\n').map((l) => l.trim())
      for (const it of items) {
        const at = all.findIndex((l) => l.startsWith(it.productName.slice(0, 40)))
        if (at < 0) continue
        const opt = all.slice(at + 1, at + 4).find((l) => /^옵션\s*[:：]/.test(l))
        if (!opt) continue
        const optText = opt.replace(/^옵션\s*[:：]\s*/, '')
        if (!it.productName.includes(optText)) {
          it.productName = `${it.productName} (${optText})`.slice(0, 160)
        }
      }
    }

    // 합계 — 결제창·장바구니 표기 모두 시도
    const totalKrw = Number(
      (text.match(/(?:총\s*상품\s*(?:가격|금액)|상품\s*금액)\s*:?\s*([\d,]+)\s*원/)?.[1] ?? '').replace(/,/g, ''),
    )
    if (items.length === 0 || !Number.isFinite(totalKrw) || totalKrw <= 0) return []
    // 개별 단가는 화면에 없을 수 있어 합계를 첫 항목에 둡니다.
    // 견적 엔진은 단가×수량으로 합산하므로 첫 항목 수량으로 나눠 단가로 만듭니다.
    items[0].productPrice = Math.round(totalKrw / (items[0].quantity || 1))
    return items
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

      // "(100ml당 N원)" 단가 줄은 '('로 시작해 자연 제외 — 남는 금액 중 최솟값이 판매가.
      const prices = lines
        .filter((l) => /^[\d,]{3,}원$/.test(l))
        .map((l) => Number(l.replace(/[^\d]/g, '')))
        .filter((n) => n > 0)
      const lineTotal = prices.length > 0 ? Math.min(...prices) : 0

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

  const won = (n) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('ko-KR')}원` : null)
  const dong = (n) => (Number.isFinite(n) ? `₫${Math.round(n).toLocaleString('ko-KR')}` : null)

  async function cartQuotes(cart) {
    // 항상 지금 화면에서 읽은 items 를 그대로 보냅니다 — 백그라운드에 남은
    // 옛 초안·견적함이 금액에 끼어들 수 없습니다. 키는 내용 전체라
    // 수량·옵션(이름)·가격이 바뀌면 즉시 다시 견적합니다.
    const key = cart.map((i) => `${i.productName}|${i.quantity}|${i.productPrice}`).join(',')
    // 성공한 견적은 내용이 바뀔 때까지 재사용, 실패는 10초 뒤 다시 시도 —
    // 일시적 서버 오류로 '계산 중…'에 영영 머물지 않게.
    const bothOk = Boolean(quoteCache.fwd && quoteCache.agent)
    if (quoteCache.key === key && (bothOk || Date.now() - (quoteCache.at ?? 0) < 10_000)) return quoteCache
    const [fwd, agent] = await Promise.all([
      send('quoteCart', { track: 'forwarding', items: cart }),
      send('quoteCart', { track: 'agent', items: cart }),
    ])
    quoteCache = { key, at: Date.now(), fwd: fwd?.ok ? fwd : null, agent: agent?.ok ? agent : null }
    return quoteCache
  }

  /**
   * 배송지 입력창의 연락처 자동 입력 — 빈 칸일 때만, 배송지 다이얼로그
   * 안에서만 채웁니다. 사용자가 적은 값은 절대 덮어쓰지 않습니다.
   * (쿠팡은 React 라 네이티브 setter 로 넣어야 값이 인식됩니다)
   */
  function autofillPhone(phone) {
    if (!phone) return
    const inputs = document.querySelectorAll(
      'input[type="tel"], input[name*="phone" i], input[placeholder*="휴대폰"], input[placeholder*="전화"]',
    )
    for (const input of inputs) {
      if (input.dataset.kbFilled || input.value.trim() !== '' || !input.offsetParent) continue
      const dialog = input.closest('[role="dialog"], form') ?? input.parentElement?.parentElement
      if (!dialog || !/배송지/.test((dialog.innerText ?? '').slice(0, 2000))) continue
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
      if (setter) setter.call(input, phone)
      else input.value = phone
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dataset.kbFilled = '1'
    }
  }

  async function renderCheckoutHelper() {
    try { if (sessionStorage.getItem('kb-helper-closed')) return } catch { /* 무시 */ }

    const cfg = await send('getConfig')
    const w = cfg?.config?.warehouse ?? {}
    const addr1 = w.address1 || '서울특별시 강서구 개화동로 11길 5'
    const zip = w.zip || '07504'
    const code = w.code || 'K-ECOM'
    const phone = w.phone || '010-7360-1156'

    // 배송지 다이얼로그가 열려 있으면 연락처를 채워둡니다.
    autofillPhone(phone)

    const body = squash(pageTextSansOurUi())
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
    const quotes = cart.length > 0 ? await cartQuotes(cart) : { fwd: null, agent: null }
    const autoAdded = pageItems.length > 0

    let card = document.getElementById('kb-checkout-helper')
    if (!card) {
      card = document.createElement('div')
      card.id = 'kb-checkout-helper'
      card.dataset.kbUi = '1'
      card.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:280px;background:#fff;' +
        'border:1px solid #dbe4f0;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);' +
        'padding:13px;font:12.5px/1.55 sans-serif;color:#191f28'
      document.body.appendChild(card)
    }

    const ok = okAddr && okCode
    const lt = cfg?.config?.leadTimeDays ?? { min: 5, max: 9 }

    // ── 가격 두 줄이 카드의 전부 — 설명은 [이용 방법]을 눌러야 보입니다 ──
    const priceRow = (label, sub, q) =>
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 2px">' +
      `<div><div style="font-weight:800;font-size:13px;color:#191f28">${label}</div>` +
      `<div style="font-size:10.5px;color:#8b95a1">${sub}</div></div>` +
      (q && won(q.total)
        ? '<div style="text-align:right">' +
          `<div style="font-weight:800;font-size:16px;color:#191f28;white-space:nowrap">${won(q.total)}</div>` +
          (dong(q.totalVnd)
            ? `<div style="font-size:11px;font-weight:700;color:#f04452;white-space:nowrap">≈ ${dong(q.totalVnd)}</div>`
            : '') +
          '</div>'
        : '<div style="font-size:11px;color:#8b95a1">계산 중…</div>') +
      '</div>'

    const priceBlock = cart.length === 0
      ? '<div style="margin-top:8px;color:#4e5968;font-size:12px">상품 페이지에서 [견적함에 담기]를 하면 ' +
        '금액 계산과 자동 신청이 가능합니다.</div>'
      : '<div style="margin-top:7px;border:1px solid #e5e8eb;border-radius:10px;padding:2px 10px;background:#fff">' +
        priceRow('배송대행', '배송비 · 쿠팡 결제는 내가', quotes.fwd) +
        '<div style="border-top:1px solid #f2f4f6"></div>' +
        priceRow('구매대행', '총액 · 결제까지 맡김', quotes.agent) +
        '</div>' +
        (autoAdded
          ? `<div style="margin-top:5px;font-size:10.5px;color:#17916b">🛒 이 화면의 상품 ${cart.length}개 기준</div>`
          : '')

    // ── 접힌 설명 영역 — 단계 안내와 구매대행 신청 버튼 ──
    const steps = (text) =>
      `<div style="margin-top:4px;font-size:11px;color:#4e5968;line-height:1.7">${text}</div>`
    const detailHead = (text) =>
      `<div style="margin-top:9px;font-size:11.5px;font-weight:800;color:#333d4b">${text}</div>`

    const detailBlock = !helperDetailOpen || cart.length === 0
      ? ''
      : (onCart
          ? '<div style="margin-top:8px;padding:7px 9px;border-radius:9px;background:#eef4fb;color:#2b5e9e;font-size:11px">' +
            '주문 단계로 가면 배송지(한국 창고) 입력을 도와드립니다.</div>'
          : '') +
        detailHead('배송대행 — 결제는 내가, 배송만 맡김') +
        steps(`쿠팡 결제 후 <b>① 배송 신청서 자동 열림</b> → ② 배송비 입금(원화/동화) → ③ 하노이 도착 ${lt.min}~${lt.max}일`) +
        steps('무게 기준: 1kg까지 기본요금 · 이후 kg 단위(0.5 이하 버림·초과 올림)') +
        detailHead('구매대행 — 결제까지 맡김') +
        steps('쿠팡 결제가 필요 없습니다 — <b>① 신청서 저장</b> → ② 원화/동화 입금 → ③ 저희가 대신 주문 → ' +
          `④ 하노이 도착 ${lt.min}~${lt.max}일`) +
        '<button id="kb-agent-go" style="margin-top:7px;width:100%;min-height:38px;border:0;border-radius:9px;' +
        'background:#3182f6;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer">구매대행 신청서 작성</button>' +
        '<div style="margin-top:4px;font-size:10.5px;color:#8b95a1;text-align:center">한국 카드·계좌 없이 동화(₫)로 이용할 수 있습니다</div>'

    const cartLine = priceBlock +
      (cart.length > 0
        ? '<button id="kb-detail" style="margin-top:7px;width:100%;min-height:30px;border:1px solid #e5e8eb;' +
          'border-radius:8px;background:#fff;color:#4e5968;font-weight:700;font-size:11.5px;cursor:pointer">' +
          (helperDetailOpen ? '접기 ▴' : '이용 방법 · 신청 ▾') + '</button>'
        : '') +
      detailBlock

    // 쿠팡 배송지 창과 같은 생김새의 3칸 미니 안내 — 어디에 뭘 넣는지 한눈에.
    const field = (icon, value, hint) =>
      `<div style="display:flex;align-items:center;gap:6px;border:1px solid #e5e8eb;border-radius:8px;` +
      `background:#fff;padding:6px 9px;margin-top:6px;font-size:12px;color:#191f28">` +
      `<span>${icon}</span><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</b></div>` +
      `<div style="margin:2px 0 0 6px;font-size:10.5px;color:#a05a12">↑ ${esc(hint)}</div>`

    const miniForm =
      '<div style="margin-top:7px;padding:9px;border-radius:10px;background:#f9fafb">' +
      '<div style="font-size:11px;color:#4e5968;text-align:center"><b>배송지 선택</b> 창에 이렇게 입력</div>' +
      field('👤', code, '이름 칸') +
      field('📍', addr1, '주소 검색(🔍)에 붙여넣기') +
      field('🏠', `${code} 본인이름`, '상세주소 — 본인 이름을 이어서') +
      field('📞', phone, '연락처 — 자동으로 입력됩니다') +
      '</div>' +
      `<button data-copy="${esc(addr1)}" style="margin-top:7px;width:100%;min-height:34px;border:0;border-radius:9px;` +
      'background:#3182f6;color:#fff;font-weight:700;cursor:pointer">📋 주소 복사</button>'

    // 장바구니 화면에는 배송지가 아직 없으므로 검사하지 않습니다 (안내는 접힌 영역에).
    // 주소가 틀렸을 때의 경고·입력 안내만은 항상 보입니다 — 결제 실패로 직결되므로.
    const statusBlock = onCart
      ? ''
      : ok
        ? '<div style="margin-top:7px;padding:7px 10px;border-radius:9px;background:#e6f6f0;color:#17916b;font-size:12px">' +
          '<b>✓ 배송지 확인됨</b> — 안심하고 결제하세요.</div>'
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
      try { sessionStorage.setItem('kb-helper-closed', '1') } catch { /* 무시 */ }
    })
    card.querySelector('#kb-agent-go')?.addEventListener('click', async () => {
      // 카드에 보인 금액 그대로 신청서로 — 지금 화면의 상품을 들려 보냅니다.
      const res = await send('openCheckout', { track: 'agent', items: cart })
      if (res?.ok) toast('🛒 구매대행 신청서를 새 탭에 열었습니다 — 저장하면 입금 안내가 나옵니다.', true)
      else toast(res?.error ?? '견적함을 확인해 주세요.', false)
    })
    card.querySelector('#kb-detail')?.addEventListener('click', () => {
      helperDetailOpen = !helperDetailOpen
      card.dataset.kbHtml = ''
      renderCheckoutHelper()
    })
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
