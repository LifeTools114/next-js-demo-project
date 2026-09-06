/**
 * 주문 하나를 누가 볼 수 있나
 *
 * 주문번호는 순번(HN+날짜+0001)이라 누구나 추측할 수 있습니다. 그래서
 * 주문번호만으로는 **진행 상태만** 보이고, 이름·전화·주소·상품·취소는
 *   · owner  — 신청한 브라우저(개인 링크 열쇠가 저장됨) 또는 개인 링크(?k=)로 연 사람
 *   · admin  — 운영자 토큰
 * 에게만 열립니다 (운영자 26-09-06: "로그인이나 링크 없어도 확인이 되네").
 *
 * 열쇠 규칙은 /my 와 같습니다 — 입금 전 열쇠는 그 열쇠로 만든 주문만,
 * 입금 확인된 열쇠는 같은 전화번호의 주문 전부.
 */
import { isAdminRequest } from '../auth.js'
import { findByKey, visibleOrders } from '../customer/store.js'
import { customerView } from './store.js'
import { maskName, maskPhone } from '../mask.js'

const first = (v) => (Array.isArray(v) ? v[0] : v)

/** 요청에 실린 개인 링크 열쇠 — x-my-key 헤더 또는 ?k= */
export function myKeyFrom(req) {
  const v = first(req.headers?.['x-my-key']) || first(req.query?.k) || ''
  return String(v).trim().slice(0, 200)
}

/** 'admin' | 'owner' | 'public' */
export function orderAccess(req, order) {
  if (isAdminRequest(req)) return 'admin'
  const key = myKeyFrom(req)
  if (key) {
    const found = findByKey(key)
    if (found && visibleOrders(found, [order]).length === 1) return 'owner'
  }
  return 'public'
}

/**
 * 값 안의 비밀 문자열을 어디에 있든 가립니다 — 견적(quote) 안의 무게 계산 줄, 판정 근거 등
 * 구조가 깊어서 필드를 하나씩 지우는 방식은 빠뜨립니다 (실제로 두 군데서 상품명이 샜습니다).
 */
function scrub(value, secrets) {
  if (typeof value === 'string') {
    let out = value
    for (const s of secrets) if (s && out.includes(s)) out = out.split(s).join('***')
    return out
  }
  if (Array.isArray(value)) return value.map((x) => scrub(x, secrets))
  if (value && typeof value === 'object') {
    const o = {}
    for (const [k, x] of Object.entries(value)) o[k] = scrub(x, secrets)
    return o
  }
  return value
}

/**
 * 공개 조회용 — 고객 화면과 같은 모양이지만 개인정보·상품명·쇼핑몰 주문번호를 비웁니다.
 * (모양을 유지해야 주문 화면이 그대로 그려집니다)
 */
export function publicView(order) {
  const name = maskName(order.customer?.name)
  const c = order.customer ?? {}
  const secrets = [
    c.name, c.address, c.email, c.messenger, c.phone,
    ...(order.items ?? []).map((it) => it.productName),
  ].map((x) => String(x ?? '').trim()).filter((x) => x.length >= 2)
  const v = scrub(customerView(order), secrets)
  const guide = v.forwardingGuide
  return {
    ...v,
    customer: { name, phone: maskPhone(order.customer?.phone), address: '', email: '', messenger: '' },
    items: (v.items ?? []).map((it, i) => ({
      ...it,
      productName: `상품 ${i + 1}`,
      productUrl: null, url: null, imageUrl: null, image: null,
    })),
    inbound: null,
    // 견적 안의 판정 근거(eligibility.results)에 상품명이 실려 있습니다 — 공개 뷰에서는 뺍니다.
    quote: v.quote ? { ...v.quote, eligibility: null } : v.quote,
    forwardingGuide: guide
      ? { ...guide, addressDetail: String(guide.addressDetail ?? '').replace('***', name), linked: guide.linked }
      : null,
    ledger: { customer: [] },
  }
}

/** 공개 조회에서 막힌 동작에 돌려줄 안내 */
export const OWNER_ONLY_MESSAGE =
  '이 주문을 신청한 브라우저나 「내 주문 링크」에서만 할 수 있습니다. 링크를 잃으셨다면 주문 조회 → 내 주문 전체 보기에서 전화번호로 다시 받으세요.'
