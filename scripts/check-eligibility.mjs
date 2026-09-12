#!/usr/bin/env node
/**
 * 상품명 목록으로 배송 가능 여부를 한 번에 봅니다 — 운영자가 100개씩 검토할 때 (26-09-12).
 *
 *   npm run check:items -- "샤넬 넘버5 오드퍼퓸 100ml" "참이슬 소주 20병"
 *   npm run check:items -- --file 목록.txt        (한 줄에 하나, 「상품명 | 카테고리경로」 꼴도 됨)
 *
 * 출력: ✅ 가능 · ⚠️ 가능(안내 붙음) · 📞 상담(자동 견적 없음) · ⛔ 차단 — 사유와 걸린 낱말
 * 판정 규칙은 config/eligibility.js (사이트·확장이 같은 규칙을 씁니다). 고치면 npm run build:ext 로 확장 번들도 갱신.
 */
import { readFileSync } from 'node:fs'
import { checkEligibility } from '../lib/eligibility.js'

const args = process.argv.slice(2)
let names = []
const fileAt = args.indexOf('--file')
if (fileAt >= 0) {
  const file = args[fileAt + 1]
  if (!file) { console.error('--file 뒤에 파일 이름이 필요합니다'); process.exit(2) }
  names = readFileSync(file, 'utf8').split(/\r?\n/)
  names.push(...args.filter((_, i) => i !== fileAt && i !== fileAt + 1))
} else {
  names = args
}
names = names.map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
if (names.length === 0) {
  console.log('쓰는 법: npm run check:items -- "상품명1" "상품명2"   또는   npm run check:items -- --file 목록.txt')
  process.exit(0)
}

const counts = { ok: 0, caution: 0, consult: 0, blocked: 0 }
for (const line of names) {
  const [productName, categoryPath = ''] = line.split('|').map((s) => s.trim())
  const r = checkEligibility({ productName, categoryPath, price: 30000, quantity: 1 })
  let mark
  let why = ''
  if (r.shippable === false) { mark = '⛔ 차단'; counts.blocked += 1; why = `${r.label} — ${r.reason ?? ''} [${r.matchedKeyword ?? r.ruleId ?? ''}]` }
  else if (r.autoQuote === false) { mark = '📞 상담'; counts.consult += 1; why = `${r.label} — ${r.reason ?? ''}` }
  else if (r.warnings?.length) { mark = '⚠️ 가능'; counts.caution += 1; why = r.warnings.map((w) => w.message ?? w.id).join(' / ') }
  else { mark = '✅ 가능'; counts.ok += 1 }
  console.log(`${mark}  ${productName}${categoryPath ? `  (${categoryPath})` : ''}${why ? `\n        ${why}` : ''}`)
}
console.log(`\n가능 ${counts.ok} · 가능(안내) ${counts.caution} · 상담 ${counts.consult} · 차단 ${counts.blocked}  / ${names.length}개`)
