import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import CategoryChips from '../../components/CategoryChips'
import ProductCard from '../../components/ProductCard'
import { fetchCatalog, sourceStatus } from '../../lib/coupang/source'
import { getSubcategory } from '../../config/catalog'
import { formatDateTime } from '../../lib/format'

const SORTS = [
  { id: 'popular', label: '기본순' },
  { id: 'price-asc', label: '낮은 가격순' },
  { id: 'price-desc', label: '높은 가격순' },
  { id: 'weight-asc', label: '가벼운 순' },
]

const sortProducts = (products, sort) => {
  const list = [...products]
  if (sort === 'price-asc') return list.sort((a, b) => a.productPrice - b.productPrice)
  if (sort === 'price-desc') return list.sort((a, b) => b.productPrice - a.productPrice)
  if (sort === 'weight-asc')
    return list.sort((a, b) => (a.weight?.chargeableG ?? 0) - (b.weight?.chargeableG ?? 0))
  return list
}

export default function ProductList({ products, category, keyword, status, fetchedAt, filterStats }) {
  const router = useRouter()
  const [sort, setSort] = useState('popular')
  const [query, setQuery] = useState(keyword ?? '')

  const sub = getSubcategory(category)
  const sorted = sortProducts(products, sort)

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (query.trim()) next.q = query.trim()
    if (category) next.category = category
    router.push({ pathname: '/products', query: next })
  }

  return (
    <Layout title={sub ? sub.label : '전체 상품'} sourceStatus={status}>
      <CategoryChips active={category} />

      <div className="section" style={{ paddingTop: 4, paddingBottom: 10 }}>
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            type="search"
            inputMode="search"
            placeholder="상품명·브랜드 검색 (예: 토너, 쿠션)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn--sm" style={{ flex: '0 0 auto' }}>
            검색
          </button>
        </form>
      </div>

      <div
        className="section"
        style={{ paddingTop: 0, paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 12.5, color: 'var(--ink-500)', flex: 1 }}>
          {sub ? `${sub.emoji} ${sub.label}` : '전체'} · {products.length}개
          {fetchedAt && ` · ${formatDateTime(fetchedAt)} 기준`}
        </span>
        <select
          className="select"
          style={{ width: 'auto', minHeight: 38, fontSize: 13 }}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="정렬"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🔍</div>
          조건에 맞는 여성 화장품이 없습니다.
          <br />
          <small>다른 카테고리나 검색어를 시도해 보세요.</small>
        </div>
      ) : (
        <div className="grid">
          {sorted.map((p) => (
            <ProductCard key={p.productId} product={p} />
          ))}
        </div>
      )}

      {filterStats?.rejected > 0 && (
        <div className="section">
          <p className="note">
            🧹 수집한 {filterStats.total}건 중 <strong>{filterStats.rejected}건</strong>을 제외했습니다.
            (남성용 {filterStats['male-product'] ?? 0}건 · 취급 제외 품목{' '}
            {filterStats['non-cosmetic'] ?? 0}건 · 미분류 {filterStats.unclassified ?? 0}건)
          </p>
        </div>
      )}
    </Layout>
  )
}

export async function getServerSideProps({ query }) {
  const category = typeof query.category === 'string' ? query.category : null
  const keyword = typeof query.q === 'string' ? query.q : null

  const { products, fetchedAt, filterStats } = await fetchCatalog({
    subcategoryId: category || undefined,
    keyword: keyword || undefined,
    limit: 60,
  })

  return {
    props: {
      products,
      category,
      keyword,
      fetchedAt: fetchedAt ?? null,
      filterStats: filterStats ?? null,
      status: sourceStatus(),
    },
  }
}
