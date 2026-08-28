/**
 * POST /api/affiliate/deeplink
 * body: { urls: string[], track: 'forwarding' | 'agent' }
 *
 * 쿠팡 파트너스 딥링크를 생성합니다. 채널 아이디(subId)가 자동으로 붙습니다.
 *
 * ⚠️ 배송대행 트랙에서만 허용합니다.
 *    구매대행은 당사가 직접 구매하므로 본인 구매(self-referral)에 해당해
 *    수수료가 지급되지 않고 계정 제재 사유가 될 수 있습니다.
 */

import { createDeeplinks, isCoupangUrl, hasAffiliateCredentials, DeeplinkError } from '../../../lib/coupang/deeplink'
import { AFFILIATE, canUseAffiliate } from '../../../config/affiliate'

const MAX_URLS = 20

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const { urls, track = 'forwarding' } = req.body ?? {}

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: '쿠팡 상품 URL 이 필요합니다.' })
  }
  if (urls.length > MAX_URLS) {
    return res.status(400).json({ error: `한 번에 최대 ${MAX_URLS}개까지 처리할 수 있습니다.` })
  }

  const clean = urls.filter((u) => typeof u === 'string' && isCoupangUrl(u))
  if (clean.length === 0) {
    return res.status(400).json({ error: '유효한 쿠팡 상품 URL 이 아닙니다.' })
  }

  // 트랙 규칙이 키 유무보다 근본적입니다.
  // 구매대행은 본인 구매라 키가 있든 없든 제휴 대상이 아니므로 먼저 걸러냅니다.
  if (!canUseAffiliate(track)) {
    return res.status(200).json({
      links: clean.map((u) => ({ originalUrl: u, shortenUrl: null, landingUrl: u })),
      affiliate: false,
      reason: '구매대행은 본인 구매에 해당해 제휴 수수료가 지급되지 않습니다. 원본 링크를 반환합니다.',
    })
  }

  if (!hasAffiliateCredentials()) {
    // 키가 없어도 사용자는 상품을 볼 수 있어야 하므로 원본 URL 을 돌려줍니다.
    return res.status(200).json({
      links: clean.map((u) => ({ originalUrl: u, shortenUrl: null, landingUrl: u })),
      affiliate: false,
      reason: '파트너스 API 키가 설정되지 않아 원본 링크를 반환합니다.',
    })
  }

  try {
    const links = await createDeeplinks(clean, track)
    return res.status(200).json({
      links,
      affiliate: true,
      subId: AFFILIATE.defaultSubId,
      disclosure: AFFILIATE.compliance.disclosure,
    })
  } catch (error) {
    if (error instanceof DeeplinkError) {
      // 제휴 실패는 사용자 경험을 막지 않습니다 — 원본 링크로 폴백합니다.
      return res.status(200).json({
        links: clean.map((u) => ({ originalUrl: u, shortenUrl: null, landingUrl: u })),
        affiliate: false,
        reason: error.message,
      })
    }
    return res.status(500).json({ error: '제휴 링크 생성에 실패했습니다.' })
  }
}
