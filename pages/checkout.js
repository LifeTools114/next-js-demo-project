import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import CostBreakdown from '../components/CostBreakdown'
import { SHIPPING } from '../config/shipping'
import { PAYMENT } from '../config/payment'
import { krw, vnd } from '../lib/format'

/**
 * 주문서 — 확장프로그램의 견적함에서 넘어옵니다.
 *
 * 확장이 `?cart=<encoded JSON>` 으로 상품 목록을 전달하면,
 * 여기서 수령인 정보를 받아 [거래 A]의 청구서를 발행합니다.
 * 가격은 클라이언트를 믿지 않고 서버에서 다시 계산합니다.
 */
export default function Checkout() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [track, setTrack] = useState('agent')
  const [zone, setZone] = useState(SHIPPING.defaultZone)
  const [form, setForm] = useState({ name: '', phone: '', address: '', email: '' })
  const [methods, setMethods] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('manual-bank')
  const [quote, setQuote] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // 확장에서 넘어온 견적함 복원
  useEffect(() => {
    if (!router.isReady) return
    const raw = router.query.cart
    if (typeof raw !== 'string') return
    try {
      const parsed = JSON.parse(decodeURIComponent(raw))
      if (Array.isArray(parsed.items)) setItems(parsed.items)
      if (parsed.zone) setZone(parsed.zone)
      if (parsed.items?.[0]?.track) setTrack(parsed.items[0].track)
    } catch {
      setError('견적함 정보를 읽지 못했습니다. 확장프로그램에서 다시 시도해 주세요.')
    }
  }, [router.isReady, router.query.cart])

  useEffect(() => {
    fetch('/api/payment-methods')
      .then((r) => r.json())
      .then((d) => {
        setMethods(d.methods ?? [])
        if (d.methods?.[0]) setPaymentMethod(d.methods[0].id)
      })
      .catch(() => setMethods([]))
  }, [])

  const refresh = useCallback(async () => {
    if (items.length === 0) return setQuote(null)
    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, zone, track }),
    })
    const data = await res.json()
    if (res.ok) setQuote(data.quote)
    else setError(data.error)
  }, [items, zone, track])

  useEffect(() => {
    refresh()
  }, [refresh])

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zone, track, customer: form, paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '주문 생성에 실패했습니다.')
      router.push(`/orders/${data.order.orderNo}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <Layout title="주문서">
        <div className="empty">
          <div className="empty__icon">🧾</div>
          주문할 상품이 없습니다.
          <br />
          <small>확장프로그램의 견적함에서 &quot;주문 요청하기&quot;를 눌러주세요.</small>
          {error && <p className="note note--danger" style={{ marginTop: 16 }}>{error}</p>}
          <div style={{ marginTop: 20 }}>
            <Link href="/" className="btn">홈으로</Link>
          </div>
        </div>
      </Layout>
    )
  }

  const valid = form.name.trim() && form.phone.trim() && form.address.trim()
  const blocked = quote && !quote.eligibility.shippable

  return (
    <Layout title="주문서">
      <div className="section" style={{ paddingBottom: 6 }}>
        <h1 className="section__title">주문서</h1>
        <p className="section__sub">
          {track === 'agent'
            ? '당사가 고객님을 대신해 쿠팡에서 구매한 뒤 하노이로 배송합니다.'
            : '고객님이 쿠팡에서 직접 결제하신 상품을 하노이로 배송해 드립니다.'}
        </p>
      </div>

      {blocked && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note note--danger">
            🚫 배송할 수 없는 상품이 포함되어 있습니다.
            <br />
            {quote.eligibility.blocked.map((b) => `${b.productName} — ${b.label}`).join(' / ')}
          </p>
        </div>
      )}

      <section className="panel">
        <div className="panel__head">주문 상품 ({items.length}종)</div>
        <div className="panel__body">
          {items.map((it, i) => (
            <div className="row" key={i}>
              <span className="row__label">{it.productName} × {it.quantity}</span>
              <span className="row__value">{krw(it.productPrice * it.quantity)}</span>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submit}>
        <section className="panel">
          <div className="panel__head">수령인 정보</div>
          <div className="panel__body">
            {[
              ['name', '이름 *', 'Nguyễn Thị Mai', 'text'],
              ['phone', '연락처 *', '09xx xxx xxx', 'tel'],
              ['address', '하노이 배송 주소 *', 'Số nhà, đường, phường, quận', 'text'],
              ['email', '이메일 (선택 — 진행 알림 수신)', 'you@example.com', 'email'],
            ].map(([key, label, ph, type]) => (
              <div className="field" key={key}>
                <label className="field__label" htmlFor={key}>{label}</label>
                <input id={key} className="input" required={label.includes('*')} type={type} placeholder={ph}
                  value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            {Object.keys(SHIPPING.zones).length > 1 ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="zone">배송 지역</label>
                <select id="zone" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
                  {Object.entries(SHIPPING.zones).map(([k, z]) => (
                    <option key={k} value={k}>
                      {z.label}{z.surchargeUsd > 0 ? ` (+$${z.surchargeUsd})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field__label">배송 지역</span>
                <p className="note">
                  {SHIPPING.zones[SHIPPING.defaultZone].label} — 지역 할증 없음
                  <br />
                  <small>{SHIPPING.serviceAreaNotice}</small>
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">결제 수단</div>
          <div className="panel__body">
            {methods.length === 0 ? (
              <p className="note note--warn">사용 가능한 결제 수단이 없습니다. 운영자에게 문의해 주세요.</p>
            ) : (
              <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} aria-label="결제 수단">
                {methods.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.labelVi}</option>)}
              </select>
            )}
            {quote && (() => {
              const chosen = methods.find((m) => m.id === paymentMethod)
              if (!chosen?.currency) return null
              return (
                <p className="note" style={{ marginTop: 12 }}>
                  입금하실 금액: <b>{chosen.currency === 'KRW' ? krw(quote.total) : vnd(quote.totalVnd)}</b>
                  {' '}<small>({chosen.currency === 'KRW' ? `≈ ${vnd(quote.totalVnd)}` : `≈ ${krw(quote.total)}`})</small>
                  <br />
                  <small>이체 메모(입금자명)에 주문번호를 꼭 넣어주세요 — 입금이 자동으로 확인됩니다.</small>
                </p>
              )
            })()}
            <p className="note" style={{ marginTop: 12 }}>
              선결제 방식입니다. 입금이 확인되면 진행합니다. 청구서는 발행 후 {PAYMENT.invoiceValidHours}시간
              동안 유효하며, 그동안 환율이 고정됩니다.
            </p>
          </div>
        </section>

        {quote && !blocked && <CostBreakdown quote={quote} />}

        {error && (
          <div className="section" style={{ paddingTop: 0 }}>
            <p className="note note--danger">{error}</p>
          </div>
        )}

        <div className="section" style={{ paddingTop: 0 }}>
          <button className="btn" type="submit" disabled={!valid || !quote || blocked || submitting || methods.length === 0}>
            {submitting ? '주문 생성 중…' : blocked ? '배송 불가 상품 포함' : quote ? `${krw(quote.total)} 주문하기` : '견적 계산 중…'}
          </button>
          {quote && !blocked && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-500)', marginTop: 8 }}>
              ≈ {vnd(quote.totalVnd)}
            </p>
          )}
        </div>
      </form>
    </Layout>
  )
}
