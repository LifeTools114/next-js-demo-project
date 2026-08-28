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

async function addToCart(item) {
  const { cart = [] } = await storage.get('cart')
  const idx = cart.findIndex((i) => i.productId === item.productId && i.track === item.track)
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
 * 제휴 링크로 이동합니다. 반드시 사용자 클릭에서만 호출되어야 합니다.
 * 구매대행 트랙은 본인 구매라 제휴가 적용되지 않으므로 원본 URL 로 엽니다.
 */
async function openAffiliate({ url, track }) {
  if (track !== 'forwarding') {
    await chrome.tabs.create({ url })
    return { ok: true, affiliate: false, reason: '구매대행은 제휴 대상이 아닙니다.' }
  }
  try {
    const res = await fetch(`${await backendUrl()}/api/affiliate/deeplink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], track }),
    })
    const data = await res.json()
    const link = data?.links?.[0]?.shortenUrl || data?.links?.[0]?.landingUrl
    await chrome.tabs.create({ url: link || url })
    return { ok: true, affiliate: Boolean(link) }
  } catch {
    // 제휴 링크 생성이 실패해도 사용자는 상품을 볼 수 있어야 합니다.
    await chrome.tabs.create({ url })
    return { ok: true, affiliate: false }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = async () => {
    switch (msg?.type) {
      case 'getConfig':
        return getConfig()
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
      case 'openAffiliate':
        return openAffiliate(msg.payload ?? {})
      default:
        return { ok: false, error: `알 수 없는 메시지: ${msg?.type}` }
    }
  }
  run().then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }))
  return true // 비동기 응답
})
