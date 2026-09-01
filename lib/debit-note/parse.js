/**
 * 물류사 청구서(DEBIT NOTE) 항목 추출
 *
 * 최종 견적서에 필요한 값만 뽑습니다: 실측 무게와 운송 정보.
 *
 * ⚠️ 금액(단가·USD·VND)은 **일부러 읽지 않습니다.** 그 값은 당사 원가라
 *    고객 문서에 섞이면 안 되고, 주문에도 남기지 않습니다. 무게만 우리
 *    요금표에 넣어 다시 계산합니다. (test/debit-note.test.js 가 검증)
 */

const num = (s) => Number.parseFloat(String(s).replace(/,/g, ''))

/** "2026-08-19", "19-Aug-2026", "19/08/2026" → "2026-08-19" */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
function normalizeDate(raw) {
  const s = String(raw ?? '').trim()
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
  m = s.match(/(\d{1,2})[-\s/]([A-Za-z]{3})[a-z]*[-\s/](\d{4})/)
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()]
    if (mm) return `${m[3]}-${String(mm).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  m = s.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return ''
}

const first = (text, patterns) => {
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return m[1].trim()
  }
  return ''
}

/**
 * 청구서 텍스트에서 필요한 값을 뽑습니다.
 * @param {string} text extractPdfText 결과 (또는 붙여넣은 텍스트)
 * @returns {{chargeableWeightKg:number|null, invoiceNo, hawbNo, mawbNo, flight, etd, eta, package, found:string[]}}
 */
export function parseDebitNote(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ')

  // C/Weight : 3.0 KGS — 표기 흔들림(C.W, Chargeable Weight, 청구중량)까지 흡수
  const kgRaw = first(t, [
    /C\s*[/.]?\s*W(?:eight|GT)?\s*[:：]?\s*([\d,.]+)\s*K\s*G/i,
    /Chargeable\s*Weight\s*[:：]?\s*([\d,.]+)\s*K\s*G/i,
    /(?:청구|실측)\s*중량\s*[:：]?\s*([\d,.]+)\s*(?:kg|KG)/i,
    /\bC\s*[/.]?\s*W\s*[:：]\s*([\d,.]+)\b/i,
  ])
  const kg = kgRaw ? num(kgRaw) : null

  const parsed = {
    chargeableWeightKg: Number.isFinite(kg) && kg > 0 && kg < 2000 ? kg : null,
    invoiceNo: first(t, [/Invoice\s*No\.?\s*[:：]?\s*([A-Z0-9][A-Z0-9-]{4,29})/i]),
    hawbNo: first(t, [/H\s*AWB\s*No\.?\s*[:：]?\s*([A-Z0-9][A-Z0-9-]{4,29})/i]),
    mawbNo: first(t, [/M\s*AWB\s*No\.?\s*[:：]?\s*([0-9][0-9-]{7,19})/i]),
    flight: first(t, [/Flight\s*(?:No\.?)?\s*[:：]?\s*([A-Z]{2}\s?\d{2,4})/i]),
    etd: normalizeDate(first(t, [/E\.?\s*T\.?\s*D\.?\s*[:：]?\s*([\d]{2,4}[-./\s][\dA-Za-z]{2,4}[-./\s][\d]{2,4})/i])),
    eta: normalizeDate(first(t, [/E\.?\s*T\.?\s*A\.?\s*[:：]?\s*([\d]{2,4}[-./\s][\dA-Za-z]{2,4}[-./\s][\d]{2,4})/i])),
    package: first(t, [/Package\s*[:：]?\s*(\d+\s*[A-Za-z]+)/i]),
  }

  parsed.found = Object.entries(parsed)
    .filter(([k, v]) => k !== 'found' && v !== null && v !== '')
    .map(([k]) => k)
  return parsed
}
