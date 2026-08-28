/**
 * GET /api/products/:id
 * 상세 페이지용 — 무게 산출 근거(basis)까지 포함한 전체 추정 결과를 함께 내려줍니다.
 */

import { fetchProduct, sourceStatus } from '../../../lib/coupang/source'
import { estimateItemWeight } from '../../../lib/weight/estimate'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  try {
    const product = await fetchProduct(req.query.id)
    if (!product) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다.' })
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    return res.status(200).json({
      product,
      estimate: estimateItemWeight(product, 1),
      status: sourceStatus(),
    })
  } catch (error) {
    return res.status(502).json({ error: error.message || '상품을 불러오지 못했습니다.' })
  }
}
