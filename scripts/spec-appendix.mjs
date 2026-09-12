#!/usr/bin/env node
/**
 * 규정 부록 만들기 — docs/SPEC-APPENDIX.md
 *
 * docs/SPEC.md 는 요약입니다. 이 스크립트는 규정의 **정본인 설정 파일들을 원문 그대로**(주석·모든 키워드·고지 문장 포함)
 * 한 문서에 모으고, 앞부분에는 실제로 계산에 쓰이는 값(JSON)을 풀어 적습니다 — 다른 도구로 다시 만들 때 빠지는 것이 없게.
 *   npm run spec:appendix
 * ⚠️ config/costs.server.js(원가)도 들어갑니다 — 이 문서는 저장소 밖(고객·확장)으로 내보내지 마세요.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')
const out = []
const h = (level, text) => out.push(`\n${'#'.repeat(level)} ${text}\n`)

out.push('# 베트남 직구 — 규정 부록 (설정 원본 전체)\n')
out.push(`> \`npm run spec:appendix\` 로 만든 자동 문서 (${new Date().toISOString().slice(0, 10)}). 요약은 docs/SPEC.md, 운영 절차는 docs/OPERATIONS.md.`)
out.push('> 1부는 실제 계산에 쓰이는 값(JSON), 2부는 설정 파일 원문(주석·키워드·고지 문장 전부)입니다. 원가 파일이 포함되므로 저장소 밖으로 내보내지 마세요.\n')

// ── 1부: 값
h(2, '1부. 실제 값 (JSON)')
const MODULES = [
  ['config/tracks.js', ['TRACKS'], '두 가지 방식의 이름·문구'],
  ['config/shipping.js', ['SHIPPING', 'ITEM_SURCHARGES', 'CONSOLIDATION', 'RETURN_SHIPPING'], '국제배송비·지역·할증·합배송·반송'],
  ['config/fees.js', ['FEES', 'ORDER_MIN', 'SETTLEMENT'], '구매대행 수수료·최소 주문·정산 안내'],
  ['config/taxes.js', ['TAXES', 'DUTY_CATEGORIES', 'TAX_LABELS'], '세금·관세 품목군'],
  ['config/eligibility.js', ['DESTINATION', 'SAFE_TERMS', 'CONTEXT_MARKERS', 'BLOCK_RULES', 'MANUAL_QUOTE_RULES', 'CAUTION_RULES', 'WARN_RULES'], '배송 가능 여부 규칙 전체'],
  ['config/payment.js', ['PAYMENT', 'REFUND_DAYS', 'RETURN_POLICY', 'SETTLEMENT_RULES', 'REVENUE_RECOGNITION'], '결제·환불·정산·수익 인식'],
  ['config/quote.js', ['QUOTE'], '견적서'],
  ['config/sourcing.js', ['SOURCING', 'SOURCING_SIGNALS', 'OVERSEAS_NOTICE'], '상품 출처(국내·로켓직구·해외판매자)'],
  ['config/maintenance.js', ['MAINTENANCE', 'MAINTENANCE_POLICY', 'MAINTENANCE_EXCEPTIONS'], '쇼핑몰 점검 시간'],
  ['config/fx.js', ['FX'], '환율 기본값'],
  ['config/warehouse.js', ['WAREHOUSE'], '한국 창고 주소 (환경변수 없을 때 기본값)'],
  ['config/legal.js', ['BUSINESS', 'NOTICES', 'REQUIRED_CONSENTS', 'OPTIONAL_CONSENTS', 'SETTLEMENT_TOLERANCE_TEXT'], '법적 고지·동의 문장'],
  ['config/words.js', ['WORDS'], '쉬운 말 사전'],
  ['config/contact.js', ['CONTACT'], '문의 채널'],
  ['config/partners.js', ['SHOP_HOME', 'PARTNERS_NOTICE'], '쿠팡으로 가기 버튼'],
  ['config/catalog.js', null, '상품 카탈로그(있는 export 전부)'],
  ['config/coupang-patterns.js', ['COUPANG_PATTERNS'], '쿠팡 화면 문구·셀렉터(원격 설정)'],
  ['config/costs.server.js', null, '⚠️ 운영자 전용 원가'],
  ['lib/order/states.js', ['ORDER_STATES'], '주문 상태'],
]
for (const [file, names, label] of MODULES) {
  let mod
  try { mod = await import(new URL(file, root).href) } catch (e) { out.push(`\n### ${file} — 불러오기 실패: ${e.message}\n`); continue }
  h(3, `${file} — ${label}`)
  const keys = names ?? Object.keys(mod).filter((k) => typeof mod[k] !== 'function')
  for (const k of keys) {
    if (!(k in mod)) { out.push(`- \`${k}\`: (없음)`); continue }
    const v = mod[k]
    if (typeof v === 'function') continue
    out.push(`\n**${k}**\n`)
    out.push('```json\n' + JSON.stringify(v, null, 2) + '\n```')
  }
}

// ── 2부: 원문
h(2, '2부. 설정 파일 원문 (주석 포함)')
const SOURCES = [
  'config/tracks.js', 'config/shipping.js', 'config/fees.js', 'config/taxes.js', 'config/eligibility.js', 'config/payment.js',
  'config/quote.js', 'config/sourcing.js', 'config/maintenance.js', 'config/fx.js', 'config/warehouse.js', 'config/legal.js',
  'config/words.js', 'config/contact.js', 'config/partners.js', 'config/catalog.js', 'config/coupang-patterns.js',
  'config/assumptions.js', 'config/manifest.js', 'config/telegram.js', 'config/costs.server.js',
  'lib/order/states.js', 'lib/pricing/shipping.js', 'lib/pricing/surcharges.js', 'lib/pricing/domestic.js', 'lib/pricing/duty.js',
  'lib/pricing/landed.js', 'lib/eligibility.js', 'lib/weight/estimate.js', 'lib/weight/density.js', 'lib/order/settlement.js',
  'lib/order/access.js', 'lib/peek-jobs.js', 'lib/peek-result.js',
]
for (const file of SOURCES) {
  let src
  try { src = read(file) } catch { continue }
  h(3, file)
  out.push('```js\n' + src.replace(/```/g, '``​`') + '\n```')
}
writeFileSync(new URL('docs/SPEC-APPENDIX.md', root), out.join('\n') + '\n')
console.log(`docs/SPEC-APPENDIX.md 작성 — ${SOURCES.length}개 원문, ${MODULES.length}개 값 묶음`)
