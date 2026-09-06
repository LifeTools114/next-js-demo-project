/**
 * 시작 배너 — 파란 카드에 국기·큰 글자·주황 알약 버튼.
 *
 * 운영자 확정 26-09-06: "파란색 바탕에 큰 이미지가 뜨는 팝업으로 통일."
 * 홈·검색 화면의 시작 배너(order-capture.js)와 상품 화면의 견적 버튼(panel.js)이
 * 같은 이 그림을 씁니다. 상태에 따라 버튼 글자와 색만 바뀝니다.
 *
 *   on      켜짐 표시(● 켜짐). 되돌리는 버튼은 두지 않습니다 — 화면을 조작하지 않으므로 되돌릴 것도 없습니다 (운영자 26-09-06)
 *   button  주황 알약 안의 글자 — 신청 / 상품 고르기 / 도착 가격 보기 …
 *   tone    orange(기본) · red(배송 불가) · grey(읽지 못함)
 *   foot    맨 아래 한 줄
 */
import { flagSvg } from './flags.js'

const TONES = {
  orange: { bg: 'linear-gradient(180deg,#ff9a1f 0%,#ff6a00 100%)', shadow: '0 3px 10px rgba(255,106,0,.45)' },
  red: { bg: 'linear-gradient(180deg,#f04452 0%,#c92a2a 100%)', shadow: '0 3px 10px rgba(201,42,42,.45)' },
  grey: { bg: 'linear-gradient(180deg,#8b95a1 0%,#5b6470 100%)', shadow: '0 3px 10px rgba(0,0,0,.25)' },
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export const BANNER_COPY = {
  brand: '베트남 직구 도우미',
  headline: ['베트남에서', '한국 직구하기'],
  footOff: '쉽고 빠른 한국 → 베트남 배송',
  footOn: '✓ 작동 중 · 상품을 누르면 가격 표시',
}

export function bannerHtml({
  on = false,
  button = on ? '상품 고르기' : '신청',
  tone = 'orange',
  foot = on ? BANNER_COPY.footOn : BANNER_COPY.footOff,
  id = 'kb-banner',
} = {}) {
  const t = TONES[tone] ?? TONES.orange
  return `<div id="${esc(id)}" role="button" tabindex="0" style="` +
    'cursor:pointer;border-radius:14px;padding:14px 14px 12px;text-align:center;' +
    'background:linear-gradient(155deg,#1b4fd8 0%,#0a2e9c 55%,#0b2f7a 100%);' +
    'box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);font-family:sans-serif;color:#fff">' +
    '<div style="font-size:10.5px;font-weight:700;color:#cfe0ff;letter-spacing:.2px">' +
    (on ? '<span style="color:#7cffb2;font-weight:900">● 켜짐</span> &nbsp;' : '') +
    `<span style="color:#fff;font-weight:900">${BANNER_COPY.brand}</span></div>` +
    '<div style="margin-top:9px;font-size:19px;font-weight:900;color:#fff;line-height:1.32">' +
    `${flagSvg('vn', { height: 17 })} ${BANNER_COPY.headline[0]} ${flagSvg('kr', { height: 17 })}<br>${BANNER_COPY.headline[1]}</div>` +
    '<div style="margin-top:11px;display:inline-block;min-width:150px;padding:9px 20px;border-radius:22px;' +
    `background:${t.bg};color:#fff;font-size:15.5px;font-weight:900;box-shadow:${t.shadow}">` +
    `${esc(button)} <span style="font-size:13px">▶</span></div>` +
    `<div style="margin-top:10px;font-size:10.5px;font-weight:700;color:#bfd3ff">${esc(foot)}</div>` +
    '</div>'
}
