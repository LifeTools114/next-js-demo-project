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
  assert.ok(s.includes('data-shot-input') && s.includes("fetch('/api/ocr'"), '📷 캡처 넣기')
  // 사진 넣는 곳은 화면에 하나 — 줄마다 두지 않습니다 (운영자 26-09-07: "사진 올리는 부분이 너무 많다")
  // (주석을 벗기지 않고 셉니다 — accept="image/*" 의 /* 가 주석 시작으로 잡히기 때문. 머리말 주석은 = 없이 적습니다)
  assert.equal((s.match(/data-shot-input=/g) ?? []).length, 1, '📷 버튼은 하나')
  assert.ok(s.includes('📷 주문완료 화면 캡처 넣기') && s.includes('📷 상품 화면 캡처 넣기'), '방식마다 버튼 이름이 곧 설명')
  // 긴 설명은 두지 않습니다 — 지운 문구가 되살아나면 실패
  for (const gone of ['폰만 있으면 됩니다', '가장 쉬운 길', '공유받은', '잘 읽히는 캡처', '이름·가격이 다르면 고치기']) {
    assert.ok(!s.includes(gone), `${gone} — 설명은 축약`)
  }
  // 구매하고 배송까지는 창고 주소를 보여주지 않습니다 (필요 없음)
  assert.ok(s.includes('{!isAgent && (') && s.includes('{isAgent && ('))
})

test('첫 화면(폰 전용) — 「캡처한 사진 넣기」 버튼 하나와 배송만·구매하고 배송까지 두 줄, PC 블록은 폰에서 숨김', () => {
  const home = read('pages/index.js')
  assert.ok(home.includes('<CaptureGuide ') && home.includes('only-pc'), '폰 블록은 CaptureGuide, PC 블록은 only-pc')
  // PC 용 설명 패널 셋은 폰에서 숨깁니다 (운영자 26-09-07: "모바일 버전에 필요없는 말이 너무 많다")
  assert.equal((home.match(/className="panel only-pc"/g) ?? []).length, 3, 'PC 설명 패널 셋은 only-pc')
  const g = read('components/CaptureGuide.js')
  assert.ok(g.includes('only-mobile') && g.includes('data-home-shot'))
  assert.ok(g.includes('📷 캡처한 사진 넣기'))
  assert.equal((g.match(/data-home-shot=/g) ?? []).length, 1, '첫 화면의 사진 넣는 곳은 하나')
  assert.ok(g.includes('📦 배송만') && g.includes('🛒 구매하고 배송까지'))
  assert.ok(g.includes('주문완료') && g.includes('상품 화면'), '무엇을 캡처하는지는 한 줄씩')
  assert.ok(!g.includes('<svg') && !g.includes('잘 읽히는 캡처'), '그림·긴 설명은 두지 않습니다')
  assert.ok(g.includes("caches.open('kb-share')") && g.includes("cache.put('/kb-share/shot'"), '공유 받기와 같은 보관함으로 넘깁니다')
  for (const word of ['배송대행', '구매대행']) assert.ok(!g.replace(/^\/\*\*[\s\S]*?\*\//, '').includes(word), `${word} 는 쉬운 말로`)
  const css = read('styles/globals.css')
  assert.ok(css.includes('.only-mobile { display: none; }') && css.includes('.only-pc { display: block; }'), '820px 이상에서 폰 블록 숨김')
})
