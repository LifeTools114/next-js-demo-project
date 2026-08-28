import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { analyzeSourcing } from '../../lib/sourcing'
import { krw, weight, formatDateTime } from '../../lib/format'

const TOKEN_KEY = 'kbeauty-hanoi:admin-token'

/**
 * 창고 입고 화면 — 폰에서 쓰는 것을 전제로 한 한 손 동선.
 *
 *   스캔(또는 붙여넣기) → 주문 자동 매칭 → 무게 입력 → 완료
 *
 * 실측 등록이 정산 적용까지 자동 연쇄되므로, 소포 하나당 사람 손은
 * 무게 입력 한 번입니다. 배송대행 소포가 아직 연결 전(PAID)이면
 * 라벨의 운송장 번호로 그 자리에서 연결해 상태를 진행시킵니다.
 */
export default function IntakePage() {
  const [token, setToken] = useState('')
  const [ref, setRef] = useState('')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // 마지막 처리 결과 배너

  const [weightG, setWeightG] = useState('')
  const [costs, setCosts] = useState({ FREIGHT: '', DUTY: '', VAT: '' })
  const [showCosts, setShowCosts] = useState(false)
  const [recheck, setRecheck] = useState({ confirmed: false, productMatches: true, extraCostKrw: '', note: '' })
  const [linkTracking, setLinkTracking] = useState('')

  const scanRef = useRef(null)
  const focusScan = () => setTimeout(() => scanRef.current?.focus(), 50)

  useEffect(() => {
    try { setToken(window.localStorage.getItem(TOKEN_KEY) ?? '') } catch { /* 무시 */ }
    focusScan()
  }, [])

  const headers = { 'Content-Type': 'application/json', 'x-admin-token': token }

  const reset = (banner = null) => {
    setOrder(null)
    setRef('')
    setWeightG('')
    setCosts({ FREIGHT: '', DUTY: '', VAT: '' })
    setShowCosts(false)
    setRecheck({ confirmed: false, productMatches: true, extraCostKrw: '', note: '' })
    setLinkTracking('')
    setDone(banner)
    setError(null)
    focusScan()
  }

  const lookup = async (e) => {
    e?.preventDefault()
    if (!ref.trim()) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await fetch(`/api/admin/inbound?ref=${encodeURIComponent(ref.trim())}`, {
        headers: { 'x-admin-token': token },
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setOrder(d.order)
      // 스캔 값이 운송장처럼 생겼으면 연결 폼에 미리 채웁니다.
      if (!/HN\d{10}/i.test(ref)) setLinkTracking(ref.trim())
    } catch (err) {
      setOrder(null)
      setError(err.message)
      focusScan()
    } finally {
      setBusy(false)
    }
  }

  const act = async (action, payload) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${order.orderNo}/action`, {
        method: 'POST', headers, body: JSON.stringify({ action, payload }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      return d.order
    } finally {
      setBusy(false)
    }
  }

  const submitLink = async () => {
    try {
      setOrder(await act('linkInbound', { trackingNo: linkTracking.trim() }))
    } catch (err) { setError(err.message) }
  }

  const submitWeighing = async () => {
    const g = Number(String(weightG).replace(/,/g, ''))
    if (!Number.isFinite(g) || g <= 0) return setError('실측 무게(g)를 입력하세요.')
    const payload = { actualWeightG: g }
    const costEntries = Object.fromEntries(
      Object.entries(costs).map(([k, v]) => [k, Number(String(v).replace(/,/g, ''))]).filter(([, v]) => v > 0),
    )
    if (Object.keys(costEntries).length > 0) payload.costs = costEntries
    if (needsRecheck) {
      payload.recheck = {
        confirmed: recheck.confirmed,
        productMatches: recheck.productMatches,
        extraCostKrw: Number(String(recheck.extraCostKrw).replace(/,/g, '')) || 0,
        note: recheck.note || undefined,
      }
    }
    try {
      const after = await act('recordWeighing', payload)
      const s = after.settlement
      reset(
        s?.action === 'none' || after.state === 'SETTLED'
          ? `✅ ${after.orderNo} 정산 완료 — 차액 없음 (실측 ${weight(g)})`
          : `🔔 ${after.orderNo} ${s?.label ?? '정산'} ${krw(s?.absKrw ?? 0)} — 고객 안내가 기록됐습니다`,
      )
    } catch (err) { setError(err.message) }
  }

  const needsRecheck = order ? analyzeSourcing(order.items ?? []).requiresRecheck : false
  const canWeigh = order && order.state === 'PURCHASED'
  const needsLink = order && order.track === 'forwarding' && order.state === 'PAID'

  return (
    <Layout title="창고 입고">
      <div className="hero">
        <h1 className="hero__title">창고 입고</h1>
        <p className="hero__desc">
          스캔 → 무게 입력 → 끝. 정산은 자동으로 이어집니다. <Link href="/admin">콘솔로 ↗</Link>
        </p>
      </div>

      <div className="section">
        <div className="field">
          <label className="field__label" htmlFor="tok">ADMIN_TOKEN</label>
          <input id="tok" className="input" type="password" value={token}
            onChange={(e) => {
              setToken(e.target.value)
              try { window.localStorage.setItem(TOKEN_KEY, e.target.value) } catch { /* 무시 */ }
            }} />
        </div>

        <form onSubmit={lookup}>
          <div className="field">
            <label className="field__label" htmlFor="scan">라벨 스캔 / 붙여넣기</label>
            <input id="scan" ref={scanRef} className="input" value={ref} autoComplete="off"
              placeholder="수령인 코드 · 쿠팡 주문번호 · 운송장"
              onChange={(e) => setRef(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={busy || !ref.trim()}>
            {busy ? '조회 중…' : '주문 찾기'}
          </button>
        </form>

        {done && <p className="note" style={{ marginTop: 12, fontSize: 14 }}>{done}</p>}
        {error && <p className="note note--danger" style={{ marginTop: 12 }}>{error}</p>}
      </div>

      {order && (
        <section className="panel">
          <div className="panel__head">
            <span>{order.orderNo} · {order.customer.name}</span>
            <span className="tag tag--weight">{order.stateInfo.label}</span>
          </div>
          <div className="panel__body">
            <div className="row row--muted">
              <span className="row__label">{order.track === 'agent' ? '구매대행' : '배송대행'} · 접수 {formatDateTime(order.createdAt)}</span>
              <span className="row__value">견적 {weight(order.quote?.weight?.chargeableG ?? 0)}</span>
            </div>
            {(order.items ?? []).map((it, i) => (
              <div className="row" key={i}>
                <span className="row__label">{it.productName}</span>
                <span className="row__value">× {it.quantity}</span>
              </div>
            ))}

            {needsLink && (
              <div style={{ marginTop: 12 }}>
                <p className="note note--warn">
                  아직 연결되지 않은 배송대행 소포입니다. 라벨의 운송장 번호로 연결하면 실측으로 넘어갑니다.
                </p>
                <div className="field">
                  <label className="field__label" htmlFor="ltrack">운송장 번호</label>
                  <input id="ltrack" className="input" value={linkTracking}
                    onChange={(e) => setLinkTracking(e.target.value)} />
                </div>
                <button className="btn" onClick={submitLink} disabled={busy || !linkTracking.trim()}>소포 연결</button>
              </div>
            )}

            {canWeigh && (
              <div style={{ marginTop: 12 }}>
                {needsRecheck && (
                  <div className="note note--warn" style={{ marginBottom: 10 }}>
                    🌏 해외직구 상품 포함 — 실물·추가 비용 확인 후 진행하세요.
                    <label style={{ display: 'block', marginTop: 8 }}>
                      <input type="checkbox" checked={recheck.confirmed}
                        onChange={(e) => setRecheck({ ...recheck, confirmed: e.target.checked })} />
                      {' '}상품 정보·비용을 확인했습니다
                    </label>
                    <label style={{ display: 'block', marginTop: 4 }}>
                      <input type="checkbox" checked={!recheck.productMatches}
                        onChange={(e) => setRecheck({ ...recheck, productMatches: !e.target.checked })} />
                      {' '}입고 상품이 주문과 다릅니다
                    </label>
                    <input className="input" style={{ marginTop: 8 }} inputMode="numeric"
                      placeholder="쿠팡 관·부가세 등 추가 비용 (원, 없으면 비움)"
                      value={recheck.extraCostKrw}
                      onChange={(e) => setRecheck({ ...recheck, extraCostKrw: e.target.value })} />
                  </div>
                )}

                <div className="field">
                  <label className="field__label" htmlFor="wg">실측 무게 (g)</label>
                  <input id="wg" className="input" inputMode="numeric" placeholder="예: 1420"
                    style={{ fontSize: 20, fontWeight: 700 }}
                    value={weightG} onChange={(e) => setWeightG(e.target.value)} />
                </div>

                <button type="button" className="btn btn--ghost" style={{ marginBottom: 8 }}
                  onClick={() => setShowCosts(!showCosts)}>
                  실비 입력 {showCosts ? '접기' : '(선택)'}
                </button>
                {showCosts && ['FREIGHT', 'DUTY', 'VAT'].map((k) => (
                  <div className="field" key={k}>
                    <label className="field__label" htmlFor={`c-${k}`}>
                      {{ FREIGHT: '운송 실비(원)', DUTY: '관세 실납부(원)', VAT: 'VAT 실납부(원)' }[k]}
                    </label>
                    <input id={`c-${k}`} className="input" inputMode="numeric" value={costs[k]}
                      onChange={(e) => setCosts({ ...costs, [k]: e.target.value })} />
                  </div>
                ))}

                <button className="btn" onClick={submitWeighing}
                  disabled={busy || !weightG || (needsRecheck && !recheck.confirmed)}>
                  {busy ? '처리 중…' : '실측 등록 → 자동 정산'}
                </button>
              </div>
            )}

            {!canWeigh && !needsLink && (
              <p className="note" style={{ marginTop: 12 }}>
                이 상태({order.stateInfo.label})에서는 입고 처리를 할 수 없습니다.
                {order.state === 'PURCHASING' && ' 매입 기록(쿠팡 주문번호·금액)이 먼저 필요합니다 — 확장 팝업 또는 콘솔에서.'}
                {order.state === 'AWAITING_PAYMENT' && ' 아직 입금 확인 전입니다.'}
              </p>
            )}

            <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => reset()}>다음 소포</button>
          </div>
        </section>
      )}
    </Layout>
  )
}
