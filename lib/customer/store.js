/**
 * 고객 풀 — 회원가입 없이 고객을 기억하는 저장소.
 *
 * 운영자 확정 26-09-06: "보안과 내 고객 정보를 가지고 있을 수 있는 좋은 방안으로.
 * 이 고객들은 앞으로 충성 고객으로 만들고, 이 풀로 새 사업을 확장할 것."
 *
 * 설계
 *   고객 번호   전화번호(phoneKey)가 곧 고객입니다. 같은 번호로 신청하면 같은 고객.
 *   개인 링크   비밀번호 대신 긴 무작위 열쇠(k=…). 서버에는 **해시만** 저장하므로
 *              파일이 새어도 링크는 새지 않습니다. 열쇠는 발급 순간에만 한 번 보입니다.
 *   증명       처음 신청할 때 받은 열쇠는 「미확인」— 그 열쇠로 만든 주문만 보입니다.
 *              그 주문의 **입금이 확인되면** 열쇠가 「확인됨」이 되어 이 전화번호의
 *              주문 전부가 보입니다. 남의 전화번호로 신청서만 내는 사람은 결제하지
 *              않으므로 남의 주문을 볼 수 없습니다. (입금 = 전화번호 주인 증명)
 *   복구       링크를 잃으면 「전화번호 + 입금까지 끝난 주문번호 하나」로 새 열쇠.
 *              기기마다 열쇠를 따로 가질 수 있고(최대 6개), 운영자는 /admin 에서
 *              새 링크 발급·전부 무효를 할 수 있습니다.
 *   마케팅 동의 필수 동의와 분리된 선택 항목. 동의·철회 시각과 경로를 남깁니다.
 *   PIN(선택)  고객이 원하면 4~6자리 PIN 을 걸어, 링크가 새어도 PIN 없이는 못 봅니다.
 *              scrypt 해시로 저장, 5번 틀리면 15분 잠금. 잊으면 복구(입금 주문번호)가 PIN 도 지웁니다.
 *              운영자 확정 26-09-06: "쉽게 확인하되 보안은 철저하게" — 기본은 링크만, 원하면 PIN.
 *
 * 파일  .data/customers.json (주문 파일과 같은 규칙 — 테스트에서는 메모리만).
 * 이 모듈은 주문 저장소를 import 하지 않습니다(순환 방지) — 주문 목록은 인자로 받습니다.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readState, writeState } from '../order/persist.js'
import { ORDER_STATES } from '../order/states.js'

const FILE = 'customers.json'
const MAX_KEYS = 6

/** 전화번호 → 고객 열쇠 문자열. +84 9xx → 09xx, +82 10 → 010, 나머지는 숫자만. */
export function phoneKey(v) {
  let d = String(v ?? '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2)
  if (d.startsWith('82') && d.length >= 11) d = '0' + d.slice(2)
  return d
}

export const hashKey = (key) => createHash('sha256').update(String(key)).digest('hex')
const newKey = () => randomBytes(24).toString('base64url')
const nowIso = () => new Date().toISOString()

/** 입금이 끝난(또는 그 뒤) 상태 — 전화번호 주인 증명으로 인정하는 주문 상태 */
export const PROVEN_STATES = Object.keys(ORDER_STATES).filter(
  (s) => !['REQUESTED', 'AWAITING_PAYMENT', 'CANCELLED'].includes(s),
)

const store = (() => {
  if (!globalThis.__kbCustomerStore) {
    const s = { counter: 0, byId: new Map() }
    const saved = readState(FILE)
    if (saved && Array.isArray(saved.customers)) {
      for (const c of saved.customers) s.byId.set(c.id, c)
      s.counter = Number(saved.counter) || 0
    }
    globalThis.__kbCustomerStore = s
  }
  return globalThis.__kbCustomerStore
})()

function persist() {
  writeState(FILE, { version: 1, counter: store.counter, customers: [...store.byId.values()] })
}

export const getCustomer = (id) => store.byId.get(id) ?? null
export const findByPhone = (phone) => {
  const k = phoneKey(phone)
  if (!k) return null
  return [...store.byId.values()].find((c) => c.phoneKey === k) ?? null
}

/** 열쇠(평문) → { customer, entry } — 해시로만 비교합니다 */
export function findByKey(key) {
  if (!key || typeof key !== 'string' || key.length < 16) return null
  const h = hashKey(key)
  for (const c of store.byId.values()) {
    const entry = c.keys.find((e) => e.hash === h)
    if (entry) return { customer: c, entry }
  }
  return null
}

/** 신청서의 이름·전화·이메일로 고객을 만들거나 갱신합니다 */
export function upsertCustomer({ name, phone, email, messenger } = {}) {
  const k = phoneKey(phone)
  if (!k) throw new Error('전화번호가 필요합니다.')
  let c = findByPhone(k)
  const created = !c
  if (!c) {
    store.counter += 1
    c = {
      id: `C${String(store.counter).padStart(5, '0')}`,
      phoneKey: k,
      phone: String(phone ?? '').trim(),
      name: String(name ?? '').trim(),
      email: String(email ?? '').trim(),
      messenger: String(messenger ?? '').trim(),
      pin: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      marketing: { agreed: false, at: null, source: null },
      keys: [],
      tags: [],
      notes: '',
    }
    store.byId.set(c.id, c)
  } else {
    if (name) c.name = String(name).trim()
    if (phone) c.phone = String(phone).trim()
    if (email) c.email = String(email).trim()
    if (messenger) c.messenger = String(messenger).trim()
    c.updatedAt = nowIso()
  }
  persist()
  return { customer: c, created }
}

/**
 * 열쇠 발급 — 평문은 이 자리에서만 돌려주고 저장하지 않습니다.
 * verified=false 는 「그 열쇠로 만든 주문만」 보이는 미확인 열쇠입니다.
 */
export function issueKey(customerId, { verified = false, via = 'first-order', label = '' } = {}) {
  const c = getCustomer(customerId)
  if (!c) throw new Error('고객을 찾을 수 없습니다.')
  const key = newKey()
  c.keys.push({ hash: hashKey(key), issuedAt: nowIso(), verified: Boolean(verified), via, label })
  // 너무 많이 쌓이면 미확인 → 오래된 순으로 버립니다.
  while (c.keys.length > MAX_KEYS) {
    const i = c.keys.findIndex((e) => !e.verified)
    c.keys.splice(i >= 0 ? i : 0, 1)
  }
  c.updatedAt = nowIso()
  persist()
  return key
}

/** 입금 확인 → 그 주문을 만든 열쇠를 「확인됨」으로 */
export function verifyKey(customerId, hash) {
  const c = getCustomer(customerId)
  if (!c || !hash) return false
  const entry = c.keys.find((e) => e.hash === hash)
  if (!entry || entry.verified) return false
  entry.verified = true
  entry.verifiedAt = nowIso()
  persist()
  return true
}

export function revokeKeys(customerId) {
  const c = getCustomer(customerId)
  if (!c) return false
  c.keys = []
  c.updatedAt = nowIso()
  persist()
  return true
}

export function setMarketing(customerId, agreed, source = 'customer') {
  const c = getCustomer(customerId)
  if (!c) return null
  c.marketing = { agreed: Boolean(agreed), at: nowIso(), source }
  c.updatedAt = nowIso()
  persist()
  return c.marketing
}

/**
 * 링크 복구 — 전화번호 + 그 번호로 접수돼 **입금까지 끝난** 주문번호 하나.
 * 어느 쪽이 틀렸는지는 말하지 않습니다(남의 번호를 더듬는 것을 돕지 않게).
 */
export function recoverKey({ phone, orderNo, getOrder }) {
  const k = phoneKey(phone)
  const order = k && orderNo ? getOrder(String(orderNo).trim().toUpperCase()) : null
  if (!order || phoneKey(order.customer?.phone) !== k) return null
  if (!PROVEN_STATES.includes(order.state)) return null
  const { customer } = upsertCustomer({ name: order.customer.name, phone: order.customer.phone, email: order.customer.email })
  // 입금 주문번호까지 아는 사람 = 본인. 잊은 PIN 은 여기서 함께 풀립니다.
  customer.pin = null
  return issueKey(customer.id, { verified: true, via: 'recover' })
}

/** 이 열쇠로 볼 수 있는 주문 — 확인된 열쇠면 전화번호 전체, 아니면 그 열쇠로 만든 것만 */
export function visibleOrders({ customer, entry }, orders) {
  return orders.filter((o) =>
    entry.verified ? phoneKey(o.customer?.phone) === customer.phoneKey : o.keyHash === entry.hash,
  )
}

/**
 * 운영자용 고객 목록 — 주문에서 전화번호별로 묶고 고객 기록을 얹습니다.
 * 기록이 아직 없는 번호(예전 주문)도 함께 보이며, 링크를 만들 때 기록이 생깁니다.
 */
export function listCustomers(orders = []) {
  const groups = new Map()
  for (const o of orders) {
    const k = phoneKey(o.customer?.phone)
    if (!k) continue
    const g = groups.get(k) ?? { phoneKey: k, orders: [] }
    g.orders.push(o)
    groups.set(k, g)
  }
  for (const c of store.byId.values()) {
    if (!groups.has(c.phoneKey)) groups.set(c.phoneKey, { phoneKey: c.phoneKey, orders: [] })
  }
  const rows = []
  for (const g of groups.values()) {
    const c = [...store.byId.values()].find((x) => x.phoneKey === g.phoneKey) ?? null
    const sorted = [...g.orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    const latest = sorted[0]
    const paid = sorted.filter((o) => PROVEN_STATES.includes(o.state))
    rows.push({
      id: c?.id ?? null,
      name: c?.name || latest?.customer?.name || '',
      phone: c?.phone || latest?.customer?.phone || g.phoneKey,
      email: c?.email || latest?.customer?.email || '',
      messenger: c?.messenger || latest?.customer?.messenger || '',
      pin: Boolean(c?.pin?.hash),
      orderCount: sorted.length,
      paidCount: paid.length,
      lastOrderAt: latest?.createdAt ?? null,
      firstOrderAt: sorted.at(-1)?.createdAt ?? null,
      totalKrw: paid.reduce((s, o) => s + (o.settlement?.finalTotalKrw ?? o.invoice?.amountKrw ?? 0), 0),
      marketing: c?.marketing ?? { agreed: false, at: null, source: null },
      keys: { total: c?.keys.length ?? 0, verified: c?.keys.filter((e) => e.verified).length ?? 0 },
      tags: c?.tags ?? [],
      notes: c?.notes ?? '',
      orderNos: sorted.map((o) => o.orderNo),
    })
  }
  return rows.sort((a, b) => String(b.lastOrderAt ?? '').localeCompare(String(a.lastOrderAt ?? '')))
}

/* ───────── PIN (선택) ───────── */
const PIN_RE = /^\d{4,6}$/
const PIN_MAX_FAIL = 5
const PIN_LOCK_MS = 15 * 60 * 1000
const pinHash = (pin, salt) => scryptSync(String(pin), salt, 32).toString('hex')

export const hasPin = (customer) => Boolean(customer?.pin?.hash)

export function setPin(customerId, pin) {
  const c = getCustomer(customerId)
  if (!c) throw new Error('고객을 찾을 수 없습니다.')
  if (!PIN_RE.test(String(pin ?? ''))) throw new Error('PIN 은 숫자 4~6자리입니다.')
  const salt = randomBytes(16).toString('hex')
  c.pin = { hash: pinHash(pin, salt), salt, setAt: nowIso(), failed: 0, lockedUntil: null }
  c.updatedAt = nowIso()
  persist()
  return true
}

export function clearPin(customerId) {
  const c = getCustomer(customerId)
  if (!c) return false
  c.pin = null
  c.updatedAt = nowIso()
  persist()
  return true
}

/** PIN 확인 — 5번 틀리면 15분 잠금. 결과: 'ok' | 'wrong' | 'locked' | 'none' */
export function checkPin(customerId, pin) {
  const c = getCustomer(customerId)
  if (!c || !hasPin(c)) return 'none'
  const now = Date.now()
  if (c.pin.lockedUntil && Date.parse(c.pin.lockedUntil) > now) return 'locked'
  const a = Buffer.from(pinHash(String(pin ?? ''), c.pin.salt), 'hex')
  const b = Buffer.from(c.pin.hash, 'hex')
  if (a.length === b.length && timingSafeEqual(a, b)) {
    c.pin.failed = 0; c.pin.lockedUntil = null
    persist()
    return 'ok'
  }
  c.pin.failed = (c.pin.failed ?? 0) + 1
  if (c.pin.failed >= PIN_MAX_FAIL) {
    c.pin.lockedUntil = new Date(now + PIN_LOCK_MS).toISOString()
    c.pin.failed = 0
  }
  persist()
  return c.pin.lockedUntil && Date.parse(c.pin.lockedUntil) > now ? 'locked' : 'wrong'
}

export function _resetCustomers() {
  store.byId.clear()
  store.counter = 0
}
