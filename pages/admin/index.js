import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { ORDER_STATES, TRANSITIONS } from '../../lib/order/states'
import { krw, vnd, weight, formatDateTime } from '../../lib/format'
import { maintenanceStatus, checkAction } from '../../lib/maintenance'
import { DESTINATION } from '../../config/eligibility'

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
    // 당사 사유(품절·가격 인상 등)는 전액 환불 — 화면 약속 그대로
    { action: 'cancelOrder', label: '주문 취소 (당사 사유 — 전액 환불)' },
    // 고객 변심은 실비 차감: 구매대행 수수료 / 배송대행 $1 (RETURN_POLICY)
    { action: 'cancelOrder', label: '고객 변심 취소 (수수료 차감 환불)', payload: { customerFault: true } },
  ],
  PURCHASING: [{ action: 'recordPurchase', label: '매입 완료 기록', primary: true, form: 'purchase' }],
  PURCHASED: [{ action: 'recordWeighing', label: '입고·실측 등록', primary: true, form: 'weighing' }],
  IN_WAREHOUSE: [{ action: 'applySettlement', label: '정산 적용', primary: true }],
  SETTLEMENT_DUE: [{ action: 'closeSettlement', label: '차액 처리 완료', primary: true }],
  SETTLED: [{ action: 'markShipped', label: '발송 처리', primary: true, form: 'shipping' }],
  SHIPPED: [{ action: 'markDelivered', label: '배송 완료', primary: true }],
}

/** 입금 대조 실패 사유 → 사람이 읽는 설명 */
const DEPOSIT_REASON_LABELS = {
  'no-order-no': '이체 메모에 주문번호 없음',
  'order-not-found': '주문번호 불일치',
  'not-payable': '결제 대기 상태 아님 (중복 입금?)',
  underpaid: '부족 입금',
  overpaid: '초과 입금 (확인은 완료)',
  'confirm-failed': '자동 확인 실패 (경합)',
  'invalid-amount': '금액 형식 오류',
  'unsupported-currency': '지원하지 않는 통화',
}

