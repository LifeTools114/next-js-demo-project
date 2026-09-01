/**
 * POST /api/telegram/webhook — 텔레그램 수신 (물류 파트너 연동)
 *
 * 파트너 방의 한 줄 메시지가 곧 업무 처리입니다:
 *   "YS-ECOM(박하노) 1.42kg"          → 입고 실측 (정산까지 자동)
 *   "HN2609010001 하노이 도착"        → 고객 위치 표시 갱신
 *   "배송일정 HN2609010001 9/3 오전"  → 배달 예정 등록
 *   "배달완료 HN2609010001"           → 배송 완료
 *
 * 보안:
 *   - setWebhook 의 secret_token 헤더 검증 (위조 차단)
 *   - 등록된 파트너 방(TELEGRAM_PARTNER_CHAT_ID)의 메시지만 처리
 *   - 허용 액션은 물류 4종뿐 — 입금 확인 등 돈 관련은 열지 않습니다
 *
 * 텔레그램은 200 이 아니면 같은 업데이트를 재전송하므로,
 * 인증 실패를 제외한 모든 경우 200 을 돌려줍니다.
 */

import { timingSafeEqual } from 'node:crypto'
import { TELEGRAM, telegramEnabled } from '../../../config/telegram.js'
import { handlePartnerMessage } from '../../../lib/telegram/handle.js'
import { sendMessage } from '../../../lib/telegram/api.js'
import { appendLog } from '../../../lib/order/persist.js'

function secretOk(req) {
  const expected = TELEGRAM.webhookSecret
  if (!expected) return null // 미설정 = 비활성
  const given = String(req.headers['x-telegram-bot-api-secret-token'] ?? '')
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  if (!telegramEnabled()) {
    return res.status(503).json({ error: '텔레그램 연동이 비활성 상태입니다. TELEGRAM_BOT_TOKEN 을 설정하세요.' })
  }
  const auth = secretOk(req)
  if (auth === null) {
    return res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET 이 설정되지 않았습니다.' })
  }
  if (!auth) return res.status(401).json({ error: '웹훅 시크릿이 올바르지 않습니다.' })

  const msg = req.body?.message ?? req.body?.edited_message
  const chatId = String(msg?.chat?.id ?? '')
  const text = msg?.text ?? ''

  // 파트너 방이 아니면 조용히 무시합니다 (봇이 다른 방에 초대돼도 무해).
  if (!chatId || chatId !== String(TELEGRAM.partnerChatId)) {
    if (chatId) appendLog('telegram.jsonl', { event: 'ignored-chat', chatId })
    return res.status(200).json({ ok: true })
  }

  const result = handlePartnerMessage(text)
  if (result.reply) {
    // 회신 실패는 로그로만 — 처리 자체는 이미 끝났습니다.
    await sendMessage(chatId, result.reply)
  }
  return res.status(200).json({ ok: true, handled: result.ok })
}
