/**
 * 물류사 청구서(DEBIT NOTE) 업로드 — PDF 에서 무게·운송정보만 읽어옵니다.
 *
 * 운영자 흐름(26-09-01): 관리자 화면에서 청구서를 업로드하면 최종 견적서가
 * 나옵니다. 여기서는 그 근거가 되는 추출·파싱을 검증합니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { extractPdfText } from '../lib/debit-note/extract-text.js'
import { parseDebitNote } from '../lib/debit-note/parse.js'

/** S1 청구서와 같은 문구를 담은 최소 PDF 를 만듭니다. (압축 여부 선택) */
function makePdf(lines, { compress = false } = {}) {
  const body = ['BT /F1 10 Tf 40 800 Td 12 TL']
  for (const line of lines) body.push(`(${line.replace(/([()\\])/g, '\\$1')}) Tj T*`)
  body.push('ET')
  const content = body.join('\n')
  const stream = compress ? zlib.deflateSync(Buffer.from(content, 'latin1')) : Buffer.from(content, 'latin1')

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // 콘텐츠 스트림
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')]
  objs.forEach((obj, i) => {
    const n = i + 1
    if (n === 4) {
      const dict = `<< /Length ${stream.length}${compress ? ' /Filter /FlateDecode' : ''} >>`
      chunks.push(Buffer.from(`${n} 0 obj\n${dict}\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream\nendobj\n', 'latin1'))
    } else {
      chunks.push(Buffer.from(`${n} 0 obj\n${obj}\nendobj\n`, 'latin1'))
    }
  })
  chunks.push(Buffer.from('trailer << /Root 1 0 R /Size 6 >>\n%%EOF', 'latin1'))
  return Buffer.concat(chunks)
}

// 실제 S1 청구서에 적혀 있는 줄들 (금액 줄 포함 — 읽히면 안 됩니다)
const S1_LINES = [
  'S1 EXPRESS CO.,LTD.',
  'DEBIT NOTE',
  'Invoice No : HINV26080754   Billing Date : 2026-08-19',
  'HAWB No : S1K452019   E.T.D : 2026-08-18   Package : 1 CARTON',
  'MAWB No : 18043690426   E.T.A : 2026-08-19   C/Weight : 3.0 KGS',
  'Departure : SEOUL,KOREA   Flight : KE0361',
  'Destination : HANOI, VIETNAM',
  'FREIGHT CHARGE  USD  26,490.00  KG  7.000  3  21.00  556,290',
  'Total (VND) : 556,290',
]

test('PDF 에서 텍스트를 추출한다 — 무압축·Flate 압축 모두', () => {
  for (const compress of [false, true]) {
    const text = extractPdfText(makePdf(S1_LINES, { compress }))
    assert.ok(text.includes('DEBIT NOTE'), `compress=${compress} 텍스트 추출 실패`)
    assert.ok(text.includes('C/Weight : 3.0 KGS'))
  }
})

test('PDF 가 아니면 빈 문자열 (이미지 업로드 시 수동 입력으로 넘어감)', () => {
  assert.equal(extractPdfText(Buffer.from([0x89, 0x50, 0x4e, 0x47])), '')
  assert.equal(extractPdfText(Buffer.from('그냥 텍스트')), '')
})

test('청구서에서 실측 무게와 운송 정보를 읽는다', () => {
  const parsed = parseDebitNote(extractPdfText(makePdf(S1_LINES, { compress: true })))
  assert.equal(parsed.chargeableWeightKg, 3.0)
  assert.equal(parsed.hawbNo, 'S1K452019')
  assert.equal(parsed.mawbNo, '18043690426')
  assert.equal(parsed.flight, 'KE0361')
  assert.equal(parsed.etd, '2026-08-18')
  assert.equal(parsed.eta, '2026-08-19')
  assert.equal(parsed.invoiceNo, 'HINV26080754')
  assert.equal(parsed.package, '1 CARTON')
})

test('금액(당사 원가)은 읽지 않는다 — 고객 문서 오염 방지', () => {
  const parsed = parseDebitNote(extractPdfText(makePdf(S1_LINES, { compress: true })))
  const dump = JSON.stringify(parsed)
  for (const cost of ['556,290', '556290', '26,490', '7.000', '21.00']) {
    assert.ok(!dump.includes(cost), `원가 ${cost} 가 추출 결과에 남았습니다`)
  }
  // 'chargeableWeight' 는 청구무게(무게 용어)라 금액 패턴에서 제외합니다.
  assert.deepEqual(
    Object.keys(parsed).filter((k) => /amount|price|total|fee|usd|vnd|krw|cost/i.test(k)),
    [], '금액 성격의 필드가 있으면 안 됩니다',
  )
})

test('표기가 흔들려도 무게를 찾는다', () => {
  assert.equal(parseDebitNote('Chargeable Weight: 12.5 KGS').chargeableWeightKg, 12.5)
  assert.equal(parseDebitNote('C.W : 4.20 KG').chargeableWeightKg, 4.2)
  assert.equal(parseDebitNote('청구중량 : 7.5 kg').chargeableWeightKg, 7.5)
  assert.equal(parseDebitNote('C/W: 2.0').chargeableWeightKg, 2.0)
})

test('날짜 표기 변형을 정규화한다', () => {
  assert.equal(parseDebitNote('E.T.A : 19-Aug-2026').eta, '2026-08-19')
  assert.equal(parseDebitNote('ETD : 18/08/2026').etd, '2026-08-18')
  assert.equal(parseDebitNote('E.T.D : 2026.08.18').etd, '2026-08-18')
})

test('무게를 못 찾으면 null — 운영자 수동 입력으로 넘어갑니다', () => {
  const parsed = parseDebitNote('DEBIT NOTE 총액 556,290 VND')
  assert.equal(parsed.chargeableWeightKg, null)
  assert.deepEqual(parsed.found, [])
})
