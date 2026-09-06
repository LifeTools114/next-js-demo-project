/**
 * 쇼핑몰 상품 링크 읽기 — 폰에서 「공유 → 링크 복사」로 받은 주소에서 상품 번호를 꺼냅니다.
 *
 * 받는 모양 (모두 됩니다)
 *   https://www.coupang.com/vp/products/1234567?itemId=89&vendorItemId=12
 *   https://m.coupang.com/vm/products/1234567
 *   https://link.coupang.com/a/xxxx   (짧은 링크 — 상품 번호는 못 읽고 주소만 남깁니다)
 *   "상품명 https://…" 처럼 글 속에 섞여 와도 첫 번째 주소를 찾습니다.
 */
const URL_RE = /https?:\/\/[^\s<>"'）)]+/i

export function parseProductUrl(text) {
  const raw = String(text ?? '').trim()
  const m = raw.match(URL_RE)
  if (!m) return null
  let url
  try { url = new URL(m[0]) } catch { return null }
  const host = url.hostname.toLowerCase()
  if (!/(^|\.)coupang\.com$/.test(host)) return null

  const id = url.pathname.match(/\/(?:vp|vm)\/products\/(\d{3,20})/)?.[1] ?? null
  const itemId = url.searchParams.get('itemId')?.replace(/\D/g, '') || null
  const vendorItemId = url.searchParams.get('vendorItemId')?.replace(/\D/g, '') || null

  if (!id) return { productId: null, itemId: null, vendorItemId: null, url: url.href.slice(0, 500) }

  // 추적용 꼬리표는 떼고, 상품을 특정하는 값만 남깁니다 (링크가 짧고 같은 상품이면 같은 주소)
  const clean = new URL(`https://www.coupang.com/vp/products/${id}`)
  if (itemId) clean.searchParams.set('itemId', itemId)
  if (vendorItemId) clean.searchParams.set('vendorItemId', vendorItemId)
  return { productId: id, itemId, vendorItemId, url: clean.href }
}

/** 공유로 들어온 title/text/url 세 값에서 상품 이름 후보와 링크를 고릅니다 */
export function fromShare({ title, text, url } = {}) {
  const parsed = parseProductUrl(url) ?? parseProductUrl(text) ?? parseProductUrl(title)
  const name = [title, text]
    .map((s) => String(s ?? '').replace(URL_RE, '').replace(/\s+/g, ' ').trim())
    .find((s) => s.length >= 2) ?? ''
  return { link: parsed, productName: name.slice(0, 300) }
}
