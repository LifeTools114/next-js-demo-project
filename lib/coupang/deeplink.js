/**
 * 쿠팡 파트너스 딥링크 생성 (서버 전용)
 *
 * 파트너스 API 를 "카탈로그 수집"이 아니라 "제휴 링크 생성"에만 사용합니다.
 * 이것이 파트너스 프로그램의 본래 용도이므로 약관 정합성 문제가 없습니다.
 *
 * ⚠️ 배송대행 트랙에서만 호출해야 합니다. (구매대행은 본인 구매라 수수료 미지급)
 */

import { buildAuthorization } from './signature.js'
import { AFFILIATE, canUseAffiliate } from '../../config/affiliate.js'

const BASE_URL = 'https://api-gateway.coupang.com'
const DEEPLINK_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
const TIMEOUT_MS = 6000

export class DeeplinkError extends Error {
  constructor(message, { status } = {}) {
    super(message)
    this.name = 'DeeplinkError'
    this.status = status
  }
}

const credentials = () => ({
  accessKey: process.env.COUPANG_ACCESS_KEY || '',
  secretKey: process.env.COUPANG_SECRET_KEY || '',
  subId: process.env.COUPANG_SUB_ID || AFFILIATE.defaultSubId,
})

export const hasAffiliateCredentials = () => {
  const { accessKey, secretKey } = credentials()
  return Boolean(accessKey && secretKey)
}

/** 쿠팡 상품 URL 인지 검증 — 임의 URL 을 제휴 API 에 넘기지 않습니다. */
export function isCoupangUrl(url) {
  try {
    const u = new URL(url)
    return /(^|\.)coupang\.com$/.test(u.hostname) && u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 제휴 딥링크를 생성합니다.
 *
 * @param {string[]} urls 쿠팡 상품 URL 목록
 * @param {string} track 'forwarding' | 'agent'
 * @returns {Promise<Array<{originalUrl:string, shortenUrl:string|null, landingUrl:string|null}>>}
 */
export async function createDeeplinks(urls = [], track = 'forwarding') {
  if (!canUseAffiliate(track)) {
    throw new DeeplinkError(
      '구매대행 주문에는 제휴 링크를 사용할 수 없습니다. 본인 구매는 수수료가 지급되지 않으며 계정 제재 사유가 될 수 있습니다.',
    )
  }

  const valid = urls.filter(isCoupangUrl)
  if (valid.length === 0) throw new DeeplinkError('유효한 쿠팡 상품 URL 이 없습니다.')

  const { accessKey, secretKey, subId } = credentials()
  if (!accessKey || !secretKey) {
    throw new DeeplinkError('쿠팡 파트너스 API 키가 설정되지 않았습니다.', { status: 503 })
  }

  const authorization = buildAuthorization({
    method: 'POST', path: DEEPLINK_PATH, query: '', accessKey, secretKey,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}${DEEPLINK_PATH}`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({ coupangUrls: valid, ...(subId ? { subId } : {}) }),
      signal: controller.signal,
    })

    if (res.status === 401 || res.status === 403) {
      /**
       * 쿠팡이 보낸 실제 거절 사유를 그대로 보여줍니다 — "서명 오류"인지
       * "미승인 계정 API 제한"인지 원인 판별에 이 문구가 결정적입니다.
       */
      let detail = ''
      try {
        const body = await res.text()
        try {
          const j = JSON.parse(body)
          detail = String(j.rMessage ?? j.message ?? body).slice(0, 200)
        } catch {
          detail = body.slice(0, 200)
        }
      } catch { /* 본문 없음 */ }
      throw new DeeplinkError(
        `파트너스 인증 실패 (HTTP ${res.status})${detail ? ` — 쿠팡 응답: ${detail}` : ''}` +
        ' · 키/서버시각(GMT) 또는 계정 API 승인 상태를 확인하세요.',
        { status: res.status },
      )
    }
    if (!res.ok) throw new DeeplinkError(`파트너스 API 오류 (HTTP ${res.status})`, { status: res.status })

    const json = await res.json()
    if (json.rCode && json.rCode !== '0') {
      throw new DeeplinkError(`파트너스 API 오류: ${json.rMessage || json.rCode}`)
    }
    return (json?.data ?? []).map((d) => ({
      originalUrl: d.originalUrl ?? null,
      shortenUrl: d.shortenUrl ?? null,
      landingUrl: d.landingUrl ?? null,
    }))
  } catch (error) {
    if (error instanceof DeeplinkError) throw error
    if (error.name === 'AbortError') throw new DeeplinkError('파트너스 API 응답 시간이 초과되었습니다.')
    throw new DeeplinkError(`파트너스 API 연결 실패: ${error.message}`)
  } finally {
    clearTimeout(timer)
  }
}
