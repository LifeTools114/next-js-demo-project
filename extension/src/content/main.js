/**
 * 콘텐츠 스크립트 진입점 — 쿠팡 상품 페이지에서 견적 패널을 띄웁니다.
 *
 * 동작 순서
 *   1. 백그라운드에서 정책 설정(요율·세율·셀렉터)을 받아 적용
 *   2. 페이지에서 상품 정보 추출
 *   3. 배송 가능 여부 판정 → 불가면 즉시 차단 표시 (계산 안 함)
 *   4. 가능하면 무게·배송비·세금 계산해서 패널에 표시
 *
 * ⚠️ 페이지 로드 시 URL 을 절대 건드리지 않습니다.
 *    제휴 링크는 사용자가 버튼을 눌렀을 때만 생성합니다. (크롬 웹스토어 정책)
 */

;(async function main() {
  if (!location.pathname.includes('/vp/products/') && !location.pathname.includes('/vm/products/')) return
  if (!globalThis.KBCalc || !globalThis.KBExtract || !globalThis.KBPanel) return

  const K = globalThis.KBCalc
  let track = 'forwarding'
  let zone = 'hanoi'
  let country = 'VN'
  let product = null

  const send = (type, payload) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (res) => {
          if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message })
          resolve(res ?? { ok: false, error: '응답이 없습니다.' })
        })
      } catch (e) {
        resolve({ ok: false, error: e.message })
      }
    })

  // ── 1. 설정 적용 ──
  let warehouse = null // 한국 창고 주소 — 배송대행은 쇼핑몰 결제 전에 알아야 합니다
  const cfg = await send('getConfig')
  if (cfg?.ok && cfg.config) {
    warehouse = cfg.config.warehouse ?? null
    K.applyConfig(cfg.config.policy ?? {})
    globalThis.KBExtract.setSelectors(cfg.config.selectors)
    if (cfg.config.preferences?.zone) zone = cfg.config.preferences.zone
    if (cfg.config.preferences?.track) track = cfg.config.preferences.track
    if (cfg.config.destination?.country) country = cfg.config.destination.country
    // 점검 창 설정도 함께 적용 — 확장이 자체 판정에 씁니다.
    if (cfg.config.maintenance) K.applyConfig({ maintenance: cfg.config.maintenance })
  }

  // "담겼습니다" 표시는 담은 그 상품에서만 — 다른 상품/옵션으로 넘어가면 초기화.
  let addedProductId = null
  /**
   * 견적·담기에 실제로 쓰는 개수.
   * 화면 값을 그대로 믿을 수 없는 경우(아래 safeQuantity 참고) 1로 떨어집니다.
   */
  let safeQty = 1

  const handlers = {
    /** 맨 위 스위치 — 끄면 이 화면도, 결제 화면 카드도 함께 조용해집니다 */
    onMode: async (off) => {
      try { await chrome.storage.local.set({ kbOn: !off }) } catch { /* 무시 */ }
      compute()
    },
    onTrackChange: (t) => {
      track = t
      send('setPreference', { track: t })
      // 서버 꺼짐 안내는 [주문서] 를 누른 그 방식에서만 — 방식을 바꾸면 지웁니다.
      // (compute 안에서 지우면 안 됩니다: 쿠팡 화면 변화로 0.6초마다 다시 계산돼 곧바로 사라집니다)
      KBPanel.setState({ notice: '' })
      compute()
    },
    onAdd: async () => {
      if (!product) return
      // 화면에서 고른 개수를 그대로 담습니다. 예전에는 무조건 1개였습니다.
      const res = await send('addToCart', { ...product, quantity: safeQty, track })
      addedProductId = product.productId
      KBPanel.setState({ added: true, cartCount: res?.count ?? 1 })
    },
    /**
     * [결제하기] (운영자 지시 26-09-04)
     *   구매하고 배송까지 → 아직 안 담겼으면 담고, 바로 신청서로 (저희에게 결제)
     *   배송만            → 열지 않습니다. 쿠팡 결제가 먼저이고, 신청서는 결제가
     *                       끝난 주문완료 화면에서 저절로 열립니다. "결제부터" 멘트만.
     */
    onPay: async () => {
      if (track === 'forwarding') {
        KBPanel.setState({ notice: '먼저 쇼핑몰에서 결제해 주세요. 결제가 끝나면 배송 신청서가 새 탭에 저절로 열립니다.' })
        return
      }
      if (!(product && addedProductId === product.productId)) await handlers.onAdd()
      await handlers.onCheckout()
    },
    onCheckout: async () => {
      // 견적함 내용을 그대로 들고 주문서(신청서)로 — 배송지 입력만 하면 됩니다.
      // (배송만은 이 버튼이 없습니다 — 쿠팡 결제 후 주문완료 화면에서 엽니다)
      const c = await send('getCart')
      // 지금 고른 방식의 상품만 실어 보냅니다 — 통째로 보내면 백그라운드가
      // 배송만 상품까지 구매대행으로 바꿔 열어, 고객이 직접 사려던 물건을
      // 저희가 대신 사는 신청서가 됩니다 (검토 26-09-04).
      const items = (c?.cart ?? []).filter((i) => i.track === track)
      if (items.length === 0) return
      const res = await send('openCheckout', { track, items })
      // 서버가 꺼져 있으면 빈 탭 대신 이유를 보여줍니다 — "에러 페이지" 의 정체입니다.
      KBPanel.setState({ notice: res?.ok ? '' : (res?.error ?? '신청서를 열지 못했습니다.') })
    },
    /** 바로가기 안내를 펼칠 때 사이트 주소를 채웁니다 (한 번만 물어봅니다) */
    onShortcutOpen: async () => {
      if (KBPanel.getState?.().siteUrl) return
      const r = await send('getSite')
      if (r?.url) KBPanel.setState({ siteUrl: r.url })
    },
    onOpenSite: () => send('openSite', { path: '/' }),
  }
  KBPanel.mount(handlers)

  // ── 2~4. 추출 → 판정 → 계산 ──
  // 시작 배너(다른 스크립트)가 kbOn 을 켜면 새로고침 없이 바로 이 화면의 견적 카드를 띄웁니다.
  try {
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.kbOn) compute() })
  } catch { /* 무시 */ }

  async function compute() {
    /**
     * 점검 시간 가드 — 쿠팡 페이지를 읽기 전에 먼저 확인합니다.
     *
     * 점검 중에는 쿠팡이 점검 안내 페이지를 띄워 가격을 0원으로 읽거나
     * 아예 못 읽을 수 있습니다. 그 값으로 견적을 만들면 완전히 틀린 금액이 나옵니다.
     * 확장이 설정값으로 스스로 판정하므로 서버가 죽어도 정확합니다.
     */
    /**
     * 직구 주문 스위치가 꺼져 있으면 아무것도 하지 않습니다 (운영자 26-09-06).
     * 쿠팡 일반 주문으로 쓰시는 중이니 견적도 안내도 방해가 됩니다.
     */
    try {
      // 켜기 전에는 패널을 아예 띄우지 않습니다 — 시작 배너만 보입니다.
      if (!(await chrome.storage.local.get('kbOn'))?.kbOn) {
        KBPanel.hide()
        return
      }
    } catch { /* 저장소를 못 읽으면 평소대로 */ }

    const gate = K.checkMaintenanceAction('readProductPage', { country })
    if (!gate.allowed) {
      KBPanel.setState({ view: 'maintenance', maintenance: K.maintenanceStatus(new Date(), country) })
      return
    }

    const extracted = globalThis.KBExtract.extractProduct()

    if (!extracted.ok) {
      KBPanel.setState({ view: 'error', message: extracted.message })
      return
    }

    product = extracted

    // 배송 불가면 계산 자체를 하지 않습니다. 견적을 보여줄 이유가 없습니다.
    /**
     * 화면에서 고른 개수를 견적에 반영합니다.
     *
     * 다만 개수를 곱해도 되는지는 **가격을 어디서 읽었는지**에 달렸습니다.
     *   json-ld · meta → 낱개 값. 곱해도 안전합니다.
     *   selector      → 화면의 `.total-price` 는 수량을 올리면 이미 곱해진
     *                   총액입니다. 여기에 또 곱하면 청구액이 개수의 제곱으로
     *                   부풀어 오릅니다 (82개면 82배 과다청구).
     * 확신이 없으면 1개로 계산하고 그렇다고 화면에 말합니다 —
     * 조용히 틀린 금액을 보여주는 것이 가장 나쁩니다.
     */
    const pageQty = Number.isFinite(extracted.quantity) ? extracted.quantity : 1
    const decided = KBExtract.safeQuantity(extracted)
    const qtyUncertain = decided.uncertain
    safeQty = decided.quantity

    // 무게를 먼저 추정해야 30kg 상한·중량물 판정이 동작합니다.
    const preWeight = K.estimateItemWeight(
      { productName: extracted.productName, specOverride: extracted.specOverride },
      safeQty,
    )
    const eligibility = K.checkEligibility({
      productName: extracted.productName,
      categoryPath: extracted.categoryPath,
      price: extracted.price,
      quantity: safeQty,
      chargeableG: preWeight.chargeableG,
    })
    if (!eligibility.shippable) {
      KBPanel.setState({
        view: 'blocked',
        productName: extracted.productName,
        label: eligibility.label,
        reason: eligibility.reason,
      })
      return
    }

    // 배송은 가능하나 자동 견적을 내지 않는 품목 — 물류사 견적이 필요합니다.
    if (eligibility.autoQuote === false) {
      KBPanel.setState({
        view: 'manual-quote',
        productName: extracted.productName,
        label: eligibility.label,
        reason: eligibility.reason,
        notice: eligibility.notice,
      })
      return
    }

    // 고시정보(용량·중량)는 specOverride 로 넘겨 무게 엔진이 우선 사용하게 합니다.
    const item = {
      productId: extracted.productId,
      productName: extracted.productName,
      specOverride: extracted.specOverride,
      productPrice: extracted.price,
      categoryPath: extracted.categoryPath,
      // 해외직구 판별 신호 — 한국 창고 도착 일정이 크게 달라집니다.
      badges: extracted.badges,
      shippingText: extracted.shippingText,
      // 국내 배송비 — 구매대행은 저희가 쿠팡에 내므로 견적에 들어갑니다.
      // 판매자마다 한 번, 무료 조건을 넘으면 0원 (lib/pricing/domestic.js).
      domesticShipKrw: extracted.domesticShipKrw ?? 0,
      freeShipOverKrw: extracted.freeShipOverKrw ?? 0,
      seller: extracted.seller ?? '',
      quantity: safeQty,
      // 운영자 발주 시 "상품 탭 열기"가 정확히 이 페이지(옵션 포함)를 열도록.
      // itemId/vendorItemId 가 빠지면 기본 옵션이 열려 대리 주문을 그르칩니다.
      productUrl: (() => {
        const u = new URL(location.href)
        const keep = new URLSearchParams()
        for (const k of ['itemId', 'vendorItemId']) {
          if (u.searchParams.get(k)) keep.set(k, u.searchParams.get(k))
        }
        return u.origin + u.pathname + (keep.toString() ? `?${keep}` : '')
      })(),
    }
    // 두 트랙을 모두 계산합니다 — 첫 화면이 "배송대행 얼마 / 구매대행 얼마"
    // 두 줄을 항상 같이 보여주기 때문입니다. (같은 상품이라 무게는 동일)
    const qF = K.quote([item], { track: 'forwarding', zone })
    const qA = K.quote([item], { track: 'agent', zone })
    const q = track === 'agent' ? qA : qF
    const conf = K.CONFIDENCE_TAG[q.weight.confidence.level] ?? K.CONFIDENCE_TAG.low
    const mstatus = K.maintenanceStatus(new Date(), country)

    // 운영자 모드: 이 상품이 발주 목록에 있으면 담을 수량을 띄웁니다.
    // (일반 고객은 hints 가 null 이라 아무것도 보이지 않습니다)
    const hintRes = await send('operatorHints')
    const operatorHint = hintRes?.hints?.[extracted.productId] ?? null

    // 견적함 개수 — "담겼는지" 확인을 패널에서 바로 할 수 있게.
    const cartRes = await send('getCart')
    const cartCount = (cartRes?.cart ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0)

    KBPanel.setState({
      view: 'quote',
      // 배송 가능 지역 — 금액 아래 굵게 (운영자 26-09-06: 중부·남부는 현재 안 됨)
      areaNotice: typeof K.serviceAreaText === 'function' ? K.serviceAreaText() : null,
      // 담김 표시는 담은 그 상품에 한해서만 유지합니다.
      added: addedProductId === extracted.productId,
      cartCount,
      operatorHint,
      warehouse,
      // 점검 예고·복구 안내는 견적을 막지 않고 배너로만 알립니다.
      maintenanceNotice: mstatus.notice,
      sourcing: q.sourcing,
      productName: extracted.productName,
      track,
      quote: q,
      quotes: { forwarding: qF, agent: qA },
      // 화면에 "82개 기준" 을 띄워, 몇 개짜리 견적인지 숨기지 않습니다.
      quantity: safeQty,
      quantityUncertain: qtyUncertain,
      pageQuantity: pageQty,
      // 화면 금액으로 되짚은 개수는 그 계산을 화면에 보여줍니다 (321,300원 = 21,420원 × 15개)
      quantityHow: extracted.quantityHow ?? '',
      unitPrice: extracted.price,
      shownPrice: extracted.shownPrice ?? null,
      // 화면 값(회원가·고른 옵션)을 쓴 경우를 패널이 알아야 그 사실을 말해줍니다
      priceBasis: extracted.priceBasis,
      catalogPrice: extracted.catalogPrice ?? null,
      confidenceLabel: conf.label,
      confidenceClass: q.weight.confidence.level === 'high' ? 'ok' : 'warn',
      ruleText: K.roundingRuleText(),
      // 수수료 같은 정책 금액은 문구에 박지 않고 여기서 넘깁니다 —
      // 서버에서 값을 바꾸면 화면 문구도 함께 따라옵니다.
      policy: K.currentPolicy(),
      fmt: { krw: K.krw, vnd: K.vnd, weight: K.weight },
    })
  }

  compute()

  // 옵션 변경 등으로 가격이 바뀌면 다시 계산합니다.
  const debounced = (() => {
    let t
    return () => {
      clearTimeout(t)
      t = setTimeout(compute, 600)
    }
  })()
  /**
   * characterData 까지 봅니다 — 수량을 바꾸면 쿠팡은 가격 **글자만** 바꾸는
   * 경우가 있어, childList 만 보면 금액이 바뀐 줄 모릅니다.
   */
  new MutationObserver(debounced).observe(document.body, { subtree: true, childList: true, characterData: true })
  /**
   * 입력칸 값 변경은 어떤 MutationObserver 로도 잡히지 않습니다.
   * 수량 칸을 고치거나 [+]/[−] 를 누르면 그 자리에서 다시 계산합니다 —
   * "수량을 늘렸는데 금액이 안 바뀐다"는 일이 없게 (운영자 26-09-06).
   */
  for (const type of ['input', 'change', 'click']) {
    document.addEventListener(type, debounced, { capture: true, passive: true })
  }

  /**
   * 색상·용량 같은 진짜 옵션은 URL(itemId)만 바꾸는 SPA 전환이라 JSON-LD 가
   * 첫 로드 값으로 남습니다. URL 이 바뀌면 새 HTML 의 구조화 데이터를 받아
   * 문서의 JSON-LD 를 갈아끼운 뒤 다시 계산합니다.
   */
  async function refetchStructuredData() {
    try {
      const html = await (await fetch(location.href, { credentials: 'include' })).text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const fresh = doc.querySelectorAll('script[type="application/ld+json"]')
      if (fresh.length === 0) return
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove())
      for (const s of fresh) {
        const clone = document.createElement('script')
        clone.type = 'application/ld+json'
        clone.textContent = s.textContent
        document.head.appendChild(clone)
      }
    } catch { /* 실패하면 기존 데이터로 계산합니다 */ }
  }

  let lastHref = location.href
  const onNav = () => {
    if (location.href === lastHref) return
    lastHref = location.href
    KBPanel.setState({ notice: '' }) // 다른 상품으로 넘어가면 이전 상품의 안내는 지웁니다
    refetchStructuredData().then(compute)
  }
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn]
    history[fn] = function (...args) {
      const r = orig.apply(this, args)
      onNav()
      return r
    }
  }
  window.addEventListener('popstate', onNav)

  /**
   * 점검이 끝나면 자동으로 다시 계산합니다.
   * 사용자가 탭을 열어둔 채 점검 창을 넘어가는 경우, 새로고침을 요구하지 않습니다.
   */
  let wasBlocked = !K.checkMaintenanceAction('readProductPage', { country }).allowed
  setInterval(() => {
    const blocked = !K.checkMaintenanceAction('readProductPage', { country }).allowed
    if (blocked !== wasBlocked) {
      wasBlocked = blocked
      compute()
    }
  }, 30_000)
})()
