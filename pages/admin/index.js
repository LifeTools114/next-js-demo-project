import { useCallback, useEffect, useRef, useState } from 'react'
import Layout from '../../components/Layout'
import { ORDER_STATES, TRANSITIONS } from '../../lib/order/states'
import { krw, vnd, weight, formatDateTime } from '../../lib/format'

/**
 * 운영자 콘솔 — 두 거래를 각각 처리합니다.
 *
 *   [거래 A] 고객 입금 확인 / 차액 정산
 *   [거래 B] 쿠팡 매입 기록 / 실측 / 실비 입력
 *
 * 이 화면에서만 매입 원가와 실마진이 보입니다.
 * 고객용 API(/api/orders/:id)는 이 정보를 내려주지 않습니다.
 */

const TOKEN_KEY = 'kbeauty-hanoi:admin-token'

/** 현재 상태에서 실행 가능한 작업 */
const ACTIONS_BY_STATE = {
  AWAITING_PAYMENT: [
    { action: 'confirmPayment', label: '입금 확인', primary: true },
    { action: 'cancelOrder', label: '주문 취소' },
  ],
  PAID: [
    { action: 'startPurchase', label: '매입 착수', primary: true },
    { action: 'cancelOrder', label: '주문 취소 (전액 환불)' },
  ],
  PURCHASING: [{ action: 'recordPurchase', label: '매입 완료 기록', primary: true, form: 'purchase' }],
  PURCHASED: [{ action: 'recordWeighing', label: '입고·실측 등록', primary: true, form: 'weighing' }],
  IN_WAREHOUSE: [{ action: 'applySettlement', label: '정산 적용', primary: true }],
  SETTLEMENT_DUE: [{ action: 'closeSettlement', label: '차액 처리 완료', primary: true }],
  SETTLED: [{ action: 'markShipped', label: '발송 처리', primary: true, form: 'shipping' }],
  SHIPPED: [{ action: 'markDelivered', label: '배송 완료', primary: true }],
}

