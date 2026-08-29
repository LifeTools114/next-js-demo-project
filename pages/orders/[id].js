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

/** 상태 → 지금 물건이 있는 곳 (📍 위치 배너) */
const LOCATION_BY_STATE = {
  REQUESTED: '주문 접수 — 입금 확인 대기',
  AWAITING_PAYMENT: '주문 접수 — 입금 확인 대기',
  PAID: '한국 — 상품 준비 중',
  PURCHASING: '한국 — 쿠팡 구매 진행 중',
  PURCHASED: '한국 — 창고(서울 강서)로 이동 중',
  IN_WAREHOUSE: '한국 창고(서울 강서) 도착 — 검수·포장 중',
  SETTLEMENT_DUE: '한국 창고(서울 강서) 보관 중 — 정산 대기',
  SETTLED: '한국 창고(서울 강서) — 발송 준비 완료',
  SHIPPED: '하노이로 국제 운송 중',
  DELIVERED: '배달 완료 🎉',
  CANCELLED: '주문 취소됨',
}

export default function OrderPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [linkForm, setLinkForm] = useState({ coupangOrderNo: '', trackingNo: '' })
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState(null)

  const submitLink = async (e) => {
    e.preventDefault()
    if (!linkForm.coupangOrderNo.trim() && !linkForm.trackingNo.trim()) return
    setLinking(true)
    setLinkError(null)
    try {
      const res = await fetch(`/api/orders/${id}/link-coupang`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkForm),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setOrder(d.order)
      setLinkForm({ coupangOrderNo: '', trackingNo: '' })
    } catch (err) {
      setLinkError(err.message)
    } finally {
      setLinking(false)
    }
  }

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

      {/* 구매대행 — 표시가 그대로 주문한다는 약속과 예외(품절·마감·가격 변동) 안내 */}
      {order.track === 'agent' && !cancelled && (
        <div className="section" style={{ paddingBottom: 0 }}>
          <p className="note" style={{ fontSize: 12.5 }}>
            🛒 신청서의 상품가 <b>그대로</b> 대리 주문합니다 (와우회원가 기준 ·
            쿠폰·신규가입 할인 등 <b>개인 혜택은 사용할 수 없고</b>, 기간 한정
            할인가는 발주 시점에 종료되면 반영되지 않을 수 있습니다).
            발주 시 가격 인상·품절·마감이 확인되면 임의로 구매하지 않고 연락드리며,
            취소 시 전액 환불됩니다.
          </p>
        </div>
      )}

      {/* 결제가 필요한 상태면 가장 위에 청구 안내 */}
      {order.payable && balance > 0 && (
        <section className="panel">
          <div className="panel__head">
            <span>{order.state === 'SETTLEMENT_DUE' ? '차액 입금 안내' : '입금 안내'}</span>
            <span className="tag tag--warn">미납</span>
          </div>
          <div className="panel__body">
            {/* 선택한 수단의 통화를 앞세워 보여줍니다 (KRW 계좌면 원화 먼저) */}
            <div className="row row--total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
              <span className="row__label">입금하실 금액</span>
              <span className="row__value">
                {order.paymentRequest?.chargeCurrency === 'KRW' ? krw(balance) : vnd(order.balance.vnd)}
              </span>
            </div>
            <div className="row row--muted">
              <span className="row__label">{order.paymentRequest?.chargeCurrency === 'KRW' ? '동화 기준' : '원화 기준'}</span>
              <span className="row__value">
                {order.paymentRequest?.chargeCurrency === 'KRW' ? vnd(order.balance.vnd) : krw(balance)}
              </span>
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

      {/* 📍 지금 위치 — 파트너의 도착·통관·배송일정 보고가 그대로 반영됩니다 */}
      {!cancelled && (
        <section className="panel">
          <div className="panel__head">내 물건 위치</div>
          <div className="panel__body">
            <div className="row row--total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
              <span className="row__label">📍 현재</span>
              <span className="row__value">
                {(order.state === 'SHIPPED' && order.delivery?.milestones?.length > 0
                  ? order.delivery.milestones[order.delivery.milestones.length - 1].label
                  : null) ?? LOCATION_BY_STATE[order.state] ?? order.stateInfo.label}
              </span>
            </div>
            {order.delivery?.scheduledText && !order.delivery?.deliveredAt && (
              <div className="row">
                <span className="row__label">🚚 배달 예정</span>
                <span className="row__value">{order.delivery.scheduledText}</span>
              </div>
            )}
            {order.delivery?.trackingNo && (
              <div className="row row--muted">
                <span className="row__label">국제 운송장</span>
                <span className="row__value">{order.delivery.trackingNo}</span>
              </div>
            )}
            {order.delivery?.milestones?.length > 0 && (
              <div className="note" style={{ marginTop: 10 }}>
                {order.delivery.milestones.map((m, i) => (
                  <span key={i}>· {formatDateTime(m.at)} — {m.label}<br /></span>
                ))}
              </div>
            )}
            {order.state === 'SHIPPED' && !order.delivery?.scheduledText && (
              <p className="note" style={{ marginTop: 10 }}>
                하노이 도착 후 배달 일정이 확정되면 여기에 표시됩니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 배송대행: 쿠팡 주문 방법 + 주문 연결 (소포가 창고에 닿기 전까지) */}
      {order.forwardingGuide && (
        <section className="panel">
          <div className="panel__head">
            <span>쿠팡 주문 안내</span>
            {order.forwardingGuide.linked && <span className="tag tag--ok">연결됨</span>}
          </div>
          <div className="panel__body">
            <p className="note">
              쿠팡 결제 시 배송지를 아래와 같이 입력해 주세요.
              <br />
              <b>세부주소의 {order.forwardingGuide.addressDetail} 코드가 있어야 창고가 접수합니다.</b>
            </p>
            <div className="note" style={{ marginTop: 10, userSelect: 'all' }}>
              · 받는 사람(이름): <b>{order.forwardingGuide.recipient}</b>
              <br />
              · 주소: {order.forwardingGuide.warehouse.address1}
              {order.forwardingGuide.warehouse.zip && ` (${order.forwardingGuide.warehouse.zip})`}
              <br />
              · 세부주소: <b>{order.forwardingGuide.addressDetail}</b>
              {order.forwardingGuide.warehouse.address2 && ` ${order.forwardingGuide.warehouse.address2}`}
              <br />
              {order.forwardingGuide.warehouse.phone && <>· 연락처: {order.forwardingGuide.warehouse.phone}</>}
            </div>
            {!order.forwardingGuide.warehouse.configured && (
              <p className="note note--warn" style={{ marginTop: 8 }}>
                창고 주소는 물류 파트너 확정 후 안내됩니다.
              </p>
            )}

            <form onSubmit={submitLink} style={{ marginTop: 14 }}>
              <p className="note" style={{ marginBottom: 8 }}>
                쿠팡 주문을 마치셨다면 주문번호를 등록해 주세요 — 입고·배송 추적이 빨라집니다.
              </p>
              <div className="field">
                <label className="field__label" htmlFor="coupangOrderNo">쿠팡 주문번호</label>
                <input id="coupangOrderNo" className="input" inputMode="numeric" placeholder="예: 29000123456789"
                  value={linkForm.coupangOrderNo}
                  onChange={(e) => setLinkForm({ ...linkForm, coupangOrderNo: e.target.value })} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="trackingNo">운송장 번호 (아는 경우만)</label>
                <input id="trackingNo" className="input" placeholder="예: 6890 1234 5678"
                  value={linkForm.trackingNo}
                  onChange={(e) => setLinkForm({ ...linkForm, trackingNo: e.target.value })} />
              </div>
              {linkError && <p className="note note--danger">{linkError}</p>}
              <button className="btn" type="submit"
                disabled={linking || (!linkForm.coupangOrderNo.trim() && !linkForm.trackingNo.trim())}>
                {linking ? '등록 중…' : '쿠팡 주문 연결'}
              </button>
            </form>

            {order.inbound?.coupangOrderNo && (
              <p className="note" style={{ marginTop: 10 }}>
                연결된 쿠팡 주문: <b>{order.inbound.coupangOrderNo}</b>
                {order.inbound.trackingNos.length > 0
                  ? <> · 운송장 {order.inbound.trackingNos.join(', ')}</>
                  : <><br /><small>📦 쿠팡에서 발송 알림을 받으면 위 폼에 운송장 번호도 등록해 주세요 — 창고 입고 확인이 빨라집니다.</small></>}
              </p>
            )}
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
