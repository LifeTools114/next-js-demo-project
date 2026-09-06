/**
 * 결제 완료·주문 상세 화면(캡처 글자 또는 알림 문자)에서 배송대행 신청에 필요한 것 고르기
 *
 * 컨셉 (운영자 26-09-07): 앱에서 평소처럼 사고 → 결제 완료 화면을 캡처해 공유 → 배송비 결제 → 하노이에서 받기.
 * 결제 완료 화면 한 장에 쇼핑몰 **주문번호**·상품·옵션·수량·가격·배송지가 다 있으므로 그것으로 신청서를 채웁니다.
 *
 * 읽는 것
 *   orderNo   「주문번호 3102787036952」 (숫자 사이 공백은 지움)
 *   items     배지(로켓배송·판매자로켓…) 다음의 이름 줄(들) + 「옵션: …」 + 「31,800원 ㆍ1개」(가격·수량)
 *             — 「결제 정보」 이후의 상품금액·배송비·총 결제금액은 상품이 아니므로 제외
 *   warehouse 배송지에 창고 코드(YS-ECOM)가 있는지, 그 뒤의 이름 — 신청서 이름과 맞춰 보기 위해
 *   total     「총 결제금액 71,600원」
 */
import { WAREHOUSE } from '../config/warehouse.js'
import { parseShotText } from './ocr-parse.js'

const BADGE = /^(?:[^가-힣A-Za-z0-9]{0,3})(로켓배송|로켓직구|로켓프레시|판매자로켓|무료배송|로켓와우|해외직구)\s*$/
const SUMMARY_START = /결제\s*정보|결제정보|총\s*결제|결제\s*금액|할인\s*금액|쿠폰|적립|배송비\s*[\d,]+/
const NOISE = /주문\s*상세보기|쇼핑\s*계속|배송요청|주문\s*상품\s*\d+개|주문\s*완료|주문이\s*완료|주문상세|배송지|받는\s*사람|배송준비|배송중|배송완료|주문번호|결제\s*정보/
const HANGUL = /[가-힣]/
// 가격·수량 줄은 「31,800원 ㆍ1개」 — 쉼표 숫자 + 원(또는 OCR 이 원을 잘못 읽은 꼬리)이 있어야 합니다
// (상품명 속 「분유, 3600, 2개」를 가격 줄로 착각해 첫 상품을 잃은 적이 있습니다)
const PRICE_QTY = /(\d{1,3}(?:,\d{3})+)\s*(?:원|2\]|\]|웜|윈)[^\d\n]{0,12}?(\d{1,3})\s*개/
const PRICE_ONLY = /(\d{1,3}(?:,\d{3})+)\s*(?:원|2\]|\])/
const QTY_ONLY = /(?:수량|개수)\s*[:：]?\s*(\d{1,3})|(\d{1,3})\s*개\s*$/
const TAIL = /^[\d\s]*(개|매|세트|팩|입|병|캔|봉|묶음)$/

const num = (s) => Number(String(s).replace(/[^\d]/g, ''))

/** 결제 완료·주문 상세·주문 알림처럼 보이는가 */
export function looksLikeOrder(text) {
  const t = String(text ?? '')
  return /주문\s*번호\s*[:：]?\s*\d[\d\s]{8,}/.test(t) || /주문이\s*완료|주문\s*완료|주문상세|총\s*결제\s*금액|결제가\s*완료/.test(t)
}

