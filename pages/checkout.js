import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import CostBreakdown from '../components/CostBreakdown'
import { SHIPPING, RETURN_SHIPPING, estimateReturnShippingUsd } from '../config/shipping'
import { PAYMENT, REFUND_DAYS, RETURN_POLICY } from '../config/payment'
import { FEES } from '../config/fees'
import { REQUIRED_CONSENTS } from '../config/legal'
import { FX } from '../config/fx'
import { krw, vnd } from '../lib/format'
import { rememberMyOrder } from '../lib/my-orders'

/**
 * 주문서 — 확장프로그램의 견적함에서 넘어옵니다.
 *
 * 확장이 `?cart=<encoded JSON>` 으로 상품 목록을 전달하면,
 * 여기서 수령인 정보를 받아 [거래 A]의 청구서를 발행합니다.
 * 가격은 클라이언트를 믿지 않고 서버에서 다시 계산합니다.
 */
/**
 * 접히는 안내 — 고지는 보이되 벽이 되지 않게.
 *
 * 운영자 원칙(26-09-04): "고지가 필요한 부분은 최대한 보일 수 있게 힌트를
 * 곳곳에 남긴다." 그래서 **핵심 한두 줄은 항상 보이고**, 나머지는 눌러서 펼칩니다.
 * 접어서 숨기는 것이 아니라, 벽을 요약으로 바꾸는 것입니다.
 */
