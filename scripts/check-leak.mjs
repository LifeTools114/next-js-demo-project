/**
 * 확장 번들 누출 검사
 *
 * 확장프로그램 파일은 사용자가 열어볼 수 있으므로,
 * 원가·마진·시크릿이 번들에 박히면 그대로 공개됩니다.
 * 실제로 costPerKgUsd:7 이 번들에 박혔던 적이 있어 빌드마다 검사합니다.
 */
import fs from 'node:fs'

const BUNDLE = 'extension/vendor/calc.js'
const FORBIDDEN = [
  { pattern: 'costPerKgUsd', why: '물류사 원가' },
  { pattern: 'shippingPerKgUsd', why: '물류사 원가' },
  { pattern: 'consolidationHandlingUsd', why: '합배송 원가' },
  { pattern: 'marginPerKgUsd', why: 'kg당 마진' },
  { pattern: 'shippingMargin', why: '마진 계산 함수' },
  { pattern: 'COUPANG_SECRET_KEY', why: '파트너스 시크릿' },
  { pattern: 'COUPANG_ACCESS_KEY', why: '파트너스 액세스 키' },
  { pattern: 'HmacSHA256', why: '서명 로직' },
  { pattern: 'ADMIN_TOKEN', why: '운영자 토큰' },
]

if (!fs.existsSync(BUNDLE)) {
  console.error(`✗ 번들이 없습니다: ${BUNDLE}`)
  process.exit(1)
}

const src = fs.readFileSync(BUNDLE, 'utf8')
const leaks = FORBIDDEN.filter(({ pattern }) => src.includes(pattern))

if (leaks.length > 0) {
  console.error('✗ 확장 번들 누출 발견:')
  for (const l of leaks) console.error(`    ${l.pattern} (${l.why})`)
  console.error('\n  원인: lib/extension-entry.js 가 해당 값을 담은 모듈을 import 하고 있습니다.')
  console.error('  해결: 서버 전용 모듈(config/costs.server.js 등)로 분리하세요.')
  process.exit(1)
}

console.log(`✓ 확장 번들 누출 없음 (${FORBIDDEN.length}개 패턴, ${(src.length / 1024).toFixed(1)}KB)`)
