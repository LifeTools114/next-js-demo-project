import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { PROGRESS_ORDER, ORDER_STATES } from '../../lib/order/states'
import { krw, vnd, weight, formatDateTime } from '../../lib/format'

/**
 * 고객용 주문 조회.
 * 매입 원가·마진은 API 단계에서 이미 제거되어 여기로 오지 않습니다.
 */
export default function OrderPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/orders/${id}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        setOrder(d.order)
      })
      .catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return (
      <Layout title="주문 조회">
        <div className="empty">
          <div className="empty__icon">🔍</div>
          {error}
          <div style={{ marginTop: 20 }}>
            <Link href="/" className="btn btn--ghost">홈으로</Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (!order) {
    return (
      <Layout title="주문 조회">
        <div className="section"><div className="skeleton" style={{ height: 220 }} /></div>
      </Layout>
    )
  }

  const currentIndex = PROGRESS_ORDER.indexOf(order.state)
  const cancelled = order.state === 'CANCELLED'
  const balance = order.balance.krw

  return (
    <Layout title={`주문 ${order.orderNo}`}>
      <div className="hero">
        <h1 className="hero__title">{order.stateInfo.label}</h1>
        <p className="hero__desc">
          주문번호 <strong>{order.orderNo}</strong>
          <br />
          {order.stateInfo.description}
        </p>
      </div>

      {/* 결제가 필요한 상태면 가장 위에 청구 안내 */}
      {order.payable && balance > 0 && (
        <section className="panel">
          <div className="panel__head">
            <span>{order.state === 'SETTLEMENT_DUE' ? '차액 입금 안내' : '입금 안내'}</span>
            <span className="tag tag--warn">미납</span>
          </div>
          <div className="panel__body">
            <div className="row row--total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
              <span className="row__label">입금하실 금액</span>
              <span className="row__value">{vnd(order.balance.vnd)}</span>
            </div>
            <div className="row row--muted">
              <span className="row__label">원화 기준</span>
              <span className="row__value">{krw(balance)}</span>
            </div>

            {order.paymentRequest?.instructions && (
              <div className="note" style={{ marginTop: 12 }}>
                {order.paymentRequest.instructions.map((line, i) => (
                  <span key={i}>· {line}<br /></span>
                ))}
              </div>
            )}
            <p className="note note--warn" style={{ marginTop: 10 }}>
              적용 환율 1원 = {order.fx.effectiveRate.toFixed(2)}₫ (주문 시점 고정)
              {order.invoice.expiresAt && ` · 유효기한 ${formatDateTime(order.invoice.expiresAt)}`}
            </p>
          </div>
        </section>
      )}

      {order.payable && balance < 0 && (
        <section className="panel">
          <div className="panel__head">환불 예정</div>
          <div className="panel__body">
            <div className="row row--total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
              <span className="row__label">환불 금액</span>
              <span className="row__value">{vnd(Math.abs(order.balance.vnd))}</span>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              실측 무게가 예상보다 가벼워 차액을 환불해 드립니다.
            </p>
          </div>
        </section>
      )}

      {/* 진행 상황 */}
      <section className="panel">
        <div className="panel__head">진행 상황</div>
        <div className="panel__body">
          {cancelled ? (
            <p className="note note--danger">이 주문은 취소되었습니다.</p>
          ) : (
            PROGRESS_ORDER.map((state, i) => {
              const done = i <= currentIndex
              const current = i === currentIndex
              return (
                <div className="row" key={state} style={{ opacity: done ? 1 : 0.35 }}>
                  <span className="row__label">
                    {done ? (current ? '🔵' : '✅') : '⚪'} {ORDER_STATES[state].label}
                  </span>
                  <span className="row__value" style={{ fontWeight: current ? 800 : 500, fontSize: 12 }}>
                    {order.history.find((h) => h.state === state)
                      ? formatDateTime(order.history.find((h) => h.state === state).at)
                      : ''}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* 실측 정산 결과 */}
      {order.settlement && (
        <section className="panel">
          <div className="panel__head">
            <span>실측 정산</span>
            <span className={`tag ${order.settlement.action === 'none' ? 'tag--ok' : 'tag--weight'}`}>
              {order.settlement.label}
            </span>
          </div>
          <div className="panel__body">
            <div className="row">
              <span className="row__label">주문 시 추정 무게</span>
              <span className="row__value">{weight(order.settlement.estimatedWeightG)} → {order.settlement.quotedBillableKg}kg 청구</span>
            </div>
            <div className="row">
              <span className="row__label">창고 실측 무게</span>
              <span className="row__value">{weight(order.settlement.actualWeightG)} → {order.settlement.finalBillableKg}kg 청구</span>
            </div>
            <div className="row">
              <span className="row__label">최초 청구액</span>
              <span className="row__value">{krw(order.settlement.quotedTotalKrw)}</span>
            </div>
            <div className="row row--total">
              <span className="row__label">최종 확정액</span>
              <span className="row__value">{krw(order.settlement.finalTotalKrw)}</span>
            </div>
            {order.settlement.action === 'none' && (
              <p className="note" style={{ marginTop: 10 }}>
                차액이 크지 않아 추가 정산 없이 최초 청구액으로 확정되었습니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 결제 내역 (고객 원장) */}
      <section className="panel">
        <div className="panel__head">결제 내역</div>
        <div className="panel__body">
          {order.ledger.customer.map((e) => (
            <div className="row" key={e.id}>
              <span className="row__label">
                {e.label}
                <br />
                <small style={{ color: 'var(--ink-500)' }}>
                  {formatDateTime(e.at)}{e.memo ? ` · ${e.memo}` : ''}
                </small>
              </span>
              <span className="row__value" style={{ color: e.delta < 0 ? 'var(--ok)' : 'inherit' }}>
                {e.delta > 0 ? '+' : '−'}{krw(e.amountKrw)}
              </span>
            </div>
          ))}
          <div className="row row--total">
            <span className="row__label">
              {balance > 0 ? '미납 잔액' : balance < 0 ? '환불 예정' : '정산 완료'}
            </span>
            <span className="row__value">{balance === 0 ? '0원' : krw(Math.abs(balance))}</span>
          </div>
        </div>
      </section>

      {/* 주문 상품 */}
      <section className="panel">
        <div className="panel__head">주문 상품 ({order.items.length}종)</div>
        <div className="panel__body">
          {order.items.map((it, i) => (
            <div className="row" key={i}>
              <span className="row__label">{it.productName} × {it.quantity}</span>
              <span className="row__value">{krw(it.productPrice * it.quantity)}</span>
            </div>
          ))}
        </div>
      </section>

      {order.delivery.trackingNo && (
        <section className="panel">
          <div className="panel__head">배송 정보</div>
          <div className="panel__body">
            <div className="row">
              <span className="row__label">운송장 번호</span>
              <span className="row__value">{order.delivery.trackingNo}</span>
            </div>
          </div>
        </section>
      )}

      <div className="section">
        <Link href="/products" className="btn btn--ghost">계속 쇼핑하기</Link>
      </div>
    </Layout>
  )
}
