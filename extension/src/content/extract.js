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
    breadcrumb: ['#breadcrumb', '.breadcrumb', 'ul.breadcrumb'],
    /** 고시정보 표 — 내용물의 용량 또는 중량이 여기 있습니다 */
    noticeTable: ['.prod-description table', '.product-details table', 'table.prod-delivery-return-policy-table'],
    rocket: ['.badge.rocket', '[class*="rocket"] img', '.prod-shipping-fee-message'],
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
  function extractProduct() {
    const base = fromJsonLd() ?? fromMeta() ?? fromSelectors()

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

    return {
      ok: true,
      productId: extractProductId(),
      productName: base.productName,
      /**
       * 고시정보의 용량·중량은 상품명보다 정확하므로 무게 산정에 우선 사용합니다.
       * 단 상품명 뒤에 이어붙이면 용량이 두 번 파싱될 수 있어 별도 필드로 넘깁니다.
       */
      specOverride: notice?.value ?? null,
      noticeSpec: notice,
      price: base.price,
      image: base.image,
      brand: base.brand,
      categoryPath: extractBreadcrumb(),
      url: canonicalUrl(),
      isRocket: Boolean(first(selectors.rocket)),
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

  return { extractProduct, extractListItems, extractNoticeSpec, setSelectors, canonicalUrl, DEFAULT_SELECTORS }
})()

globalThis.KBExtract = KBExtract
