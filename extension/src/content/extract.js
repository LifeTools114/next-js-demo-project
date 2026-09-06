/**
 * 쿠팡 페이지에서 상품 정보를 추출합니다.
 *
 * 이 파일이 이 확장의 가장 취약한 부분입니다. 쿠팡이 마크업을 바꾸면 깨집니다.
 * 그래서 네 단계로 시도하고, 앞 단계일수록 마크업 변경에 강합니다.
 *
 *   1) JSON-LD (schema.org Product)  ← 가장 안정적. SEO 용이라 잘 안 바뀜
 *   2) OpenGraph / meta 태그          ← 그다음으로 안정적
 *   3) CSS 셀렉터 (원격 설정 가능)     ← 가장 취약. 백엔드에서 갱신
 *   4) 실패                           ← 절대 추측하지 않고 "읽을 수 없음"을 반환
 *
 * ⚠️ 원칙: 잘못된 견적은 침묵보다 나쁩니다.
 *    가격이나 상품명을 못 읽으면 엉뚱한 숫자를 만들어내지 말고 실패를 표시합니다.
 */

const KBExtract = (() => {
  /** 원격으로 갱신 가능한 기본 셀렉터. 백엔드 설정이 있으면 덮어씁니다. */
  const DEFAULT_SELECTORS = {
    productName: [
      'h1.prod-buy-header__title',
      '.prod-buy-header__title',
      'h2.prod-buy-header__title',
      '#contents .prod-buy-header__title',
      'h1[class*="ProductTitle"]',
    ],
    price: [
      '.prod-sale-price .total-price strong',
      '.total-price strong',
      '.prod-price .total-price',
      'span.total-price > strong',
      '[class*="PriceInfo"] [class*="finalPrice"]',
    ],
    /**
     * 수량 입력칸 — 고객이 화면에서 고른 개수입니다.
     * 이걸 안 읽으면 82개를 골라놔도 1개짜리 견적을 보여주게 됩니다.
     * (26-09-04 실제로 그랬습니다)
     */
    quantity: [
      'input[name="quantity"]',
      '.prod-quantity input',
      '.prod-quantity__input',
      '[class*="QuantityInput"] input',
      '[class*="quantity" i] input[type="number"]',
      '[class*="quantity" i] input[type="tel"]',
    ],
    breadcrumb: ['#breadcrumb', '.breadcrumb', 'ul.breadcrumb'],
    /** 고시정보 표 — 내용물의 용량 또는 중량이 여기 있습니다 */
    noticeTable: ['.prod-description table', '.product-details table', 'table.prod-delivery-return-policy-table'],
    rocket: ['.badge.rocket', '[class*="rocket"] img', '.prod-shipping-fee-message'],
    /** 배지 — 로켓직구·해외직구 판별에 씁니다 */
    badges: ['.badge', '.prod-badge', '[class*="Badge"]', '.delivery-badge'],
    /** 배송 안내 문구 — '해외배송', '통관번호 필요' 등이 여기 있습니다 */
    shippingInfo: ['.prod-shipping', '.prod-shipping-fee', '.delivery-info', '[class*="shippingInfo"]'],
    soldOut: ['.prod-out-of-stock', '.oos-label', '[class*="soldOut"]'],
  }

  let selectors = { ...DEFAULT_SELECTORS }

  function setSelectors(remote) {
    if (!remote || typeof remote !== 'object') return
    for (const [key, value] of Object.entries(remote)) {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        selectors[key] = [...value, ...(DEFAULT_SELECTORS[key] ?? [])]
      }
    }
  }

  const first = (list) => {
    for (const sel of list ?? []) {
      try {
        const el = document.querySelector(sel)
        if (el) return el
      } catch {
        /* 잘못된 셀렉터는 건너뜁니다 */
      }
    }
    return null
  }

  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')

  const toNumber = (raw) => {
    const digits = String(raw ?? '').replace(/[^\d]/g, '')
    if (!digits) return null
    const n = Number.parseInt(digits, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  // ── 1단계: JSON-LD ──────────────────────────────────────────
  function fromJsonLd() {
    const nodes = document.querySelectorAll('script[type="application/ld+json"]')
    for (const node of nodes) {
      let data
      try {
        data = JSON.parse(node.textContent)
      } catch {
        continue
      }
      const candidates = Array.isArray(data) ? data : [data, ...(data['@graph'] ?? [])]
      for (const c of candidates) {
        if (!c || typeof c !== 'object') continue
        const type = c['@type']
        const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'))
        if (!isProduct) continue

        const offers = Array.isArray(c.offers) ? c.offers[0] : c.offers
        /**
         * offers.price 가 있으면 **그 상품 하나의 값**입니다.
         * 없고 lowPrice 만 있으면(AggregateOffer) 색상·사이즈 옵션들 중
         * **가장 싼 것**의 값입니다 — 고객이 고른 옵션의 값이 아닙니다.
         *
         * 26-09-06 운영자 화면: 카라티(18컬러 S-5L)에서 화면은 21,800원인데
         * JSON-LD 최저가는 10,900원이었습니다. 그대로 쓰면 구매대행에서
         * 한 벌당 10,900원을 우리가 물어야 합니다. 그래서 확정값인지
         * 아닌지를 표시해 두고, 아래에서 화면 값과 견줍니다.
         */
        const exact = toNumber(offers?.price)
        const low = toNumber(offers?.lowPrice)
        const high = toNumber(offers?.highPrice)
        if (!c.name) continue

        return {
          productName: String(c.name).trim(),
          price: exact ?? low,
          /** 고른 옵션의 값으로 믿어도 되는가 (AggregateOffer 의 최저가는 아님) */
          priceExact: Boolean(exact),
          lowPrice: low,
          highPrice: high,
          image: typeof c.image === 'string' ? c.image : c.image?.[0] ?? null,
          brand: typeof c.brand === 'string' ? c.brand : c.brand?.name ?? null,
          source: 'json-ld',
        }
      }
    }
    return null
  }

  // ── 2단계: meta 태그 ────────────────────────────────────────
  function fromMeta() {
    const meta = (prop) =>
      document.querySelector(`meta[property="${prop}"]`)?.content ??
      document.querySelector(`meta[name="${prop}"]`)?.content ??
      null

    const name = meta('og:title')
    if (!name) return null
    return {
      productName: name.replace(/\s*[-|]\s*쿠팡!?\s*$/, '').trim(),
      price: toNumber(meta('product:price:amount') ?? meta('og:price:amount')),
      priceExact: true, // meta 가격은 이 상품 하나의 값입니다

      image: meta('og:image'),
      brand: meta('product:brand'),
      source: 'meta',
    }
  }

  // ── 3단계: CSS 셀렉터 ───────────────────────────────────────
  function fromSelectors() {
    const name = text(first(selectors.productName))
    if (!name) return null
    return {
      productName: name,
      // 셀렉터가 빗나가도 화면에서 제일 큰 금액으로 찾아냅니다 —
      // 값이 멀쩡히 떠 있는데 "가격을 읽지 못했습니다" 만 나오면 안 됩니다.
      price: toNumber(text(first(selectors.price))) ?? screenPriceWide(),
      image: null,
      brand: null,
      source: 'selector',
    }
  }

  /**
   * 고시정보 표에서 용량/중량을 읽습니다.
   * 상품명 파싱보다 훨씬 정확하므로 있으면 우선 사용합니다.
   */
  function extractNoticeSpec() {
    const table = first(selectors.noticeTable)
    if (!table) return null

    const rows = table.querySelectorAll('tr')
    const WEIGHT_LABELS = ['용량', '중량', '내용물의 용량', '내용량', '총 내용량', '제품 주요 사양']
    for (const row of rows) {
      const cells = row.querySelectorAll('th, td')
      if (cells.length < 2) continue
      const label = text(cells[0])
      if (!WEIGHT_LABELS.some((l) => label.includes(l))) continue
      const value = text(cells[1])
      if (value && value !== '-' && !/상세.*참조/.test(value)) {
        return { label, value }
      }
    }
    return null
  }

  /** 페이지의 배지 텍스트를 모두 모읍니다 (로켓직구·해외직구 판별용) */
  function extractBadges() {
    const out = new Set()
    for (const sel of selectors.badges ?? []) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const t = text(el) || el.getAttribute('alt') || ''
          if (t && t.length <= 20) out.add(t)
        }
      } catch {
        /* 잘못된 셀렉터는 건너뜁니다 */
      }
    }
    return [...out]
  }

  /** 배송 안내 문구 */
  function extractShippingText() {
    return (selectors.shippingInfo ?? [])
      .map((sel) => {
        try {
          return text(document.querySelector(sel))
        } catch {
          return ''
        }
      })
      .filter(Boolean)
      .join(' ')
      .slice(0, 300)
  }

  function extractBreadcrumb() {
    const el = first(selectors.breadcrumb)
    if (!el) return ''
    // a 와 li 를 함께 선택하면 같은 항목이 두 번 잡힙니다.
    // 링크가 있으면 링크만, 없으면 li 를 씁니다.
    const nodes = el.querySelectorAll('a')
    const list = (nodes.length ? [...nodes] : [...el.querySelectorAll('li')])
      .map((n) => text(n))
      .filter(Boolean)
    // 혹시 남는 중복은 제거합니다.
    return [...new Set(list)].join(' > ')
  }

  /**
   * 상품 상세 페이지에서 정보를 추출합니다.
   * @returns {{ok:boolean, ...}} ok:false 면 절대 견적을 만들지 않습니다.
   */
  /**
   * 옵션 실시간 보정 — 쿠팡은 수량 옵션(1개/2개…)을 클릭해도 JSON-LD 를
   * 갱신하지 않아 첫 로드 값(1개 가격)이 남습니다. 화면에서 "선택된"
   * 옵션 요소의 "N개 … 원" 을 읽어 가격·수량을 덮어씁니다.
   */
  function selectedOptionOverride() {
    // 마지막 후보(active)는 넓은 그물 — 라디오가 커스텀 div 인 페이지 대비.
    const queries = ['input[type=radio]:checked', '[aria-checked="true"]', '[class*="selected" i]', '[class*="active" i]']
    const seen = new Set()
    for (const q of queries) {
      let nodes
      try { nodes = document.querySelectorAll(q) } catch { continue }
      for (const node of nodes) {
        /**
         * 선택 표시 요소는 텍스트 없는 동그라미(input·span)인 경우가 많아
         * label/li 고정 탐색으로는 옵션 줄을 놓칩니다. 자신부터 조상으로
         * 올라가며 "N개 … 원" 이 있는 가장 작은 블록을 찾습니다.
         * 120자 상한이 안전장치 — 옵션 목록 전체를 감싸는 조상은 다른
         * 옵션 가격까지 섞여 있으므로 길이에서 걸러집니다.
         */
        let holder = node
        for (let up = 0; holder && up < 5; up++) {
          if (seen.has(holder)) break
          seen.add(holder)
          const text = (holder.innerText ?? '').trim()
          if (text.length > 120) break
          const m = text.match(/(\d+)\s*개\s*\n?\s*([\d,]{4,})\s*원/)
          if (m) return { count: Number(m[1]), price: Number(m[2].replace(/,/g, '')) }
          holder = holder.parentElement
        }
      }
    }
    return null
  }

  /**
   * 화면에서 고른 수량을 읽습니다.
   *
   * 못 읽으면 1 로 두되 found:false 로 알립니다 — 잘못된 개수로 계산하느니
   * 1개로 계산하고 그렇다고 말하는 편이 낫습니다.
   */
  function readQuantity() {
    const el = first(selectors.quantity)
    if (el) {
      const n = intValue(el.value ?? el.getAttribute('value') ?? '')
      // 화면 값이 터무니없으면(오타·자동입력) 믿지 않습니다 — intValue 가 1~999 만 인정.
      if (n) return { value: n, found: true, how: 'selector' }
    }
    /**
     * 셀렉터가 모두 빗나갔습니다 — 쿠팡이 화면을 바꾼 것입니다 (26-09-06 운영자
     * 화면: 수량 15 인데 1개 견적). 셀렉터 목록은 원격으로 고칠 수 있지만 그때까지
     * 고객이 틀린 개수를 보게 둘 수는 없으므로, 구조에 덜 기대는 그물을 던집니다.
     */
    const wide = findQuantityWide()
    if (wide) return wide
    return { value: 1, found: false, how: '' }
  }

  /** 1~999 의 정수만 인정 — 수량으로 말이 되는 범위 */
  const intValue = (raw) => {
    const n = Number.parseInt(String(raw ?? '').replace(/[^0-9]/g, ''), 10)
    return Number.isFinite(n) && n >= 1 && n <= 999 ? n : null
  }
  const rectOf = (el) => { try { return el.getBoundingClientRect() } catch { return null } }
  const visible = (el) => { const r = rectOf(el); return Boolean(r && r.width > 0 && r.height > 0) }
  /** 요소의 이름표들 — aria-label·name·id·class·placeholder·title 을 한 줄로 */
  const hintOf = (el) => [
    el.getAttribute?.('aria-label'), el.getAttribute?.('name'), el.id, el.className,
    el.getAttribute?.('placeholder'), el.getAttribute?.('title'), el.getAttribute?.('data-testid'),
  ].map((v) => String(v ?? '')).join(' ')
  const QTY_WORDS = /수량|quantity|qty|개수/i
  const isSearchy = (el) =>
    el.type === 'search' || /search|검색/i.test(hintOf(el)) ||
    Boolean(el.closest?.('[role="search"], form[action*="search" i], header'))
  /** [장바구니 담기]·[바로구매] 의 위치 — 수량 칸은 그 줄에 있습니다 */
  function buyButtonRects() {
    const out = []
    let nodes
    try { nodes = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]') } catch { return out }
    for (const b of nodes) {
      const t = String(b.textContent || b.value || '').replace(/\s+/g, '')
      if (!/장바구니담기|바로구매|구매하기|주문하기/.test(t)) continue
      const r = rectOf(b)
      if (r && r.width > 0) out.push(r)
    }
    return out
  }
  const sameRow = (el, rects) => {
    const r = rectOf(el)
    if (!r || rects.length === 0) return false
    const mid = (r.top + r.bottom) / 2
    return rects.some((b) => Math.abs((b.top + b.bottom) / 2 - mid) <= 120)
  }

  /** 요소의 글자 모양 — 화면에서 제일 큰 금액을 고르는 데 씁니다 */
  const styleOf = (el) => {
    try {
      const view = el.ownerDocument?.defaultView ?? globalThis.window
      const cs = view?.getComputedStyle?.(el)
      if (cs) return cs
    } catch { /* 접근 불가 */ }
    return el.style ?? {}
  }
  const PRICE_TEXT = /^[0-9][0-9,]{2,}원$/

  /**
   * 화면에 **크게** 떠 있는 금액 — 고객이 실제로 보고 있는 값입니다.
   *
   * 셀렉터(.total-price 등)가 쿠팡의 새 화면에서 다 빗나가므로, 구조 대신
   * "구매 버튼 위쪽 본문에서 글자가 가장 큰 금액" 으로 찾습니다.
   * 취소선(정가)과 장바구니 미리보기·추천 상품 값은 제외합니다.
   */
  function screenPriceWide() {
    const buys = buyButtonRects()
    const floor = buys.length > 0 ? Math.min(...buys.map((r) => r.bottom)) : Infinity
    const rightEdge = buys.length > 0 ? Math.max(...buys.map((r) => r.right)) : Infinity
    let nodes
    try { nodes = document.querySelectorAll('strong, span, div, b, em, p, dd') } catch { return null }
    let best = null
    for (const el of nodes) {
      const t = String(el.textContent ?? '').replace(/\s+/g, '')
      if (!PRICE_TEXT.test(t)) continue
      // 같은 금액을 감싸고 있는 껍데기는 건너뜁니다 — 가장 안쪽만 봅니다.
      if ([...(el.children ?? [])].some((c) => PRICE_TEXT.test(String(c.textContent ?? '').replace(/\s+/g, '')))) continue
      if (!visible(el)) continue
      const r = rectOf(el)
      // 구매 버튼보다 아래(추천 상품)·오른쪽(장바구니 미리보기)은 이 상품의 값이 아닙니다.
      if (!r || r.top > floor || r.left > rightEdge) continue
      const st = styleOf(el)
      // 취소선은 정가입니다 (31% 31,600원)
      if (/line-through/.test(String(st.textDecoration ?? st.textDecorationLine ?? ''))) continue
      if (el.closest?.('del, s, strike')) continue
      const n = toNumber(t)
      if (!n) continue
      const size = Number.parseFloat(st.fontSize) || 0
      if (!best || size > best.size) best = { n, size }
    }
    return best?.n ?? null
  }

  /** 화면 금액 — 셀렉터 먼저, 빗나가면 넓은 그물 */
  function readScreenPrice() {
    return toNumber(text(first(selectors.price))) ?? screenPriceWide()
  }

  /**
   * 낱개 값을 정합니다 — **고객이 화면에서 보는 값**이 기준입니다.
   *
   * JSON-LD 를 무턱대고 믿으면 안 되는 경우가 둘 있습니다.
   *   · 옵션 묶음의 최저가(AggregateOffer) — 고른 옵션이 더 비쌉니다
   *   · 회원가(와우) 가 화면에만 반영된 경우
   * 반대로 화면 값을 무턱대고 믿어도 안 됩니다 — 로켓 상품은 수량을 올리면
   * 화면의 큰 금액이 **이미 곱해진 총액**이라, 거기에 또 곱하면 개수의
   * 제곱으로 부풀어 오릅니다.
   *
   * @returns {{ price:number, basis:string }} basis: json-ld·meta·screen·selector
   */
  function resolveUnitPrice(base, screen, qty) {
    const ld = base.price
    if (!screen) return { price: ld, basis: base.source }
    if (!ld) return { price: screen, basis: 'selector' }
    if (screen === ld) return { price: ld, basis: base.source }

    if (base.priceExact) {
      /**
       * 확정값의 **정수배** = 로켓 상품의 곱해진 총액입니다 (21,420 × 15 = 321,300).
       * 낱개 값은 JSON-LD 쪽이고, 그 배수가 곧 개수입니다 (아래에서 되짚습니다).
       */
      if (screen > ld && screen % ld === 0 && screen / ld <= 999) return { price: ld, basis: base.source }
      /**
       * 화면이 **더 싸다** = 회원가·할인입니다. 곱해진 총액은 낱개 값보다 작을 수
       * 없으므로 이 방향은 헷갈릴 여지가 없습니다 — 고객이 낼 값을 그대로 씁니다.
       */
      if (screen < ld) return { price: screen, basis: 'screen' }
      /**
       * 화면이 더 비싼데 배수가 아니다 = 할인이 섞인 총액일 수 있습니다. 이걸
       * 낱개 값으로 오해하면 개수를 곱할 때 몇 배로 부풀어 오르므로 지키던 값을 씁니다.
       */
      return { price: ld, basis: base.source }
    }
    /**
     * JSON-LD 가 옵션 묶음의 **최저가**입니다 — 고객이 고른 옵션은 더 비쌀 수
     * 있으므로 화면 값이 기준입니다. 다만 화면 값이 옵션 값 범위를 넘고 개수로
     * 나누어떨어지면 "고른 옵션의 값 × 개수" 인 총액이라 나눠서 되돌립니다.
     */
    const outOfRange = (n) => (base.highPrice ? n > base.highPrice : false)
    const inRange = (n) => (base.lowPrice ? n >= base.lowPrice : true) && !outOfRange(n)
    if (qty >= 2 && screen % qty === 0 && outOfRange(screen) && inRange(screen / qty)) {
      return { price: screen / qty, basis: 'screen' }
    }
    return { price: screen, basis: 'screen' }
  }

  /**
   * 수량 칸을 구조 없이 찾습니다 — 셀렉터가 다 빗나갔을 때의 그물.
   *   ① 이름표(aria-label·name·id·class·placeholder)에 '수량' 이 있는 입력칸
   *   ② 화면에 숫자 입력칸(type=number·inputmode=numeric)이 하나뿐이면 그것
   *   ③ [장바구니 담기]·[바로구매] 와 같은 줄에 있는 작은 입력칸
   *   ④ [+]·[−] 버튼 사이의 숫자 (입력칸이 아니라 글자로 그리는 화면)
   * 검색창·헤더 안의 칸은 제외합니다.
   */
  function findQuantityWide() {
    let fields
    try {
      fields = [...document.querySelectorAll('input[type="number"], input[inputmode="numeric"], input[type="tel"], input[type="text"], input:not([type]), select')]
    } catch { fields = [] }
    const valued = fields
      .filter((el) => visible(el) && !isSearchy(el))
      .map((el) => ({
        el,
        n: el.tagName === 'SELECT'
          ? intValue(el.options?.[el.selectedIndex]?.text ?? el.value)
          : intValue(el.value),
      }))
      .filter((x) => x.n)
    const labeled = valued.find((x) => QTY_WORDS.test(hintOf(x.el)))
    if (labeled) return { value: labeled.n, found: true, how: 'labeled' }
    const numeric = valued.filter((x) => x.el.type === 'number' || x.el.getAttribute?.('inputmode') === 'numeric')
    if (numeric.length === 1) return { value: numeric[0].n, found: true, how: 'number-input' }
    const rects = buyButtonRects()
    const near = valued.filter((x) => sameRow(x.el, rects) && (rectOf(x.el)?.width ?? 999) <= 160)
    if (near.length === 1) return { value: near[0].n, found: true, how: 'near-buy' }

    // ④ 스테퍼: [+] 나 "수량 늘리기" 버튼 옆의 숫자
    let btns
    try { btns = [...document.querySelectorAll('button, [role="button"], a')] } catch { btns = [] }
    for (const b of btns) {
      if (!visible(b)) continue
      const label = String(b.getAttribute?.('aria-label') ?? '')
      const t = String(b.textContent ?? '').replace(/\s+/g, '')
      const plus = /^[+＋]$/.test(t) || /증가|늘리|plus|increase/i.test(label)
      const minus = /^[-−–－]$/.test(t) || /감소|줄이|minus|decrease/i.test(label)
      if (!plus && !minus) continue
      const kin = [b.previousElementSibling, b.nextElementSibling, ...(b.parentElement?.children ?? [])]
      for (const k of kin) {
        if (!k || k === b) continue
        const n = intValue(k.tagName === 'INPUT' || k.tagName === 'SELECT' ? k.value : k.textContent)
        if (n && String(k.tagName === 'INPUT' ? k.value : k.textContent).trim().length <= 4) return { value: n, found: true, how: 'stepper' }
      }
    }
    return null
  }

  /**
   * 세 단계를 **끝까지** 시도합니다.
   *
   * 예전에는 `fromJsonLd() ?? fromMeta() ?? fromSelectors()` 였습니다.
   * 쿠팡 페이지에는 og:title 이 항상 있어서 2단계가 늘 "이름은 있고 가격은
   * 없음" 을 돌려주고, 그 순간 3단계(CSS 셀렉터)는 **한 번도 실행되지
   * 않았습니다.** 즉 JSON-LD 가 사라지면 화면에 가격이 멀쩡히 떠 있어도
   * "가격을 읽지 못했습니다" 만 나오고, 쿠팡 화면 변경에 대비해 만든
   * 원격 셀렉터 갱신도 무용지물이었습니다. (26-09-04 발견)
   *
   * 이제 이름과 가격이 **둘 다** 있는 첫 단계를 고르고, 그런 단계가
   * 없으면 이름이라도 있는 단계를 골라 이유를 제대로 말합니다.
   */
  function pickBase() {
    const layers = [fromJsonLd, fromMeta, fromSelectors]
    let named = null
    for (const layer of layers) {
      let r = null
      try { r = layer() } catch { r = null }
      if (!r || !r.productName) continue
      if (r.price) return r
      named ??= r
    }
    return named
  }

  function extractProduct() {
    const base = pickBase()

    if (!base || !base.productName) {
      return { ok: false, reason: 'name', message: '상품명을 읽지 못했습니다. 페이지를 새로고침해 주세요.' }
    }
    if (!base.price) {
      return {
        ok: false,
        reason: 'price',
        productName: base.productName,
        message: '가격을 읽지 못했습니다. 옵션을 선택하면 다시 계산됩니다.',
      }
    }

    const notice = extractNoticeSpec()
    let qty = readQuantity()

    // 선택된 수량 옵션이 있으면 가격과 상품명 끝의 "N개" 를 그 값으로.
    // (상품명의 개수는 무게 계산이 그대로 쓰므로 함께 맞춰야 합니다)
    const opt = selectedOptionOverride()
    let productName = base.productName
    let price = base.price
    if (opt?.price) {
      price = opt.price
      productName = /,?\s*\d+\s*개\s*$/.test(productName)
        ? productName.replace(/,?\s*\d+\s*개\s*$/, `, ${opt.count}개`)
        : `${productName}, ${opt.count}개`
    }
    /**
     * 화면 값과 견줍니다.
     *   · 고른 옵션·회원가가 화면에만 반영된 경우 → 화면 값을 낱개 값으로
     *   · 화면 값이 낱개 값의 정수배 → 곱해진 총액이니 그 배수가 곧 개수
     * 수량 옵션("2개 42,840원")이 이미 값을 정했으면 그쪽이 더 구체적이라 건드리지 않습니다.
     */
    const shownPrice = base.source === 'selector' ? null : readScreenPrice()
    let basis = base.source
    // 수량 옵션("2개 42,840원")이 값을 정했으면 그쪽이 더 구체적입니다 — 개수 되짚기에만 씁니다.
    if (shownPrice && !opt?.price) {
      const resolved = resolveUnitPrice({ ...base, price }, shownPrice, qty.found ? qty.value : 1)
      price = resolved.price
      basis = resolved.basis
    }
    /**
     * 개수 되짚기 — 수량 칸을 끝내 못 찾았을 때의 마지막 그물.
     * 쿠팡은 로켓 상품의 수량을 올리면 큰 가격을 곱해진 총액으로 바꿉니다
     * (15개 → 321,300원 = 21,420원 × 15, 26-09-06 운영자 화면). 낱개 값이
     * **확정값**일 때만 씁니다 — 옵션 묶음의 최저가로 나누면 엉뚱한 개수가 나옵니다.
     */
    const unitTrusted = Boolean(opt?.price) || (base.priceExact && basis !== 'screen')
    if (!qty.found && shownPrice && price && unitTrusted
        && shownPrice > price && shownPrice % price === 0) {
      const n = shownPrice / price
      if (n >= 2 && n <= 999) qty = { value: n, found: true, how: 'ratio' }
    }

    return {
      ok: true,
      productId: extractProductId(),
      productName,
      /**
       * 고시정보의 용량·중량은 상품명보다 정확하므로 무게 산정에 우선 사용합니다.
       * 단 상품명 뒤에 이어붙이면 용량이 두 번 파싱될 수 있어 별도 필드로 넘깁니다.
       */
      specOverride: notice?.value ?? null,
      noticeSpec: notice,
      price,
      /**
       * 화면에서 고른 개수. 견적과 견적함이 이 값을 그대로 씁니다.
       */
      quantity: qty.value,
      quantityFound: qty.found,
      /** 개수를 어떻게 알았나 — selector·labeled·number-input·near-buy·stepper·ratio·'' */
      quantityHow: qty.how ?? '',
      /** 화면의 큰 금액(낱개 값과 다를 때만) — 되짚은 개수·회원가를 화면에 설명하는 데 씁니다 */
      shownPrice: shownPrice && shownPrice !== price ? shownPrice : null,
      /** JSON-LD 가 말한 값 (화면 값과 다르면 패널이 어느 쪽을 썼는지 보여줍니다) */
      catalogPrice: base.price && base.price !== price ? base.price : null,
      /**
       * 가격을 어디서 읽었는가 — 개수 계산의 안전 판단에 씁니다.
       *
       * json-ld·meta 는 **낱개 값**이라 개수를 곱해도 안전합니다.
       * selector 는 화면의 `.total-price` 라서 수량을 올리면 **곱해진
       * 총액**이 잡힙니다. 그 값에 개수를 또 곱하면 청구액이 개수의
       * 제곱으로 부풀어 오릅니다 — 그래서 main.js 가 이 값을 보고
       * 낱개인지 확신할 수 없으면 1개로만 계산합니다.
       */
      priceBasis: basis,
      image: base.image,
      brand: base.brand,
      categoryPath: extractBreadcrumb(),
      url: canonicalUrl(),
      isRocket: Boolean(first(selectors.rocket)),
      badges: extractBadges(),
      shippingText: extractShippingText(),
      soldOut: Boolean(first(selectors.soldOut)),
      source: base.source,
    }
  }

  function extractProductId() {
    const m = location.pathname.match(/\/products\/(\d+)/)
    if (m) return m[1]
    const q = new URLSearchParams(location.search).get('itemId')
    return q ?? null
  }

  /** 추적 파라미터를 제거한 정규 URL — 제휴 링크 생성에 사용 */
  function canonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]')?.href
    const raw = canonical || location.href
    try {
      const u = new URL(raw)
      // 다른 제휴사 파라미터가 붙어 있을 수 있으므로 정리합니다.
      for (const key of [...u.searchParams.keys()]) {
        if (!['itemId', 'vendorItemId'].includes(key)) u.searchParams.delete(key)
      }
      return u.toString()
    } catch {
      return raw
    }
  }

  /**
   * 견적에 실제로 쓸 개수를 정합니다. (순수 함수 — 테스트로 지킵니다)
   *
   * 개수를 곱해도 되는지는 **가격을 어디서 읽었는지**에 달렸습니다.
   *   json-ld · meta → 낱개 값. 곱해도 안전합니다.
   *   selector      → 화면의 `.total-price` 는 수량을 올리면 이미 곱해진
   *                   총액입니다. 여기에 또 곱하면 청구액이 개수의 제곱으로
   *                   부풀어 오릅니다 (82개면 82배 과다청구).
   *
   * 확신이 없으면 1개로 계산하고, 화면이 그렇다고 말하게 합니다.
   *
   * @returns {{ quantity:number, uncertain:boolean }}
   */
  function safeQuantity(extracted) {
    const raw = Number(extracted?.quantity)
    const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
    if (page <= 1) return { quantity: 1, uncertain: false }
    // 'screen' 은 화면에 뜬 **고른 옵션의 낱개 값** 이라 곱해도 안전합니다.
    // 'selector' 만 위험합니다 — 그 값은 이미 곱해진 총액일 수 있습니다.
    const trusted = ['json-ld', 'meta', 'screen'].includes(extracted?.priceBasis)
    return trusted ? { quantity: page, uncertain: false } : { quantity: 1, uncertain: true }
  }

  /** 목록/검색 페이지의 상품 카드들 */
  function extractListItems() {
    const cards = document.querySelectorAll('li.search-product, li[class*="ProductUnit"], ul.products li')
    const items = []
    for (const card of cards) {
      const name = text(card.querySelector('.name, [class*="productName"], .descriptions .name'))
      const price = toNumber(text(card.querySelector('.price-value, [class*="priceValue"], .price strong')))
      if (!name) continue
      items.push({ el: card, productName: name, price, productId: card.getAttribute('data-product-id') ?? null })
    }
    return items
  }

  return { extractProduct, extractListItems, extractNoticeSpec, extractBadges, setSelectors, canonicalUrl, safeQuantity, readQuantity, DEFAULT_SELECTORS }
})()

globalThis.KBExtract = KBExtract
