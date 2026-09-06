/**
 * 폰 웹앱(홈 화면에 추가) — 매니페스트·아이콘·공유 받기가 갖춰져 있는지.
 * 쿠팡 앱 위에 겹쳐 뜨는 것은 웹으로 불가능하고, 대신 「공유 → 베트남 직구」로 링크를 받습니다 (운영자 26-09-06).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

test('manifest — 이름·아이콘·standalone·공유 받기(share_target → /send)', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'))
  assert.equal(m.name, '베트남 직구')
  assert.equal(m.display, 'standalone')
  assert.ok(m.start_url.startsWith('/send'))
  assert.equal(m.share_target.action, '/send')
  // 캡처(이미지)도 받으므로 POST multipart — 링크·글은 title/text/url, 이미지는 shots
  assert.equal(m.share_target.method, 'POST')
  assert.equal(m.share_target.enctype, 'multipart/form-data')
  assert.deepEqual(m.share_target.params.files, [{ name: 'shots', accept: ['image/*'] }])
  assert.equal(m.share_target.params.url, 'url')
  for (const icon of m.icons) assert.ok(existsSync(new URL(`public${icon.src}`, root)), `아이콘 파일 ${icon.src}`)
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'))
  assert.ok(m.shortcuts.some((s) => s.url.includes('track=agent')), '구매하고 배송까지 바로가기')
})

test('머리글·서비스 워커 — manifest 링크와 아이폰용 메타, sw.js 는 캐시를 두지 않음', () => {
  const doc = read('pages/_document.js')
  assert.ok(doc.includes('rel="manifest"') && doc.includes('/manifest.webmanifest'))
  assert.ok(doc.includes('apple-mobile-web-app-capable'))
  const sw = read('public/sw.js')
  // 공유로 받은 캡처를 잠깐 두는 보관함(kb-share) 말고는 캐시가 없어야 합니다 — 주문·금액은 항상 최신
  assert.deepEqual([...sw.matchAll(/caches\.open\('([^']+)'\)/g)].map((m) => m[1]), ['kb-share'])
  assert.ok(sw.includes("event.request.method !== 'POST' || url.pathname !== '/send'"), '공유 POST 만 다룹니다')
  assert.ok(sw.includes('Response.redirect('), '공유는 GET /send?… 로 넘깁니다')
  assert.ok(read('pages/_app.js').includes("serviceWorker.register('/sw.js')"))
})

test('/send — 배송만·구매하고 배송까지 두 방식, 상품 링크 칸, 공유 파라미터 처리', () => {
  const s = read('pages/send.js')
  assert.ok(s.includes("toggleBtn('agent')") && s.includes("toggleBtn('forwarding')"))
  assert.ok(s.includes('productUrl'))
  assert.ok(s.includes('fromShare({ title: q.title, text: q.text, url: q.url })'))
  assert.ok(s.includes("q.track === 'agent'"))
  assert.ok(s.includes("q.shot === '1'") && s.includes("cache.match('/kb-share/shot')"), '공유된 캡처를 읽습니다')
  assert.ok(s.includes('data-shot-input') && s.includes("fetch('/api/ocr'"), '📷 캡처로 채우기')
  // 구매하고 배송까지는 창고 주소를 보여주지 않습니다 (필요 없음)
  assert.ok(s.includes('{!isAgent && (') && s.includes('{isAgent && ('))
})
