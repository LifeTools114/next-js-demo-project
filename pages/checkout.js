import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import CostBreakdown from '../components/CostBreakdown'
import { useCart } from '../components/CartProvider'
import { SHIPPING } from '../config/shipping'
import { PAYMENT } from '../config/payment'
import { krw, vnd } from '../lib/format'

/**
 * 주문서 — 여기서 [거래 A]의 청구서가 발행됩니다.
 * 주문이 생성되는 순간 견적이 동결되고 환율이 고정됩니다.
 */
export default function Checkout() {
  const router = useRouter()
  const { items, clear, ready } = useCart()

  const [zone, setZone] = useState(SHIPPING.defaultZone)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [methods, setMethods] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('manual-bank')
  const [quote, setQuote] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
      body: JSON.stringify({ items, zone }),
    })
    const data = await res.json()
    if (res.ok) setQuote(data.quote)
  }, [items, zone])

  useEffect(() => {
    if (ready) refresh()
  }, [ready, refresh])

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zone, customer: form, paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '주문 생성에 실패했습니다.')
      clear()
      router.push(`/orders/${data.order.orderNo}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (ready && items.length === 0) {
    return (
      <Layout title="주문서">
        <div className="empty">
          <div className="empty__icon">🧾</div>
          주문할 상품이 없습니다.
          <div style={{ marginTop: 20 }}>
            <Link href="/products" className="btn">상품 보러 가기</Link>
          </div>
        </div>
      </Layout>
    )
  }

  const valid = form.name.trim() && form.phone.trim() && form.address.trim()

  return (
    <Layout title="주문서">
      <div className="section" style={{ paddingBottom: 6 }}>
        <h1 className="section__title">주문서</h1>
        <p className="section__sub">
          주문하시면 당사가 고객님을 대신해 쿠팡에서 구매한 뒤 하노이로 배송해 드립니다.
        </p>
      </div>

      <form onSubmit={submit}>
        <section className="panel">
          <div className="panel__head">수령인 정보</div>
          <div className="panel__body">
            <div className="field">
              <label className="field__label" htmlFor="name">이름 *</label>
              <input id="name" className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nguyễn Thị Mai" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="phone">연락처 *</label>
              <input id="phone" className="input" required type="tel" inputMode="tel"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="09xx xxx xxx" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="addr">하노이 배송 주소 *</label>
              <input id="addr" className="input" required value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Số nhà, đường, phường, quận" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field__label" htmlFor="zone">배송 지역</label>
              <select id="zone" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
                {Object.entries(SHIPPING.zones).map(([k, z]) => (
                  <option key={k} value={k}>
                    {z.label.split(' (')[0]}{z.surcharge > 0 ? ` (+${krw(z.surcharge)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">결제 수단</div>
          <div className="panel__body">
            {methods.length === 0 ? (
              <p className="note note--warn">사용 가능한 결제 수단이 없습니다. 운영자에게 문의해 주세요.</p>
            ) : (
              <div className="field" style={{ marginBottom: 0 }}>
                <select className="select" value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)} aria-label="결제 수단">
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {m.labelVi}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="note" style={{ marginTop: 12 }}>
              선결제 방식입니다. 입금이 확인되면 한국에서 상품을 구매합니다.
              청구서는 발행 후 {PAYMENT.invoiceValidHours}시간 동안 유효하며, 그동안 환율이 고정됩니다.
            </p>
          </div>
        </section>

        {quote && <CostBreakdown quote={quote} />}

        {error && (
          <div className="section" style={{ paddingTop: 0 }}>
            <p className="note note--danger">{error}</p>
          </div>
        )}

        <div className="section" style={{ paddingTop: 0 }}>
          <button className="btn" type="submit" disabled={!valid || !quote || submitting || methods.length === 0}>
            {submitting ? '주문 생성 중…' : quote ? `${krw(quote.total)} 주문하기` : '견적 계산 중…'}
          </button>
          {quote && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-500)', marginTop: 8 }}>
              ≈ {vnd(quote.totalVnd)}
            </p>
          )}
        </div>
      </form>
    </Layout>
  )
}