function Fold({ title, summary, children, bg = '#f9fafb', border = '#e5e8eb' }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: `1px solid ${border}`, borderRadius: 12, background: bg,
      padding: '12px 14px', marginBottom: 10,
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#191f28', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#333d4b' }}>{summary}</div>
      <button type="button" onClick={() => setOpen(!open)}
        style={{
          marginTop: 8, width: '100%', minHeight: 40, borderRadius: 9,
          border: '1px solid #dbe4f0', background: '#fff', color: '#3182f6',
          fontSize: 14, fontWeight: 800, cursor: 'pointer',
        }}>
        {open ? '접기 ▴' : '자세히 보기 ▾'}
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

export default function Checkout() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [track, setTrack] = useState('agent')
  const [zone, setZone] = useState(SHIPPING.defaultZone)
  const [form, setForm] = useState({ name: '', phone: '', address: '', email: '' })
  /** 받는 분 정보를 펼쳐서 고칠지 — 저장된 값이 있으면 접힌 채로 시작합니다 */
  /** 저장된 값을 불러왔는가 — 안내 문구에만 씁니다 (입력칸은 항상 보입니다) */
  const [recipientRestored, setRecipientRestored] = useState(false)
  const [methods, setMethods] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('manual-bank')
  /**
   * 필수 고지 동의 — 서버가 최종 검증하지만, 화면에서 먼저 받아
   * 무엇에 동의하는지 큰 글씨로 보여줍니다 (config/legal.js).
   */
  const [consents, setConsents] = useState({})
  const allAgreed = REQUIRED_CONSENTS.every((c) => consents[c.id])
  const [quote, setQuote] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // 중복 접수 감지(409) 응답 — 기존 주문 안내 + 취소 후 재접수/재구매 선택지
  const [duplicate, setDuplicate] = useState(null)
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
        /*
         * 예전에는 저장된 값이 다 차 있으면 입력칸을 **접고** 요약만 보여줬습니다.
         * 그랬더니 "하노이 주소 입력하는 곳이 없고 바로 신청이 된다"는 일이
         * 생겼습니다 (운영자 26-09-06). 배송지는 이 서비스에서 가장 비싼
         * 실수가 나는 자리라, 다시 오신 분에게도 **항상 보이게** 합니다.
         * 값은 채워 드리니 확인만 하시면 됩니다.
         */
        if (saved.name || saved.phone || saved.address) setRecipientRestored(true)
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

  /**
   * @param force 중복 안내를 보고도 "그래도 신청" 한 경우
   * @param consentIds 이번 신청에 동의한 항목 — 넘기지 않으면 화면 체크 상태를 씁니다.
   *        [동의하고 신청하기] 한 번 누름으로 처리할 때, setState 가 반영되기를
   *        기다리지 않고 바로 보내기 위해 인자로 받습니다.
   */
  const submitOrder = async (force, consentIds) => {
    setSubmitting(true)
    setError(null)
    setDuplicate(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, zone, track, customer: form, paymentMethod,
          consents: consentIds ?? REQUIRED_CONSENTS.filter((c) => consents[c.id]).map((c) => c.id),
          coupangOrderNo: coupangOrderNo || undefined,
          // 중복 안내를 보고 "일부러 한 번 더 산다"고 확인한 재구매만 true
          force: force || undefined,
        }),
      })
      const data = await res.json()
      // 중복 접수 — 오류가 아니라 선택지(기존 주문 보기/취소 후 재접수/재구매)를 보여줍니다.
      if (res.status === 409 && data.duplicate) {
        setDuplicate(data.duplicate)
        setSubmitting(false)
        return
      }
      if (!res.ok) throw new Error(data.error || '주문 생성에 실패했습니다.')
      rememberMyOrder(data.order.orderNo)
      router.push(`/orders/${data.order.orderNo}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  /**
   * 신청 — 아직 확인 항목을 안 누르셨다면, 버튼 문구가 "동의하고 신청하기"이므로
   * 그 누름 자체가 동의입니다(필수 항목은 일괄 동의가 가능합니다).
   * 화면 체크도 함께 켜서 무엇에 동의했는지 눈으로 남게 합니다.
   */
  const submit = (e) => {
    e.preventDefault()
    if (allAgreed) return submitOrder(false)
    const all = {}
    for (const c of REQUIRED_CONSENTS) all[c.id] = true
    setConsents(all)
    submitOrder(false, REQUIRED_CONSENTS.map((c) => c.id))
  }

  /**
   * [기존 주문 모두 취소하고 다시 접수] — 같은 구성으로 열려 있는 주문
   * **전부**를 취소한 뒤 재제출합니다. 한 건만 취소하면 남은 다른 건이
   * 다시 중복으로 잡혀 "취소했는데 또 중복" 혼란이 생깁니다.
   * (이미 취소된 건은 서버가 성공으로 받아줍니다 — 멱등)
   */
  const cancelAndResubmit = async () => {
    if (!duplicate) return
    setSubmitting(true)
    setError(null)
    try {
      const targets = duplicate.openOrderNos?.length ? duplicate.openOrderNos : [duplicate.orderNo]
      for (const no of targets) {
        const res = await fetch(`/api/orders/${no}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '중복 접수 — 새 주문으로 다시 접수' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`${no} 취소 실패 — ${data.error || '취소에 실패했습니다.'}`)
      }
      await submitOrder(true)
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
          <small>배송만은 쇼핑몰 결제가 끝난 주문완료 화면에서 저절로 열리고,
            구매하고 배송까지는 확장프로그램 견적함의 &quot;주문 요청하기&quot;로 열립니다.</small>
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
    <Layout title={track === 'forwarding' ? '배송 신청서' : '주문서'}>
      <div className="section" style={{ paddingBottom: 6 }}>
        {/* 상품 화면·팝업·주문완료 카드가 "배송 신청서" 라고 부르므로 여기서도 같은 이름 */}
        <h1 className="section__title">{track === 'forwarding' ? '배송 신청서' : '주문서'}</h1>
        <p className="section__sub">
          {track === 'agent'
            ? '당사가 고객님을 대신해 쇼핑몰에서 구매한 뒤 하노이로 배송합니다.'
            : '고객님이 쇼핑몰에서 직접 결제하신 상품을 하노이로 배송해 드립니다.'}
        </p>
      </div>

      {track === 'agent' && (
        <div className="section" style={{ paddingTop: 0 }}>
          <Fold
            title="🛒 대신 사드릴 때 알아두실 것"
            bg="#f2f6fb" border="#dbe4f0"
            summary={<>
              화면에 보이는 <b>와우회원가 그대로</b> 사드리고, 수수료는 <b>기본 {krw(FEES.agencyBaseKrw)}</b>입니다.
              <b style={{ color: '#c92a2a' }}> 쿠폰·신규가입 할인은 쓸 수 없습니다.</b>
            </>}>
          <p className="note" style={{ fontSize: 12.5, lineHeight: 1.75 }}>
            🛒 <b style={{ color: '#3182f6' }}>와우회원가 기준, 화면에 표시된 가격 그대로</b> 대리
            주문합니다 (일부 상품은 와우가 미적용 가능).
            <br />
            💰 수수료 <b style={{ color: '#3182f6' }}>기본 {krw(FEES.agencyBaseKrw)}</b> — 대리 주문·검수·발주 처리
            실비입니다. 상품가 <b>10만원·5종류까지는 {krw(FEES.agencyBaseKrw)} 고정</b>, 넘는 경우에만 10만원
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
          </Fold>
        </div>
      )}

      {quote?.sourcing?.schedule && (
        <div className="section" style={{ paddingTop: 0 }}>
          <Fold
            title="📦 언제 받아보시나요"
            bg="#fff8e6" border="#ffe3a3"
            summary={<>
              하노이 도착까지 <b style={{ color: '#d9480f', fontSize: 15 }}>
                {quote.sourcing.schedule.totalDays.min}~{quote.sourcing.schedule.totalDays.max}영업일
              </b> (주말·공휴일 제외)
              {quote.sourcing.hasOverseas
                ? <b style={{ color: '#c92a2a' }}> · 해외직구 상품이 있어 2~3일 더 걸립니다</b> : null}
            </>}>
          <p className="note" style={{ fontSize: 12.5, background: '#fff8e6', lineHeight: 1.75 }}>
            📦 하노이 도착 예상{' '}
            <b style={{ color: '#d9480f', fontSize: 14 }}>
              {quote.sourcing.schedule.totalDays.min}~{quote.sourcing.schedule.totalDays.max}영업일
            </b>
            <br />
            쇼핑몰→한국창고{' '}
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
          </Fold>
        </div>
      )}

      {overLimit && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note note--danger">
            🚫 대신 사드리는 건 한 번에 상품값 합계{' '}
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
            ✅ 쇼핑몰 주문 <b>{coupangOrderNo}</b> 이(가) 연결됩니다.
            결제하신 상품은 한국 창고 도착 후 하노이로 이어서 배송됩니다.
          </p>
        </div>
      )}

      <section className="panel">
        <div className="panel__head">1. 보내드릴 상품 ({items.length}종)</div>
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
          {/*
            하노이 주소를 적는 자리라는 것이 한눈에 보여야 합니다 —
            여기에 한국 주소를 적는 분이 실제로 계십니다 (운영자 지시 26-09-04).
          */}
          <div className="panel__head panel__head--accent">
            2. 받으실 분<span className="hint-strong">🇻🇳 하노이 주소 입력</span>
          </div>
          <div className="panel__body">
            {/*
              다시 오신 분은 같은 정보를 또 치지 않습니다 — 저장된 값이 다 차 있으면
              요약만 보여주고, 고치실 때만 [바꾸기]로 입력칸을 펼칩니다.
              (저장은 이 브라우저 안에만 — 서버로 보내지 않습니다)
            */}
            {recipientRestored ? (
              <p className="note" style={{
                marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: '#17916b',
                background: '#e6f6f0', border: '1px solid #b7e4d2', borderRadius: 9, padding: '9px 11px',
              }}>
                ✓ 지난번에 넣으신 정보를 불러왔습니다 — <b>이 주소가 맞는지 확인해 주세요.</b>
              </p>
            ) : (
              <p className="note" style={{ marginBottom: 12, fontSize: 12 }}>
                한 번만 적어주시면 이 브라우저에 저장돼, 다음부터는 확인만 하시면 됩니다.
              </p>
            )}
            {[
              ['name', '받는 분 이름 *', 'Nguyễn Thị Mai / 홍길동', 'text'],
              ['phone', '베트남 전화번호 *', '09xx xxx xxx', 'tel'],
              ['address', '🇻🇳 하노이 주소 * (한국 주소 아님)', 'Số nhà, đường, phường, quận', 'text'],
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

        {/*
          결제 안내 — 10살 어린이도, 60세 어르신도 따라 할 수 있게.
          "무엇을 / 어디로 / 얼마" 를 큰 글씨 세 줄로만 보여주고,
          계좌번호는 눌러서 복사되게 합니다.
        */}
        <section className="panel">
          <div className="panel__head">3. 어디로 보내실지 고르기</div>
          <div className="panel__body">
            {methods.length === 0 ? (
              <p className="note note--warn">사용 가능한 결제 수단이 없습니다. 카카오톡으로 문의해 주세요.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {methods.map((m) => {
                  const on = paymentMethod === m.id
                  return (
                    <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '16px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                        border: on ? '3px solid #3182f6' : '2px solid #e5e8eb',
                        background: on ? '#eef4fb' : '#fff',
                      }}>
                      <span style={{ fontSize: 30 }}>{m.currency === 'KRW' ? '🇰🇷' : '🇻🇳'}</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#191f28' }}>
                          {m.currency === 'KRW' ? '한국 계좌로 원화 보내기' : '베트남 계좌로 동화 보내기'}
                        </span>
                        <span style={{ display: 'block', fontSize: 13.5, color: '#4e5968' }}>{m.label}</span>
                      </span>
                      <span style={{ fontSize: 24, color: on ? '#3182f6' : '#c9d0d8' }}>{on ? '✓' : '○'}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {quote && (() => {
              const chosen = methods.find((m) => m.id === paymentMethod)
              if (!chosen?.currency) return null
              const amount = chosen.currency === 'KRW' ? krw(quote.total) : vnd(quote.totalVnd)
              return (
                <div style={{ marginTop: 14, border: '2px solid #3182f6', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ background: '#3182f6', color: '#fff', padding: '10px 14px', fontWeight: 800, fontSize: 15 }}>
                    이렇게 하시면 됩니다
                  </div>
                  <ol style={{ margin: 0, padding: '14px 14px 14px 34px', fontSize: 15.5, lineHeight: 2, color: '#191f28' }}>
                    <li>아래 <b>주문하기</b>를 누릅니다.</li>
                    <li>다음 화면에 나오는 <b>계좌번호</b>로 <b style={{ color: '#f04452', fontSize: 18 }}>{amount}</b> 을 보냅니다.</li>
                    <li>보낼 때 메모에 <b>주문번호</b>를 적습니다. (자동으로 확인됩니다)</li>
                  </ol>
                  <p style={{ margin: 0, padding: '0 14px 14px', fontSize: 13.5, color: '#4e5968' }}>
                    계좌번호는 다음 화면에서 <b>누르면 복사</b>됩니다. 카드로 내고 싶으시면 카카오톡으로 말씀해 주세요.
                  </p>
                </div>
              )
            })()}
          </div>
        </section>

        {/*
          필수 동의 — 무엇에 동의하는지 한 줄씩, 전문은 공지사항으로.
          서버가 다시 검증하므로 화면을 건너뛴 접수는 거절됩니다.
        */}
      {/* 환불·교환·반품 정책 — 최종 결제 전 반드시 인지 (운영자 확정 26-08-30) */}
      {(() => {
        const goodsKrw = items.reduce((s, i) => s + (Number(i.productPrice) || 0) * (Number(i.quantity) || 1), 0)
        const billableKg = quote?.shipping?.billableKg ?? 1
        // 구매대행 반품·교환은 반송 접수·확인을 대행하므로 처리 기본료가 붙습니다.
        const handlingKrw = track === 'agent' ? (RETURN_SHIPPING.agentHandlingKrw ?? 0) : 0
        const backUsd = estimateReturnShippingUsd(billableKg)
        const backKrw = Math.round(backUsd * FX.usdToKrw) + handlingKrw
        const freightKrw = quote?.breakdown?.find((r) => r.key === 'freight')?.krw ?? 0
        const agencyKrw = track === 'agent' ? (quote?.agency?.fee ?? 0) : 0
        const resendKrw = freightKrw + agencyKrw
        const roundTripKrw = backKrw + resendKrw
        return (
          <div className="section" style={{ paddingTop: 0 }}>
            {/*
              이 안내는 아래 「취소·반품 비용 부담 규정」 동의 바로 위에 둡니다 —
              동의하는 그 순간, 그 자리에서 보이는 것이 맞습니다.
              핵심 한 줄은 항상 보이고 나머지는 펼쳐서 봅니다 (벽이 되지 않게).
            */}
            <Fold
              title="↩️ 취소·반품·교환하면 얼마가 드나요"
              bg="#fff8f0" border="#ffe0c0"
              summary={<>
                환불은 <b>영업일 {REFUND_DAYS.min}~{REFUND_DAYS.max}일</b> 안에 돌려드립니다.
                변심으로 반품하시면 <b style={{ color: '#c92a2a' }}>반송비는 본인 부담</b>이고,
                {quote && freightKrw > 0
                  ? <> 이 주문 기준 교환 왕복은 약 <b style={{ color: '#d9480f' }}>{krw(roundTripKrw)}</b> 듭니다.</>
                  : <> 품절 등 저희 사유면 전액 돌려드립니다.</>}
              </>}>
            <p className="note" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
              💳 환불은 <b style={{ color: '#3182f6' }}>영업일 기준 {REFUND_DAYS.min}~{REFUND_DAYS.max}일</b> 내
              돌려드립니다 (계좌로 보내드리거나 카드결제 취소, 같습니다).
              <br />
              ⛔ 반품·변심 취소 환불: <b>대신 사드린 건은 수수료를 뺀 나머지</b>를 돌려드리고,{' '}
              <b>배송만 맡기신 건은 처리비 {'$' + RETURN_POLICY.forwardingRefundFeeUsd}를 뺀</b> 나머지를 돌려드립니다.
              품절·가격 인상 등 당사 사유 취소는 <b style={{ color: '#17916b' }}>전액 환불</b>.
              <br />
              ↩️ 하노이 도착 후 교환·반품 시{' '}
              <b style={{ color: '#c92a2a' }}>반송비(하노이→한국)와 쇼핑몰 반품비는 전액 구매자 부담</b>입니다.
            </p>
            {quote && freightKrw > 0 && (
              <div className="note" style={{ fontSize: 12.5, background: '#fff8e6', lineHeight: 1.8, marginTop: 8 }}>
                <b>↔️ 이 주문 기준 교환·반품 비용 미리보기</b>{' '}
                <small>({billableKg}kg 기준{RETURN_SHIPPING.assumed ? ' · 반송비는 요율 확정 전 예상' : ''})</small>
                <br />
                보낼 때(하노이→한국) 약 <b style={{ color: '#c92a2a' }}>{krw(backKrw)}</b>
                {handlingKrw > 0 ? ' (처리 기본료 포함)' : ''}
                {' '}· 다시 받을 때(한국→하노이) <b style={{ color: '#c92a2a' }}>{krw(resendKrw)}</b>
                {agencyKrw > 0 ? ' (배송비+수수료)' : ' (배송비)'}
                <br />
                🔁 교환 왕복 합계 약{' '}
                <b style={{ color: '#d9480f', fontSize: 13.5 }}>{krw(roundTripKrw)}</b>
                {goodsKrw > 0 && roundTripKrw >= goodsKrw && (
                  <>
                    <br />
                    <b style={{ color: '#c92a2a' }}>
                      ⚠️ 상품가 합계({krw(goodsKrw)})보다 큽니다 — 교환·반품 실익이 없으니 저렴한 상품은
                      그대로 받으시길 권합니다.
                    </b>
                  </>
                )}
                <br />
                <small style={{ color: '#c92a2a', fontWeight: 700 }}>
                  ⚠️ {RETURN_SHIPPING.blockedNote} — 해당 품목은 교환·반품이 불가합니다.
                </small>{' '}
                <small>{RETURN_SHIPPING.customsNote}.</small>
              </div>
            )}
            </Fold>
          </div>
        )
      })()}

        <section className="panel">
          <div className="panel__head">4. 확인하기</div>
          <div className="panel__body">
            <button type="button"
              onClick={() => {
                const next = {}
                for (const c of REQUIRED_CONSENTS) next[c.id] = !allAgreed
                setConsents(next)
              }}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
                border: allAgreed ? '3px solid #17916b' : '2px solid #e5e8eb',
                background: allAgreed ? '#e6f6f0' : '#fff',
                fontSize: 16.5, fontWeight: 800, color: allAgreed ? '#17916b' : '#191f28',
              }}>
              {allAgreed ? '✓ 모두 확인했습니다' : '아래 내용을 모두 확인했습니다'}
            </button>

            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {REQUIRED_CONSENTS.map((c) => (
                <label key={c.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  border: '1px solid #e5e8eb', borderRadius: 10, cursor: 'pointer',
                  background: consents[c.id] ? '#f7fbf9' : '#fff',
                }}>
                  <input type="checkbox" checked={Boolean(consents[c.id])}
                    onChange={(e) => setConsents({ ...consents, [c.id]: e.target.checked })}
                    style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 14.5, lineHeight: 1.6, color: '#333d4b' }}>{c.label}</span>
                </label>
              ))}
            </div>
            <p className="note" style={{ marginTop: 10, fontSize: 13.5 }}>
              자세한 내용은 <a href="/notice" target="_blank" rel="noreferrer"><b>공지사항</b></a> 에서 확인하실 수 있습니다.
            </p>
          </div>
        </section>

        {quote && !blocked && <CostBreakdown quote={quote} />}

        {duplicate && (() => {
          const openNos = duplicate.openOrderNos?.length ? duplicate.openOrderNos : [duplicate.orderNo]
          return (
          <div className="section" style={{ paddingTop: 0 }}>
            <div style={{ border: '2px solid #f59f00', background: '#fff8e6', borderRadius: 12, padding: 14 }}>
              <p style={{ margin: 0, fontWeight: 800, color: '#d9480f' }}>
                ⚠️ 같은 주문이 {openNos.length > 1 ? `${openNos.length}건 ` : ''}이미 접수되어 있어요
              </p>
              <p className="note" style={{ margin: '8px 0 10px', background: '#fff', fontSize: 12.5 }}>
                <b>{duplicate.orderNo}</b> · {duplicate.stateLabel} · {duplicate.minutesAgo}분 전 접수
                {duplicate.totalKrw ? <> · <b>{krw(duplicate.totalKrw)}</b></> : null}
                {openNos.length > 1 && (
                  <>
                    <br />
                    <b style={{ color: '#d9480f' }}>미결제 {openNos.length}건 전부</b>: {openNos.join(' · ')}
                    <br />
                    <small>한 건만 취소하면 남은 건이 다시 중복으로 잡힙니다 — 아래 버튼이 모두 정리합니다.</small>
                  </>
                )}
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                <a className="btn btn--ghost" href={`/orders/${duplicate.orderNo}`} target="_blank" rel="noreferrer">
                  기존 주문 확인하기 ↗
                </a>
                {duplicate.cancellable && (
                  <button type="button" className="btn" disabled={submitting} onClick={cancelAndResubmit}>
                    {submitting ? '처리 중…'
                      : openNos.length > 1
                        ? `기존 주문 ${openNos.length}건 모두 취소하고 이 주문으로 다시 접수`
                        : '기존 주문 취소하고 이 주문으로 다시 접수'}
                  </button>
                )}
                {duplicate.forceable ? (
                  <button type="button" className="btn btn--ghost" disabled={submitting}
                    onClick={() => submitOrder(true)}>
                    중복 아님 — 같은 상품을 한 번 더 주문합니다
                  </button>
                ) : (
                  <p className="note" style={{ fontSize: 12, margin: 0 }}>
                    같은 쇼핑몰 주문번호는 두 번 접수할 수 없습니다.
                    {duplicate.cancellable
                      ? ' 기존 주문을 취소하면 다시 접수됩니다.'
                      : ' 이미 진행 중이면 운영자에게 문의해 주세요.'}
                  </p>
                )}
              </div>
            </div>
          </div>
          )
        })()}

        {error && (
          <div className="section" style={{ paddingTop: 0 }}>
            <p className="note note--danger">{error}</p>
          </div>
        )}

        <div className="section" style={{ paddingTop: 0 }}>
          <button className="btn" type="submit"
            style={{ minHeight: 60, fontSize: 19, fontWeight: 800 }}
            disabled={!valid || !quote || blocked || overLimit || submitting || methods.length === 0}>
            {submitting ? '신청서를 만들고 있어요…'
              : blocked ? '보낼 수 없는 상품이 있어요'
              : overLimit ? '한도를 넘었어요 — 나눠서 신청해 주세요'
              : !quote ? '금액 계산 중…'
              : allAgreed ? `${krw(quote.total)} 신청하기`
              : `${krw(quote.total)} · 위 내용에 동의하고 신청하기`}
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
