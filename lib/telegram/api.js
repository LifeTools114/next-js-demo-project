/**
 * 텔레그램 Bot API 발신 — 실패해도 주문 흐름을 절대 막지 않습니다.
 * (알림·서류 전송은 부가 기능이고, 실패는 telegram.jsonl 에 남습니다)
 */

import { TELEGRAM, telegramEnabled } from '../../config/telegram.js'
import { appendLog } from '../order/persist.js'

const base = () => `https://api.telegram.org/bot${TELEGRAM.botToken}`

async function call(method, payload) {
  if (!telegramEnabled()) return { ok: false, skipped: true }
  try {
    const res = await fetch(`${base()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!data?.ok) appendLog('telegram.jsonl', { event: 'send-failed', method, error: data?.description ?? res.status })
    return { ok: Boolean(data?.ok) }
  } catch (error) {
    appendLog('telegram.jsonl', { event: 'send-failed', method, error: error.message })
    return { ok: false, error: error.message }
  }
}

export const sendMessage = (chatId, text) =>
  call('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000) })

/** CSV 같은 텍스트 파일 전송 (multipart) */
export async function sendDocument(chatId, fileName, content, caption = '') {
  if (!telegramEnabled()) return { ok: false, skipped: true }
  try {
    const form = new FormData()
    form.append('chat_id', String(chatId))
    if (caption) form.append('caption', String(caption).slice(0, 1000))
    form.append('document', new Blob([content], { type: 'text/csv' }), fileName)
    const res = await fetch(`${base()}/sendDocument`, { method: 'POST', body: form })
    const data = await res.json().catch(() => null)
    if (!data?.ok) appendLog('telegram.jsonl', { event: 'send-failed', method: 'sendDocument', error: data?.description ?? res.status })
    return { ok: Boolean(data?.ok) }
  } catch (error) {
    appendLog('telegram.jsonl', { event: 'send-failed', method: 'sendDocument', error: error.message })
    return { ok: false, error: error.message }
  }
}
