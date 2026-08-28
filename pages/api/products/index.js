/**
 * GET /api/products?category=skincare&q=토너&limit=60
 *
 * 여성 화장품만 필터링된 카탈로그를 반환합니다.
 * 가격은 쿠팡 파트너스 API(키 설정 시) 또는 예시 데이터에서 오며,
 * 응답의 source/fetchedAt 으로 어느 쪽인지 구분할 수 있습니다.
 */

import { fetchCatalog, sourceStatus } from '../../../lib/coupang/source'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }

  const { category, q, limit } = req.query
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 60, 1), 200)

  try {
    const result = await fetchCatalog({
      subcategoryId: category || undefined,
      keyword: q || undefined,
      limit: parsedLimit,
    })

    // 브라우저/CDN 캐시로도 호출 한도를 아낍니다.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    return res.status(200).json({
      ...result,
      status: sourceStatus(),
    })
  } catch (error) {
    return res.status(502).json({ error: error.message || '상품을 불러오지 못했습니다.' })
  }
}
