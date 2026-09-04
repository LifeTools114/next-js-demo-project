/**
 * 폰에서 「📦 배송만」 하는 길 — 확장 없이 혼자 끝내는 화면
 *
 * 왜 필요한가
 *   PC 크롬은 확장이 쿠팡 배송지를 자동으로 채워줍니다. 그런데 **폰에는 확장이
 *   없습니다** (안드로이드·아이폰 크롬 모두 지원하지 않습니다). 고객 대부분이
 *   폰을 쓰는데, 지금까지 폰에서는 창고 주소를 알 방법조차 없었습니다.
 *
 * 그래서 이 화면이 하는 일은 셋뿐입니다.
 *   ① 쿠팡에 넣을 주소를 **한 항목씩 눌러 복사**하게 (외워 옮겨적지 않게)
 *   ② 쿠팡 앱으로 보내드리고
 *   ③ 돌아오시면 상품을 담아 신청서로 잇습니다
 *
 * 가장 자주 깨지는 곳은 **상세주소**입니다. "YS-ECOM 이름"이 빠지면 창고에서
 * 소포 주인을 못 찾습니다. 그래서 이름을 먼저 받아 상세주소를 만들어 드리고,
 * 이름이 없으면 그 칸은 복사조차 되지 않게 막아 둡니다.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { WAREHOUSE, detailAddressFor } from '../config/warehouse'
import { TRACKS } from '../config/tracks'
import { krw, vnd } from '../lib/format'

const RECIPIENT_KEY = 'kbeauty-hanoi:recipient'

/** 눌러서 복사되는 한 줄 — 폰에서 손가락으로 누르기 좋은 크기로. */
function CopyRow({ label, value, hint, disabled, danger }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    if (disabled || !value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // HTTPS 가 아니거나 권한이 없으면 클립보드가 막힙니다 —
      // 그때는 글자를 선택 상태로 만들어 길게 눌러 복사할 수 있게 합니다.
      try {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      } catch {
        return // 그래도 안 되면 화면의 글자를 직접 복사하시면 됩니다
      }
    }
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }

  return (
    <button type="button" onClick={copy} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '14px 14px', marginBottom: 8, borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
        border: `2px ${danger ? 'solid #ef4a76' : 'solid #e5e8eb'}`,
        background: disabled ? '#f6f7f9' : done ? '#e6f6f0' : '#fff',
        font: 'inherit',
      }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: danger ? '#ef4a76' : '#8b95a1' }}>
          {label}
        </span>
        <span style={{
          display: 'block', fontSize: 17, fontWeight: 800, color: disabled ? '#b0b8c1' : '#191f28',
          marginTop: 2, wordBreak: 'break-all', lineHeight: 1.45,
        }}>
          {value || '이름을 먼저 적어주세요'}
        </span>
        {hint ? <span style={{ display: 'block', fontSize: 12.5, color: '#8b95a1', marginTop: 3 }}>{hint}</span> : null}
      </span>
      <span style={{
        flexShrink: 0, fontSize: 14, fontWeight: 800,
        color: done ? '#17916b' : disabled ? '#b0b8c1' : '#3182f6',
      }}>
        {done ? '✓ 복사됨' : '복사'}
      </span>
    </button>
  )
}

