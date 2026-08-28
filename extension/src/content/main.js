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
  let zone = 'hanoi-inner'
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
  const cfg = await send('getConfig')
  if (cfg?.ok && cfg.config) {
    K.applyConfig(cfg.config.policy ?? {})
    globalThis.KBExtract.setSelectors(cfg.config.selectors)
    if (cfg.config.preferences?.zone) zone = cfg.config.preferences.zone
    if (cfg.config.preferences?.track) track = cfg.config.preferences.track
  }

  const policy = K.currentPolicy()

  KBPanel.mount({
    onTrackChange: (t) => {
      track = t
      send('setPreference', { track: t })
      compute()
    },
    onAdd: async () => {
      if (!product) return
      await send('addToCart', { ...product, quantity: 1, track })
      KBPanel.setState({ added: true })
    },
    onAffiliate: async () => {
      // 사용자 클릭 시에만 제휴 링크를 생성합니다.
      const res = await send('openAffiliate', { url: product.url, track })
      if (!res?.ok) window.open(product.url, '_blank', 'noopener')
    },
  })

  // ── 2~4. 추출 → 판정 → 계산 ──
  function compute() {
    const extracted = globalThis.KBExtract.extractProduct()

    if (!extracted.ok) {
      KBPanel.setState({ view: 'error', message: extracted.message })
      return
    }

    product = extracted

    // 배송 불가면 계산 자체를 하지 않습니다. 견적을 보여줄 이유가 없습니다.
    const eligibility = K.checkEligibility({
      productName: extracted.productName,
      categoryPath: extracted.categoryPath,
      price: extracted.price,
      quantity: 1,
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

    // 고시정보(용량·중량)는 specOverride 로 넘겨 무게 엔진이 우선 사용하게 합니다.
    const item = {
      productId: extracted.productId,
      productName: extracted.productName,
      specOverride: extracted.specOverride,
      productPrice: extracted.price,
      categoryPath: extracted.categoryPath,
      quantity: 1,
    }
    const q = K.quote([item], { track, zone })
    const conf = K.CONFIDENCE_TAG[q.weight.confidence.level] ?? K.CONFIDENCE_TAG.low

    KBPanel.setState({
      view: 'quote',
      productName: extracted.productName,
      track,
      quote: q,
      confidenceLabel: conf.label,
      confidenceClass: q.weight.confidence.level === 'high' ? 'ok' : 'warn',
      disclosureShort: policy.affiliateDisclosureShort,
      fmt: { krw: K.krw, vnd: K.vnd },
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
  new MutationObserver(debounced).observe(document.body, { subtree: true, childList: true })
})()
