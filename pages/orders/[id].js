import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { PROGRESS_ORDER, ORDER_STATES } from '../../lib/order/states'
import { krw, vnd, weight, formatDateTime } from '../../lib/format'
import CopyButton from '../../components/CopyButton'
import { REFUND_DAYS, RETURN_POLICY } from '../../config/payment'
import { RETURN_SHIPPING, estimateReturnShippingUsd } from '../../config/shipping'
import { FX } from '../../config/fx'

/**
 * 고객용 주문 조회.
 * 매입 원가·마진은 API 단계에서 이미 제거되어 여기로 오지 않습니다.
 */

/** 상태 → 지금 물건이 있는 곳 (📍 위치 배너) */
const LOCATION_BY_STATE = {
  REQUESTED: '신청 완료 — 보내주시면 시작해요',
  AWAITING_PAYMENT: '신청 완료 — 보내주시면 시작해요',
  PAID: '한국 — 상품 준비 중',
  PURCHASING: '한국 — 쇼핑몰 구매 진행 중',
  PURCHASED: '한국 — 창고(서울 강서)로 이동 중',
  IN_WAREHOUSE: '한국 창고(서울 강서) 도착 — 검수·포장 중',
  SETTLEMENT_DUE: '한국 창고(서울 강서) 보관 중 — 정산 대기',
  SETTLED: '한국 창고(서울 강서) — 발송 준비 완료',
  SHIPPED: '하노이로 국제 운송 중',
  DELIVERED: '배달 완료 🎉',
  CANCELLED: '주문 취소됨',
}

/**
 * 「YS-ECOM 이름」을 칠해서 보여줍니다 — 창고가 소포 주인을 찾는 단서라
 * 눈에 띄어야 하고, 이름이 남의 것으로 남아 있으면 바로 보여야 합니다.
 */
const NAME_MARK = {
  background: '#ffe98a', color: '#191f28', padding: '1px 6px', borderRadius: 6,
  fontWeight: 900, boxShadow: 'inset 0 -2px 0 #f0b429',
}