export default function SendPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [rows, setRows] = useState([{ productName: '', productPrice: '', quantity: 1 }])
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState(null)

  // 신청서에서 쓰던 이름이 있으면 그대로 씁니다 — 두 번 적지 않게.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECIPIENT_KEY) ?? 'null')
      if (saved?.name) setName(saved.name)
    } catch { /* 없으면 빈 칸으로 */ }
  }, [])

  const detail = name.trim() ? detailAddressFor(name) : ''
  const fullAddress = `${WAREHOUSE.address1}${WAREHOUSE.address2 ? ` ${WAREHOUSE.address2}` : ''}`

  /** 신청서로 넘길 수 있는 줄만 (이름과 가격이 있는 것) */
  const items = useMemo(() => rows
    .map((r, i) => ({
      productId: `m-${i}`,
      productName: String(r.productName ?? '').trim(),
      productPrice: Math.max(0, Math.round(Number(r.productPrice) || 0)),
      quantity: Math.max(1, Math.min(Number(r.quantity) || 1, 99)),
      track: 'forwarding',
    }))
    .filter((r) => r.productName && r.productPrice > 0), [rows])

  const setRow = (i, patch) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  const getQuote = async () => {
    if (items.length === 0) return
    setQuoting(true)
    setError(null)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zone: 'hanoi', track: 'forwarding' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '계산에 실패했습니다.')
      setQuote(data.quote)
    } catch (e) {
      setError(e.message)
      setQuote(null)
    } finally {
      setQuoting(false)
    }
  }

  const goCheckout = () => {
    const cart = encodeURIComponent(JSON.stringify({ items, zone: 'hanoi' }))
    router.push(`/checkout?cart=${cart}`)
  }

  const t = TRACKS.forwarding

  return (
    <Layout title="배송만 — 폰으로 하기">
      <div className="section" style={{ paddingBottom: 6 }}>
        <h1 className="section__title">{t.emoji} {t.name}</h1>
        <p className="section__sub">{t.line} — 폰만 있으면 됩니다.</p>
      </div>

      {/* ── 1. 쿠팡에 넣을 주소 ─────────────────────────────── */}
      <section className="panel">
        <div className="panel__head">1. 쿠팡 배송지에 이대로 넣어주세요</div>
        <div className="panel__body">
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field__label" htmlFor="myname">받는 분 성함 (한글 또는 영문)</label>
            <input id="myname" className="input" value={name} placeholder="예) 박하노"
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: 17, minHeight: 52 }} />
            <p className="note" style={{ marginTop: 6, fontSize: 13 }}>
              이 이름으로 창고에서 소포를 찾습니다. 신청서에 적으실 이름과 <b>같아야</b> 합니다.
            </p>
          </div>

          <CopyRow label="받는 사람" value={WAREHOUSE.code} />
          <CopyRow label="전화번호" value={WAREHOUSE.phone} />
          <CopyRow label="우편번호" value={WAREHOUSE.zip} hint="주소 검색 대신 우편번호로 찾으면 빠릅니다" />
          <CopyRow label="주소" value={fullAddress} />
          <CopyRow label="상세주소 — 이게 빠지면 소포 주인을 못 찾습니다" value={detail}
            disabled={!detail} danger
            hint={detail ? '쿠팡 배송지의 «상세주소» 칸에 이대로 넣어주세요' : undefined} />

          <p className="note note--danger" style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.7 }}>
            ⚠️ <b>상세주소</b>가 가장 중요합니다. 「{WAREHOUSE.code} 이름」이 없으면 창고에 물건이
            도착해도 누구 것인지 알 수 없어 배송이 늦어집니다.
          </p>
        </div>
      </section>

      {/* ── 2. 쿠팡으로 ─────────────────────────────────────── */}
      <section className="panel">
        <div className="panel__head">2. 쿠팡에서 결제하고 오세요</div>
        <div className="panel__body">
          <a className="btn" href="https://m.coupang.com/" target="_blank" rel="noreferrer"
            style={{ display: 'block', textAlign: 'center', minHeight: 56, fontSize: 17, lineHeight: '32px' }}>
            쿠팡 열기 →
          </a>
          <p className="note" style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.75 }}>
            결제하실 때 <b>배송지를 위 주소로 바꾸시면</b> 됩니다.
            결제가 끝나면 이 화면으로 돌아와 아래 3번을 이어서 해주세요.
          </p>
        </div>
      </section>

      {/* ── 3. 상품 담고 신청 ───────────────────────────────── */}
      <section className="panel">
        <div className="panel__head">3. 무엇을 사셨나요</div>
        <div className="panel__body">
          <p className="note" style={{ marginBottom: 12, fontSize: 13.5 }}>
            상품 이름만 있으면 무게를 알아서 계산합니다. 쿠팡 화면의 이름을 그대로 넣어주세요.
          </p>

          {rows.map((r, i) => (
            <div key={i} style={{
              border: '1px solid #e5e8eb', borderRadius: 12, padding: 12, marginBottom: 10, background: '#fbfcfd',
            }}>
              <input className="input" value={r.productName} placeholder="상품 이름 (쿠팡 화면 그대로)"
                onChange={(e) => setRow(i, { productName: e.target.value })}
                style={{ fontSize: 16, minHeight: 50, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" type="number" inputMode="numeric" min="0" value={r.productPrice}
                  placeholder="가격 (원)" onChange={(e) => setRow(i, { productPrice: e.target.value })}
                  style={{ flex: 2, fontSize: 16, minHeight: 50 }} />
                <input className="input" type="number" inputMode="numeric" min="1" max="99" value={r.quantity}
                  placeholder="개수" onChange={(e) => setRow(i, { quantity: e.target.value })}
                  style={{ flex: 1, fontSize: 16, minHeight: 50 }} />
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))}
                    style={{
                      flexShrink: 0, width: 50, minHeight: 50, borderRadius: 10, border: '1px solid #ffd5d5',
                      background: '#fff', color: '#c53030', fontSize: 18, fontWeight: 800, cursor: 'pointer',
                    }}>×</button>
                )}
              </div>
            </div>
          ))}

          <button type="button"
            onClick={() => setRows([...rows, { productName: '', productPrice: '', quantity: 1 }])}
            style={{
              width: '100%', minHeight: 48, borderRadius: 10, border: '2px dashed #dbe4f0',
              background: '#fff', color: '#3182f6', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}>+ 상품 더 담기</button>

          {error && <p className="note note--danger" style={{ marginTop: 10 }}>{error}</p>}

          {quote && (
            <div style={{
              marginTop: 12, padding: '14px 16px', borderRadius: 12,
              border: '2px solid #3182f6', background: '#f2f6fb',
            }}>
              <div style={{ fontSize: 13.5, color: '#4e5968' }}>하노이까지 배송비 (예상)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#3182f6', marginTop: 2 }}>
                {krw(quote.total)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f04452' }}>≈ {vnd(quote.totalVnd)}</div>
              <div style={{ fontSize: 12.5, color: '#8b95a1', marginTop: 6 }}>
                청구무게 {quote.shipping?.billableKg}kg · 창고에서 실제로 달아본 뒤 확정됩니다
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {quote ? (
              <button type="button" className="btn" onClick={goCheckout}
                style={{ width: '100%', minHeight: 58, fontSize: 18, fontWeight: 800 }}>
                신청서 쓰러 가기 →
              </button>
            ) : (
              <button type="button" className="btn" onClick={getQuote}
                disabled={items.length === 0 || quoting}
                style={{ width: '100%', minHeight: 58, fontSize: 18, fontWeight: 800 }}>
                {quoting ? '계산 중…' : items.length === 0 ? '상품 이름과 가격을 넣어주세요' : '배송비 얼마인지 보기'}
              </button>
            )}
          </div>
        </div>
      </section>
    </Layout>
  )
}
