/** 국기 그림 — 이모지 대신 SVG (윈도우에서 「VN」「KR」 글자로 보이던 것, 26-09-06) */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { flagSvg, FLAG_INNER } from '../lib/ui/flags.js'

test('국기 SVG — 베트남은 빨강+노란 별, 한국은 태극(빨강·파랑)+괘', () => {
  assert.ok(/#da251d/.test(FLAG_INNER.vn) && /#ffff00/.test(FLAG_INNER.vn))
  assert.ok(/#cd2e3a/.test(FLAG_INNER.kr) && /#0047a0/.test(FLAG_INNER.kr))
  assert.equal((FLAG_INNER.kr.match(/<g transform="translate/g) ?? []).length, 4, '괘 네 개')
  const svg = flagSvg('vn', { height: 20 })
  assert.ok(svg.startsWith('<svg') && svg.includes('width="30" height="20"'), '3:2 비율')
  assert.ok(!/https?:|url\(/.test(svg), '바깥에서 받아오는 그림이 없어야 합니다 (확장 CSP)')
  assert.equal(flagSvg('xx'), '', '모르는 나라는 빈 문자열')
})

test('고객 화면에서 국기 이모지를 쓰지 않는다 — 윈도우에서 글자로 깨집니다', () => {
  for (const f of ['extension/src/content/order-capture.js', 'extension/src/content/panel.js',
    'extension/src/popup/popup.html', 'pages/index.js', 'pages/checkout.js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
    assert.ok(!/🇻🇳|🇰🇷/.test(src), `${f}: 국기 이모지 대신 Flag/flagSvg 를 쓰세요`)
  }
})
