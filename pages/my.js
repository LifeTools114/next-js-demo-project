import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { readMyKey, saveMyKey, clearMyKey } from '../lib/my-orders'
import { krw, formatDateTime } from '../lib/format'

/**
 * 내 주문 — 회원가입 없이, 개인 링크(열쇠)로 이 전화번호의 주문 전부를 봅니다.
 *
 * 열쇠는 이 브라우저와 고객이 저장한 링크에만 있고 서버는 해시만 가집니다.
 * 링크를 잃으면 「전화번호 + 입금까지 끝난 주문번호」로 다시 받습니다.
 * 원하면 PIN(숫자 4~6자리)을 걸어, 링크가 새어도 PIN 없이는 못 보게 합니다.
 */
const STATE_COLOR = { REQUESTED: '#b7791f', AWAITING_PAYMENT: '#b7791f', CANCELLED: '#c53030' }
const UNLOCK_KEY = 'kbeauty-hanoi:my-unlock'
const readUnlock = () => { try { return window.sessionStorage.getItem(UNLOCK_KEY) || '' } catch { return '' } }
const saveUnlock = (u) => { try { window.sessionStorage.setItem(UNLOCK_KEY, u) } catch { /* 무시 */ } }

export default function MyOrders() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [unlock, setUnlock] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pinGate, setPinGate] = useState(null) // { name } — PIN 을 물어야 하는 상태
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [rec, setRec] = useState({ phone: '', orderNo: '' })
  const [recError, setRecError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pinForm, setPinForm] = useState({ open: false, pin: '', msg: null })

  const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const load = useCallback(async (k, u) => {
    setLoading(true); setError(null); setPinGate(null)
    try {
      const r = await fetch(`/api/my?k=${encodeURIComponent(k)}${u ? `&u=${encodeURIComponent(u)}` : ''}`)
      const d = await r.json()
      if (r.status === 403 && d.pinRequired) { setPinGate({ name: d.name }); setData(null); return }
      if (!r.ok) throw new Error(d.error || '불러오지 못했습니다.')
      setData(d)
    } catch (e) {
      setData(null); setError(e.message)
      clearMyKey(); setKey('')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    const fromUrl = typeof router.query.k === 'string' ? router.query.k : ''
    if (fromUrl) {
      saveMyKey(fromUrl)
      // 주소창에서 열쇠를 지웁니다 — 화면을 찍어 보내거나 링크가 남는 일을 줄이기 위해서입니다.
      router.replace('/my', undefined, { shallow: true })
    }
    const k = fromUrl || readMyKey()
    const u = readUnlock()
    setKey(k); setUnlock(u)
    if (k) load(k, u); else setLoading(false)
  }, [router.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const link = typeof window !== 'undefined' && key ? `${window.location.origin}/my?k=${key}` : ''
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* 입력칸에서 직접 복사 */ }
  }
  const submitPin = async (e) => {
    e.preventDefault(); setBusy(true); setPinError(null)
    try {
      const r = await post('/api/my/unlock', { k: key, pin: pinInput })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'PIN 을 확인하지 못했습니다.')
      saveUnlock(d.unlock); setUnlock(d.unlock); setPinGate(null); setPinInput('')
      setData({ customer: d.customer, orders: d.orders })
    } catch (e2) { setPinError(e2.message) } finally { setBusy(false) }
  }
  const toggleMarketing = async (agreed) => {
    const r = await post('/api/my/consent', { k: key, u: unlock, agreed })
    if (r.ok) setData((d) => ({ ...d, customer: { ...d.customer, marketing: agreed } }))
  }
  const savePin = async (remove) => {
    setBusy(true)
    try {
      const r = await post('/api/my/pin', { k: key, u: unlock, pin: pinForm.pin, remove })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '저장하지 못했습니다.')
      setData((x) => ({ ...x, customer: { ...x.customer, pin: d.pin } }))
      setPinForm({ open: false, pin: '', msg: d.pin ? '✓ PIN 을 걸었습니다. 다음부터 링크를 열 때 PIN 을 묻습니다.' : '✓ PIN 을 풀었습니다.' })
    } catch (e2) { setPinForm((f) => ({ ...f, msg: e2.message })) } finally { setBusy(false) }
  }
  const recover = async (e) => {
    e.preventDefault(); setBusy(true); setRecError(null)
    try {
      const r = await post('/api/my/recover', rec)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '다시 받지 못했습니다.')
      saveMyKey(d.key); setKey(d.key); await load(d.key, '')
    } catch (e2) { setRecError(e2.message) } finally { setBusy(false) }
  }

  const unpaid = (data?.orders ?? []).filter((o) => o.state === 'REQUESTED' || o.state === 'AWAITING_PAYMENT').length

  return (
    <Layout title="내 주문">
      <div className="hero">
        <h1 className="hero__title">내 주문</h1>
        <p className="hero__desc">회원가입 없이, 개인 링크로 이 전화번호의 주문을 모두 봅니다.</p>
      </div>

      {loading && <div className="section"><p className="note">불러오는 중…</p></div>}

      {!loading && pinGate && (
        <section className="panel">
          <div className="panel__head panel__head--accent">PIN 입력<span className="hint-strong">🔒 잠금</span></div>
          <div className="panel__body">
            <p className="note" style={{ marginBottom: 12 }}>
              {pinGate.name ? `${pinGate.name} 님, ` : ''}이 링크에는 PIN 이 걸려 있습니다. 숫자 PIN 을 넣어주세요.
            </p>
            <form onSubmit={submitPin}>
              <input className="input" inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={pinInput} autoFocus
                placeholder="PIN 4~6자리" onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }} />
              {pinError && <p className="note note--danger" style={{ margin: '10px 0' }}>{pinError}</p>}
              <button className="btn" type="submit" disabled={busy || pinInput.length < 4} style={{ marginTop: 10 }}>열기</button>
            </form>
            <p className="note" style={{ marginTop: 12, fontSize: 12 }}>
              PIN 을 잊으셨으면 아래에서 전화번호와 입금 끝난 주문번호로 새 링크를 받으세요 — PIN 도 함께 풀립니다.
            </p>
            <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => { clearMyKey(); setKey(''); setPinGate(null) }}>
              새 링크 받기로 가기
            </button>
          </div>
        </section>
      )}

      {!loading && !data && !pinGate && (
        <section className="panel">
          <div className="panel__head panel__head--accent">개인 링크 받기<span className="hint-strong">비밀번호 없음</span></div>
          <div className="panel__body">
            {error && <p className="note note--warn" style={{ marginBottom: 10 }}>{error}</p>}
            <p className="note" style={{ marginBottom: 12 }}>
              신청하실 때 받으신 <b>내 주문 링크</b>를 여시면 바로 보입니다. 링크가 없으면
              <b> 전화번호</b>와 <b>입금까지 끝난 주문번호 하나</b>로 새 링크를 받으세요.
            </p>
            <form onSubmit={recover}>
              <div className="field">
                <label className="field__label" htmlFor="rphone">전화번호</label>
                <input id="rphone" className="input" value={rec.phone} placeholder="신청서에 적으신 번호"
                  onChange={(e) => setRec({ ...rec, phone: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="rno">주문번호 (입금 확인된 것)</label>
                <input id="rno" className="input" value={rec.orderNo} placeholder="HN2609060001" autoComplete="off"
                  onChange={(e) => setRec({ ...rec, orderNo: e.target.value })} required />
              </div>
              {recError && <p className="note note--danger" style={{ marginBottom: 10 }}>{recError}</p>}
              <button className="btn" type="submit" disabled={busy}>{busy ? '확인 중…' : '새 링크 받기'}</button>
            </form>
            <p className="note" style={{ marginTop: 12, fontSize: 12 }}>
              입금 전 주문만 있으시면 <Link href="/orders"><b>주문번호로 조회</b></Link>하시거나 카카오톡으로 문의해 주세요.
            </p>
          </div>
        </section>
      )}

      {data && (
        <>
          <section className="panel">
            <div className="panel__head">
              <span>{data.customer.name ? `${data.customer.name} 님` : '내'} 주문 {data.orders.length}건</span>
              {unpaid > 0 && <span className="tag tag--warn">입금 전 {unpaid}건</span>}
            </div>
            <div className="panel__body">
              {!data.customer.verified && (
                <p className="note note--warn" style={{ marginBottom: 10, fontSize: 12.5 }}>
                  지금은 이 링크로 만든 주문만 보입니다. <b>입금이 확인되면</b> 이 전화번호({data.customer.phone})의
                  다른 주문도 함께 보입니다.
                </p>
              )}
              {data.orders.length === 0 && <p className="note">아직 주문이 없습니다.</p>}
              {data.orders.map((o) => (
                <Link key={o.orderNo} href={`/orders/${o.orderNo}`} className="row" style={{ display: 'flex' }}>
                  <span className="row__label">
                    <b>{o.orderNo}</b>
                    <br />
                    <small style={{ color: 'var(--ink-500)' }}>
                      {formatDateTime(o.createdAt)} · {(o.items ?? []).map((i) => i.productName).join(', ').slice(0, 40)}
                      {o.invoice?.amountKrw ? ` · ${krw(o.invoice.amountKrw)}` : ''}
                    </small>
                  </span>
                  <span className="row__value" style={{ fontSize: 12.5, fontWeight: 800, color: STATE_COLOR[o.state] ?? 'var(--ok)' }}>
                    {o.stateInfo?.label ?? o.state} ›
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head panel__head--accent">내 링크 저장해 두기<span className="hint-strong">잃어버리지 마세요</span></div>
            <div className="panel__body">
              <p className="note" style={{ marginBottom: 10 }}>
                이 링크 하나로 폰·PC 어디서든 내 주문을 봅니다. <b>카카오톡 「나에게 보내기」</b>에 넣어 두세요.
                <br /><b style={{ color: '#c92a2a' }}>남에게 보내지 마세요</b> — 링크를 아는 사람은 주문 내역을 볼 수 있습니다.
                {data.customer.pin ? ' (PIN 을 걸어 두셔서 PIN 없이는 열리지 않습니다)' : ''}
              </p>
              <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} style={{ fontSize: 12.5 }} />
              <button className="btn" type="button" onClick={copy} style={{ marginTop: 8 }}>{copied ? '✓ 복사됨' : '링크 복사'}</button>
              <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }}
                onClick={() => { clearMyKey(); setKey(''); setData(null) }}>이 기기에서 링크 지우기</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head"><span>🔒 PIN 잠금 (선택)</span>{data.customer.pin && <span className="tag tag--ok">걸려 있음</span>}</div>
            <div className="panel__body">
              <p className="note" style={{ marginBottom: 10, fontSize: 12.5 }}>
                PIN 을 걸면 링크가 새어도 PIN 없이는 아무도 못 봅니다. 잊으면 전화번호 + 입금 끝난 주문번호로 새 링크를 받으면 풀립니다.
              </p>
              {!pinForm.open ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--sm" onClick={() => setPinForm({ open: true, pin: '', msg: null })}>
                    {data.customer.pin ? 'PIN 바꾸기' : 'PIN 걸기'}
                  </button>
                  {data.customer.pin && <button type="button" className="btn btn--ghost btn--sm" onClick={() => savePin(true)} disabled={busy}>PIN 풀기</button>}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" inputMode="numeric" maxLength={6} value={pinForm.pin} placeholder="숫자 4~6자리" style={{ maxWidth: 160, textAlign: 'center', letterSpacing: 4 }}
                    onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, '') })} />
                  <button type="button" className="btn btn--sm" disabled={busy || pinForm.pin.length < 4} onClick={() => savePin(false)}>저장</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPinForm({ open: false, pin: '', msg: null })}>취소</button>
                </div>
              )}
              {pinForm.msg && <p className="note" style={{ marginTop: 8 }}>{pinForm.msg}</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">새 소식 받기 (선택)</div>
            <div className="panel__body">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(data.customer.marketing)} onChange={(e) => toggleMarketing(e.target.checked)}
                  style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>
                  새 상품·할인 소식을 카카오톡/Zalo·이메일로 받겠습니다. 언제든 여기서 끌 수 있습니다.
                </span>
              </label>
            </div>
          </section>
        </>
      )}
    </Layout>
  )
}