export default function AdminConsole() {
  const [token, setToken] = useState('')
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [forms, setForms] = useState({})
  // 토큰 로드 전후로 요청이 두 번 나가며, 먼저 보낸 실패 응답이
  // 나중에 도착해 성공 결과를 덮어쓰는 경쟁 상태를 막습니다.
  const reqRef = useRef(0)

  useEffect(() => {
    try {
      setToken(window.localStorage.getItem(TOKEN_KEY) ?? '')
    } catch { /* 저장소 접근 불가 */ }
  }, [])

  const load = useCallback(async () => {
    const seq = (reqRef.current += 1)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/orders', { headers: { 'x-admin-token': token } })
      const data = await res.json()
      // 더 최신 요청이 이미 나갔다면 이 응답은 버립니다.
      if (seq !== reqRef.current) return
      if (!res.ok) throw new Error(data.error)
      setOrders(data.orders)
    } catch (e) {
      if (seq !== reqRef.current) return
      setError(e.message)
      setOrders([])
    } finally {
      if (seq === reqRef.current) setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const run = async (orderNo, action, payload = {}) => {
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderNo}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ action, payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const setField = (id, key, value) =>
    setForms((f) => ({ ...f, [id]: { ...(f[id] ?? {}), [key]: value } }))

  const saveToken = (v) => {
    setToken(v)
    try { window.localStorage.setItem(TOKEN_KEY, v) } catch { /* 무시 */ }
  }

  return (
    <Layout title="운영자 콘솔">
      <div className="hero">
        <h1 className="hero__title">운영자 콘솔</h1>
        <p className="hero__desc">
          고객 결제(거래 A)와 쿠팡 매입(거래 B)을 각각 기록합니다.
          이 화면에서만 매입 원가와 실마진이 보입니다.
        </p>
      </div>

      <div className="section">
        <div className="field" style={{ marginBottom: 8 }}>
          <label className="field__label" htmlFor="tok">ADMIN_TOKEN</label>
          <input id="tok" className="input" type="password" value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="환경변수 ADMIN_TOKEN 값 (미설정 시 개발 환경에서는 비워도 됨)" />
        </div>
        <button className="btn btn--ghost" onClick={load} disabled={loading}>
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>

      {error && <div className="section" style={{ paddingTop: 0 }}><p className="note note--danger">{error}</p></div>}

      {orders.length === 0 && !error && !loading && (
        <div className="empty"><div className="empty__icon">📋</div>주문이 없습니다.</div>
      )}

      {orders.map((o) => {
        const actions = ACTIONS_BY_STATE[o.state] ?? []
        const f = forms[o.orderNo] ?? {}
        const s = o.ledgerSummary
        return (
          <section className="panel" key={o.orderNo}>
            <div className="panel__head">
              <span>{o.orderNo}</span>
              <span className="tag tag--weight">{o.stateInfo.label}</span>
            </div>
            <div className="panel__body">
              <div className="row row--muted">
                <span className="row__label">{o.customer.name} · {o.customer.phone}</span>
                <span className="row__value">{formatDateTime(o.createdAt)}</span>
              </div>

              {/* 거래 A — 고객 */}
              <div className="row" style={{ marginTop: 8 }}>
                <span className="row__label"><strong>[거래 A] 고객 청구</strong></span>
                <span className="row__value">{krw(s.billedKrw)}</span>
              </div>
              <div className="row">
                <span className="row__label">고객 입금 (실수취)</span>
                <span className="row__value">{krw(s.netReceivedKrw)} / {vnd(Math.round(s.netReceivedKrw * o.fx.effectiveRate))}</span>
              </div>
              <div className="row">
                <span className="row__label">잔액</span>
                <span className="row__value" style={{ color: s.balanceKrw === 0 ? 'var(--ok)' : 'var(--danger)' }}>
                  {s.balanceKrw === 0 ? '정산됨' : krw(s.balanceKrw)}
                </span>
              </div>

              {/* 거래 B — 매입 */}
              <div className="row" style={{ marginTop: 8 }}>
                <span className="row__label"><strong>[거래 B] 실지출</strong></span>
                <span className="row__value">{krw(s.disbursedKrw)}</span>
              </div>
              {Object.entries(s.disbursedByType).map(([type, amt]) => (
                <div className="row row--muted" key={type}>
                  <span className="row__label">└ {type}</span>
                  <span className="row__value">{krw(amt)}</span>
                </div>
              ))}

              <div className="row row--total">
                <span className="row__label">
                  실마진 {o.revenue.confirmed ? '(확정)' : '(진행 중)'}
                </span>
                <span className="row__value" style={{ color: o.revenue.netRevenueKrw >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                  {krw(o.revenue.netRevenueKrw)}
                </span>
              </div>
              {o.revenue.confirmed ? (
                <p className="note" style={{ marginTop: 8, fontSize: 11.5 }}>
                  세무상 매출은 순액 {krw(o.revenue.netRevenueKrw)} 입니다.
                  총액 {krw(o.revenue.grossIfPrincipalKrw)} 로 신고하면 안 됩니다.
                </p>
              ) : (
                <p className="note note--warn" style={{ marginTop: 8, fontSize: 11.5 }}>
                  아직 지출이 다 기록되지 않아 이 마진은 확정값이 아닙니다.
                  매입·실비 입력과 정산이 끝나야 세무상 매출이 확정됩니다.
                </p>
              )}

              {o.settlement && (
                <p className="note note--warn" style={{ marginTop: 8, fontSize: 11.5 }}>
                  실측 {weight(o.settlement.actualWeightG)} (추정 {weight(o.settlement.estimatedWeightG)},
                  오차 {(o.settlement.weightErrorRate * 100).toFixed(1)}%) → {o.settlement.label}
                  {o.settlement.diffKrw !== 0 && ` ${krw(Math.abs(o.settlement.diffKrw))}`}
                  {o.settlement.requiresReview && ' ⚠️ 추가 청구가 과대합니다. 확인 필요'}
                </p>
              )}

              {/* 작업 입력 폼 */}
              {actions.some((a) => a.form === 'purchase') && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <input className="input" placeholder="쿠팡 주문번호"
                    value={f.coupangOrderNo ?? ''}
                    onChange={(e) => setField(o.orderNo, 'coupangOrderNo', e.target.value)} />
                  <input className="input" type="number" placeholder="실제 매입 금액 (원)"
                    value={f.amountKrw ?? ''}
                    onChange={(e) => setField(o.orderNo, 'amountKrw', e.target.value)} />
                </div>
              )}

              {actions.some((a) => a.form === 'weighing') && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <input className="input" type="number" placeholder="실측 무게 (g)"
                    value={f.actualWeightG ?? ''}
                    onChange={(e) => setField(o.orderNo, 'actualWeightG', e.target.value)} />
                  {['FREIGHT', 'DUTY', 'VAT', 'WAREHOUSE', 'LAST_MILE'].map((k) => (
                    <input key={k} className="input" type="number" placeholder={`${k} 실비 (원)`}
                      value={f[k] ?? ''} onChange={(e) => setField(o.orderNo, k, e.target.value)} />
                  ))}
                </div>
              )}

              {actions.some((a) => a.form === 'shipping') && (
                <div style={{ marginTop: 12 }}>
                  <input className="input" placeholder="운송장 번호"
                    value={f.trackingNo ?? ''}
                    onChange={(e) => setField(o.orderNo, 'trackingNo', e.target.value)} />
                </div>
              )}

              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {actions.map((a) => (
                  <button key={a.action}
                    className={`btn ${a.primary ? '' : 'btn--ghost'}`}
                    onClick={() => {
                      const payload =
                        a.form === 'purchase'
                          ? { coupangOrderNo: f.coupangOrderNo, amountKrw: Number(f.amountKrw) }
                          : a.form === 'weighing'
                            ? {
                                actualWeightG: Number(f.actualWeightG),
                                costs: Object.fromEntries(
                                  ['FREIGHT', 'DUTY', 'VAT', 'WAREHOUSE', 'LAST_MILE']
                                    .filter((k) => Number(f[k]) > 0)
                                    .map((k) => [k, Number(f[k])]),
                                ),
                              }
                            : a.form === 'shipping'
                              ? { trackingNo: f.trackingNo }
                              : {}
                      run(o.orderNo, a.action, payload)
                    }}>
                    {a.label}
                  </button>
                ))}
                {actions.length === 0 && (
                  <p className="note" style={{ fontSize: 12 }}>
                    이 상태에서 가능한 작업이 없습니다. (다음 가능 상태: {(TRANSITIONS[o.state] ?? []).map((t) => ORDER_STATES[t].label).join(', ') || '없음'})
                  </p>
                )}
              </div>
            </div>
          </section>
        )
      })}
    </Layout>
  )
}
