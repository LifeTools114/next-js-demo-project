/**
 * PDF 텍스트 추출 (의존성 없음)
 *
 * 물류사 청구서(DEBIT NOTE)는 표 형태의 PDF 로 옵니다. 여기서 필요한 값은
 * 실측 무게와 운송 정보뿐이라 정교한 레이아웃 복원은 필요 없고, 문자열만
 * 순서대로 뽑으면 충분합니다. 그래서 외부 PDF 라이브러리를 쓰지 않고
 * Node 내장 zlib 로 스트림을 풀어 텍스트 연산자만 읽습니다.
 *
 * 한계: 글꼴이 CID(사용자 정의 인코딩)면 글자가 깨질 수 있고, 스캔 이미지
 * PDF 는 텍스트가 없어 아무것도 나오지 않습니다. 그 경우 호출부는 운영자
 * 수동 입력으로 넘어갑니다 — 자동 인식이 실패해도 업무가 멈추지 않게.
 */

import zlib from 'node:zlib'

/** PDF 문자열 이스케이프(\n, \(, \053 …)를 실제 문자로 */
function unescapePdfString(raw) {
  return raw.replace(/\\(n|r|t|b|f|\(|\)|\\|[0-7]{1,3})/g, (_, esc) => {
    switch (esc) {
      case 'n': return '\n'
      case 'r': return '\r'
      case 't': return '\t'
      case 'b': return '\b'
      case 'f': return '\f'
      case '(': return '('
      case ')': return ')'
      case '\\': return '\\'
      default: return String.fromCharCode(Number.parseInt(esc, 8))
    }
  })
}

/** 콘텐츠 스트림에서 표시되는 문자열만 순서대로 뽑습니다. */
function textFromContent(content) {
  const out = []
  // (문자열) 과 <16진문자열> 을 나오는 순서대로
  const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g
  let m
  while ((m = re.exec(content))) {
    const token = m[0]
    if (token.startsWith('(')) {
      out.push(unescapePdfString(token.slice(1, -1)))
    } else {
      const hex = token.slice(1, -1).replace(/\s+/g, '')
      let s = ''
      for (let i = 0; i + 1 < hex.length; i += 2) {
        s += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
      }
      out.push(s)
    }
  }
  return out.join(' ')
}

/**
 * PDF 바이트에서 텍스트를 추출합니다.
 * @param {Buffer|Uint8Array} bytes
 * @returns {string} 추출된 텍스트 (실패 시 빈 문자열)
 */
export function extractPdfText(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return ''

  const raw = buf.toString('latin1')
  const parts = []
  const streamRe = /stream\r?\n?/g
  let m
  while ((m = streamRe.exec(raw))) {
    const start = m.index + m[0].length
    const end = raw.indexOf('endstream', start)
    if (end < 0) break
    streamRe.lastIndex = end

    // 스트림 앞 사전(dict)에 압축 방식이 적혀 있습니다.
    const dict = raw.slice(Math.max(0, m.index - 400), m.index)
    const chunk = buf.subarray(start, end)
    let content = ''
    if (/\/FlateDecode/.test(dict)) {
      try {
        content = zlib.inflateSync(chunk).toString('latin1')
      } catch {
        try { content = zlib.inflateRawSync(chunk).toString('latin1') } catch { continue }
      }
    } else if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode|LZWDecode|RunLengthDecode)/.test(dict)) {
      continue // 이미지·미지원 압축은 건너뜁니다
    } else {
      content = chunk.toString('latin1')
    }
    if (content.includes('Tj') || content.includes('TJ')) parts.push(textFromContent(content))
  }

  return parts.join('\n').replace(/[ \t]+/g, ' ').trim()
}
