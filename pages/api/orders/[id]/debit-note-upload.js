/**
 * POST /api/orders/:id/debit-note-upload  물류사 청구서 파일 업로드 (운영자)
 *
 * 파일에서 실측 무게·운송 정보만 읽어 돌려줍니다. 값이 읽히면 그대로
 * 저장하고 최종 견적서 데이터까지 함께 반환하므로, 운영자는 업로드 한
 * 번으로 최종 견적서를 받습니다.
 *
 * ⚠️ 업로드된 파일은 **저장하지 않습니다.** 청구서에는 당사 원가(단가·
 *    청구액)가 적혀 있어 서버에 남기면 고객 응답에 섞일 위험이 있습니다.
 *    메모리에서 읽고 필요한 값만 추출한 뒤 버립니다.
 */

import { getOrder, saveDebitNote } from '../../../../lib/order/store.js'
import { extractPdfText } from '../../../../lib/debit-note/extract-text.js'
import { parseDebitNote } from '../../../../lib/debit-note/parse.js'
import { buildQuoteDoc } from '../../../../lib/quote-doc.js'
import { isAdminRequest } from '../../../../lib/auth.js'

/** 청구서 PDF 는 보통 수백 KB — 넉넉히 8MB 까지 받습니다. */
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

const MAX_BYTES = 8 * 1024 * 1024

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' })
  }
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: '운영자만 청구서를 업로드할 수 있습니다.' })
  }
  const order = getOrder(req.query.id)
  if (!order) return res.status(404).json({ ok: false, error: '주문을 찾을 수 없습니다.' })

  const { fileName = '', dataBase64 = '' } = req.body ?? {}
  if (!dataBase64) return res.status(400).json({ ok: false, error: '파일이 비어 있습니다.' })

  let bytes
  try {
    bytes = Buffer.from(String(dataBase64).split(',').pop(), 'base64')
  } catch {
    return res.status(400).json({ ok: false, error: '파일을 읽지 못했습니다.' })
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return res.status(400).json({ ok: false, error: '파일 크기가 올바르지 않습니다 (최대 8MB).' })
  }

  const isPdf = bytes.slice(0, 5).toString('latin1') === '%PDF-'
  const parsed = isPdf ? parseDebitNote(extractPdfText(bytes)) : parseDebitNote('')

  if (!parsed.chargeableWeightKg) {
    return res.status(200).json({
      ok: true,
      parsed,
      saved: false,
      // 스캔본·이미지는 글자가 없어 읽을 수 없습니다 — 수동 입력으로 잇습니다.
      message: isPdf
        ? `${fileName || '파일'} 에서 실측 무게(C/Weight)를 찾지 못했습니다. 무게를 직접 입력해 주세요.`
        : '이미지 파일은 자동 인식이 되지 않습니다. PDF 를 올리거나 무게를 직접 입력해 주세요.',
    })
  }

  const saved = saveDebitNote(order.id, parsed)
  return res.status(200).json({
    ok: true,
    parsed,
    saved: true,
    message: `실측 ${parsed.chargeableWeightKg}kg 를 읽었습니다.`,
    doc: buildQuoteDoc(saved, { kind: 'final' }),
  })
}
