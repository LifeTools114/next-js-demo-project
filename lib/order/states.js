/**
 * 주문 상태 머신 (선결제 후 정산)
 *
 *   REQUESTED ─▶ AWAITING_PAYMENT ─▶ PAID ─▶ PURCHASING ─▶ PURCHASED
 *                                                              │
 *        DELIVERED ◀─ SHIPPED ◀─ SETTLED ◀─ SETTLEMENT_DUE ◀─ IN_WAREHOUSE
 *                                    ▲                            │
 *                                    └──── 차액이 허용오차 이내 ────┘
 *
 * 각 상태가 두 거래 중 어느 쪽에 속하는지(track)를 함께 표시합니다.
 * 고객 화면과 운영자 화면이 서로 다른 track 을 봐야 하기 때문입니다.
 */

export const ORDER_STATES = {
  REQUESTED: {
    label: '주문 접수',
    track: 'customer',
    description: '주문이 접수되었습니다. 청구서를 발행합니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '신청 완료', description: '신청이 접수되었습니다. 보내실 금액을 안내해 드립니다.' },
  },
  AWAITING_PAYMENT: {
    label: '입금 대기',
    track: 'customer',
    description: '안내된 계좌로 입금해 주세요. 입금 확인 후 매입을 시작합니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '보내주시면 시작해요', description: '아래 계좌로 보내주세요. 확인되면 바로 시작합니다.' },
  },
  PAID: {
    label: '결제 완료',
    track: 'customer',
    description: '입금이 확인되었습니다. 곧 한국에서 상품을 구매합니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '돈 받았습니다', description: '확인했습니다. 곧 한국에서 상품을 챙깁니다.' },
  },
  PURCHASING: {
    label: '한국 구매 중',
    track: 'procurement',
    description: '고객님을 대신해 쿠팡에서 상품을 구매하고 있습니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '한국에서 사는 중', description: '고객님 대신 쿠팡에서 상품을 사고 있습니다.' },
  },
  PURCHASED: {
    label: '구매 완료',
    track: 'procurement',
    description: '구매가 완료되어 한국 물류창고로 배송 중입니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '샀습니다', description: '구매를 마치고 한국 창고로 오는 중입니다.' },
  },
  IN_WAREHOUSE: {
    label: '창고 입고·실측',
    track: 'procurement',
    description: '한국 창고에 입고되어 실제 무게를 측정했습니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '한국 창고 도착', description: '창고에 도착해 무게를 달았습니다.' },
  },
  SETTLEMENT_DUE: {
    label: '차액 정산 대기',
    track: 'customer',
    description: '실측 무게에 따른 차액을 정산합니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '무게 확인 — 차액 정리 중', description: '실제로 달아본 무게로 금액을 맞춰 드립니다.' },
  },
  SETTLED: {
    label: '정산 완료',
    track: 'customer',
    description: '최종 금액이 확정되었습니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '금액 확정', description: '최종 금액이 정해졌습니다.' },
  },
  SHIPPED: {
    label: '국제배송 중',
    track: 'procurement',
    description: '하노이로 발송되었습니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '하노이로 가는 중', description: '하노이로 보냈습니다.' },
  },
  DELIVERED: {
    label: '배송 완료',
    track: 'procurement',
    description: '배송이 완료되었습니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '받으셨습니다', description: '배송이 끝났습니다.' },
  },
  CANCELLED: {
    label: '취소',
    track: 'customer',
    description: '주문이 취소되었습니다.',
    /** 고객 화면에 쓰는 쉬운 말 (운영자·물류사 문서는 위 label 그대로) */
    plain: { label: '취소됨', description: '신청이 취소되었습니다.' },
  },
}

/** 허용된 상태 전이 */
export const TRANSITIONS = {
  REQUESTED: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  // 매입 전까지는 전액 환불 취소가 가능합니다.
  PAID: ['PURCHASING', 'CANCELLED'],
  // 매입을 시작한 뒤에는 쿠팡 반품 절차가 필요하므로 자동 취소를 막습니다.
  PURCHASING: ['PURCHASED'],
  PURCHASED: ['IN_WAREHOUSE'],
  // 실측 결과에 따라 정산이 필요하면 SETTLEMENT_DUE, 아니면 바로 SETTLED
  IN_WAREHOUSE: ['SETTLEMENT_DUE', 'SETTLED'],
  SETTLEMENT_DUE: ['SETTLED'],
  SETTLED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

/** 고객이 결제해야 하는 상태 */
export const PAYABLE_STATES = ['AWAITING_PAYMENT', 'SETTLEMENT_DUE']

/** 더 이상 변하지 않는 상태 */
export const TERMINAL_STATES = ['DELIVERED', 'CANCELLED']

export class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`'${ORDER_STATES[from]?.label ?? from}' 상태에서 '${ORDER_STATES[to]?.label ?? to}' (으)로 변경할 수 없습니다.`)
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to))
}

export function assertTransition(from, to) {
  if (!ORDER_STATES[to]) throw new Error(`알 수 없는 상태입니다: ${to}`)
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

/** 진행률 (고객 화면 표시용) — 취소는 제외 */
const PROGRESS_ORDER = [
  'REQUESTED', 'AWAITING_PAYMENT', 'PAID', 'PURCHASING', 'PURCHASED',
  'IN_WAREHOUSE', 'SETTLEMENT_DUE', 'SETTLED', 'SHIPPED', 'DELIVERED',
]

export function progressOf(state) {
  const i = PROGRESS_ORDER.indexOf(state)
  if (i < 0) return 0
  return Math.round(((i + 1) / PROGRESS_ORDER.length) * 100)
}

export { PROGRESS_ORDER }
