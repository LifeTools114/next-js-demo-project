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

/**
 * 한 번에 열기 — redirect 를 따라간 뒤의 최종 주소(res.url)로 상품 번호를 확정합니다.
 * 짧은 링크(link.coupang.com/a/…)가 HTML 중간 페이지로 멈추면, 그 HTML 속의 /vp/products/번호 를 찾아
 * 한 번 더 엽니다. (PC 에서 카카오로 받은 짧은 링크가 안 읽히던 문제 — 운영자 26-09-06)
 */
async function openProduct(url, fetchImpl, signal) {
  const headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' }
  let res = await fetchImpl(url, { headers, redirect: 'follow', signal })
  let html = res.ok ? await res.text() : ''
  let link = parseProductUrl(res.url || url) ?? parseProductUrl(url)
  if (!link?.productId) {
    // 중간 페이지(메타 리프레시·스크립트 이동) 속의 상품 주소
    const m = html.match(/https?:\/\/(?:www\.|m\.)?coupang\.com\/(?:vp|vm)\/products\/\d+[^"'\s<>\\]*/i)
      ?? html.match(/(?:content|href|location(?:\.href)?)\s*=\s*["']?[^"']*?(\/(?:vp|vm)\/products\/\d+[^"'\s<>\\]*)/i)
    const next = m ? new URL(m[0].startsWith('http') ? m[0] : (m[1] ?? m[0]), 'https://www.coupang.com').href : null
    const found = next ? parseProductUrl(next) : null
    if (found?.productId) {
      link = found
      res = await fetchImpl(found.url, { headers, redirect: 'follow', signal })
      html = res.ok ? await res.text() : ''
    }
  }
  return { res, html, link }
}

/**
 * @returns {{ok:true, productId, url, productName, productPrice, spec} | {ok:false, reason, url?}}
 */
export async function peekProduct(input, { fetchImpl = globalThis.fetch, timeoutMs = 8000, log = console } = {}) {
  const first = parseProductUrl(input)
  if (!first) return { ok: false, reason: 'not-a-product-link' }

  const cacheKey = first.productId ? `${first.productId}:${first.itemId ?? ''}:${first.vendorItemId ?? ''}` : `u:${first.url}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  // 서버 전체 상한 — 상품 하나에 한 번이지만, 몰려도 분당 30번을 넘기지 않습니다
  if (!allow('peek', 'global', { limit: 30, windowMs: 60_000 })) return { ok: false, reason: 'busy', url: first.url }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const { res, html, link } = await openProduct(first.url, fetchImpl, ctrl.signal)
    const productId = link?.productId ?? null
    const url = link?.url ?? first.url
    const parsed = res.ok ? parseProductHtml(html) : { productName: '', productPrice: null, spec: null }
    const blocked = !res.ok || (/access denied|captcha|잠시 후 다시|자동입력 방지/i.test(html.slice(0, 4000)) && !parsed.productPrice)
    const value = !productId
      ? { ok: false, reason: 'unresolved', url }
      : blocked || (!parsed.productName && !parsed.productPrice)
        ? { ok: false, reason: res.ok ? 'unreadable' : `http-${res.status}`, url, productId }
        : { ok: true, productId, url, ...parsed }
    // 로그에는 상품 번호·성공 여부만 — 개인정보도, 페이지 내용도 남기지 않습니다
    log?.info?.(`[peek] ${productId ?? 'short-link'} status=${res.status} ok=${value.ok}${value.ok ? '' : ` reason=${value.reason}`}`)
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
