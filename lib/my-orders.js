/**
 * 이 브라우저에서 접수한 주문번호 기록 (localStorage, 클라이언트 전용)
 *
 * 로그인이 없으므로 고객이 "내 주문"을 다시 찾을 유일한 단서입니다.
 * 주문조회 페이지가 이 목록을 보여줘, 취소를 깜빡한 중복 주문도
 * 고객이 스스로 발견하고 정리할 수 있습니다.
 */

export const MY_ORDERS_KEY = 'kbeauty-hanoi:my-orders'

export function readMyOrders() {
  try {
    const list = JSON.parse(window.localStorage.getItem(MY_ORDERS_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((e) => e && typeof e.orderNo === 'string') : []
  } catch {
    return []
  }
}

export function rememberMyOrder(orderNo) {
  try {
    const next = [
      { orderNo, at: new Date().toISOString() },
      ...readMyOrders().filter((e) => e.orderNo !== orderNo),
    ].slice(0, 20)
    window.localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(next))
  } catch { /* 저장에 실패해도 주문 자체는 진행 */ }
}

/**
 * 개인 링크 열쇠 (localStorage) — /my 에서 내 주문 전체를 여는 열쇠입니다.
 * 서버는 해시만 가지므로, 이 브라우저와 고객이 저장해 둔 링크에만 평문이 있습니다.
 */
export const MY_KEY = 'kbeauty-hanoi:my-key'

export function readMyKey() {
  try { return window.localStorage.getItem(MY_KEY) || '' } catch { return '' }
}
export function saveMyKey(key) {
  try { if (key) window.localStorage.setItem(MY_KEY, String(key)) } catch { /* 무시 */ }
}
export function clearMyKey() {
  try { window.localStorage.removeItem(MY_KEY) } catch { /* 무시 */ }
}
