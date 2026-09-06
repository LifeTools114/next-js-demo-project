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
  assert.equal(m.share_target.method, 'GET')
  assert.deepEqual(m.share_target.params, { title: 'title', text: 'text', url: 'url' })
  for (const icon of m.icons) assert.ok(existsSync(new URL(`public${icon.src}`, root)), `아이콘 파일 ${icon.src}`)
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'))
  assert.ok(m.shortcuts.some((s) => s.url.includes('track=agent')), '구매하고 배송까지 바로가기')
})

test('머리글·서비스 워커 — manifest 링크와 아이폰용 메타, sw.js 는 캐시를 두지 않음', () => {
  const doc = read('pages/_document.js')
  assert.ok(doc.includes('rel="manifest"') && doc.includes('/manifest.webmanifest'))
  assert.ok(doc.includes('apple-mobile-web-app-capable'))
  const sw = read('public/sw.js')
  assert.ok(!sw.includes('caches.open'), '주문·금액은 항상 최신이어야 하므로 캐시 없음')
  assert.ok(read('pages/_app.js').includes("serviceWorker.register('/sw.js')"))
})

test('/send — 배송만·구매하고 배송까지 두 방식, 상품 링크 칸, 공유 파라미터 처리', () => {
  const s = read('pages/send.js')
  assert.ok(s.includes("toggleBtn('agent')") && s.includes("toggleBtn('forwarding')"))
  assert.ok(s.includes('productUrl'))
  assert.ok(s.includes('fromShare({ title: q.title, text: q.text, url: q.url })'))
  assert.ok(s.includes("q.track === 'agent'"))
  // 구매하고 배송까지는 창고 주소를 보여주지 않습니다 (필요 없음)
  assert.ok(s.includes('{!isAgent && (') && s.includes('{isAgent && ('))
})
