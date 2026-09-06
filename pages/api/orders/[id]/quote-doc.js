/**
 * GET  /api/orders/:id/quote-doc?kind=provisional|final  견적서 데이터
 * POST /api/orders/:id/quote-doc                          물류사 청구서 입력 (운영자)
 *
 * POST 는 DEBIT NOTE 에서 옮긴 실측 무게·운송 정보만 받습니다.
 * 청구서의 단가·금액(당사 원가)은 저장하지도, 응답에 담지도 않습니다.
 */

import { getOrder, saveDebitNote } from '../../../../lib/order/store.js'
import { buildQuoteDoc } from '../../../../lib/quote-doc.js'
import { isAdminRequest } from '../../../../lib/auth.js'
import { orderAccess, OWNER_ONLY_MESSAGE } from '../../../../lib/order/access.js'
import { getMethod } from '../../../../lib/payment/methods.js'

/**
 * 견적서에 실을 입금 계좌 — 한국(원화)·베트남(동화) 계좌를 모두 표기합니다.
 * 고객이 편한 쪽으로 보낼 수 있어야 하므로 주문의 결제 수단과 무관하게 둘 다.
 * 계좌 정보는 결제 수단 설정(lib/payment/methods.js) 한 곳에서만 가져옵니다.
 */
function paymentAccounts(order) {
  const pick = (methodId, currency) => {
    try {
      const req = getMethod(methodId).createRequest(order)
      const find = (re) => (req.instructions ?? [])
        .find((line) => re.test(line))?.split(':').slice(1).join(':').trim() ?? ''
      const account = find(/계좌번호/)
      if (!account) return null
      return { currency, bank: find(/은행/), account, holder: find(/예금주/) }
    } catch {
      return null
    }
  }
  return [
    pick('manual-bank-krw', 'KRW'),
    pick('manual-bank', 'VND'),
  ].filter(Boolean)
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
      doc: { ...buildQuoteDoc(saved, { kind: 'final' }), payment: paymentAccounts(saved) },
    })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'GET 또는 POST 만 지원합니다.' })
  }

  // 견적서에는 이름·전화·주소가 있습니다 — 주문번호만으로는 열리지 않습니다.
  if (orderAccess(req, order) === 'public') return res.status(403).json({ ok: false, error: OWNER_ONLY_MESSAGE })

  try {
    const doc = buildQuoteDoc(order, { kind: req.query.kind })
    return res.status(200).json({ ok: true, doc: { ...doc, payment: paymentAccounts(order) } })
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message })
  }
}
