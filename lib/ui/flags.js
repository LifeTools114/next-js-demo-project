/**
 * 국기 그림 — 이모지 대신 SVG.
 *
 * 왜: 윈도우 크롬은 국기 이모지(🇻🇳 🇰🇷)를 못 그려서 「VN」「KR」 글자로 보입니다
 * (운영자 화면 26-09-06). 바깥에서 받아오는 그림이 아니라 여기 적힌 도형이라
 * 확장의 CSP·웹스토어 정책에 걸릴 것이 없고, 어느 운영체제에서나 같습니다.
 *
 * 사이트는 components/Flag.js 가, 확장은 KBCalc.flagSvg 가 같은 도형을 씁니다.
 */
const bar = (y, broken) => broken
  ? `<rect x="-2.3" y="${y}" width="1.9" height="0.9" fill="#000"/><rect x="0.4" y="${y}" width="1.9" height="0.9" fill="#000"/>`
  : `<rect x="-2.3" y="${y}" width="4.6" height="0.9" fill="#000"/>`
/** 괘 — 막대 세 개, 대각선에 직각으로 기울여 그립니다 (true = 끊어진 막대) */
const trigram = (cx, cy, rot, pattern) =>
  `<g transform="translate(${cx} ${cy}) rotate(${rot})">${pattern.map((b, i) => bar(-2.2 + i * 1.55, b)).join('')}</g>`

export const FLAG_INNER = {
  // 베트남 — 빨간 바탕에 노란 별
  vn: '<rect width="30" height="20" fill="#da251d"/>' +
    '<polygon fill="#ffff00" points="15,4 16.35,8.14 20.71,8.15 17.19,10.71 18.53,14.85 15,12.3 11.47,14.85 12.81,10.71 9.29,8.15 13.65,8.14"/>',
  // 한국 — 태극(대각선으로 기울임) + 건·감·리·곤
  kr: '<rect width="30" height="20" fill="#fff"/>' +
    '<g transform="rotate(-33.7 15 10)"><circle cx="15" cy="10" r="5" fill="#0047a0"/>' +
    '<path d="M10,10 a5,5 0 0 1 10,0 a2.5,2.5 0 0 1 -5,0 a2.5,2.5 0 0 0 -5,0z" fill="#cd2e3a"/></g>' +
    trigram(6, 4, -56.3, [false, false, false]) +   // 건 ☰ 왼쪽 위
    trigram(24, 4, 56.3, [true, false, true]) +     // 감 ☵ 오른쪽 위
    trigram(6, 16, 56.3, [false, true, false]) +    // 리 ☲ 왼쪽 아래
    trigram(24, 16, -56.3, [true, true, true]),     // 곤 ☷ 오른쪽 아래
}

const NAME = { vn: '베트남', kr: '한국' }

/** 확장(문자열 HTML)용 — 높이(px)만 주면 3:2 비율로 그립니다 */
export function flagSvg(code, { height = 16 } = {}) {
  const inner = FLAG_INNER[code]
  if (!inner) return ''
  return `<svg viewBox="0 0 30 20" width="${height * 1.5}" height="${height}" role="img" aria-label="${NAME[code]}" ` +
    'style="display:inline-block;vertical-align:-0.15em;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.15);flex-shrink:0">' +
    `${inner}</svg>`
}