export function parseOrderText(text) {
  const raw = String(text ?? '')
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

  // ── 주문번호 ──
  const noMatch = raw.match(/주문\s*번호\s*[:：]?\s*(\d[\d\s]{8,25}\d)/)
  let orderNo = noMatch ? noMatch[1].replace(/\s/g, '') : null
  if (!orderNo) orderNo = raw.match(/(?<!\d)(\d{13})(?!\d)/)?.[1] ?? null
  if (orderNo && (orderNo.length < 9 || orderNo.length > 20)) orderNo = null

  // ── 창고 배송지 확인 ──
  const code = WAREHOUSE.code
  const addrLine = lines.find((l) => l.includes(code) && HANGUL.test(l) && !/^YS-ECOM\s*\/|^YS-\*/.test(l)) ?? lines.find((l) => l.includes(code))
  let warehouseName = null
  if (addrLine) {
    const after = addrLine.slice(addrLine.lastIndexOf(code) + code.length).replace(/^[\s:：/-]+/, '')
    const m = after.match(/^([가-힣A-Za-z][가-힣A-Za-z ]{0,20})/)
    if (m) warehouseName = m[1].trim()
  }
  const warehouse = { found: lines.some((l) => l.includes(code)), name: warehouseName }

  // ── 상품 ──
  const items = []
  let cur = null
  const flush = () => { if (cur && cur.productName) items.push(cur); cur = null }
  const summaryAt = lines.findIndex((l) => SUMMARY_START.test(l) && !PRICE_QTY.test(l))
  const end = summaryAt > 0 ? summaryAt : lines.length
  for (let i = 0; i < end; i += 1) {
    const l = lines[i]
    if (BADGE.test(l)) { flush(); cur = { productName: '', option: null, quantity: 1, productPrice: null }; continue }
    const pq = l.match(PRICE_QTY)
    if (pq && (cur || items.length)) {
      const target = cur ?? items[items.length - 1]
      target.productPrice = num(pq[1]); target.quantity = Math.max(1, Math.min(num(pq[2]) || 1, 999))
      if (cur) flush()
      continue
    }
    if (/^옵션\s*[:：]/.test(l)) { if (cur) cur.option = l.replace(/^옵션\s*[:：]\s*/, '').slice(0, 80); continue }
    if (NOISE.test(l)) continue
    const po = l.match(PRICE_ONLY)
    if (po && cur && cur.productName) {
      cur.productPrice = num(po[1])
      const q = lines[i + 1]?.match(QTY_ONLY)
      if (q) { cur.quantity = Math.max(1, Math.min(num(q[1] ?? q[2]) || 1, 999)); i += 1 }
      flush(); continue
    }
    if (!cur) {
      // 배지 없이 이름부터 나오는 화면(알림 문자 등) — 「상품명: …」 형태
      const named = l.match(/^상품(?:명)?\s*[:：]\s*(.+)$/)
      if (named) { cur = { productName: named[1].trim().slice(0, 300), option: null, quantity: 1, productPrice: null } }
      continue
    }
    if (!HANGUL.test(l) && !/[A-Za-z]{2,}|\d/.test(l)) continue
    if (cur.productName === '') { cur.productName = l; continue }
    const glue = (/\d$/.test(cur.productName) && /^(ml|mL|g|kg|l|L|리터|개|매|입|병|캔|봉|팩|세트|p|P|ea|EA)/.test(l)) || (TAIL.test(l) && !/^\d/.test(l)) ? '' : ' '
    cur.productName = `${cur.productName}${glue}${l}`.slice(0, 300)
  }
  flush()

  // 「상품명 외 1건」(알림 문자) — 나머지는 고객이 캡처로 보태게 표시만
  const more = raw.match(/외\s*(\d+)\s*건/)
  const total = num(raw.match(/총\s*결제\s*금액\s*[:：]?\s*([\d,]+)/)?.[1] ?? '') || null

  // 상품을 하나도 못 읽었지만 주문번호는 있으면, 상품 화면 파서로 이름·가격 한 줄이라도
  if (items.length === 0) {
    const p = parseShotText(raw)
    if (p.productName || p.productPrice) items.push({ productName: p.productName, option: p.option, quantity: 1, productPrice: p.productPrice })
  }

  return { orderNo, items, warehouse, total, moreItems: more ? num(more[1]) : 0 }
}
