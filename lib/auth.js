/**
 * 운영자 인증 (최소 구현)
 *
 * 운영자 API는 매입 원가·마진·고객 개인정보를 다루므로 반드시 보호해야 합니다.
 * ADMIN_TOKEN 환경변수를 설정하고 x-admin-token 헤더로 전달하세요.
 *
 * ⚠️ 프로덕션에서는 실제 인증(세션/OAuth)과 감사 로그로 교체하세요.
 *    ADMIN_TOKEN 이 없으면 개발 환경에서만 통과시키고, 프로덕션에서는 차단합니다.
 */

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UnauthorizedError'
    this.status = 401
  }
}

export function requireAdmin(req) {
  const expected = process.env.ADMIN_TOKEN || ''

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedError(
        'ADMIN_TOKEN 이 설정되지 않아 운영자 기능을 사용할 수 없습니다. 환경변수를 설정하세요.',
      )
    }
    return { operator: 'dev', unprotected: true }
  }

  const provided = req.headers['x-admin-token']
  if (provided !== expected) {
    throw new UnauthorizedError('운영자 인증에 실패했습니다.')
  }
  return { operator: req.headers['x-admin-user'] || 'admin', unprotected: false }
}

/**
 * "운영자 뷰를 보여줘도 되는가" — requireAdmin 과 달리 절대 기본 통과가 없습니다.
 *
 * requireAdmin 은 토큰 미설정 시 개발 편의로 통과시키지만, 그 규칙을 뷰 선택에
 * 그대로 쓰면 개발 서버에서 **모든 고객 조회가 원가·마진이 든 운영자 뷰**로
 * 나갑니다 (파일럿을 dev 로 돌리면 실제 고객에게 누출). 뷰 승격은 오직
 * "토큰이 설정되어 있고, 요청이 그 토큰을 제시"했을 때만.
 */
export function isAdminRequest(req) {
  const expected = process.env.ADMIN_TOKEN || ''
  if (!expected) return false
  return req.headers['x-admin-token'] === expected
}
