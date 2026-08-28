/**
 * POST /api/orders/:id/action   운영자 전용 상태 전이
 * body: { action, payload }
 *
 * 상태 전이는 반드시 서버에서만 일어나며, 허용되지 않은 전이는 거부됩니다.
 * (예: 결제 확인 없이 매입으로 넘어가는 것을 막습니다)
 */

import {
  confirmPayment, startPurchase, recordPurchase, recordWeighing,
  applySettlement, closeSettlement, markShipped, markDelivered, cancelOrder,
  getOrder, orderView,
} from '../../../../lib/order/store'
import { requireAdmin, UnauthorizedError } from '../../../../lib/auth'
import { InvalidTransitionError } from '../../../../lib/order/states'
import { checkAction } from '../../../../lib/maintenance'
import { DESTINATION } from '../../../../config/eligibility'

const ACTIONS = {
  confirmPayment: (id, p, op) => confirmPayment(id, { ...p, confirmedBy: p.confirmedBy ?? op }),
  startPurchase: (id, p, op) => startPurchase(id, op),
  recordPurchase: (id, p, op) => recordPurchase(id, { ...p, by: op }),
  recordWeighing: (id, p, op) => recordWeighing(id, { ...p, by: op }),
  applySettlement: (id, p, op) => applySettlement(id, op),
  closeSettlement: (id, p, op) => closeSettlement(id, { ...p, by: op }),
  markShipped: (id, p, op) => markShipped(id, { ...p, by: op }),
  markDelivered: (id, p, op) => markDelivered(id, op),
  cancelOrder: (id, p, op) => cancelOrder(id, { ...p, by: op }),
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  let operator
  try {
    operator = requireAdmin(req).operator
  } catch (e) {
    return res.status(e instanceof UnauthorizedError ? e.status : 401).json({ error: e.message })
  }

  const { action, payload = {} } = req.body ?? {}
  const handlerFn = ACTIONS[action]
  if (!handlerFn) {
    return res.status(400).json({
      error: `알 수 없는 작업입니다: ${action}`,
      available: Object.keys(ACTIONS),
    })
  }

  const order = getOrder(req.query.id)
  if (!order) {
    return res.status(404).json({ error: '주문을 찾을 수 없습니다.' })
  }

  /**
   * 점검 시간 가드 — 쿠팡에서 실제로 결제하는 액션만 막습니다.
   *
   * 예외:
   *   override=true      운영자가 확인하고 강제 실행 (쿠팡이 실제로는 멀쩡할 수 있음)
   *   이미 PURCHASING 상태 중단하면 쿠팡엔 결제됐는데 우리 기록은 없는 상태가 됨
   */
  const COUPANG_DEPENDENT = ['startPurchase', 'recordPurchase']
  if (COUPANG_DEPENDENT.includes(action)) {
    const gate = checkAction('purchase', {
      country: DESTINATION.country,
      override: payload.override === true,
      inFlight: action === 'recordPurchase' && order.state === 'PURCHASING',
      orderNo: order.orderNo,
    })
    if (!gate.allowed) {
      return res.status(503).json({
        error: gate.message,
        maintenance: true,
        retryAfterMinutes: gate.retryAfterMinutes,
        retryAt: gate.retryAt,
        hint: '운영자 확인 후 강제로 진행하려면 override: true 를 함께 보내세요.',
      })
    }
    if (gate.exception) {
      res.setHeader('X-Maintenance-Exception', gate.exception)
    }
  }

  try {
    const order = handlerFn(req.query.id, payload, operator)
    return res.status(200).json({ order: orderView(order) })
  } catch (error) {
    // 허용되지 않은 상태 전이는 409 (충돌) 로 구분합니다.
    const status = error instanceof InvalidTransitionError ? 409 : 400
    return res.status(status).json({ error: error.message })
  }
}
