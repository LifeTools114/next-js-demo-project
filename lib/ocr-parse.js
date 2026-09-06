/**
 * 캡처 글자(OCR 결과)에서 상품명·가격·옵션 고르기
 *
 * 쇼핑몰 앱은 공유로 링크만 넘겨주므로, 고객이 상품 화면을 **캡처**해 보내면 서버가 글자를 읽어
 * (tesseract, lib/ocr.js) 여기서 뜻을 고릅니다 (운영자 26-09-07: "앱에서 공유하는 정보를 가지고 와야").
 *
 * OCR 은 「원」을 「2]」로, 「ml」을 「701」로 읽는 식으로 흔들리므로 규칙은 느슨하게, 결과는 고객이 확인합니다.
 *   가격  : 「20% 19,900원」처럼 % 가 있는 줄의 숫자를 최우선, 없으면 상품명 뒤 첫 가격 줄
 *           (상품평 개수·적립·배송비 줄은 제외, 취소선 정가는 % 줄이 있으면 자연히 밀림)
 *   상품명: 배송 배지 줄과 상품평 줄 사이에서 가장 긴 한글 줄 (짧게 잘린 다음 줄은 이어 붙임)
 *   옵션  : 「옵션: …」 줄
 */
const UI_NOISE = /검색해보세요|장바구니|바로구매|와우회원|적립|쿠폰|카드|할부|무이자|판매자|배송비|도착 보장|도착보장|상품 이미지|상품평|리뷰|찜|공유|문의|반품|교환|로켓배송|로켓직구|로켓프레시|판매자로켓|무료배송/
const REVIEW = /상품평|리뷰|★|☆/
const BADGE = /로켓배송|로켓직구|로켓프레시|판매자로켓|무료배송|쿠팡/
const HANGUL = /[가-힣]/
const PRICE_TOKEN = /\d{1,3}(?:,\d{3})+|\d{4,7}/g

const toNumber = (tok) => Number(String(tok).replace(/,/g, ''))

function pricesIn(line) {
  const out = []
  for (const m of line.matchAll(PRICE_TOKEN)) {
    const n = toNumber(m[0])
    if (n >= 100 && n <= 50_000_000) out.push({ n, hasComma: m[0].includes(','), at: m.index })
  }
  return out
}

export function parseShotText(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

  // ── 가격 ──
  let productPrice = null
  const isPriceNoise = (l) => /상품평|리뷰|적립|배송비|당 |개월|할부|P\b|포인트/.test(l)
  const pctLine = lines.find((l) => /\d\s?%/.test(l) && pricesIn(l).length)
  if (pctLine) {
    const after = pctLine.slice(pctLine.search(/\d\s?%/) + 1)
    const cands = pricesIn(after).filter((p) => p.n >= 100)
    productPrice = (cands.find((p) => p.hasComma) ?? cands[0])?.n ?? null
  }
  if (!productPrice) {
    const cands = lines.filter((l) => !isPriceNoise(l)).flatMap((l) => pricesIn(l).map((p) => ({ ...p, line: l })))
    // 「원」(또는 OCR 이 흔히 만드는 꼬리)이 따라오는 쉼표 숫자를 우선
    const withWon = cands.filter((p) => p.hasComma && /원|2\]|\]|웜|윈/.test(p.line.slice(p.at)))
    productPrice = (withWon[0] ?? cands.find((p) => p.hasComma) ?? cands.find((p) => p.n >= 1000))?.n ?? null
  }

  // ── 상품명 ──
  // 상품평 줄이 경계 — 배지는 그 위에서 찾습니다 (아래쪽 「로켓배송ㆍ판매자」 줄에 속지 않게)
  const reviewIdx = lines.findIndex((l) => REVIEW.test(l))
  const limit = reviewIdx > 0 ? reviewIdx : Math.min(lines.length, 10)
  let badgeIdx = -1
  for (let i = 0; i < limit; i += 1) if (BADGE.test(lines[i]) && lines[i].length <= 14) badgeIdx = i
  const from = badgeIdx + 1
  const to = reviewIdx > from ? reviewIdx : Math.min(lines.length, from + 8)
  const region = lines.slice(from, to).map((l, i) => ({ l, i: from + i }))
    .filter(({ l }) => HANGUL.test(l) && l.length >= 6 && !UI_NOISE.test(l) && !/\d\s?%/.test(l) && !pricesIn(l).some((p) => p.hasComma && /원|\]/.test(l)))
  let productName = ''
  if (region.length) {
    const best = region.reduce((a, b) => (b.l.length > a.l.length ? b : a))
    productName = best.l
    const next = lines[best.i + 1]
    // 줄바꿈으로 잘린 꼬리(「개」「1개」「세트」…)는 이어 붙입니다
    if (next && next.length <= 6 && /^[\d\s]*(개|매|세트|팩|입|병|캔|봉|묶음)$/.test(next)) productName = `${productName}${/^\d/.test(next) ? ' ' : ''}${next}`
  }
  productName = productName.replace(/^[^가-힣A-Za-z0-9\[(]+/, '').slice(0, 300)

  // ── 옵션 ──
  const option = lines.find((l) => /^옵션\s*[:：]/.test(l))?.replace(/^옵션\s*[:：]\s*/, '').slice(0, 80) ?? null

  return { productName, productPrice, option, lineCount: lines.length }
}
