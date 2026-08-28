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
  let warehouse = null // 한국 창고 주소 — 배송대행은 쿠팡 결제 전에 알아야 합니다
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
  async function compute() {
    /**
     * 점검 시간 가드 — 쿠팡 페이지를 읽기 전에 먼저 확인합니다.
     *
     * 점검 중에는 쿠팡이 점검 안내 페이지를 띄워 가격을 0원으로 읽거나
     * 아예 못 읽을 수 있습니다. 그 값으로 견적을 만들면 완전히 틀린 금액이 나옵니다.
     * 확장이 설정값으로 스스로 판정하므로 서버가 죽어도 정확합니다.
     */
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
    // 무게를 먼저 추정해야 30kg 상한·중량물 판정이 동작합니다.
    const preWeight = K.estimateItemWeight(
      { productName: extracted.productName, specOverride: extracted.specOverride },
      1,
    )
    const eligibility = K.checkEligibility({
      productName: extracted.productName,
      categoryPath: extracted.categoryPath,
      price: extracted.price,
      quantity: 1,
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
      quantity: 1,
      // 운영자 발주 시 "상품 탭 열기"가 정확히 이 페이지(옵션 포함)를 열도록
      productUrl: location.origin + location.pathname,
    }
    const q = K.quote([item], { track, zone })
    const conf = K.CONFIDENCE_TAG[q.weight.confidence.level] ?? K.CONFIDENCE_TAG.low
    const mstatus = K.maintenanceStatus(new Date(), country)
    const affGate = K.checkMaintenanceAction('affiliateLink', { country })

    // 운영자 모드: 이 상품이 발주 목록에 있으면 담을 수량을 띄웁니다.
    // (일반 고객은 hints 가 null 이라 아무것도 보이지 않습니다)
    const hintRes = await send('operatorHints')
    const operatorHint = hintRes?.hints?.[extracted.productId] ?? null

    KBPanel.setState({
      view: 'quote',
      operatorHint,
      warehouse,
      // 점검 예고·복구 안내는 견적을 막지 않고 배너로만 알립니다.
      maintenanceNotice: mstatus.notice,
      affiliateWarn: affGate.warn ? '점검 중' : null,
      sourcing: q.sourcing,
      productName: extracted.productName,
      track,
      quote: q,
      confidenceLabel: conf.label,
      confidenceClass: q.weight.confidence.level === 'high' ? 'ok' : 'warn',
      disclosureShort: policy.affiliateDisclosureShort,
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
  new MutationObserver(debounced).observe(document.body, { subtree: true, childList: true })

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
