/**
 * 백그라운드 서비스 워커 (MV3)
 *
 * 역할
 *   - 백엔드에서 정책 설정(요율·세율·셀렉터)을 받아 캐시
 *   - 견적함(장바구니) 보관
 *   - 제휴 딥링크 생성 요청 중계 (사용자 클릭 시에만)
 *
 * ⚠️ MV3 는 원격 코드 실행을 금지합니다.
 *    백엔드에서 받는 것은 "설정 데이터"이며, 코드는 확장에 번들되어 있습니다.
 */

const CONFIG_TTL_MS = 6 * 60 * 60 * 1000 // 6시간
const DEFAULT_BACKEND = 'http://localhost:3000'

const storage = {
  get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (obj) => new Promise((r) => chrome.storage.local.set(obj, r)),
}

// 확장을 새로고침(🔄)·업데이트하면 설정 캐시(6시간)를 비웁니다 —
// 서버에서 바꾼 정책(요율·최소주문 등)이 기다림 없이 바로 반영되도록.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ configAt: 0 })
})

async function backendUrl() {
  const { backend } = await storage.get('backend')
  return (backend || DEFAULT_BACKEND).replace(/\/$/, '')
}

/**
 * 정책 설정을 가져옵니다.
 * 백엔드가 죽어도 확장은 계속 동작해야 하므로,
 * 캐시 → 만료된 캐시 → 번들 기본값 순으로 폴백합니다.
 */
