import { useState } from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import WeightBreakdown from '../../components/WeightBreakdown'
import CostBreakdown from '../../components/CostBreakdown'
import { useCart } from '../../components/CartProvider'
import { fetchProduct, sourceStatus } from '../../lib/coupang/source'
import { estimateItemWeight } from '../../lib/weight/estimate'
import { quote } from '../../lib/pricing/landed'
import { getSubcategory } from '../../config/catalog'
import { krw, vnd, toVnd, formatDateTime } from '../../lib/format'

export default function ProductDetail({ product, estimate, singleQuote, status }) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const sub = getSubcategory(product.subcategoryId)

  const handleAdd = () => {
    add(product, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const prohibited = estimate.restriction?.status === 'prohibited'

  return (
    <Layout title={product.productName} sourceStatus={status}>
      <div className="detail__hero">
        {product.productImage ? (
          <img
            src={product.productImage}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span aria-hidden="true">{sub?.emoji ?? '💄'}</span>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {sub && (
            <Link href={`/products?category=${sub.id}`} className="tag">
              {sub.emoji} {sub.label}
            </Link>
          )}
          {product.isRocket && <span className="tag tag--ok">로켓배송</span>}
        </div>

        <h1 className="detail__title">{product.productName}</h1>
        <div className="detail__price">{krw(product.productPrice)}</div>
        <div className="detail__vnd">≈ {vnd(toVnd(product.productPrice))} (상품가만)</div>

        <p style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 6 }}>
          쿠팡 판매가 · {formatDateTime(new Date().toISOString())} 기준
          {!status.live && ' · 예시 데이터'}
        </p>
      </div>

      <WeightBreakdown estimate={estimate} />

      <CostBreakdown quote={singleQuote} />

      <div className="section" style={{ display: 'grid', gap: 10 }}>
        <button className="btn" onClick={handleAdd} disabled={prohibited}>
          {prohibited ? '항공 운송 불가 상품' : added ? '✓ 견적함에 담았습니다' : '견적함에 담기'}
        </button>

        {product.productUrl && (
          <a
            className="btn btn--ghost"
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            쿠팡 원본 상품 보기 ↗
          </a>
        )}
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <p className="note">
          구매대행 서비스입니다. 주문하시면 당사가 고객님을 대신해 쿠팡에서 구매한 뒤 하노이로
          배송해 드립니다. 상품의 소유권은 고객님께 있으며, 당사는 대행 수수료를 받습니다.
        </p>
      </div>
    </Layout>
  )
}

export async function getServerSideProps({ params }) {
  const product = await fetchProduct(params.id)
  if (!product) return { notFound: true }

  return {
    props: {
      product,
      estimate: estimateItemWeight(product, 1),
      singleQuote: quote([{ ...product, quantity: 1 }]),
      status: sourceStatus(),
    },
  }
}
