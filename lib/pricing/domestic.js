/**
 * 국내 배송비 (쿠팡 판매자 → 한국 창고)
 *
 * 왜 걷는가
 *   구매대행은 **저희가 쿠팡에 결제**합니다. 마켓플레이스 상품에는 국내
 *   배송비가 따로 붙는데(예: 3,000원), 지금까지 견적에 넣지 않아 주문마다
 *   그만큼이 빠졌습니다 (26-09-06 사장님 화면: 카라티 배송비 3,000원).
 *   배송만(배송대행)에는 걷지 않습니다 — 고객이 쿠팡에 직접 내니까요.
 *
 * 규정 (운영자 확정 26-09-06)
 *   ① 구매대행에서만 청구한다.
 *   ② **판매자마다 한 번**만 붙는다. 같은 판매자 상품을 여러 개 담아도
 *      배송비는 한 번입니다 — 개수만큼 곱하면 과다청구입니다.
 *   ③ "같은 판매자 상품 N원 이상 무료" 조건은 **그 판매자 상품 합계**로
 *      판정한다. 조건을 넘으면 0원.
 *   ④ 화면에서 못 읽었으면 **청구하지 않는다.** 모르면 안 받습니다 —
 *      우리가 조금 손해 보는 쪽이, 고객이 모르는 돈을 내는 쪽보다 낫습니다.
 *   ⑤ 판매자를 모르면 그 줄은 따로 센다 (묶어서 깎아주면 우리 손해).
 *
 * 값의 출처는 쿠팡 화면입니다. 확장이 상품 화면에서 읽어 상품 정보에
 * 실어 보내고(domesticShipKrw · freeShipOverKrw · seller), 서버는 그 값으로
 * 같은 계산을 합니다 — 패널 금액과 신청서 금액이 어긋나지 않게.
 */

import { FEES } from '../../config/fees.js'

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const money = (v) => Math.max(0, Math.min(num(v), FEES.domesticShip.maxKrw))

/**
 * @param {Array<{productPrice:number, quantity:number, domesticShipKrw?:number,
 *                freeShipOverKrw?:number, seller?:string}>} items
 * @param {string} track
 * @returns {{krw:number, rows:Array, waived:Array, known:boolean}}
 */
export function domesticShipping(items = [], track = 'forwarding') {
  const empty = { krw: 0, rows: [], waived: [], known: false }
  if (FEES.domesticShip.agentOnly && track !== 'agent') return empty

  // 판매자별로 묶습니다 — 무료 조건도, 청구도 판매자 단위입니다.
  const groups = new Map()
  items.forEach((it, idx) => {
    const seller = String(it?.seller ?? '').trim()
    // 판매자를 모르면 이 줄만의 묶음 — 남의 배송비를 깎아주지 않도록.
    const key = seller || `#${idx}`
    const g = groups.get(key) ?? { seller, feeKrw: 0, goodsKrw: 0, freeOverKrw: null }
    g.goodsKrw += Math.max(0, num(it?.productPrice)) * Math.max(1, num(it?.quantity) || 1)
    const fee = money(it?.domesticShipKrw)
    // 같은 판매자 줄마다 값이 다르면 큰 쪽 — 실제 청구서가 그렇습니다.
    if (fee > g.feeKrw) g.feeKrw = fee
    const over = money(it?.freeShipOverKrw)
    if (over > 0) g.freeOverKrw = g.freeOverKrw === null ? over : Math.min(g.freeOverKrw, over)
    groups.set(key, g)
  })

  const rows = []
  const waived = []
  for (const g of groups.values()) {
    if (g.feeKrw <= 0) continue // 무료배송이거나 못 읽은 줄 — 청구하지 않습니다
    if (g.freeOverKrw !== null && g.goodsKrw >= g.freeOverKrw) {
      waived.push({ seller: g.seller, freeOverKrw: g.freeOverKrw, goodsKrw: g.goodsKrw, feeKrw: g.feeKrw })
      continue
    }
    rows.push({ seller: g.seller, krw: g.feeKrw })
  }
  return {
    krw: rows.reduce((s, r) => s + r.krw, 0),
    rows,
    waived,
    /** 화면에서 배송비를 하나라도 읽었는가 — 못 읽었으면 견적에 "0원"이 아니라 "모름"입니다 */
    known: rows.length > 0 || waived.length > 0,
  }
}