export default function OrderPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [linkForm, setLinkForm] = useState({ coupangOrderNo: '', trackingNo: '' })
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  /** 고객 셀프 취소 — 입금 확인 전(주문 접수·입금 대기)에만 서버가 허용합니다. */
  const cancelNow = async () => {
    if (!window.confirm('이 신청을 취소할까요?\n아직 돈을 안 보내셨으니 비용 없이 바로 취소됩니다. 같은 상품으로 다시 신청하실 수 있습니다.')) return
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setOrder(d.order)
    } catch (err) {
      setCancelError(err.message)
    } finally {
      setCancelling(false)
    }
  }

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
            <span>{order.state === 'SETTLEMENT_DUE' ? '차액 보내기' : '여기로 보내주세요'}</span>
            <span className="tag tag--warn">아직 안 보내심</span>
          </div>
          <div className="panel__body">
            {/* 선택한 수단의 통화를 앞세워 보여줍니다 (KRW 계좌면 원화 먼저) */}
            <div className="row row--total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
              <span className="row__label">보내실 금액</span>
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

            {/*
              계좌번호는 손으로 옮겨 적다 틀리기 쉽습니다 — 눌러서 복사되게
              하고, 어린이·어르신도 읽을 수 있게 크게 보여줍니다.
            */}
            {order.paymentRequest?.instructions && (() => {
              const lines = order.paymentRequest.instructions
              const pick = (re) => lines.find((l) => re.test(l))?.split(':').slice(1).join(':').trim() ?? ''
              const bank = pick(/은행/)
              const account = pick(/계좌번호/)
              const holder = pick(/예금주/)
              const others = lines.filter((l) => !/은행|계좌번호|예금주/.test(l))
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ border: '2px solid #3182f6', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ background: '#3182f6', color: '#fff', padding: '10px 14px', fontWeight: 800, fontSize: 15 }}>
                      여기로 보내주세요
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ fontSize: 15, color: '#4e5968' }}>{bank}</div>
                      <CopyButton value={account.replace(/[^0-9]/g, '')} label={account}
                        style={{
                          display: 'block', width: '100%', marginTop: 6, padding: '12px 10px',
                          border: '2px dashed #3182f6', borderRadius: 10, background: '#f2f6fb',
                          fontSize: 24, fontWeight: 800, color: '#191f28', cursor: 'pointer',
                        }} />
                      <div style={{ fontSize: 15, color: '#4e5968', marginTop: 6 }}>예금주 : <b>{holder}</b></div>
                      <div style={{
                        marginTop: 12, padding: '10px 12px', borderRadius: 10,
                        background: '#fff0f0', color: '#c92a2a', fontSize: 15, fontWeight: 700, lineHeight: 1.6,
                      }}>
                        보낼 때 메모(내용)에 이 번호를 꼭 적어주세요.
                        <CopyButton value={order.orderNo}
                          style={{
                            display: 'block', width: '100%', marginTop: 8, padding: '10px',
                            border: '2px dashed #c92a2a', borderRadius: 10, background: '#fff',
                            fontSize: 20, fontWeight: 800, color: '#c92a2a', cursor: 'pointer',
                          }} />
                        <span style={{ display: 'block', marginTop: 8, fontWeight: 500, fontSize: 13.5 }}>
                          적지 않으면 누가 보내셨는지 확인이 늦어집니다.
                        </span>
                      </div>
                    </div>
                  </div>
                  {others.length > 0 && (
                    <div className="note" style={{ marginTop: 10, fontSize: 13 }}>
                      {others.map((line, i) => <span key={i}>· {line}<br /></span>)}
                    </div>
                  )}
                </div>
              )
            })()}
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
            <span>쇼핑몰 주문 안내</span>
            {order.forwardingGuide.linked && <span className="tag tag--ok">연결됨</span>}
          </div>
          <div className="panel__body">
            <p className="note">
              쇼핑몰 결제 시 배송지를 아래와 같이 입력해 주세요.
              <br />
              {/* 이름 부분을 칠해 "여기가 당신 이름" 임을 눈에 띄게 (운영자 26-09-06) */}
              <b>세부주소에 <span style={NAME_MARK}>{order.forwardingGuide.addressDetail}</span> 이(가) 있어야 창고가 접수합니다.</b>
            </p>
            <div className="note" style={{ marginTop: 10, userSelect: 'all' }}>
              · 받는 사람(이름): <b>{order.forwardingGuide.recipient}</b>
              <br />
              · 주소: {order.forwardingGuide.warehouse.address1}
              {order.forwardingGuide.warehouse.zip && ` (${order.forwardingGuide.warehouse.zip})`}
              <br />
              · 세부주소: <b style={NAME_MARK}>{order.forwardingGuide.addressDetail}</b>
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
                쇼핑몰 주문을 마치셨다면 주문번호를 등록해 주세요 — 입고·배송 추적이 빨라집니다.
              </p>
              <div className="field">
                <label className="field__label" htmlFor="coupangOrderNo">쇼핑몰 주문번호</label>
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
                {linking ? '등록 중…' : '쇼핑몰 주문 연결'}
              </button>
            </form>

            {order.inbound?.coupangOrderNo && (
              <p className="note" style={{ marginTop: 10 }}>
                연결된 쇼핑몰 주문: <b>{order.inbound.coupangOrderNo}</b>
                {order.inbound.trackingNos.length > 0
                  ? <> · 운송장 {order.inbound.trackingNos.join(', ')}</>
                  : <><br /><small>📦 쇼핑몰에서 발송 알림을 받으면 위 폼에 운송장 번호도 등록해 주세요 — 창고 입고 확인이 빨라집니다.</small></>}
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
              실측 무게가 예상보다 가벼워 차액을 환불해 드립니다. 환불은{' '}
              <b>영업일 기준 {REFUND_DAYS.min}~{REFUND_DAYS.max}일</b> 내 지급됩니다.
            </p>
          </div>
        </section>
      )}

      {/* 진행 상황 */}
      <section className="panel">
        <div className="panel__head">진행 상황</div>
        <div className="panel__body">
          {cancelled ? (
            <p className="note note--danger">
              이 주문은 취소되었습니다. 같은 상품이 필요하시면 쇼핑몰 화면에서 다시 접수해
              주세요 — 취소된 주문은 중복으로 잡히지 않습니다.
            </p>
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
            <span>실제로 달아본 무게</span>
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
              <span className="row__label">처음 안내한 금액</span>
              <span className="row__value">{krw(order.settlement.quotedTotalKrw)}</span>
            </div>
            <div className="row row--total">
              <span className="row__label">최종 확정액</span>
              <span className="row__value">{krw(order.settlement.finalTotalKrw)}</span>
            </div>
            {order.settlement.action === 'none' && (
              <p className="note" style={{ marginTop: 10 }}>
                차액이 크지 않아 처음 안내한 금액 그대로 확정되었습니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 결제 내역 (고객 원장) */}
      <section className="panel">
        <div className="panel__head">주고받은 내역</div>
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
              {balance > 0 ? '아직 보내실 금액' : balance < 0 ? '돌려드릴 금액' : '정리 끝'}
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

      {/* 입금 확인 전에는 고객이 직접 취소할 수 있습니다 (중복 접수 정리 포함) */}
      {['REQUESTED', 'AWAITING_PAYMENT'].includes(order.state) && (
        <div className="section" style={{ paddingBottom: 0 }}>
          {cancelError && <p className="note note--danger">{cancelError}</p>}
          <button type="button" className="btn btn--ghost" disabled={cancelling} onClick={cancelNow}
            style={{ color: '#c92a2a', borderColor: '#ffc9c9', width: '100%' }}>
            {cancelling ? '취소 중…' : '이 신청 취소하기'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-500)', marginTop: 6 }}>
            보내시기 전에는 비용 없이 바로 취소됩니다 · 실수로 두 번 신청한 것도 여기서 정리하세요
          </p>
        </div>
      )}

      {/* 입금 후 ~ 매입 전 — 셀프 취소는 닫히지만 아직 취소가 가능한 구간 */}
      {order.state === 'PAID' && (
        <div className="section" style={{ paddingBottom: 0 }}>
          <p className="note" style={{ fontSize: 12 }}>
            취소가 필요하시면 <b>빠르게 연락 주세요</b> — 쇼핑몰 매입 시작 전에는 취소할 수 있습니다.
            품절·가격 인상 등 당사 사유는 <b style={{ color: '#17916b' }}>전액 환불</b>, 단순 변심은{' '}
            {order.track === 'agent' ? '대행수수료 제외' : `처리 수수료 $${RETURN_POLICY.forwardingRefundFeeUsd} 차감`} 후
            환불되며, 지급은 영업일 {REFUND_DAYS.min}~{REFUND_DAYS.max}일입니다.
          </p>
        </div>
      )}

      {/* 환불·교환·반품 정책 + 이 주문 기준 비용 미리보기 (운영자 확정 26-08-30) */}
      {!cancelled && (() => {
        const goodsKrw = order.items.reduce(
          (s, i) => s + (Number(i.productPrice) || 0) * (Number(i.quantity) || 1), 0,
        )
        const billableKg = order.quote?.shipping?.billableKg ?? 1
        // 구매대행 반품·교환은 반송 접수·확인 대행 처리 기본료가 붙습니다.
        const handlingKrw = order.track === 'agent' ? (RETURN_SHIPPING.agentHandlingKrw ?? 0) : 0
        const backUsd = estimateReturnShippingUsd(billableKg)
        const backKrw = Math.round(backUsd * FX.usdToKrw) + handlingKrw
        const freightKrw = order.quote?.breakdown?.find((r) => r.key === 'freight')?.krw ?? 0
        const agencyKrw = order.track === 'agent' ? (order.quote?.agency?.fee ?? 0) : 0
        const roundTripKrw = backKrw + freightKrw + agencyKrw
        return (
          <div className="section" style={{ paddingBottom: 0 }}>
            <p className="note" style={{ fontSize: 12, lineHeight: 1.75 }}>
              💳 환불은 <b>영업일 {REFUND_DAYS.min}~{REFUND_DAYS.max}일</b> 내 지급 · ⛔ 반품·변심 취소는{' '}
              {order.track === 'agent' ? '대행수수료 제외 후' : `처리 수수료 $${RETURN_POLICY.forwardingRefundFeeUsd} 차감 후`} 환불
              (당사 사유 취소는 전액 환불)
              <br />
              ↩️ 하노이 도착 후 교환·반품 시{' '}
              <b style={{ color: '#c92a2a' }}>반송비(하노이→한국)·쇼핑몰 반품비 전액 구매자 부담</b>
              {freightKrw > 0 && (
                <>
                  <br />
                  ↔️ 이 주문 기준: 보낼 때 약 <b>{krw(backKrw)}</b>
                  {RETURN_SHIPPING.assumed ? '(예상)' : ''} + 다시 받을 때 <b>{krw(freightKrw + agencyKrw)}</b> =
                  교환 왕복 약 <b style={{ color: '#d9480f' }}>{krw(roundTripKrw)}</b>
                  {goodsKrw > 0 && roundTripKrw >= goodsKrw && (
                    <b style={{ color: '#c92a2a' }}> — 상품가({krw(goodsKrw)})보다 커서 실익이 없습니다</b>
                  )}
                </>
              )}
              <br />
              <small style={{ color: '#c92a2a', fontWeight: 700 }}>
                ⚠️ {RETURN_SHIPPING.blockedNote} — 해당 품목은 교환·반품 불가.
              </small>{' '}
              <small>{RETURN_SHIPPING.customsNote}.</small>
            </p>
          </div>
        )
      })()}

      <div className="section" style={{ display: 'grid', gap: 10 }}>
        {/* 쇼핑은 쿠팡에서 — 확장 패널이 다시 견적을 띄워줍니다 */}
        <a href="https://www.coupang.com" className="btn" target="_blank" rel="noreferrer">
          쇼핑몰에서 계속 쇼핑하기 ↗
        </a>
        <Link href="/orders" className="btn btn--ghost">내 주문 목록</Link>
      </div>
    </Layout>
  )
}