async function getConfig() {
  const cached = await storage.get(['config', 'configAt'])
  const fresh = cached.configAt && Date.now() - cached.configAt < CONFIG_TTL_MS
  if (fresh && cached.config) return { ok: true, config: cached.config, fromCache: true }

  try {
    const res = await fetch(`${await backendUrl()}/api/extension/config`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const config = await res.json()
    await storage.set({ config, configAt: Date.now() })
    return { ok: true, config, fromCache: false }
  } catch (error) {
    // 백엔드 없이도 동작합니다 — 번들된 기본 정책을 씁니다.
    if (cached.config) return { ok: true, config: cached.config, fromCache: true, stale: true }
    return { ok: true, config: null, offline: true, error: error.message }
  }
}

/**
 * 자가진단 보고 — 쿠팡 화면이 바뀌어 문구를 못 찾을 때 콘텐츠 스크립트가 부릅니다.
 *
 * 고객을 방해하지 않는 것이 최우선이라 실패는 전부 조용히 무시합니다.
 * 개인정보는 애초에 담기지 않지만(문구 개수·경로뿐), 여기서 한 번 더
 * 크기를 자르고 화이트리스트 필드만 보냅니다.
 */
async function reportHealth(payload) {
  const clean = {
    kind: String(payload?.kind ?? '').slice(0, 24),
    missing: (payload?.missing ?? []).slice(0, 8).map((x) => String(x).slice(0, 24)),
    found: Object.fromEntries(
      Object.entries(payload?.found ?? {}).slice(0, 8).map(([k, v]) => [String(k).slice(0, 24), Number(v) || 0]),
    ),
    host: String(payload?.host ?? '').slice(0, 40),
    path: String(payload?.path ?? '').slice(0, 80),
    ext: String(payload?.ext ?? '').slice(0, 16),
    pat: Number(payload?.pat) || 0,
    patSource: payload?.patSource === 'server' ? 'server' : 'bundled',
    stage: String(payload?.stage ?? '').slice(0, 24),
    rejected: (payload?.rejected ?? []).slice(0, 8).map((x) => String(x).slice(0, 40)),
  }
  try {
    await fetch(`${await backendUrl()}/api/extension/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    })
    return { ok: true }
  } catch {
    return { ok: false } // 보고 실패는 고객 흐름과 무관합니다
  }
}

async function addToCart(item) {
  const { cart = [] } = await storage.get('cart')
  // 같은 상품이라도 옵션(상품명에 반영)이 다르면 다른 줄로 담습니다 —
  // 옵션별 가격이 다른데 합치면 먼저 담은 옵션의 가격으로 뭉개집니다.
  const idx = cart.findIndex(
    (i) => i.productId === item.productId && i.track === item.track && i.productName === item.productName,
  )
  if (idx >= 0) cart[idx].quantity += item.quantity ?? 1
  else cart.push({ ...item, addedAt: Date.now() })
  await storage.set({ cart })
  await updateBadge(cart)
  return { ok: true, count: cart.reduce((s, i) => s + i.quantity, 0) }
}

async function updateBadge(cart) {
  const n = cart.reduce((s, i) => s + (i.quantity ?? 1), 0)
  try {
    await chrome.action.setBadgeText({ text: n > 0 ? String(Math.min(n, 99)) : '' })
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4a76' })
  } catch {
    /* 배지는 부가 기능이므로 실패해도 무시 */
  }
}

/**
 * ─────────────── 운영자 모드 ───────────────
 * 토큰은 백그라운드(storage)만 갖고, 콘텐츠 스크립트에는 절대 주지 않습니다.
 * 페이지 세계와 격리돼 있긴 하지만, 원칙적으로 페이지에 가까운 곳에
 * 자격증명을 두지 않습니다. 요청은 전부 여기서 대신 보냅니다.
 */

/** 콘텐츠 스크립트가 넘긴 상품 목록 정리 — 형태만 믿고 값은 좁혀 받습니다 */
function sanitizeItems(items) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 20).map((i, idx) => ({
    productId: String(i?.productId ?? `inline-${idx}`).slice(0, 64),
    productName: String(i?.productName ?? '').slice(0, 160),
    quantity: Math.max(1, Math.min(Number(i?.quantity) || 1, 99)),
    productPrice: Math.max(0, Math.min(Number(i?.productPrice) || 0, 100_000_000)),
    // 국내 배송비·무료 조건·판매자 — 버리면 신청서 금액이 패널보다 배송비만큼 싸집니다.
    domesticShipKrw: Math.max(0, Math.min(Number(i?.domesticShipKrw) || 0, 50_000)),
    freeShipOverKrw: Math.max(0, Math.min(Number(i?.freeShipOverKrw) || 0, 10_000_000)),
    seller: String(i?.seller ?? '').slice(0, 80),
    track: i?.track === 'agent' ? 'agent' : 'forwarding',
  })).filter((i) => i.productName)
}

/**
 * 결제 흐름의 상품 출처 — 최근 2시간 내 결제창 드래프트가 있으면 그것,
 * 없으면 견적함. "결제창의 사실"이 "담아둔 계획"보다 우선입니다.
 */
async function checkoutSource() {
  const { checkoutDraft = [], checkoutDraftAt = 0, cart = [] } = await storage.get([
    'checkoutDraft', 'checkoutDraftAt', 'cart',
  ])
  const fresh = Date.now() - checkoutDraftAt < 2 * 60 * 60 * 1000
  return fresh && checkoutDraft.length > 0 ? checkoutDraft : cart
}

/** 운영자 API 로 열어줄 경로 접두사 — 그 외는 거부합니다 */
const ADMIN_PATHS = ['/api/orders', '/api/admin/']

async function adminFetch({ path, method = 'GET', body }) {
  const { adminToken } = await storage.get('adminToken')
  if (!adminToken) return { ok: false, error: '운영자 토큰이 설정되지 않았습니다.' }
  if (!ADMIN_PATHS.some((p) => String(path ?? '').startsWith(p))) {
    return { ok: false, error: `허용되지 않은 경로입니다: ${path}` }
  }
  try {
    const res = await fetch(`${await backendUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
        'X-Admin-User': 'extension',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

/**
 * 발주 작업 힌트 — 매입 대기·진행 중인 구매대행 주문의 상품 목록.
 * 운영자가 쿠팡 상품 페이지를 열면 "이 상품 N개 담으세요"를 띄우는 데 씁니다.
 */
let hintsCache = { at: 0, hints: null }
async function operatorHints() {
  const { adminToken } = await storage.get('adminToken')
  if (!adminToken) return { ok: true, hints: null }
  if (Date.now() - hintsCache.at < 60_000) return { ok: true, hints: hintsCache.hints }
  const res = await adminFetch({ path: '/api/orders' })
  if (!res.ok || !Array.isArray(res.data?.orders)) return { ok: true, hints: hintsCache.hints }
  const hints = {}
  for (const o of res.data.orders) {
    if (o.track !== 'agent' || !['PAID', 'PURCHASING'].includes(o.state)) continue
    for (const item of o.items ?? []) {
      if (!item.productId) continue
      // unitPriceKrw = 고객이 화면에서 본 가격 — 발주 시 이 가격(이하)인지 대조합니다.
      hints[item.productId] = {
        orderNo: o.orderNo,
        quantity: item.quantity,
        state: o.state,
        unitPriceKrw: Number(item.productPrice) || 0,
      }
    }
  }
  hintsCache = { at: Date.now(), hints }
  return { ok: true, hints }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = async () => {
    switch (msg?.type) {
      case 'getConfig':
        return getConfig()
      case 'reportHealth':
        return reportHealth(msg.payload ?? {})
      case 'addToCart':
        return addToCart(msg.payload)
      case 'getCart': {
        const { cart = [] } = await storage.get('cart')
        return { ok: true, cart }
      }
      case 'setCart':
        await storage.set({ cart: msg.payload ?? [] })
        await updateBadge(msg.payload ?? [])
        return { ok: true }
      case 'setPreference': {
        const { config } = await storage.get('config')
        const next = { ...(config ?? {}), preferences: { ...(config?.preferences ?? {}), ...msg.payload } }
        await storage.set({ config: next })
        return { ok: true }
      }
      case 'setAdminToken': {
        const token = String(msg.payload?.token ?? '').trim()
        await storage.set({ adminToken: token })
        hintsCache = { at: 0, hints: null }
        return { ok: true, hasToken: Boolean(token) }
      }
      case 'getAdminState': {
        const { adminToken } = await storage.get('adminToken')
        return { ok: true, hasToken: Boolean(adminToken) }
      }
      case 'adminFetch':
        return adminFetch(msg.payload ?? {})
      case 'operatorHints':
        return operatorHints()
      case 'captureCoupangOrder':
        return adminFetch({ path: '/api/admin/coupang-capture', method: 'POST', body: msg.payload ?? {} })
      case 'setCheckoutDraft': {
        // 결제창에서 읽은 "지금 결제 중인 상품" — 견적함과 분리 보관합니다.
        // 견적함은 고객이 직접 담은 계획이고, 드래프트는 이 결제의 사실입니다.
        await storage.set({ checkoutDraft: msg.payload?.items ?? [], checkoutDraftAt: Date.now() })
        return { ok: true }
      }
      case 'openCheckout': {
        // 쿠팡 결제 → 배송비 결제로 잇는 다리.
        // 호출자가 지금 화면에서 읽은 items 를 주면 그것이 최우선 진실이고,
        // 없으면 결제창 드래프트 → 견적함 순서로 폴백합니다.
        // track: 'agent' 면 한국 결제수단이 없는 고객의 구매대행 요청.
        const inline = sanitizeItems(msg.payload?.items)
        const src = inline.length > 0 ? inline : await checkoutSource()
        const asAgent = msg.payload?.track === 'agent'
        const items = asAgent
          ? src.map((i) => ({ ...i, track: 'agent' }))
          : src.filter((i) => i.track !== 'agent')
        if (items.length === 0) {
          return { ok: false, error: '결제하신 상품을 읽지 못했습니다. 쿠팡 상품 화면에서 [담아두기]로 담은 뒤 다시 눌러 주세요.' }
        }
        const { config } = await storage.get('config')
        const zone = config?.preferences?.zone ?? 'hanoi'
        const payload = encodeURIComponent(JSON.stringify({ items, zone }))
        const no = String(msg.payload?.coupangOrderNo ?? '').replace(/\D/g, '').slice(0, 40)
        const base = await backendUrl()
        /**
         * 서버가 살아 있는지 먼저 확인합니다.
         * 패널은 캐시된 설정으로 멀쩡히 떠 있어도, 서버가 꺼져 있으면 여기서
         * 연 탭은 크롬의 "사이트에 연결할 수 없음" 이 됩니다 — 고객에게는
         * 그냥 "에러 페이지" 입니다 (26-09-04). 빈 탭을 열지 말고 이유를 돌려줍니다.
         */
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4000)
          const ping = await fetch(`${base}/api/extension/config`, { cache: 'no-store', signal: ctrl.signal })
          clearTimeout(timer)
          if (!ping.ok) throw new Error(`HTTP ${ping.status}`)
        } catch {
          // 고객 브라우저(운영자 토큰 없음)에는 쉬운 말만 — 서버 주소·명령어는
          // 고객이 할 수 있는 일이 아니라서 오히려 겁만 줍니다. 운영자 브라우저에는
          // 고칠 방법을 그대로 알려줍니다.
          const { adminToken } = await storage.get('adminToken')
          return {
            ok: false,
            error: adminToken
              ? `서버(${base})에 연결되지 않습니다. 사장님 컴퓨터에서 start-server 를 실행한 뒤 다시 눌러주세요.`
              : '지금은 연결이 안 됩니다. 잠시 후 다시 눌러 주세요. 계속 안 되면 저희에게 알려 주세요.',
          }
        }
        const url = `${base}/checkout?cart=${payload}${!asAgent && no ? `&coupang=${no}` : ''}`
        await chrome.tabs.create({ url })
        // 신청서로 넘어간 드래프트는 소진 — 다음 결제에 재사용되지 않게.
        await storage.set({ checkoutDraft: [] })
        // url 반환 — 완료 화면의 [신청서 다시 열기]가 같은 신청서를 재사용합니다.
        return { ok: true, url }
      }
      case 'quoteCart': {
        // 금액 미리보기 — 호출자가 준 items(지금 화면) 우선, 서버 견적으로 일치 보장.
        const inline = sanitizeItems(msg.payload?.items)
        const src = inline.length > 0 ? inline : await checkoutSource()
        if (src.length === 0) return { ok: false, error: 'empty' }
        const track = msg.payload?.track === 'agent' ? 'agent' : 'forwarding'
        const { config } = await storage.get('config')
        const zone = config?.preferences?.zone ?? 'hanoi'
        try {
          const res = await fetch(`${await backendUrl()}/api/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: src.map((i) => ({ ...i, track })), zone, track }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) return { ok: false, error: data?.error ?? `HTTP ${res.status}` }
          // 총액만이 아니라 근거(무게·내역)까지 — 카드가 "왜 이 금액인지" 보여줍니다.
          const q = data?.quote
          return {
            ok: true,
            total: q?.total,
            totalVnd: q?.totalVnd,
            chargeableG: q?.weight?.chargeableG,
            billableKg: q?.shipping?.billableKg,
            // key 는 화면의 비용 안내(ⓘ) 매칭에 씁니다 (예: surcharge-device)
            breakdown: (q?.breakdown ?? []).slice(0, 10).map((l) => ({ key: l?.key, label: l?.label, krw: l?.krw })),
            agentLimit: q?.agentLimit ?? null,
          }
        } catch (error) {
          return { ok: false, error: error.message }
        }
      }
      /**
       * 우리 사이트 주소를 알려줍니다 — 패널이 "폰에서 이 주소로" 안내에 씁니다.
       * 주소는 chrome.storage 의 backend 값(운영자가 바꿀 수 있음)에서 옵니다.
       */
      case 'getSite':
        return { ok: true, url: await backendUrl() }

      /** 우리 사이트를 새 탭으로 엽니다 (바로가기 만들기 안내용) */
      case 'openSite': {
        const base = await backendUrl()
        const path = typeof msg.payload?.path === 'string' ? msg.payload.path : '/'
        // 경로만 받습니다 — 임의의 외부 주소를 열지 않도록.
        await chrome.tabs.create({ url: base + (path.startsWith('/') ? path : `/${path}`) })
        return { ok: true }
      }

      case 'openTabs': {
        const urls = (msg.payload?.urls ?? []).slice(0, 20)
        for (const url of urls) {
          if (/^https:\/\/(www|m)\.coupang\.com\//.test(url)) await chrome.tabs.create({ url, active: false })
        }
        return { ok: true, opened: urls.length }
      }
      default:
        return { ok: false, error: `알 수 없는 메시지: ${msg?.type}` }
    }
  }
  run().then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }))
  return true // 비동기 응답
})
