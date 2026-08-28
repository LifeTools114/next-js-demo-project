import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import CostBreakdown from '../components/CostBreakdown'
import WeightBreakdown from '../components/WeightBreakdown'
import { useCart } from '../components/CartProvider'
import { SHIPPING } from '../config/shipping'
import { TAXES } from '../config/taxes'
import { getSubcategory } from '../config/catalog'
import { krw, weight } from '../lib/format'

export default function CartPage() {
  const { items, setQuantity, remove, clear, ready } = useCart()
  const [zone, setZone] = useState(SHIPPING.defaultZone)
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (items.length === 0) {
      setQuote(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '견적 계산에 실패했습니다.')
      setQuote(data.quote)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [items, zone])

  useEffect(() => {
    if (ready) refresh()
  }, [ready, refresh])

  // 개인 직구 수량 경고 — 상업적 반입으로 간주되면 통관이 보류될 수 있습니다.
  const overQty = items.filter((i) => i.quantity > TAXES.personalUse.maxSameItemQty)

  if (ready && items.length === 0) {
    return (
      <Layout title="견적함">
        <div className="empty">
          <div className="empty__icon">🧾</div>
          견적함이 비어 있습니다.
          <br />
          <small>상품을 담으면 무게와 배송비를 바로 계산해 드립니다.</small>
          <div style={{ marginTop: 20 }}>
            <Link href="/products" className="btn">
              상품 보러 가기
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="견적함">
      <div className="section" style={{ paddingBottom: 6 }}>
        <h1 className="section__title">견적함</h1>
        <p className="section__sub">담은 상품의 무게를 합산해 국제배송비와 세금을 계산합니다.</p>
      </div>

      <div>
        {items.map((item) => {
          const sub = getSubcategory(item.subcategoryId)
          return (
            <div className="cart-item" key={item.productId}>
              <div className="cart-item__thumb" aria-hidden="true">
                {item.productImage ? <img src={item.productImage} alt="" /> : (sub?.emoji ?? '💄')}
              </div>
              <div className="cart-item__main">
                <p className="cart-item__name">{item.productName}</p>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                  {krw(item.productPrice * item.quantity)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="qty">
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label="수량 줄이기"
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label="수량 늘리기"
                    >
                      ＋
                    </button>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => remove(item.productId)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="section">
        <div className="field">
          <label className="field__label" htmlFor="zone">
            배송 지역
          </label>
          <select
            id="zone"
            className="select"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
            {Object.entries(SHIPPING.zones).map(([key, z]) => (
              <option key={key} value={key}>
                {z.label}
                {z.surcharge > 0 ? ` (+${krw(z.surcharge)})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="section">
          <div className="skeleton" style={{ height: 180 }} />
        </div>
      )}

      {error && (
        <div className="section">
          <p className="note note--danger">{error}</p>
        </div>
      )}

      {quote && !loading && (
        <>
          {quote.weight.restrictions.limitedQty > 0 && !quote.weight.restrictions.exceedsLimitedQty && (
            <div className="section" style={{ paddingBottom: 0 }}>
              <p className="note note--warn">
                ⚠️ 알코올 함유 제품 {quote.weight.restrictions.limitedQty}개가 포함되어 위험물 취급
                할증 {krw(quote.weight.restrictions.surchargeKrw)}이 배송비에 추가되었습니다.
              </p>
            </div>
          )}

          {quote.weight.restrictions.exceedsLimitedQty && (
            <div className="section" style={{ paddingBottom: 0 }}>
              <p className="note note--warn">
                ⚠️ 알코올 함유 제품(향수 등)이 배송 건당 허용 수량을 초과했습니다. 분할 배송이
                필요하며 추가 배송비가 발생합니다.
              </p>
            </div>
          )}

          {quote.weight.restrictions.prohibited.length > 0 && (
            <div className="section" style={{ paddingBottom: 0 }}>
              <p className="note note--danger">
                🚫 항공 운송이 불가한 상품이 포함되어 있습니다:{' '}
                {quote.weight.restrictions.prohibited.map((p) => p.productName).join(', ')}
              </p>
            </div>
          )}

          {overQty.length > 0 && (
            <div className="section" style={{ paddingBottom: 0 }}>
              <p className="note note--warn">⚠️ {TAXES.personalUse.message}</p>
            </div>
          )}

          <div className="section" style={{ paddingBottom: 6 }}>
            <div className="row">
              <span className="row__label">상품 실무게 합계</span>
              <span className="row__value">{weight(quote.weight.actualG)}</span>
            </div>
            <div className="row">
              <span className="row__label">부피무게 합계</span>
              <span className="row__value">{weight(quote.weight.volumetricG)}</span>
            </div>
            <div className="row">
              <span className="row__label">
                청구무게 ({quote.weight.chargeableBy === 'actual' ? '실무게' : '부피무게'} 기준,{' '}
                {SHIPPING.roundingStepKg}kg 올림)
              </span>
              <span className="row__value">{quote.shipping.billableKg}kg</span>
            </div>
            <div className="row">
              <span className="row__label">적용 요율 ({quote.shipping.tierLabel})</span>
              <span className="row__value">{krw(quote.shipping.ratePerKg)} / kg</span>
            </div>
          </div>

          <CostBreakdown quote={quote} />

          <div className="section" style={{ paddingTop: 0 }}>
            <p className="note">
              📦 하노이 도착 예상 {quote.shipping.leadTimeDays.min}~{quote.shipping.leadTimeDays.max}
              영업일 · {quote.shipping.zoneLabel}
            </p>
          </div>

          <div className="section" style={{ display: 'grid', gap: 10, paddingTop: 0 }}>
            {quote.weight.restrictions.prohibited.length > 0 ? (
              <button className="btn" disabled>
                항공 운송 불가 상품이 있어 주문할 수 없습니다
              </button>
            ) : (
              <Link href="/checkout" className="btn">
                주문서 작성하기
              </Link>
            )}
            <button className="btn btn--ghost" onClick={clear}>
              견적함 비우기
            </button>
          </div>
        </>
      )}
    </Layout>
  )
}
