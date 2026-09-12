/**
 * 「대신 읽기」 결과 정리 — 읽기 기기(운영자 확장)가 보낸 값을 고객 화면에 줄 모양으로 다듬습니다.
 *
 * 받는 것은 값뿐입니다(코드 아님). 길이 상한을 두고, 숫자는 검증하고, 옵션은 이 상품의 쇼핑몰 주소로
 * 확인된 것만 url 을 남깁니다 — 고객 화면은 그 url 로 「그 옵션의 가격」을 다시 읽습니다 (lib/peek-jobs.js).
 */
import { parseProductUrl } from './coupang-url.js'

const str = (v, n) => String(v ?? '').slice(0, n)
const digits = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? d.slice(0, 20) : null }
export const MAX_OPTIONS = 60

/** 옵션 목록 정리 — 라벨 80자, 같은 번호는 하나로, url 은 같은 상품의 정식 주소일 때만 */
export function sanitizeOptions(list, { productId = null } = {}) {
  if (!Array.isArray(list)) return []
  const want = productId ? String(productId) : null
  const out = []
  const seen = new Set()
  for (const o of list) {
    if (!o || typeof o !== 'object') continue
    const label = str(o.label, 80).replace(/\s+/g, ' ').trim()
    if (!label) continue
    const itemId = digits(o.itemId)
    const vendorItemId = digits(o.vendorItemId)
    let url = null
    if (o.url) {
      const p = parseProductUrl(String(o.url))
      if (p?.productId && (!want || p.productId === want)) url = p.url
    }
    const key = itemId || vendorItemId ? `${itemId ?? ''}:${vendorItemId ?? ''}` : `l:${label}`
    if (seen.has(key)) continue
    seen.add(key)
    const price = Number(o.price)
    out.push({ label, itemId, vendorItemId, url, price: Number.isFinite(price) && price > 0 ? Math.round(price) : null, selected: Boolean(o.selected) })
    if (out.length >= MAX_OPTIONS) break
  }
  return out
}

/**
 * 읽기 기기가 POST 한 본문 → 고객 화면용 결과.
 * 이름도 가격도 없으면 실패(ok:false)로 — 빈 성공은 고객에게 "읽었다"고 거짓말하는 셈입니다.
 */
export function sanitizeWorkerResult(body, { productId = null } = {}) {
  const b = body && typeof body === 'object' ? body : {}
  const price = Number(b.productPrice)
  if (!(b.ok && (b.productName || price > 0))) return { ok: false, message: str(b.message, 200) }
  const productUrl = b.productUrl ? (parseProductUrl(String(b.productUrl))?.url ?? null) : null
  return {
    ok: true,
    productName: str(b.productName, 300),
    productPrice: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
    spec: b.spec ? str(b.spec, 120) : null,
    badges: Array.isArray(b.badges) ? b.badges.slice(0, 12).map((x) => str(x, 40)) : [],
    categoryPath: str(b.categoryPath, 200),
    shippingText: str(b.shippingText, 300),
    blocked: b.blocked ? str(b.blocked, 80) : null,
    productUrl,
    options: sanitizeOptions(b.options, { productId }),
    via: 'worker',
  }
}
