/**
 * 폰 웹앱(홈 화면에 추가)과 폰 화면 — 매니페스트·공유 받기·첫 화면·/send 가 「링크 하나」 흐름인지.
 * 쿠팡 앱 위에 겹쳐 뜨는 것은 웹으로 불가능하고, 앱의 「공유」로 링크를 받습니다 (운영자 26-09-06).
 * 사진(캡처) 길은 운영자 지시(26-09-12)로 뺐습니다 — 되살아나면 여기서 실패합니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

test('manifest — 이름·아이콘·standalone·공유 받기(share_target GET → /send, 이미지 없음)', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'))
  assert.equal(m.name, '베트남 직구')
  assert.equal(m.display, 'standalone')
  assert.ok(m.start_url.startsWith('/send'))
  assert.equal(m.share_target.action, '/send')
  assert.equal((m.share_target.method ?? 'GET').toUpperCase(), 'GET', '링크·글만 받으므로 GET')
  assert.equal(m.share_target.files, undefined, '캡처 이미지 공유는 뺐습니다')
  assert.equal(m.share_target.params.url, 'url')
  for (const icon of m.icons) assert.ok(existsSync(new URL(`public${icon.src}`, root)), `아이콘 파일 ${icon.src}`)
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'))
  assert.ok(m.shortcuts.some((s) => s.url.includes('track=agent')), '구매하고 배송까지 바로가기')
})

test('머리글·서비스 워커 — manifest 링크와 아이폰용 메타, sw.js 는 아무것도 캐시하지 않음', () => {
  const doc = read('pages/_document.js')
  assert.ok(doc.includes('rel="manifest"') && doc.includes('/manifest.webmanifest'))
  assert.ok(doc.includes('apple-mobile-web-app-capable'))
  const sw = read('public/sw.js')
  assert.ok(!sw.includes('caches.open') && !sw.includes('kb-share'), '캐시·임시 보관함 없음 — 주문·금액은 항상 최신')
  assert.ok(read('pages/_app.js').includes("serviceWorker.register('/sw.js')"))
})

test('/send — 배송만·구매하고 배송까지, 링크 칸 + 붙여넣기, 옵션 칩, 공유 파라미터, 캡처 없음', () => {
  const s = read('pages/send.js').replace(/^\/\*\*[\s\S]*?\*\//, '') // 머리말 주석은 뺀 이유를 적어 두므로 검사에서 제외
  assert.ok(s.includes("toggleBtn('agent')") && s.includes("toggleBtn('forwarding')"))
  assert.ok(s.includes('productUrl'))
  assert.ok(s.includes('fromShare({ title: q.title, text: q.text, url: q.url })'))
  assert.ok(s.includes("q.track === 'agent'"))
  assert.ok(s.includes('data-paste-link') && s.includes('navigator.clipboard.readText'), '줄마다 「붙여넣기」 버튼')
  assert.ok(s.includes('data-option-chip') && s.includes("peekRow(i, opt.url, { force: true })"), '옵션 칩을 누르면 그 옵션 화면을 읽어 가격을 맞춥니다')
  assert.ok(s.includes("fetch(`/api/product-peek?url=") && s.includes("reason === 'pending'"), '대신 읽기 기다림')
  // 구매하고 배송까지는 창고 주소를 보여주지 않습니다 (필요 없음)
  assert.ok(s.includes('{!isAgent && (') && s.includes('{isAgent && ('))
  // 사진(캡처) 길은 없습니다 — 링크 하나
  for (const gone of ['data-shot-input', "fetch('/api/ocr'", 'kb-share', "shot === '1'", '📷', '캡처']) {
    assert.ok(!s.includes(gone), `${gone} — 사진 넣기는 뺐습니다`)
  }
  // 긴 설명은 두지 않습니다 — 지운 문구가 되살아나면 실패
  for (const gone of ['폰만 있으면 됩니다', '가장 쉬운 길', '공유받은', '이름·가격이 다르면 고치기']) {
    assert.ok(!s.includes(gone), `${gone} — 설명은 축약`)
  }
})

test('첫 화면(폰 전용) — 「🔗 상품 링크 붙여넣기」 하나, 두 방법 두 줄, PC 패널 셋은 폰에서 숨김, 캡처 블록 없음', () => {
  const home = read('pages/index.js')
  assert.ok(home.includes('<LinkStart ') && home.includes('only-pc'), '폰 블록은 LinkStart, PC 블록은 only-pc')
  assert.equal((home.match(/className="panel only-pc"/g) ?? []).length, 3, 'PC 설명 패널 셋은 only-pc')
  assert.ok(!existsSync(new URL('components/CaptureGuide.js', root)), '캡처 안내 블록은 지웠습니다')
  const g = read('components/LinkStart.js')
  assert.ok(g.includes('only-mobile') && g.includes('data-home-link') && g.includes('🔗 상품 링크 붙여넣기'))
  assert.ok(g.includes('navigator.clipboard.readText') && g.includes('router.push(`/send?url='), '붙여넣기 → /send?url=')
  assert.ok(g.includes('📦 배송만') && g.includes('🛒 구매하고 배송까지'))
  assert.ok(!g.includes('📷') && !g.includes('<svg'), '사진·그림 없음')
  for (const word of ['배송대행', '구매대행']) assert.ok(!g.replace(/^\/\*\*[\s\S]*?\*\//, '').includes(word), `${word} 는 쉬운 말로`)
  const css = read('styles/globals.css')
  assert.ok(css.includes('.only-mobile { display: none; }') && css.includes('.only-pc { display: block; }'), '820px 이상에서 폰 블록 숨김')
})

test('상호 표기 — 폰 전용 블록만 「쿠팡」을 적고, PC 화면·서버 렌더 문구에는 남의 상호가 없다 (운영자 26-09-12)', () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')
  assert.ok(strip(read('components/LinkStart.js')).includes('쿠팡 전용'), '폰 첫 화면은 쿠팡 전용임을 밝힙니다')
  // /send 는 폰 너비에서만 쿠팡 — 코드에 상호 리터럴은 isPhone 분기 한 곳뿐
  const send = strip(read('pages/send.js'))
  assert.equal((send.match(/쿠팡/g) ?? []).length, 1, '/send 의 상호는 isPhone ? 쿠팡 : 쇼핑몰 한 곳에만')
  assert.ok(send.includes("const shopWord = isPhone ? '쿠팡' : '쇼핑몰'"))
  assert.ok(strip(read('components/LinkStart.js')).includes('🛍 쿠팡으로 가기') && send.includes('data-shop-link'), '쿠팡으로 가기 버튼 (파트너스 링크는 환경변수로만)')
  // PC 에서도 보이는 화면·확장에는 상호가 없습니다
  for (const p of ['pages/index.js', 'pages/checkout.js', 'pages/rates.js', 'pages/orders/[id].js', 'components/Layout.js']) {
    assert.ok(!strip(read(p)).includes('쿠팡'), `${p} 에 남의 상호가 있습니다 — 데스크탑 쪽에는 쓰지 않습니다`)
  }
})