export default function AdminConsole() {
  const [token, setToken] = useState('')
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [forms, setForms] = useState({})
  // 발송 묶음 — 선택한 주문들을 마스터 AWB 하나로 일괄 발송합니다.
  const [shipSel, setShipSel] = useState({})
  const [masterAwb, setMasterAwb] = useState('')
  const [shipMsg, setShipMsg] = useState(null)
  // 자동화가 남긴 검토 건 (대조 실패 입금, 캡처 보류)
  const [review, setReview] = useState(null)
  // 점검 상태는 시간이 지나면 바뀌므로 주기적으로 갱신합니다.
  const [maint, setMaint] = useState(null)
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
      // 검토 큐는 부가 정보라 실패해도 주문 목록을 막지 않습니다.
      fetch('/api/admin/review', { headers: { 'x-admin-token': token } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (seq === reqRef.current && d) setReview(d) })
        .catch(() => {})
    } catch (e) {
      if (seq !== reqRef.current) return
      setError(e.message)
      setOrders([])
    } finally {
      if (seq === reqRef.current) setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const tick = () => setMaint(maintenanceStatus(new Date(), DESTINATION.country))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  const run = async (orderNo, action, payload = {}) => {
    setError(null)
    // 점검 중 매입은 서버가 503 으로 막습니다. 운영자가 확인하면 강제 실행할 수 있습니다.
    if (['startPurchase', 'recordPurchase'].includes(action) && maint?.active && !payload.override) {
      const ok = window.confirm(
        `${maint.label}입니다 (${maint.timezoneHint}).\n\n` +
          `${maint.minutesUntilEnd}분 뒤 자동으로 재개됩니다.\n` +
          '쿠팡이 실제로는 정상이라면 지금 강제로 진행할 수 있습니다. 강제 진행할까요?',
      )
      if (!ok) return
      payload = { ...payload, override: true }
    }
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn--ghost" onClick={load} disabled={loading}>
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
          <Link href="/admin/intake" className="btn btn--ghost">📦 창고 입고 화면</Link>
          <button className="btn btn--ghost" onClick={async () => {
            // 전체 주문 목록(무게·쿠팡 주문번호 포함)을 엑셀용 CSV 로 내려받습니다.
            setError(null)
            const res = await fetch('/api/admin/orders-export', { headers: { 'x-admin-token': token } })
            if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? '다운로드에 실패했습니다.')
            const blob = await res.blob()
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'orders.csv'
            a.click()
            URL.revokeObjectURL(a.href)
          }}>📄 주문 목록 엑셀</button>
        </div>
      </div>

      {maint?.notice && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className={`note ${maint.active ? 'note--warn' : ''}`}>
            {maint.active ? '🌙' : maint.soon ? '⏰' : '✅'} <strong>{maint.active ? maint.label : maint.soon ? '곧 점검 시작' : '점검 종료'}</strong>
            <br />
            {maint.notice}
            <br />
            <small>{maint.timezoneHint} · 한국 현재 {maint.nowKst}</small>
          </p>
        </div>
      )}

      {error && <div className="section" style={{ paddingTop: 0 }}><p className="note note--danger">{error}</p></div>}

      {/* 검토 필요 — 자동화가 처리하지 못하고 남긴 건들 */}
      {(review?.paymentReview?.length > 0 || review?.captureReview?.length > 0) && (
        <section className="panel">
          <div className="panel__head">
            <span>검토 필요</span>
            <span className="tag tag--warn">{(review.paymentReview?.length ?? 0) + (review.captureReview?.length ?? 0)}건</span>
          </div>
          <div className="panel__body">
            {review.paymentReview?.map((r, i) => (
              <div className="row" key={`p${i}`}>
                <span className="row__label">
                  💰 {DEPOSIT_REASON_LABELS[r.reason] ?? r.reason ?? r.event}
                  {r.orderNo && ` · ${r.orderNo}`}
                  {r.memo && <small> — 메모 &quot;{String(r.memo).slice(0, 40)}&quot;</small>}
                </span>
                <span className="row__value">
                  {r.amount ? `${Number(r.amount).toLocaleString('ko-KR')} ${r.currency ?? ''}` : ''}
                  {r.surplus ? `+${Number(r.surplus).toLocaleString('ko-KR')} ${r.currency ?? ''}` : ''}
                  <small> {r.at ? formatDateTime(r.at) : ''}</small>
                </span>
              </div>
            ))}
            {review.captureReview?.map((r, i) => (
              <div className="row" key={`c${i}`}>
                <span className="row__label">
                  🧾 쿠팡 캡처 보류 — {r.reason === 'ambiguous' ? `매입 중 ${r.candidates?.length ?? 0}건이라 미기록` : '매입 중 주문 없음'}
                  <small> 쿠팡 {r.coupangOrderNo}</small>
                </span>
                <span className="row__value">
                  {Number(r.amountKrw ?? 0).toLocaleString('ko-KR')}원 <small>{r.at ? formatDateTime(r.at) : ''}</small>
                </span>
              </div>
            ))}
            <p className="note" style={{ marginTop: 8 }}>
              입금 건은 은행 내역과 대조 후 해당 주문에서 [입금 확인]을, 캡처 건은 발주 목록에서 [매입 완료 기록]을 눌러 처리하세요.
            </p>
          </div>
        </section>
      )}

      {/* 발송 묶음 — SETTLED 주문 선택 → 매니페스트 CSV → 마스터 AWB 로 일괄 발송 */}
      {orders.some((o) => o.state === 'SETTLED') && (
        <section className="panel">
          <div className="panel__head">
            <span>발송 준비 ({orders.filter((o) => o.state === 'SETTLED').length}건)</span>
            <span className="tag tag--ok">SETTLED</span>
          </div>
          <div className="panel__body">
            {orders.filter((o) => o.state === 'SETTLED').map((o) => (
              <label key={o.orderNo} className="row" style={{ cursor: 'pointer' }}>
                <span className="row__label">
                  <input type="checkbox" checked={Boolean(shipSel[o.id])}
                    onChange={(e) => setShipSel({ ...shipSel, [o.id]: e.target.checked })} />
                  {' '}{o.orderNo} · {o.customer.name}
                </span>
                <span className="row__value">
                  {o.procurement?.actualWeightG ? `${(o.procurement.actualWeightG / 1000).toFixed(2)}kg` : '-'}
                </span>
              </label>
            ))}
            <div className="field" style={{ marginTop: 10 }}>
              <label className="field__label" htmlFor="awb">마스터 AWB (물류사 운송장)</label>
              <input id="awb" className="input" value={masterAwb} placeholder="예: HAN-260901-01"
                onChange={(e) => setMasterAwb(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn--ghost" onClick={async () => {
                const ids = Object.keys(shipSel).filter((id) => shipSel[id])
                const qs = ids.length > 0 ? `?ids=${ids.join(',')}` : ''
                const res = await fetch(`/api/admin/manifest${qs}`, { headers: { 'x-admin-token': token } })
                if (!res.ok) return setShipMsg((await res.json()).error)
                const blob = await res.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'manifest.csv'
                a.click()
                URL.revokeObjectURL(a.href)
              }}>매니페스트 CSV</button>
              <button className="btn" disabled={!masterAwb.trim() || !Object.values(shipSel).some(Boolean)}
                onClick={async () => {
                  const ids = Object.keys(shipSel).filter((id) => shipSel[id])
                  const res = await fetch('/api/admin/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
                    body: JSON.stringify({ ids, masterAwb }),
                  })
                  const d = await res.json()
                  setShipMsg(res.ok
                    ? `발송 처리 ${d.shipped.length}건${d.failed.length ? ` · 실패 ${d.failed.length}건` : ''}`
                    : d.error)
                  setShipSel({})
                  setMasterAwb('')
                  load()
                }}>일괄 발송</button>
            </div>
            {shipMsg && <p className="note" style={{ marginTop: 8 }}>{shipMsg}</p>}
            <p className="note" style={{ marginTop: 8 }}>
              선택 없이 CSV 를 누르면 발송 준비 전체가 담깁니다. 물류사 양식은 config/manifest.js 에서 바꿉니다.
            </p>
          </div>
        </section>
      )}

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
                  {o.quote?.sourcing?.hasOverseas && (
                    <div className="note note--warn" style={{ fontSize: 11.5 }}>
                      🌏 해외직구 상품이 포함되어 있습니다. 입고된 실제 상품이 주문과 같은지,
                      쿠팡에서 관·부가세가 별도로 부과되었는지 확인한 뒤 등록하세요.
                      <br />
                      <label style={{ display: 'block', marginTop: 8 }}>
                        <input type="checkbox" checked={f.recheckConfirmed ?? false}
                          onChange={(e) => setField(o.orderNo, 'recheckConfirmed', e.target.checked)} />
                        {' '}상품 정보·비용을 확인했습니다
                      </label>
                      <label style={{ display: 'block', marginTop: 4 }}>
                        <input type="checkbox" checked={f.productMismatch ?? false}
                          onChange={(e) => setField(o.orderNo, 'productMismatch', e.target.checked)} />
                        {' '}입고 상품이 주문과 다릅니다
                      </label>
                      <input className="input" type="number" style={{ marginTop: 8 }}
                        placeholder="쿠팡 관·부가세 등 추가 비용 (원)"
                        value={f.recheckExtraKrw ?? ''}
                        onChange={(e) => setField(o.orderNo, 'recheckExtraKrw', e.target.value)} />
                    </div>
                  )}
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

              {/*
                견적서 — 임시본은 접수 즉시 고객에게 보내고, 물류사 청구서
                (DEBIT NOTE)가 오면 실측 무게만 입력해 최종본을 만듭니다.
                청구서의 단가·금액은 당사 원가라 입력하지도 저장하지도 않습니다.
              */}
              <div style={{ marginTop: 12, padding: 10, border: '1px solid #e5e8eb', borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📄 견적서</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  <input className="input" placeholder="실측 무게 C/Weight (kg)"
                    value={f.dnKg ?? ''} onChange={(e) => setField(o.orderNo, 'dnKg', e.target.value)} />
                  <input className="input" placeholder="운송장 HAWB"
                    value={f.dnHawb ?? ''} onChange={(e) => setField(o.orderNo, 'dnHawb', e.target.value)} />
                  <input className="input" placeholder="항공편 (예: KE0361)"
                    value={f.dnFlight ?? ''} onChange={(e) => setField(o.orderNo, 'dnFlight', e.target.value)} />
                  <input className="input" placeholder="도착일 ETA (2026-08-19)"
                    value={f.dnEta ?? ''} onChange={(e) => setField(o.orderNo, 'dnEta', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <a className="btn btn--ghost" href={`/quote/${o.id}?kind=provisional`} target="_blank" rel="noreferrer">
                    임시 견적서 열기
                  </a>
                  <button className="btn" disabled={!(Number(f.dnKg) > 0)}
                    onClick={async () => {
                      const res = await fetch(`/api/orders/${o.id}/quote-doc`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
                        body: JSON.stringify({
                          chargeableWeightKg: Number(f.dnKg),
                          hawbNo: f.dnHawb ?? '', flight: f.dnFlight ?? '', eta: f.dnEta ?? '',
                        }),
                      })
                      const data = await res.json()
                      if (!data.ok) return alert(data.error ?? '등록에 실패했습니다.')
                      alert(`최종 견적서 생성 — ${data.doc.adjustLabel}\n차액 ${data.doc.diffVnd.toLocaleString('ko-KR')}동`)
                      window.open(`/quote/${o.id}?kind=final`, '_blank')
                    }}>
                    청구서 반영 → 최종 견적서
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {actions.map((a) => (
                  <button key={a.label}
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
                              : (a.payload ?? {})
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
