/**
 * 쿠팡 파트너스 Open API 클라이언트 (서버 전용)
 *
 * 제공 엔드포인트
 *   - 상품 검색      GET  /products/search
 *   - 카테고리 베스트 GET  /products/bestcategories/{categoryId}
 *   - 딥링크 생성    POST /v1/deeplink
 *
 * 키는 서버 환경변수(COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY)에서만 읽습니다.
 */

import { buildAuthorization } from './signature.js'

const BASE_URL = 'https://api-gateway.coupang.com'
const API_ROOT = '/v2/providers/affiliate_open_api/apis/openapi'
const TIMEOUT_MS = 8000

export class CoupangApiError extends Error {
  constructor(message, { status, code, retryable = false } = {}) {
    super(message)
    this.name = 'CoupangApiError'
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

export function getCredentials() {
  return {
    accessKey: process.env.COUPANG_ACCESS_KEY || '',
    secretKey: process.env.COUPANG_SECRET_KEY || '',
    subId: process.env.COUPANG_SUB_ID || '',
  }
}

export function hasCoupangCredentials() {
  const { accessKey, secretKey } = getCredentials()
  return Boolean(accessKey && secretKey)
}

async function request({ method, path, query = '', body = null }) {
  const { accessKey, secretKey } = getCredentials()
  const authorization = buildAuthorization({ method, path, query, accessKey, secretKey })

  const url = `${BASE_URL}${path}${query ? `?${query}` : ''}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json;charset=UTF-8' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    if (error.name === 'AbortError') {
      throw new CoupangApiError('쿠팡 API 응답 시간이 초과되었습니다.', { retryable: true })
    }
    throw new CoupangApiError(`쿠팡 API 연결에 실패했습니다: ${error.message}`, { retryable: true })
  }
  clearTimeout(timer)

  if (response.status === 429) {
    throw new CoupangApiError('쿠팡 API 호출 한도를 초과했습니다. 캐시된 가격을 사용합니다.', {
      status: 429,
      retryable: true,
    })
  }
  if (response.status === 401 || response.status === 403) {
    throw new CoupangApiError('쿠팡 파트너스 인증에 실패했습니다. ACCESS_KEY/SECRET_KEY 와 서버 시각(GMT)을 확인하세요.', {
      status: response.status,
    })
  }
  if (!response.ok) {
    throw new CoupangApiError(`쿠팡 API 오류 (HTTP ${response.status})`, {
      status: response.status,
      retryable: response.status >= 500,
    })
  }

  const json = await response.json()
  // 파트너스 API 는 HTTP 200 이어도 rCode 로 실패를 알립니다.
  if (json.rCode && json.rCode !== '0') {
    throw new CoupangApiError(`쿠팡 API 오류: ${json.rMessage || json.rCode}`, { code: json.rCode })
  }
  return json
}

/**
 * 키워드 상품 검색 — 실시간 가격 조회의 기본 수단
 * @param {{keyword:string, limit?:number}} params
 */
export async function searchProducts({ keyword, limit = 50 }) {
  const path = `${API_ROOT}/products/search`
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${Math.min(limit, 100)}`
  const json = await request({ method: 'GET', path, query })
  return json?.data?.productData ?? []
}

/**
 * 카테고리 베스트 상품 — 카탈로그 시딩용
 * @param {{categoryId:number, limit?:number}} params
 */
export async function getBestCategoryProducts({ categoryId, limit = 50 }) {
  const path = `${API_ROOT}/products/bestcategories/${categoryId}`
  const query = `limit=${Math.min(limit, 100)}`
  const json = await request({ method: 'GET', path, query })
  return Array.isArray(json?.data) ? json.data : (json?.data?.productData ?? [])
}

/**
 * 딥링크(제휴 추적 링크) 생성 — 상품 상세의 "쿠팡 원본 보기" 링크에 사용
 * @param {string[]} urls
 */
export async function createDeeplinks(urls = []) {
  if (urls.length === 0) return []
  const path = `${API_ROOT}/v1/deeplink`
  const { subId } = getCredentials()
  const body = { coupangUrls: urls, ...(subId ? { subId } : {}) }
  const json = await request({ method: 'POST', path, body })
  return json?.data ?? []
}
