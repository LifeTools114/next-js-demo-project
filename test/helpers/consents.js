/**
 * 테스트용 필수 동의 묶음
 *
 * 실제 접수는 고지 동의를 모두 받아야 통과합니다(config/legal.js).
 * 테스트는 그 절차를 매번 나열하는 대신 이 상수를 씁니다.
 */
import { REQUIRED_CONSENTS } from '../../config/legal.js'

export const ALL_CONSENTS = REQUIRED_CONSENTS.map((c) => c.id)
