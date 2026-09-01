/**
 * GET  /api/orders/:id/quote-doc?kind=provisional|final  견적서 데이터
 * POST /api/orders/:id/quote-doc                          물류사 청구서 입력 (운영자)
 *
 * POST 는 DEBIT NOTE 에서 옮긴 실측 무게·운송 정보만 받습니다.
 * 청구서의 단가·금액(당사 원가)은 저장하지도, 응답에 담지도 않습니다.
 */

import { getOrder, saveDebitNote } from '../../../../lib/order/store'
import { buildQuoteDoc } from '../../../../lib/quote-doc'
import { isAdminRequest } from '../../../../lib/auth'
import { getMethod } from '../../../../lib/payment/methods'

/** 견적서에 실을 입금 계좌 — 결제 수단 설정에서 그대로 가져옵니다. */
function paymentLines(order) {
  try {
    const req = getMethod(order.paymentMethod).createRequest(order)
    return (req.instructions ?? [])
      .filter((line) => /은행|계좌번호|예금주/.test(line))
      .map((line) => {
        const [label, ...rest] = line.split(':')
        return { label: label.trim(), value: rest.join(':').trim() }
      })
  } catch {
    return []
  }
}

export default function handler(req, res) {
  const order = getOrder(req.query.id)
  if (!order) return res.status(404).json({ ok: false, error: '주문을 찾을 수 없습니다.' })

  if (req.method === 'POST') {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: '운영자만 청구서를 등록할 수 있습니다.' })
    }
    const b = req.body ?? {}
    const kg = Number(b.chargeableWeightKg)
    if (!Number.isFinite(kg) || kg <= 0) {
      return res.status(400).json({ ok: false, error: '청구서의 실측 무게(C/Weight, kg)를 입력해 주세요.' })
    }
    const saved = saveDebitNote(order.id, {
      chargeableWeightKg: kg,
      invoiceNo: String(b.invoiceNo ?? '').slice(0, 40),
      hawbNo: String(b.hawbNo ?? '').slice(0, 40),
      mawbNo: String(b.mawbNo ?? '').slice(0, 40),
      flight: String(b.flight ?? '').slice(0, 20),
      etd: String(b.etd ?? '').slice(0, 20),
      eta: String(b.eta ?? '').slice(0, 20),
      package: String(b.package ?? '').slice(0, 40),
    })
    return res.status(200).json({
      ok: true,
      doc: { ...buildQuoteDoc(saved, { kind: 'final' }), payment: paymentLines(saved) },
    })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'GET 또는 POST 만 지원합니다.' })
  }

  try {
    const doc = buildQuoteDoc(order, { kind: req.query.kind })
    return res.status(200).json({ ok: true, doc: { ...doc, payment: paymentLines(order) } })
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message })
  }
}
