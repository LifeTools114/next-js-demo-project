/**
 * 하노이행 발송 처리 (운영자)
 *
 * GET  /api/admin/manifest?ids=HN...,HN...   적하목록 CSV 다운로드
 *      ids 를 생략하면 발송 준비(SETTLED) 주문 전체.
 * POST /api/admin/manifest                    일괄 발송 처리
 *      body: { ids: [...], masterAwb }
 *      묶음의 모든 주문을 마스터 AWB 하나로 SHIPPED 처리합니다.
 *
 * 운영자 동선: 발송일에 [CSV 다운로드] → 물류사 전달 → AWB 받으면
 * [일괄 발송] 한 번. 주문별 발송 클릭이 사라집니다.
 */

import { listOrders, getOrder, markShipped, orderView } from '../../../lib/order/store.js'
import { requireAdmin, UnauthorizedError } from '../../../lib/auth.js'
import { toManifestCsv, manifestFileName } from '../../../lib/manifest.js'
import { TELEGRAM, telegramEnabled } from '../../../config/telegram.js'
import { sendDocument } from '../../../lib/telegram/api.js'

function resolveOrders(idsParam) {
  if (idsParam) {
    const ids = String(idsParam).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200)
    return ids.map((id) => getOrder(id)).filter(Boolean)
  }
  return listOrders().filter((o) => o.state === 'SETTLED')
}

export default function handler(req, res) {
  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e instanceof UnauthorizedError ? e.status : 401).json({ error: e.message })
  }

  if (req.method === 'GET') {
    const orders = resolveOrders(req.query.ids)
    if (orders.length === 0) {
      return res.status(404).json({ error: '발송 준비된 주문이 없습니다.' })
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${manifestFileName()}"`)
    return res.status(200).send(toManifestCsv(orders))
  }

  if (req.method === 'POST') {
    const { ids, masterAwb } = req.body ?? {}
    const awb = String(masterAwb ?? '').trim().slice(0, 60)
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '발송할 주문 목록(ids)이 필요합니다.' })
    }
    if (!awb) {
      return res.status(400).json({ error: '마스터 AWB(운송장) 번호가 필요합니다.' })
    }

    const operator = req.headers['x-admin-user'] || 'admin'
    const shipped = []
    const shippedOrders = []
    const failed = []
    for (const id of ids.slice(0, 200)) {
      try {
        const order = markShipped(id, { trackingNo: awb, by: operator })
        shipped.push(orderView(order).orderNo)
        shippedOrders.push(order)
      } catch (error) {
        failed.push({ id, error: error.message })
      }
    }

    // 파트너 방으로 적하목록 자동 전송 — 사람이 파일을 옮길 필요가 없습니다.
    // 실패해도 발송 처리는 이미 끝났으므로 응답을 막지 않습니다.
    if (shippedOrders.length > 0 && telegramEnabled() && TELEGRAM.partnerChatId) {
      sendDocument(
        TELEGRAM.partnerChatId,
        manifestFileName(),
        toManifestCsv(shippedOrders),
        `📦 하노이행 ${shippedOrders.length}건 발송 — AWB ${awb}`,
      ).catch(() => {})
    }

    return res.status(failed.length > 0 && shipped.length === 0 ? 409 : 200).json({ shipped, failed })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'GET 또는 POST 요청만 지원합니다.' })
}
