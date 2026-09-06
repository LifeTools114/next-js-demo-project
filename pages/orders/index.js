import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { readMyOrders, authHeaders } from '../../lib/my-orders'
import { krw, formatDateTime } from '../../lib/format'

/** 상태별 표시 색 — 눈에 띄어야 하는 상태(미결제·취소)만 강조합니다. */
const STATE_COLOR = {
  REQUESTED: '#b7791f',
  AWAITING_PAYMENT: '#b7791f',
  CANCELLED: '#c53030',
}

/** 주문번호로 조회 — 로그인 없이 주문번호만으로 확인합니다. */
export default function OrderLookup() {
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  // 이 브라우저에서 접수했던 주문들 (localStorage) + 서버에서 읽은 현재 상태
  const [mine, setMine] = useState([])

  useEffect(() => {
    const saved = readMyOrders()
    if (saved.length === 0) return
    setMine(saved)
    // 최근 10건만 서버 상태를 붙입니다 — 미결제로 남은 중복 주문이 바로 보이게.
    ;(async () => {
      const detailed = await Promise.all(
        saved.slice(0, 10).map(async (e) => {
          try {
            const r = await fetch(`/api/orders/${e.orderNo}`, { headers: authHeaders() })
            const d = await r.json()
            if (!r.ok) return { ...e, missing: true }
            return {
              ...e,
              state: d.order.state,
              stateLabel: d.order.stateInfo?.label ?? d.order.state,
              totalKrw: d.order.invoice?.amountKrw ?? null,
              createdAt: d.order.createdAt,
            }
          } catch {
            return e
          }
        }),
      )
      setMine([...detailed, ...saved.slice(10)])
    })()
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const no = orderNo.trim().toUpperCase()
    if (no) router.push(`/orders/${no}`)
  }

  const unpaidCount = mine.filter((e) => e.state === 'REQUESTED' || e.state === 'AWAITING_PAYMENT').length

  return (
    <Layout title="주문 조회">
      <div className="hero">
        <h1 className="hero__title">주문 조회</h1>
        <p className="hero__desc">주문번호를 입력하면 진행 상황과 결제 내역을 확인할 수 있습니다.</p>
      </div>

      <div className="section">
        <form onSubmit={submit}>
          <div className="field">
            <label className="field__label" htmlFor="no">주문번호</label>
            <input id="no" className="input" value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
              placeholder="HN2608280001" autoComplete="off" />
          </div>
          <button className="btn" type="submit" disabled={!orderNo.trim()}>조회하기</button>
        </form>
        <p className="note" style={{ marginTop: 12 }}>
          여러 주문을 한 번에 보시려면 <Link href="/my"><b>내 주문 전체 보기</b></Link> — 회원가입 없이 개인 링크로 봅니다.
          <br />
          <small>주문번호만으로는 <b>진행 상태만</b> 보입니다. 이름·주소·상품은 신청하신 브라우저나 개인 링크에서만 열립니다.</small>
        </p>
      </div>

      {mine.length > 0 && (
        <section className="panel">
          <div className="panel__head">
            <span>이 브라우저에서 접수한 주문</span>
            {unpaidCount > 0 && <span className="tag tag--warn">입금 전 {unpaidCount}건</span>}
          </div>
          <div className="panel__body">
            {unpaidCount > 1 && (
              <p className="note note--warn" style={{ fontSize: 12, marginBottom: 10 }}>
                ⚠️ 입금 전 주문이 {unpaidCount}건입니다. 실수로 겹친 주문이 있다면 열어서
                [이 주문 취소하기]로 정리해 주세요 — 취소하지 않으면 각각 청구가 살아있습니다.
              </p>
            )}
            {mine.map((e) => (
              <Link key={e.orderNo} href={`/orders/${e.orderNo}`} className="row" style={{ display: 'flex' }}>
                <span className="row__label">
                  <b>{e.orderNo}</b>
                  <br />
                  <small style={{ color: 'var(--ink-500)' }}>
                    {formatDateTime(e.createdAt ?? e.at)}
                    {e.totalKrw ? ` · ${krw(e.totalKrw)}` : ''}
                  </small>
                </span>
                <span className="row__value" style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: STATE_COLOR[e.state] ?? 'var(--ok)',
                }}>
                  {e.missing ? '조회 불가' : (e.stateLabel ?? '확인 중…')} ›
                </span>
              </Link>
            ))}
            <p className="note" style={{ marginTop: 10, fontSize: 11.5 }}>
              이 목록은 이 브라우저에만 저장됩니다. 다른 기기에서 접수한 주문은 주문번호로 조회해 주세요.
            </p>
          </div>
        </section>
      )}
    </Layout>
  )
}
