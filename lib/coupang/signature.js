/**
 * 쿠팡 파트너스 Open API HMAC 서명 (CEA algorithm)
 *
 *   message   = signed-date + HTTP메서드 + 경로 + 쿼리스트링(? 제외)
 *   signature = HMAC-SHA256(secretKey, message) 의 hex
 *   헤더       = Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=...
 *
 * signed-date 형식은 GMT 기준 yyMMddTHHmmssZ 입니다.
 *
 * ⚠️ SECRET KEY 는 절대 클라이언트로 내보내지 마세요.
 *    이 모듈은 서버(API Route)에서만 import 되어야 합니다.
 */

import crypto from 'node:crypto'

/** GMT 기준 yyMMddTHHmmssZ */
export function signedDate(now = new Date()) {
  //  2026-08-28T12:34:56.789Z  ->  260828T123456Z
  return `${now.toISOString().slice(2, 19).replace(/[-:]/g, '')}Z`
}

/**
 * @param {{method:string, path:string, query?:string, accessKey:string, secretKey:string, now?:Date}} params
 * @returns {string} Authorization 헤더 값
 */
export function buildAuthorization({ method, path, query = '', accessKey, secretKey, now }) {
  if (!accessKey || !secretKey) {
    throw new Error('쿠팡 파트너스 ACCESS_KEY / SECRET_KEY 가 설정되지 않았습니다.')
  }
  const datetime = signedDate(now)
  const message = datetime + method.toUpperCase() + path + query
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex')

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
}
