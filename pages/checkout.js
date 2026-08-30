import { useEffect, useState, useCallback, useRef } from 'react'
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
  // 쿠팡 결제 우선 흐름 — 주문완료 화면에서 넘어오면 주문번호가 함께 옵니다.
  const [coupangOrderNo, setCoupangOrderNo] = useState('')

  /**
   * 수령인 정보 자동 저장·불러오기 — 단골이 주문할 때마다 베트남 주소를
   * 다시 치지 않도록 이 브라우저에 저장해 두고 다음 주문서에 채웁니다.
   * (서버가 아니라 고객 본인 브라우저에만 저장됩니다)
   */
  const RECIPIENT_KEY = 'kbeauty-hanoi:recipient'
  const recipientLoaded = useRef(false)
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECIPIENT_KEY) ?? 'null')
      if (saved && typeof saved === 'object') {
        setForm((f) => ({
          ...f,
          name: saved.name ?? '',
          phone: saved.phone ?? '',
          address: saved.address ?? '',
          email: saved.email ?? '',
        }))
      }
    } catch { /* 저장값이 없거나 손상 — 빈 폼으로 시작 */ }
    recipientLoaded.current = true
  }, [])
  useEffect(() => {
    // 저장값을 불러오기 전에 빈 폼으로 덮어쓰지 않도록 로드 후에만 저장합니다.
    if (!recipientLoaded.current) return
    if (!(form.name || form.phone || form.address || form.email)) return
    try { window.localStorage.setItem(RECIPIENT_KEY, JSON.stringify(form)) } catch { /* 무시 */ }
  }, [form])

  // 확장에서 넘어온 견적함 복원
  useEffect(() => {
    if (!router.isReady) return
    const raw = router.query.cart
    if (typeof raw !== 'string') return
    // Next 라우터가 이미 한 번 디코드해 주므로 그대로 파싱을 먼저 시도합니다.
    // 상품명에 '%' 가 있으면(예: "순도 100%") 이중 디코드가 터지기 때문입니다.
    const candidates = [raw]
    try { candidates.push(decodeURIComponent(raw)) } catch { /* 이중 인코딩이 아니면 실패할 수 있음 */ }
    let parsed = null
    for (const c of candidates) {
      try { parsed = JSON.parse(c); break } catch { /* 다음 후보 */ }
    }
    if (parsed) {
      if (Array.isArray(parsed.items)) setItems(parsed.items)
      if (parsed.zone) setZone(parsed.zone)
      if (parsed.items?.[0]?.track) setTrack(parsed.items[0].track)
    } else {
      setError('견적함 정보를 읽지 못했습니다. 확장프로그램에서 다시 시도해 주세요.')
    }
    if (typeof router.query.coupang === 'string') {
      const no = router.query.coupang.replace(/\D/g, '').slice(0, 40)
      if (no) {
        setCoupangOrderNo(no)
        setTrack('forwarding') // 이미 본인이 결제한 주문 = 배송대행
      }
    }
  }, [router.isReady, router.query.cart, router.query.coupang])

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
        body: JSON.stringify({ items, zone, track, customer: form, paymentMethod, coupangOrderNo: coupangOrderNo || undefined }),
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
  const overLimit = Boolean(quote?.agentLimit?.exceeded)

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

      {track === 'agent' && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note" style={{ fontSize: 12.5, lineHeight: 1.75 }}>
            🛒 <b style={{ color: '#3182f6' }}>와우회원가 기준, 화면에 표시된 가격 그대로</b> 대리
            주문합니다 (일부 상품은 와우가 미적용 가능).
            <br />
            💰 수수료 <b style={{ color: '#3182f6' }}>기본 5,000원</b> — 대리 주문·검수·발주 처리
            실비입니다. 상품가 <b>10만원·5종류까지는 5,000원 고정</b>, 넘는 경우에만 10만원
            초과분의 5%와 5종 초과 종류당 1,000원이 더해집니다.
            <br />
            <b style={{ color: '#c92a2a' }}>쿠폰·신규가입 할인 등 개인 혜택은 사용할 수 없고</b>,
            타임세일·마감임박 등{' '}
            <b style={{ color: '#c92a2a' }}>기간 한정 할인가는 발주 시점에 종료되면 반영되지 않을 수
            있습니다.</b>
            <br />
            가격 인상·품절·마감이 확인되면 임의로 구매하지 않고 연락드리며, 취소 시{' '}
            <b style={{ color: '#17916b' }}>전액 환불</b>됩니다. 1회 접수 한도{' '}
            <b style={{ color: '#d9480f' }}>{krw(quote?.agentLimit?.maxGoodsKrw ?? 1_000_000)}</b>.
          </p>
        </div>
      )}

      {quote?.sourcing?.schedule && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note" style={{ fontSize: 12.5, background: '#fff8e6', lineHeight: 1.75 }}>
            📦 하노이 도착 예상{' '}
            <b style={{ color: '#d9480f', fontSize: 14 }}>
              {quote.sourcing.schedule.totalDays.min}~{quote.sourcing.schedule.totalDays.max}영업일
            </b>
            <br />
            쿠팡→한국창고{' '}
            <b>
              {quote.sourcing.schedule.toWarehouseDays.min}~
              {quote.sourcing.schedule.toWarehouseDays.max}영업일
            </b>{' '}
            + 한국창고→하노이{' '}
            <b>
              {quote.sourcing.schedule.toHanoiDays.min}~{quote.sourcing.schedule.toHanoiDays.max}영업일
            </b>
            <br />
            <b style={{ color: '#d9480f' }}>모두 영업일 기준(주말·공휴일 제외)</b>
            {quote.sourcing.hasOverseas && (
              <>
                <br />
                <b style={{ color: '#c92a2a' }}>
                  🌏 해외직구 상품 포함 — 한국창고 도착까지 +2~3영업일 더 걸립니다
                </b>
              </>
            )}
          </p>
        </div>
      )}

      {overLimit && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note note--danger">
            🚫 구매대행은 1회 상품가 합계{' '}
            <b>{krw(quote.agentLimit.maxGoodsKrw)}</b>까지 접수합니다. 나눠서 신청해 주세요.
          </p>
        </div>
      )}

      {blocked && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note note--danger">
            🚫 배송할 수 없는 상품이 포함되어 있습니다.
            <br />
            {quote.eligibility.blocked.map((b) => `${b.productName} — ${b.label}`).join(' / ')}
          </p>
        </div>
      )}

      {coupangOrderNo && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note">
            ✅ 쿠팡 주문 <b>{coupangOrderNo}</b> 이(가) 연결됩니다.
            결제하신 상품은 한국 창고 도착 후 하노이로 이어서 배송됩니다.
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
          <div className="panel__head">수령인 정보 (베트남)</div>
          <div className="panel__body">
            <p className="note" style={{ marginBottom: 12, fontSize: 12 }}>
              입력하신 정보는 이 브라우저에 자동 저장되어, 다음 주문서에 자동으로 채워집니다.
            </p>
            {[
              ['name', '받는 분 이름 *', 'Nguyễn Thị Mai / 홍길동', 'text'],
              ['phone', '베트남 전화번호 *', '09xx xxx xxx', 'tel'],
              ['address', '베트남(하노이) 배송 주소 *', 'Số nhà, đường, phường, quận', 'text'],
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
          <button className="btn" type="submit" disabled={!valid || !quote || blocked || overLimit || submitting || methods.length === 0}>
            {submitting ? '주문 생성 중…'
              : blocked ? '배송 불가 상품 포함'
              : overLimit ? '접수 한도 초과 — 나눠서 신청해 주세요'
              : quote ? `${krw(quote.total)} 주문하기` : '견적 계산 중…'}
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
