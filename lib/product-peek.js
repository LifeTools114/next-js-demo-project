/**
 * 상품 링크 미리 읽기 — 폰 공유는 링크만 넘겨주므로, 서버가 그 상품 화면을 한 번 열어
 * 이름·가격·용량을 읽어 신청 화면에 채웁니다 (운영자 결정 26-09-06: "수량·금액 모두 자동 입력").
 *
 * ⚠️ 한계와 원칙
 *   · 쇼핑몰은 서버(데이터센터) 접속을 봇 차단으로 막는 일이 잦습니다 — 그러면 ok:false 로 돌려주고
 *     화면은 가격을 직접 적게 합니다. 실패해도 흐름은 끊기지 않습니다.
 *   · 고객이 링크를 넣은 그 순간에만, 상품 하나에 한 번만 엽니다 (6시간 캐시 + 분당 상한).
 *   · 수량은 링크에 없습니다 — 기본 1개, 고객이 바꿉니다.
 *   · 읽은 값은 화면을 채우는 데만 쓰고 저장하지 않습니다. 결과 로그는 개수·성공 여부만 남깁니다.
 */
import { parseProductUrl } from './coupang-url.js'
import { allow } from './throttle.js'

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
/** 검색용으로 HTML 을 펴기 — JSON 이스케이프(\/, \u002F)·URL 인코딩(%2F)·&amp; 를 원래 글자로 */
const unescapeHtml = (h) => String(h ?? '')
  .replace(/\\\//g, '/').replace(/\\u002F/gi, '/').replace(/&amp;/g, '&')
  .replace(/%2F/gi, '/').replace(/%3A/gi, ':').replace(/%3F/gi, '?').replace(/%3D/gi, '=').replace(/%26/gi, '&')
const TTL_MS = 6 * 60 * 60 * 1000
const cache = globalThis.__kbPeekCache ?? (globalThis.__kbPeekCache = new Map())
/** 진행 중인 요청 — 같은 상품을 3초에 7번 연 적이 있습니다 (서버 로그 26-09-07). 하나로 합칩니다 */
const inflight = globalThis.__kbPeekInflight ?? (globalThis.__kbPeekInflight = new Map())

const decode = (s) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const num = (s) => { const n = Number(String(s ?? '').replace(/[^\d]/g, '')); return Number.isFinite(n) && n > 0 ? n : null }

/** HTML 한 장에서 이름·가격·용량을 찾습니다 — 여러 모양을 순서대로 시도합니다 */
export function parseProductHtml(html) {
  const h = String(html ?? '')
  const pick = (res) => { for (const re of res) { const m = h.match(re); if (m?.[1]) return m[1] } return null }

  let name = pick([
    /<h[12][^>]*class=["'][^"']*prod-buy-header__title[^"']*["'][^>]*>([\s\S]{2,300}?)<\/h[12]>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,300})["']/i,
    /<meta[^>]+content=["']([^"']{2,300})["'][^>]+property=["']og:title["']/i,
    /"productName"\s*:\s*"([^"]{2,300})"/i,
    /"itemName"\s*:\s*"([^"]{2,300})"/i,
    /<title>([^<]{2,300})<\/title>/i,
  ])
  name = name ? decode(name.replace(/<[^>]+>/g, '')).replace(/\s*[-|:]\s*쿠팡!?\s*$/i, '').replace(/^\[쿠팡\]\s*/, '').replace(/^쿠팡!?$/, '') : ''

  const price = num(pick([
    /class=["']total-price["'][^>]*>\s*<strong[^>]*>([\d,]{3,})<\/strong>/i,
    /"salePrice"\s*:\s*"?(\d{3,})/i,
    /"finalPrice"\s*:\s*"?(\d{3,})/i,
    /"discountedPrice"\s*:\s*"?(\d{3,})/i,
    /"salesPrice"\s*:\s*"?(\d{3,})/i,
    /"sellingPrice"\s*:\s*"?(\d{3,})/i,
    /"currentPrice"\s*:\s*"?(\d{3,})/i,
    /property=["']og:price:amount["'][^>]+content=["']([\d,]{3,})["']/i,
    /class=["'][^"']*prod-price[^"']*["'][\s\S]{0,400}?<strong[^>]*>([\d,]{3,})<\/strong>/i,
    /class=["'][^"']*total-price[^"']*["'][\s\S]{0,200}?([\d,]{3,})\s*원/i,
    /class=["'][^"']*(?:prod-sale-price|sale-price|final-price)[^"']*["'][\s\S]{0,300}?([\d,]{3,})\s*원/i,
    /"(?:price|salePriceValue|discountPrice|couponPrice)"\s*:\s*"?(\d{3,})/i,
  ]))

  // 용량·중량 — 고시정보 표(용량, 중량, 내용량, 무게) 또는 본문의 「360g × 2개입」 같은 표기
  const text = decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
  const spec = text.match(/(?:내용량|용량|중량|무게|총\s*중량)\s*[:：]?\s*([\d.,]+\s?(?:kg|g|ml|mL|l|L|리터)(?:\s?[×x*]\s?\d+\s?개입?)?)/i)?.[1] ?? null

  return { productName: name.slice(0, 300), productPrice: price, spec: spec ? spec.replace(/\s+/g, ' ').slice(0, 60) : null }
}

const HEADERS = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' }
const hostOf = (u) => { try { return new URL(u).hostname } catch { return '?' } }
const PRODUCT_IN_HTML = [
  /https?:\/\/(?:www\.|m\.)?coupang\.com\/(?:vp|vm)\/products\/\d+[^"'\s<>\\]*/i,
  /https?:\/\/link\.coupang\.com\/re\/[^"'\s<>\\]*pageKey=\d+[^"'\s<>\\]*/i,
  /(?:pageKey|productId)["']?\s*[:=]\s*["']?(\d{5,20})/i,
  /(?:content|href|location(?:\.href)?)\s*=\s*["']?[^"']*?(\/(?:vp|vm)\/products\/\d+[^"'\s<>\\]*)/i,
]

/**
 * 짧은 링크(link.coupang.com/a/…)는 한 단계씩 따라갑니다 — 각 단계의 주소에서 상품 번호가 보이는 순간 멈춥니다.
 * (redirect 를 자동으로 따라가면 마지막 단계가 막혔을 때 번호조차 못 얻습니다 — 운영자 폰 시험 26-09-06)
 * 200 인데 상품 주소가 아니면(중간 안내 페이지) HTML 속의 상품 주소를 찾아 이어갑니다.
 */
async function findProductLink(url, fetchImpl, signal) {
  const hops = []
  let cur = url
  for (let i = 0; i < 6; i += 1) {
    const found = parseProductUrl(cur)
    if (found?.productId) return { link: found, hops }
    const res = await fetchImpl(cur, { headers: HEADERS, redirect: 'manual', signal })
    hops.push(`${res.status} ${hostOf(cur)}`)
    const loc = res.headers?.get?.('location')
    if (res.status >= 300 && res.status < 400 && loc) { cur = new URL(loc, cur).href; continue }
    const html = res.ok ? unescapeHtml(await res.text()) : ''
    const m = PRODUCT_IN_HTML.map((re) => html.match(re)).find(Boolean)
    if (!m) return { link: null, hops, fingerprint: fingerprintOf(html) }
    const hitUrl = m[1] ?? m[0]
    cur = /^\d{5,20}$/.test(hitUrl) ? `https://www.coupang.com/vp/products/${hitUrl}` : new URL(hitUrl, 'https://www.coupang.com').href
  }
  return { link: null, hops }
}

/** 못 읽은 페이지의 지문 — 길이·제목·표식만 (내용은 남기지 않음) */
function fingerprintOf(html) {
  const h = String(html ?? '')
  const title = decode(h.match(/<title>([^<]{0,80})/i)?.[1] ?? '').slice(0, 60)
  const marks = ['akamai', 'captcha', 'challenge', 'Access Denied', 'products/', 'pageKey', 'salePrice', 'total-price', 'og:title', 'intent://', 'browser_fallback_url']
    .filter((k) => h.includes(k))
  return `len=${h.length} title="${title}" marks=[${marks.join(',')}]`
}

/** 상품 화면 열기 — PC 주소가 막히거나 못 읽으면 모바일 주소로 한 번 더 */
async function readProduct(link, fetchImpl, signal) {
  const q = new URLSearchParams()
  if (link.itemId) q.set('itemId', link.itemId)
  if (link.vendorItemId) q.set('vendorItemId', link.vendorItemId)
  const qs = q.toString() ? `?${q}` : ''
  // PC 화면은 PC 브라우저로 열어야 제목·가격이 HTML 에 들어 있습니다 (폰 브라우저인 척하면
  // 쿠팡이 내용이 비어 있는 모바일 화면으로 보냅니다 — 서버 로그 26-09-07 'unreadable')
  const candidates = [
    [`https://www.coupang.com/vp/products/${link.productId}${qs}`, { ...HEADERS, 'User-Agent': UA_PC }],
    [`https://m.coupang.com/vm/products/${link.productId}${qs}`, HEADERS],
  ]
  let last = { status: 0, parsed: { productName: '', productPrice: null, spec: null }, html: '', host: '', fingerprint: '' }
  for (const [url, headers] of candidates) {
    const res = await fetchImpl(url, { headers, redirect: 'follow', signal })
    const html = res.ok ? await res.text() : ''
    const parsed = res.ok ? parseProductHtml(html) : last.parsed
    last = { status: res.status, parsed, html, host: hostOf(res.url || url), fingerprint: fingerprintOf(html) }
    if (res.ok && parsed.productPrice) break
  }
  return last
}

/**
 * @returns {{ok:true, productId, url, productName, productPrice, spec} | {ok:false, reason, url?}}
 */
export async function peekProduct(input, { fetchImpl = globalThis.fetch, timeoutMs = 9000, log = console } = {}) {
  const first = parseProductUrl(input)
  if (!first) return { ok: false, reason: 'not-a-product-link' }

  const cacheKey = first.productId ? `${first.productId}:${first.itemId ?? ''}:${first.vendorItemId ?? ''}` : `u:${first.url}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  if (inflight.has(cacheKey)) return inflight.get(cacheKey)
  // 서버 전체 상한 — 상품 하나에 한 번이지만, 몰려도 분당 30번을 넘기지 않습니다
  if (!allow('peek', 'global', { limit: 30, windowMs: 60_000 })) return { ok: false, reason: 'busy', url: first.url }

  const job = peekOnce(first, cacheKey, { fetchImpl, timeoutMs, log })
  inflight.set(cacheKey, job)
  try { return await job } finally { inflight.delete(cacheKey) }
}

async function peekOnce(first, cacheKey, { fetchImpl, timeoutMs, log }) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const { link, hops, fingerprint: shortFp } = await findProductLink(first.url, fetchImpl, ctrl.signal)
    const trail = hops.length ? ` hops=[${hops.join(' → ')}]` : ''
    if (!link?.productId) {
      const value = { ok: false, reason: 'unresolved', url: first.url }
      log?.info?.(`[peek] short-link ok=false reason=unresolved${trail} ${shortFp ?? ''}`.trim())
      cache.set(cacheKey, { at: Date.now(), value })
      return value
    }
    const { status, parsed, html, host, fingerprint } = await readProduct(link, fetchImpl, ctrl.signal)
    const okStatus = status >= 200 && status < 300
    const blocked = !okStatus || (/access denied|captcha|잠시 후 다시|자동입력 방지/i.test(html.slice(0, 4000)) && !parsed.productPrice)
    const value = blocked || (!parsed.productName && !parsed.productPrice)
      ? { ok: false, reason: okStatus ? 'unreadable' : `http-${status}`, url: link.url, productId: link.productId }
      : { ok: true, productId: link.productId, url: link.url, ...parsed }
    // 로그에는 상품 번호·성공 여부·경로만 — 개인정보도, 페이지 내용도 남기지 않습니다
    log?.info?.(`[peek] ${link.productId} status=${status} via=${host} ok=${value.ok}${value.ok ? '' : ` reason=${value.reason} ${fingerprint}`}${trail}`)
    cache.set(cacheKey, { at: Date.now(), value })
    if (cache.size > 2000) cache.clear()
    return value
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : 'fetch-failed'
    log?.info?.(`[peek] ${first.productId ?? 'short-link'} error=${reason} ${err?.message ?? ''}`.trim())
    return { ok: false, reason, url: first.url }
  } finally {
    clearTimeout(timer)
  }
}

export const _resetPeekCache = () => cache.clear()
