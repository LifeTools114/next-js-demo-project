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
        const price = toNumber(offers?.price ?? offers?.lowPrice)
        if (!c.name) continue

        return {
          productName: String(c.name).trim(),
          price,
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
      price: toNumber(text(first(selectors.price))),
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
    if (!el) return { value: 1, found: false }
    const raw = el.value ?? el.getAttribute('value') ?? ''
    const n = Number.parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(n) || n < 1) return { value: 1, found: false }
    // 화면 값이 터무니없으면(오타·자동입력) 믿지 않습니다.
    if (n > 999) return { value: 1, found: false }
    return { value: n, found: true }
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
    const qty = readQuantity()

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
      /**
       * 가격을 어디서 읽었는가 — 개수 계산의 안전 판단에 씁니다.
       *
       * json-ld·meta 는 **낱개 값**이라 개수를 곱해도 안전합니다.
       * selector 는 화면의 `.total-price` 라서 수량을 올리면 **곱해진
       * 총액**이 잡힙니다. 그 값에 개수를 또 곱하면 청구액이 개수의
       * 제곱으로 부풀어 오릅니다 — 그래서 main.js 가 이 값을 보고
       * 낱개인지 확신할 수 없으면 1개로만 계산합니다.
       */
      priceBasis: base.source,
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
    const trusted = extracted?.priceBasis === 'json-ld' || extracted?.priceBasis === 'meta'
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
