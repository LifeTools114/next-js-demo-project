/**
 * 텔레그램 웹훅 등록 — 1회 실행 (npm run telegram:webhook)
 *
 * 필요 env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, BASE_URL
 * BASE_URL 은 공개 HTTPS 주소여야 합니다 (예: https://hanoi.example.com).
 */

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '')

if (!token || !secret || !baseUrl) {
  console.error('TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, BASE_URL 을 모두 설정하세요.')
  process.exit(1)
}

const url = `${baseUrl}/api/telegram/webhook`
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url,
    secret_token: secret,
    // 텍스트 메시지만 받습니다 — 불필요한 업데이트를 줄입니다.
    allowed_updates: ['message', 'edited_message'],
  }),
})
const data = await res.json()
if (data.ok) console.log(`✓ 웹훅 등록 완료: ${url}`)
else {
  console.error('✗ 등록 실패:', data.description)
  process.exit(1)
}
