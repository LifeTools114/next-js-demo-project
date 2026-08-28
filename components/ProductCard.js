import Link from 'next/link'
import { krw, toVnd, vnd, weight, CONFIDENCE_TAG } from '../lib/format'
import { getSubcategory } from '../config/catalog'

export default function ProductCard({ product }) {
  const sub = getSubcategory(product.subcategoryId)
  const conf = CONFIDENCE_TAG[product.weight?.confidence] ?? CONFIDENCE_TAG.low
  const restriction = product.weight?.restriction

  return (
    <Link href={`/products/${product.productId}`} className="card">
      <div className="card__thumb">
        {product.productImage ? (
          <img src={product.productImage} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">{sub?.emoji ?? '💄'}</span>
        )}
        {product.isRocket && <span className="card__flag">로켓</span>}
      </div>

      <div className="card__body">
        {product.brand && <span className="card__brand">{product.brand}</span>}
        <p className="card__name">{product.productName}</p>

        <div>
          <div className="card__price">{krw(product.productPrice)}</div>
          <div className="card__vnd">≈ {vnd(toVnd(product.productPrice))}</div>
        </div>

        <div className="card__meta">
          <span className="tag tag--weight">{weight(product.weight?.chargeableG)}</span>
          <span className={conf.className}>{conf.label}</span>
          {restriction?.status === 'limited' && <span className="tag tag--warn">항공 제한</span>}
          {restriction?.status === 'prohibited' && <span className="tag tag--danger">항공 불가</span>}
        </div>
      </div>
    </Link>
  )
}
