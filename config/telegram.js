/**
 * 텔레그램 연동 설정 — 물류 파트너·운영자 채널
 *
 * 파트너와의 소통이 텔레그램이므로 봇 하나로 양방향을 잇습니다:
 *   수신: 파트너 방 메시지(입고 무게·현황·배달완료) → 주문 자동 처리
 *   발신: 일괄 발송 시 적하목록 CSV 전송, 운영자 알림
 *
 * 준비 (docs/OPERATIONS.md 텔레그램 절 참조):
 *   1. @BotFather 로 봇 생성 → TELEGRAM_BOT_TOKEN
 *   2. 봇을 파트너 방에 초대, 방 ID 확인 → TELEGRAM_PARTNER_CHAT_ID
 *   3. 웹훅 등록: npm run telegram:webhook (BASE_URL 필요)
 *
 * 토큰이 없으면 연동 전체가 조용히 꺼집니다 — 다른 기능에 영향 없음.
 */

const env = (key) => process.env[key] || ''

export const TELEGRAM = {
  botToken: env('TELEGRAM_BOT_TOKEN'),
  /** 웹훅 위조 방지 — setWebhook 의 secret_token 과 같아야 합니다 */
  webhookSecret: env('TELEGRAM_WEBHOOK_SECRET'),
  /** 물류 파트너 방 — 여기서 온 메시지만 주문 처리로 이어집니다 */
  partnerChatId: env('TELEGRAM_PARTNER_CHAT_ID'),
  /** 운영자 방(선택) — 상태 전이 알림을 받습니다 */
  operatorChatId: env('TELEGRAM_OPERATOR_CHAT_ID'),
}

export const telegramEnabled = () => Boolean(TELEGRAM.botToken)
