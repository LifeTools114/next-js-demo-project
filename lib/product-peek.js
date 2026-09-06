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
const TTL_MS = 6 * 60 * 60 * 1000
const cache = globalThis.__kbPeekCache ?? (globalThis.__kbPeekCache = new Map())

const decode = (s) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const num = (s) => { const n = Number(String(s ?? '').replace(/[^\d]/g, '')); return Number.isFinite(n) && n > 0 ? n : null }

/** HTML 한 장에서 이름·가격·용량을 찾습니다 — 여러 모양을 순서대로 시도합니다 */
export function parseProductHtml(html) {
  const h = String(html ?? '')
  const pick = (res) => { for (const re of res) { const m = h.match(re); if (m?.[1]) return m[1] } return null }

  let name = pick([
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,300})["']/i,
    /<meta[^>]+content=["']([^"']{2,300})["'][^>]+property=["']og:title["']/i,
    /<h[12][^>]*class=["'][^"']*prod-buy-header__title[^"']*["'][^>]*>([\s\S]{2,300}?)<\/h[12]>/i,
    /<title>([^<]{2,300})<\/title>/i,
  ])
  name = name ? decode(name.replace(/<[^>]+>/g, '')).replace(/\s*[-|]\s*쿠팡!?\s*$/i, '').replace(/^\[쿠팡\]\s*/, '') : ''

  const price = num(pick([
    /class=["']total-price["'][^>]*>\s*<strong[^>]*>([\d,]{3,})<\/strong>/i,
    /"salePrice"\s*:\s*"?(\d{3,})/i,
    /"finalPrice"\s*:\s*"?(\d{3,})/i,
    /"discountedPrice"\s*:\s*"?(\d{3,})/i,
    /property=["']og:price:amount["'][^>]+content=["']([\d,]{3,})["']/i,
    /class=["'][^"']*prod-price[^"']*["'][\s\S]{0,400}?<strong[^>]*>([\d,]{3,})<\/strong>/i,
    /class=["'][^"']*total-price[^"']*["'][\s\S]{0,200}?([\d,]{3,})\s*원/i,
  ]))

  // 용량·중량 — 고시정보 표(용량, 중량, 내용량, 무게) 또는 본문의 「360g × 2개입」 같은 표기
  const text = decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
  const spec = text.match(/(?:내용량|용량|중량|무게|총\s*중량)\s*[:：]?\s*([\d.,]+\s?(?:kg|g|ml|mL|l|L|리터)(?:\s?[×x*]\s?\d+\s?개입?)?)/i)?.[1] ?? null

  return { productName: name.slice(0, 300), productPrice: price, spec: spec ? spec.replace(/\s+/g, ' ').slice(0, 60) : null }
}

/** 짧은 링크(link.coupang.com/a/…)를 따라가 실제 상품 주소를 찾습니다 (최대 3번) */
async function resolveShortLink(url, fetchImpl, signal) {
  let cur = url
  for (let i = 0; i < 3; i += 1) {
    const res = await fetchImpl(cur, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html' }, signal })
    const loc = res.headers?.get?.('location')
    if (!loc) return cur
    cur = new URL(loc, cur).href
    if (parseProductUrl(cur)?.productId) return cur
  }
  return cur
}

/**
 * @returns {{ok:true, productId, url, productName, productPrice, spec} | {ok:false, reason, url?}}
 */
export async function peekProduct(input, { fetchImpl = globalThis.fetch, timeoutMs = 7000, log = console } = {}) {
  let link = parseProductUrl(input)
  if (!link) return { ok: false, reason: 'not-a-product-link' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    if (!link.productId) {
      const resolved = await resolveShortLink(link.url, fetchImpl, ctrl.signal)
      link = parseProductUrl(resolved) ?? link
      if (!link.productId) return { ok: false, reason: 'unresolved', url: link.url }
    }
    const key = `${link.productId}:${link.itemId ?? ''}:${link.vendorItemId ?? ''}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value
    // 서버 전체 상한 — 상품 하나에 한 번이지만, 몰려도 분당 30번을 넘기지 않습니다
    if (!allow('peek', 'global', { limit: 30, windowMs: 60_000 })) return { ok: false, reason: 'busy', url: link.url }

    const res = await fetchImpl(link.url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      redirect: 'follow', signal: ctrl.signal,
    })
    const html = res.ok ? await res.text() : ''
    const parsed = res.ok ? parseProductHtml(html) : { productName: '', productPrice: null, spec: null }
    const blocked = !res.ok || /access denied|bot|captcha|잠시 후 다시|자동입력 방지/i.test(html.slice(0, 4000)) && !parsed.productPrice
    const value = blocked || (!parsed.productName && !parsed.productPrice)
      ? { ok: false, reason: res.ok ? 'unreadable' : `http-${res.status}`, url: link.url, productId: link.productId }
      : { ok: true, productId: link.productId, url: link.url, ...parsed }
    // 로그에는 상품 번호·성공 여부만 — 개인정보도, 페이지 내용도 남기지 않습니다
    log?.info?.(`[peek] ${link.productId} status=${res.status} ok=${value.ok}${value.ok ? '' : ` reason=${value.reason}`}`)
    cache.set(key, { at: Date.now(), value })
    if (cache.size > 2000) cache.clear()
    return value
  } catch (err) {
    log?.info?.(`[peek] ${link.productId ?? '?'} error=${err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'fetch')}`)
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'fetch-failed', url: link.url }
  } finally {
    clearTimeout(timer)
  }
}

export const _resetPeekCache = () => cache.clear()
