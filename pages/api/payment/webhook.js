/**
 * POST /api/payment/webhook?currency=VND — 입금 자동 확인
 *
 * 은행 입금 알림 서비스가 이 주소로 입금 내역을 쏘면, 이체 메모의
 * 주문번호와 금액을 대조해 결제 확인(또는 차액 정산 종료)까지 자동으로
 * 처리합니다. 운영자는 대조에 실패한 건만 봅니다 (.data/payment-review.jsonl).
 *
 * 정규화된 계약 (제공사 어댑터는 이 형태로 변환해 보내면 됩니다):
 *   { amount: number, currency?: 'KRW'|'VND', memo: string, txId?, paidAt? }
 *   - memo 별칭: content / description / remark (Casso·SePay 계열 호환)
 *   - currency 가 본문에 없으면 쿼리 ?currency= 로 지정 (제공사별 URL 로 구분)
 *
 * 인증: 환경변수 PAYMENT_WEBHOOK_TOKEN 을 X-Webhook-Token 헤더(권장) 또는
 * ?token= 쿼리로. 토큰이 미설정이면 엔드포인트 자체가 비활성입니다.
 *
 * 응답은 대조 실패여도 200 입니다 — 웹훅 제공사가 4xx/5xx 를 재시도하며
 * 같은 실패를 반복 전송하는 것을 막기 위해서입니다.
 */

// 테스트가 이 라우트를 Node 에서 직접 import 하므로 확장자를 명시합니다.
import { timingSafeEqual } from 'node:crypto'
import { listOrders, confirmPayment, closeSettlement } from '../../../lib/order/store.js'
import { matchDeposit } from '../../../lib/payment/deposit-match.js'
import { appendLog } from '../../../lib/order/persist.js'

function tokenOk(req) {
  const expected = process.env.PAYMENT_WEBHOOK_TOKEN || ''
  if (!expected) return null // 미설정 = 비활성
  const given = String(req.headers['x-webhook-token'] ?? req.query.token ?? '')
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const auth = tokenOk(req)
  if (auth === null) {
    return res.status(503).json({ error: '입금 웹훅이 비활성 상태입니다. PAYMENT_WEBHOOK_TOKEN 을 설정하세요.' })
  }
  if (!auth) return res.status(401).json({ error: '웹훅 토큰이 올바르지 않습니다.' })

  const body = req.body ?? {}
  const deposit = {
    amount: body.amount ?? body.transferAmount,
    currency: body.currency ?? req.query.currency,
    memo: body.memo ?? body.content ?? body.description ?? body.remark ?? '',
  }

  const result = matchDeposit(deposit, listOrders())

  if (!result.matched) {
    // 사람이 볼 검토 큐 — 부족 입금·미확인 주문번호가 여기 쌓입니다.
    appendLog('payment-review.jsonl', { event: 'unmatched-deposit', ...deposit, ...result })
    return res.status(200).json({ matched: false, reason: result.reason })
  }

  try {
    if (result.kind === 'invoice') {
      confirmPayment(result.orderId, {
        confirmedBy: 'auto-webhook',
        reference: body.txId ?? `webhook-${Date.now()}`,
        paidAt: body.paidAt,
      })
    } else {
      closeSettlement(result.orderId, { by: 'auto-webhook', memo: '차액 입금 (자동 확인)' })
    }
  } catch (error) {
    // 동시 처리 등으로 상태가 이미 넘어간 경우 — 검토 큐로만 남깁니다.
    appendLog('payment-review.jsonl', { event: 'confirm-failed', ...deposit, orderNo: result.orderNo, error: error.message })
    return res.status(200).json({ matched: false, reason: 'confirm-failed' })
  }

  if (result.surplus > 0) {
    // 초과 입금은 자동 확인은 하되 흔적을 남깁니다 (환불·문의 대비).
    appendLog('payment-review.jsonl', {
      event: 'overpaid', orderNo: result.orderNo, surplus: result.surplus, currency: result.currency,
    })
  }

  return res.status(200).json({
    matched: true,
    orderNo: result.orderNo,
    kind: result.kind,
    surplus: result.surplus,
  })
}
