/**
 * 가격 소스 어댑터
 *
 * 쿠팡 파트너스 API 접근이 막히거나 약관 이슈가 생겨도
 * 서비스 전체를 다시 만들지 않도록, 가격 소스를 여기 한 곳에서 갈아끼웁니다.
 *
 *   partners → 쿠팡 파트너스 Open API (실시간, 키 필요)
 *   seed     → 내장 예시 데이터 (개발/장애 폴백)
 *
 * 반환값에는 항상 source 와 fetchedAt 이 포함되어,
 * UI 에서 "실시간 / 캐시 / 예시 데이터"를 구분해 표시할 수 있습니다.
 */

import { searchProducts, getBestCategoryProducts, hasCoupangCredentials, CoupangApiError } from './client.js'
import { normalizeProducts, dedupeByProductId } from './normalize.js'
import { searchSeed, SEED_PRODUCTS } from './seed.js'
import { filterWomenCosmetics } from '../filter/women-cosmetics.js'
import { withCache, DEFAULT_TTL_MS } from './cache.js'
import { SUBCATEGORIES, CATALOG_SEARCH_TERMS, COUPANG_BEAUTY_CATEGORY_ID, getSubcategory } from '../../config/catalog.js'

export const SOURCE = { PARTNERS: 'partners', SEED: 'seed' }

/** 현재 활성 소스 */
export function activeSource() {
  return hasCoupangCredentials() ? SOURCE.PARTNERS : SOURCE.SEED
}

/** 소스 상태 (UI 배지용) */
export function sourceStatus() {
  const source = activeSource()
  return {
    source,
    live: source === SOURCE.PARTNERS,
    label: source === SOURCE.PARTNERS ? '쿠팡 실시간 연동' : '예시 데이터 (API 키 미설정)',
  }
}

async function fetchRaw({ keyword, subcategoryId, limit }) {
  if (!hasCoupangCredentials()) {
    // 시드는 전량을 넘기고, 필터링·서브카테고리 선별 후에 limit 을 적용합니다.
    // (여기서 미리 자르면 뒤쪽 서브카테고리가 통째로 비어버립니다)
    return { raw: searchSeed(keyword ?? '', SEED_PRODUCTS.length), source: SOURCE.SEED }
  }

  try {
    if (keyword) {
      return { raw: await searchProducts({ keyword, limit }), source: SOURCE.PARTNERS }
    }

    // 카탈로그 수집: 서브카테고리별 검색어를 순차 호출합니다.
    // (호출 한도를 고려해 병렬이 아닌 순차 + 소량으로 제한)
    const terms = subcategoryId
      ? CATALOG_SEARCH_TERMS.filter((t) => t.subcategoryId === subcategoryId)
      : CATALOG_SEARCH_TERMS

    const perTerm = Math.max(5, Math.ceil(limit / Math.max(terms.length, 1)))
    const collected = []
    for (const { term } of terms) {
      if (collected.length >= limit) break
      collected.push(...(await searchProducts({ keyword: term, limit: perTerm })))
    }

    if (collected.length === 0) {
      collected.push(...(await getBestCategoryProducts({ categoryId: COUPANG_BEAUTY_CATEGORY_ID, limit })))
    }
    return { raw: collected, source: SOURCE.PARTNERS }
  } catch (error) {
    if (error instanceof CoupangApiError) {
      // 캐시도 없는 상황 — 서비스 중단 대신 예시 데이터로 폴백하고 사유를 전달합니다.
      return { raw: searchSeed(keyword ?? '', SEED_PRODUCTS.length), source: SOURCE.SEED, error }
    }
    throw error
  }
}

/**
 * 여성 화장품 카탈로그를 가져옵니다.
 *
 * @param {{keyword?:string, subcategoryId?:string, limit?:number, ttl?:number}} params
 */
export async function fetchCatalog({ keyword, subcategoryId, limit = 60, ttl = DEFAULT_TTL_MS } = {}) {
  const cacheKey = `catalog:${activeSource()}:${subcategoryId || 'all'}:${keyword || ''}:${limit}`

  const result = await withCache(
    cacheKey,
    async () => {
      const { raw, source, error } = await fetchRaw({ keyword, subcategoryId, limit })
      const normalized = dedupeByProductId(normalizeProducts(raw))

      // 여성 화장품만 남깁니다.
      const { accepted, rejected, stats } = filterWomenCosmetics(normalized)

      const scoped = subcategoryId ? accepted.filter((p) => p.subcategoryId === subcategoryId) : accepted

      return {
        products: scoped.slice(0, limit),
        source,
        filterStats: stats,
        rejectedSample: rejected.slice(0, 5).map((r) => ({
          productName: r.productName,
          reason: r.classification.reason,
        })),
        error: error ? { message: error.message, status: error.status ?? null } : null,
      }
    },
    ttl,
  )

  return {
    ...result.value,
    fetchedAt: new Date(result.storedAt).toISOString(),
    fromCache: result.fromCache,
    stale: Boolean(result.stale),
  }
}

/** 단일 상품 조회 — 상세 페이지용 */
export async function fetchProduct(productId) {
  const { products } = await fetchCatalog({ limit: 200 })
  const found = products.find((p) => p.productId === String(productId))
  if (found) return found

  // 카탈로그에 없으면 시드에서 직접 조회 (직접 URL 접근 대응)
  const seedRaw = SEED_PRODUCTS.find((p) => p.productId === String(productId))
  if (!seedRaw) return null
  const [normalized] = normalizeProducts([seedRaw])
  const { accepted } = filterWomenCosmetics([normalized])
  return accepted[0] ?? null
}

export { SUBCATEGORIES, getSubcategory }
