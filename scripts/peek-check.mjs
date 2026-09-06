#!/usr/bin/env node
/**
 * 링크 미리 읽기 점검 — 서버에서 실제 쇼핑몰에 접속해 결과를 표로 보여줍니다.
 *
 *   node scripts/peek-check.mjs "링크1" "링크2" ...
 *
 * 링크마다: ① 실제 서비스 경로(peekProduct) 결과  ② 주소·브라우저 종류를 바꾼 변형 4가지의
 * 상태·크기·제목·표식. 못 읽은 HTML 은 /tmp/peek-debug/ 에 저장합니다 (개발자 확인용, 서버 밖으로 안 나감).
 * 출력에는 상품 정보(이름·가격) 외 개인정보가 없습니다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { peekProduct, parseProductHtml, _resetPeekCache } from '../lib/product-peek.js'
import { parseProductUrl } from '../lib/coupang-url.js'

const links = process.argv.slice(2).filter(Boolean)
if (links.length === 0) { console.log('사용법: node scripts/peek-check.mjs "링크1" "링크2" ...'); process.exit(1) }

const UA_M = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const OUT = '/tmp/peek-debug'
mkdirSync(OUT, { recursive: true })
const marks = (h) => ['products/', 'pageKey', 'salePrice', 'total-price', 'og:title', 'prod-buy-header__title', 'akamai', 'captcha', 'Access Denied', 'intent://', 'browser_fallback_url', '__NEXT_DATA__', 'window.__PRELOADED']
  .filter((k) => h.includes(k)).join(',')
const title = (h) => (h.match(/<title>([^<]{0,80})/i)?.[1] ?? '').trim()
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function probe(label, url, ua, redirect = 'follow') {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' }, redirect, signal: ctrl.signal })
    const html = await res.text()
    const p = parseProductHtml(html)
    const file = `${OUT}/${label.replace(/[^a-z0-9-]/gi, '_')}.html`
    writeFileSync(file, html)
    console.log(`  ${label.padEnd(14)} ${res.status} ${String(html.length).padStart(7)}B  final=${(res.url || url).slice(0, 70)}`)
    console.log(`  ${''.padEnd(14)} title="${title(html).slice(0, 50)}"  name=${p.productName ? `"${p.productName.slice(0, 40)}"` : '-'}  price=${p.productPrice ?? '-'}  spec=${p.spec ?? '-'}`)
    console.log(`  ${''.padEnd(14)} marks=[${marks(html)}]  location=${res.headers.get('location') ?? '-'}`)
    console.log(`  ${''.padEnd(14)} text: ${text(html).slice(0, 160)}`)
    return { status: res.status, html, parsed: p }
  } catch (e) {
    console.log(`  ${label.padEnd(14)} 오류 ${e.name === 'AbortError' ? 'timeout' : e.message}`)
    return null
  } finally { clearTimeout(t) }
}

let n = 0
for (const link of links) {
  n += 1
  console.log(`\n━━━ [${n}] ${link.slice(0, 90)}`)
  _resetPeekCache()
  const lines = []
  const r = await peekProduct(link, { log: { info: (m) => lines.push(m) } })
  console.log(`  서비스 결과: ${r.ok ? `✓ ${r.productName?.slice(0, 40)} · ${r.productPrice}원 · ${r.spec ?? '용량 없음'}` : `✗ ${r.reason}`}`)
  for (const l of lines) console.log(`  ${l}`)
  const parsed = parseProductUrl(link)
  if (!parsed?.productId) await probe(`${n}-short-raw`, parsed?.url ?? link, UA_M, 'manual')
  const id = r.productId ?? parsed?.productId
  if (id) {
    const q = parsed?.itemId ? `?itemId=${parsed.itemId}${parsed.vendorItemId ? `&vendorItemId=${parsed.vendorItemId}` : ''}` : ''
    await probe(`${n}-www-pc`, `https://www.coupang.com/vp/products/${id}${q}`, UA_PC)
    await probe(`${n}-www-mobile`, `https://www.coupang.com/vp/products/${id}${q}`, UA_M)
    await probe(`${n}-m-mobile`, `https://m.coupang.com/vm/products/${id}${q}`, UA_M)
  }
}
console.log(`\n저장된 HTML: ${OUT}/ (내용 확인이 필요하면 head -c 3000 <파일> 로 앞부분만)`)
