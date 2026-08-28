/**
 * 입금 자동 대조 — "입금 확인"을 사람 손에서 떼어냅니다.
 *
 * 은행 입금 웹훅(베트남: Casso·SePay 계열, 한국: 오픈뱅킹·가상계좌 등)이
 * 보내주는 입금 내역을 주문과 대조합니다. 통화는 KRW·VND 둘 다 받습니다.
 *
 * 대조 규칙:
 *   1. 이체 메모에서 주문번호(HN + 10자리)를 찾는다 — 없으면 대조 불가
 *   2. 주문이 결제 대기 상태여야 한다 (첫 입금 또는 차액 입금)
 *   3. 입금액이 청구액 이상이어야 확인 — 부족분은 자동 확인하지 않고
 *      검토 큐로 보낸다 (초과분은 확인하되 기록을 남긴다)
 *
 * 판정만 하는 순수 모듈입니다. 상태 전이는 웹훅 라우트가 수행합니다.
 */

import { summarize } from '../order/ledger.js'
import { FX } from '../../config/fx.js'

/** 이체 메모 어딘가에서 주문번호를 찾습니다 (앞뒤 잡문 허용) */
export function extractOrderNo(text) {
  const m = String(text ?? '').toUpperCase().match(/HN\d{10}/)
  return m ? m[0] : null
}

const roundVnd = (raw) => Math.round(raw / FX.vndRoundTo) * FX.vndRoundTo

/**
 * 이 주문이 지금 받아야 할 금액.
 * 첫 청구(invoice)와 실측 차액(settlement)을 모두 다룹니다.
 */
export function dueFor(order) {
  if (order.state === 'AWAITING_PAYMENT') {
    return { kind: 'invoice', krw: order.invoice.amountKrw, vnd: order.invoice.amountVnd }
  }
  if (order.state === 'SETTLEMENT_DUE') {
    const balanceKrw = summarize(order.ledger, order.fx.effectiveRate).balanceKrw
    if (balanceKrw > 0) {
      // 주문 시점에 고정한 환율로 환산해야 청구서와 같은 금액이 나옵니다.
      return { kind: 'settlement', krw: balanceKrw, vnd: roundVnd(balanceKrw * order.fx.effectiveRate) }
    }
  }
  return null
}

/**
 * @param {{amount:number, currency:'KRW'|'VND', memo:string}} deposit
 * @param {Array} orders 전체 주문 (스토어의 listOrders())
 */
export function matchDeposit(deposit, orders) {
  const amount = Number(deposit?.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { matched: false, reason: 'invalid-amount' }
  }
  const currency = String(deposit?.currency ?? '').toUpperCase()
  if (currency !== 'KRW' && currency !== 'VND') {
    return { matched: false, reason: 'unsupported-currency', currency }
  }

  const orderNo = extractOrderNo(deposit?.memo)
  if (!orderNo) return { matched: false, reason: 'no-order-no', memo: deposit?.memo ?? null }

  const order = orders.find((o) => o.orderNo === orderNo)
  if (!order) return { matched: false, reason: 'order-not-found', orderNo }

  const due = dueFor(order)
  if (!due) return { matched: false, reason: 'not-payable', orderNo, state: order.state }

  const expected = currency === 'KRW' ? due.krw : due.vnd
  if (amount < expected) {
    return { matched: false, reason: 'underpaid', orderNo, expected, amount, currency }
  }

  return {
    matched: true,
    kind: due.kind,
    orderId: order.id,
    orderNo,
    expected,
    amount,
    currency,
    surplus: amount - expected,
  }
}
