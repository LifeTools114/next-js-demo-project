/**
 * 폰에서 하는 길 — 확장 없이 혼자 끝내는 화면 (📦 배송만 · 🛒 구매하고 배송까지)
 *
 * 구매하고 배송까지(구매대행)는 창고 주소가 필요 없습니다 — 상품 링크·가격·개수만 적으면
 * 신청서에서 상품값+수수료+배송비를 한 번에 결제하고 나머지는 저희가 합니다 (운영자 26-09-06).
 * 폰 웹앱(홈 화면에 추가) 상태에서 쿠팡 앱의 「공유」로 링크를 받으면 ?url=·?text=·?title= 로
 * 들어와 첫 줄에 채워집니다 (public/manifest.webmanifest 의 share_target).
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
import { copyText } from '../lib/copy'
import { fromShare, parseProductUrl } from '../lib/coupang-url'

const RECIPIENT_KEY = 'kbeauty-hanoi:recipient'

/** 눌러서 복사되는 한 줄 — 폰에서 손가락으로 누르기 좋은 크기로. */
function CopyRow({ label, value, display, hint, disabled, danger }) {
  const [state, setState] = useState('')
  const done = state === 'ok'
  const copy = async () => {
    if (disabled || !value) return
    // 복사가 막히는 환경에서도 조용히 실패하지 않습니다 (lib/copy.js 참고)
    setState((await copyText(value)) ? 'ok' : 'fail')
    setTimeout(() => setState(''), 1800)
  }

  return (
    <button type="button" onClick={copy} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '14px 14px', marginBottom: 8, borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
        border: `2px ${danger ? 'solid #ff6a00' : 'solid #e5e8eb'}`,
        background: disabled ? '#f6f7f9' : done ? '#e6f6f0' : state === 'fail' ? '#fff8e6' : '#fff',
        font: 'inherit',
      }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: danger ? '#ff6a00' : '#8b95a1' }}>
          {label}
        </span>
        <span style={{
          display: 'block', fontSize: 17, fontWeight: 800, color: disabled ? '#b0b8c1' : '#191f28',
          marginTop: 2, wordBreak: 'break-all', lineHeight: 1.45,
        }}>
          {display ?? value ?? ''}
        </span>
        {hint ? <span style={{ display: 'block', fontSize: 12.5, color: '#8b95a1', marginTop: 3 }}>{hint}</span> : null}
      </span>
      <span style={{
        flexShrink: 0, fontSize: 14, fontWeight: 800,
        color: done ? '#17916b' : disabled ? '#b0b8c1' : '#3182f6',
      }}>
        {done ? '✓ 복사됨' : state === 'fail' ? '길게 눌러 복사' : '복사'}
      </span>
    </button>
  )
}

export default function SendPage() {
  const router = useRouter()
  const [track, setTrack] = useState('forwarding')
  const [name, setName] = useState('')
  const emptyRow = () => ({ productName: '', productPrice: '', quantity: 1, productUrl: '', spec: '', edit: false })
  const [rows, setRows] = useState([emptyRow()])
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState(null)
  const [shared, setShared] = useState(false)
  /** 줄별 「링크 미리 읽기」 상태 — { i: 'loading' | 'ok' | 'fail' } */
  const [peek, setPeek] = useState({})

  // 신청서에서 쓰던 이름이 있으면 그대로 씁니다 — 두 번 적지 않게.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECIPIENT_KEY) ?? 'null')
      if (saved?.name) setName(saved.name)
    } catch { /* 없으면 빈 칸으로 */ }
  }, [])

  /**
   * 주소창으로 들어온 것 — ?track=agent (홈·바로가기) 와
   * 쿠팡 앱 「공유」(share_target: ?url= ?text= ?title=) 는 첫 줄에 링크·이름을 채웁니다.
   */
  useEffect(() => {
    if (!router.isReady) return
    const q = router.query
    if (q.track === 'agent') setTrack('agent')
    const { link, productName } = fromShare({ title: q.title, text: q.text, url: q.url })
    if (link) {
      setRows([{ ...emptyRow(), productUrl: link.url, productName }])
      setShared(true)
      peekRow(0, link.url)
      // 공유로 온 상품은 대부분 「대신 사 달라」는 뜻 — 배송만이 필요하면 위에서 바꿉니다
      if (q.track !== 'forwarding') setTrack('agent')
      router.replace('/send', undefined, { shallow: true })
    }
  }, [router.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const isAgent = track === 'agent'
  const detail = name.trim() ? detailAddressFor(name) : ''
  /**
   * 예시 이름은 **누가 봐도 예시**여야 합니다.
   * 예전에는 이 자리에 브라우저에 저장된 이름이 그대로 떠서, 남의 이름을
   * 자기 이름인 줄 알고 그대로 넣는 일이 생겼습니다 (운영자 26-09-06).
   * 그래서 비어 있으면 '홍길동'을 회색 예시로 보여주고, 이름을 넣으면
   * 그 이름을 노랗게 칠해 "이 부분이 당신 이름"임을 눈에 띄게 합니다.
   */
  const SAMPLE_NAME = '홍길동'
  const markStyle = {
    background: '#ffe98a', color: '#191f28', padding: '1px 6px', borderRadius: 6,
    fontWeight: 900, boxShadow: 'inset 0 -2px 0 #f0b429',
  }
  const sampleStyle = { ...markStyle, background: '#eef1f5', color: '#8b95a1', boxShadow: 'none' }
  const fullAddress = `${WAREHOUSE.address1}${WAREHOUSE.address2 ? ` ${WAREHOUSE.address2}` : ''}`

  /** 신청서로 넘길 수 있는 줄만 (이름과 가격이 있는 것 — 구매하고 배송까지는 링크도) */
  const items = useMemo(() => rows
    .map((r, i) => {
      const link = parseProductUrl(r.productUrl)
      // 쇼핑몰 앱의 공유는 링크만 넘겨줍니다 — 이름을 안 적어도 상품 번호로 신청은 되게 하고,
      // 이름을 적으면 무게(배송비)가 더 정확해집니다 (운영자 26-09-06: "링크만 가지고 오네").
      const typedName = String(r.productName ?? '').trim()
      return {
        productId: link?.productId ?? `m-${i}`,
        productName: typedName || (link?.productId ? `상품 ${link.productId}` : ''),
        productPrice: Math.max(0, Math.round(Number(r.productPrice) || 0)),
        quantity: Math.max(1, Math.min(Number(r.quantity) || 1, 99)),
        productUrl: link?.url ?? String(r.productUrl ?? '').trim().slice(0, 500),
        specOverride: r.spec || null,
        track,
      }
    })
    .filter((r) => r.productName && r.productPrice > 0 && (!isAgent || r.productUrl)), [rows, track, isAgent])

  const setRow = (i, patch) => { setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r))); setQuote(null) }

  /**
   * 링크를 넣으면 서버가 그 상품 화면을 한 번 읽어 이름·가격·용량을 채웁니다 (운영자 26-09-06).
   * 쇼핑몰이 막으면 「직접 적어 주세요」 — 흐름은 끊기지 않습니다. 이미 적힌 칸은 덮어쓰지 않습니다.
   */
  const peekRow = async (i, url) => {
    if (!parseProductUrl(url)) return
    setPeek((p) => ({ ...p, [i]: 'loading' }))
    try {
      const res = await fetch(`/api/product-peek?url=${encodeURIComponent(url)}`)
      const d = await res.json()
      if (!d.ok) {
        // 번호·정식 주소만 확인된 경우(쇼핑몰이 서버의 화면 읽기를 막음) — 주소는 정식으로 바꿔 두고 가격만 받습니다
        if (d.productId && d.url) setRows((prev) => prev.map((r, k) => (k !== i ? r : { ...r, productUrl: d.url })))
        setPeek((p) => ({ ...p, [i]: d.productId ? 'resolved' : 'fail' }))
        return
      }
      setRows((prev) => prev.map((r, k) => (k !== i ? r : {
        ...r,
        productName: r.productName?.trim() ? r.productName : (d.productName ?? ''),
        productPrice: r.productPrice ? r.productPrice : (d.productPrice ?? ''),
        spec: d.spec ?? r.spec ?? '',
      })))
      setPeek((p) => ({ ...p, [i]: 'ok' }))
    } catch {
      setPeek((p) => ({ ...p, [i]: 'fail' }))
    }
  }
  const switchTrack = (next) => { setTrack(next); setQuote(null); setError(null) }

  const getQuote = async () => {
    if (items.length === 0) return
    setQuoting(true)
    setError(null)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zone: 'hanoi', track }),
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

  const t = TRACKS[track]
  const toggleBtn = (id) => {
    const on = track === id
    const tt = TRACKS[id]
    return (
      <button key={id} type="button" onClick={() => switchTrack(id)} aria-pressed={on}
        data-track={id}
        style={{
          flex: 1, minHeight: 64, borderRadius: 12, cursor: 'pointer', padding: '8px 6px',
          border: on ? '2.5px solid #ff6a00' : '2px solid #dbe4f0',
          background: on ? '#fff4e5' : '#fff', color: on ? '#7a3b00' : '#4e5968', font: 'inherit',
        }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 900 }}>{tt.emoji} {tt.name}</span>
        <span style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{tt.line}</span>
      </button>
    )
  }

  const productRows = (
    <>
      {rows.map((r, i) => {
        const link = parseProductUrl(r.productUrl)
        const auto = peek[i] === 'ok' && !r.edit
        const qty = Math.max(1, Math.min(Number(r.quantity) || 1, 99))
        return (
          <div key={i} style={{
            border: '1px solid #e5e8eb', borderRadius: 12, padding: 12, marginBottom: 10, background: '#fbfcfd',
          }}>
            {/* 1) 링크 — 고객은 이것만 붙여넣습니다 (운영자 26-09-06: "고객이 링크만 붙여넣게 합시다") */}
            <input className="input" type="url" inputMode="url" value={r.productUrl}
              placeholder="여기에 상품 링크를 붙여넣으세요"
              onChange={(e) => {
                const v = e.target.value
                setRow(i, { productUrl: v, edit: false })
                // 붙여넣기처럼 한 번에 완전한 링크가 들어오면 바로 읽습니다
                if (parseProductUrl(v)?.productId || /link\.coupang\.com/.test(v)) peekRow(i, v)
              }}
              onBlur={(e) => { if (parseProductUrl(e.target.value) && !peek[i]) peekRow(i, e.target.value) }}
              style={{ fontSize: 15, minHeight: 52, marginBottom: 8, borderColor: r.productUrl && !link ? '#ff6a00' : (auto ? '#17916b' : undefined) }} />
            {r.productUrl && !link && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>
                쇼핑몰 상품 링크가 아닌 것 같습니다. 앱에서 상품 → 공유 → 링크 복사한 주소를 넣어주세요.
              </p>
            )}
            {peek[i] === 'loading' && <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5 }}>⏳ 상품 정보를 읽는 중…</p>}
            {peek[i] === 'resolved' && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: '#e6f6f0', color: '#0f6e4f' }}>
                ✓ 링크 확인됨 (상품 번호 {link?.productId}). 쇼핑몰이 서버의 자동 읽기를 막아 <b>가격</b>은 직접 적어 주세요 — 이름은 안 적어도 됩니다.
              </p>
            )}
            {peek[i] === 'fail' && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>
                쇼핑몰 상품 링크로 확인되지 않았습니다 — 아래에 이름과 가격을 직접 적어 주세요.
              </p>
            )}

            {auto ? (
              /* 2) 읽어온 상품 — 고객이 고른 옵션 그대로. 개수만 정합니다 */
              <div data-auto-item="1" style={{ border: '1px solid #b7e4d2', background: '#f2fbf7', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#17916b', fontWeight: 800 }}>✓ 읽어온 상품 (고른 옵션 그대로)</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#191f28', marginTop: 4, lineHeight: 1.4 }}>{r.productName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#1b64da' }}>{krw(Number(r.productPrice) || 0)}</span>
                  {r.spec ? <span style={{ fontSize: 12.5, color: '#4e5968' }}>용량 {r.spec}</span> : null}
                  <span style={{ flex: 1 }} />
                  {/* 개수 − n + 는 한 덩어리로 — 좁은 폰에서 줄이 갈라지지 않게 */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 12.5, color: '#4e5968', fontWeight: 700 }}>개수</span>
                    <button type="button" aria-label="개수 줄이기" onClick={() => setRow(i, { quantity: Math.max(1, qty - 1) })}
                      style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid #dbe4f0', background: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>−</button>
                    <span data-qty="1" style={{ minWidth: 24, textAlign: 'center', fontSize: 18, fontWeight: 900 }}>{qty}</span>
                    <button type="button" aria-label="개수 늘리기" onClick={() => setRow(i, { quantity: Math.min(99, qty + 1) })}
                      style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid #dbe4f0', background: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>+</button>
                  </span>
                </div>
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <button type="button" onClick={() => setRow(i, { edit: true })}
                    style={{ border: 0, background: 'transparent', color: '#8b95a1', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
                    이름·가격이 다르면 고치기
                  </button>
                </div>
              </div>
            ) : (
              /* 3) 직접 적기 — 링크를 못 읽었거나 링크가 없을 때 */
              <>
                <input className="input" value={r.productName} placeholder="상품 이름 (쇼핑몰 화면 그대로)"
                  onChange={(e) => setRow(i, { productName: e.target.value })}
                  style={{ fontSize: 16, minHeight: 50, marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" type="number" inputMode="numeric" min="0" value={r.productPrice}
                    placeholder="가격 (원)" onChange={(e) => setRow(i, { productPrice: e.target.value })}
                    autoFocus={i === 0 && (peek[i] === 'resolved' || peek[i] === 'fail')}
                    style={{ flex: 2, fontSize: 16, minHeight: 50 }} />
                  <input className="input" type="number" inputMode="numeric" min="1" max="99" value={r.quantity}
                    placeholder="개수" onChange={(e) => setRow(i, { quantity: e.target.value })}
                    style={{ flex: 1, fontSize: 16, minHeight: 50 }} />
                </div>
              </>
            )}

            {rows.length > 1 && (
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))}
                  style={{ border: '1px solid #ffd5d5', borderRadius: 8, background: '#fff', color: '#c53030', fontSize: 12.5, fontWeight: 800, padding: '6px 10px', cursor: 'pointer' }}>
                  이 상품 빼기 ×
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button type="button"
        onClick={() => setRows([...rows, emptyRow()])}
        style={{
          width: '100%', minHeight: 48, borderRadius: 10, border: '2px dashed #dbe4f0',
          background: '#fff', color: '#3182f6', fontSize: 15, fontWeight: 800, cursor: 'pointer',
        }}>+ 상품 링크 하나 더</button>

      {error && <p className="note note--danger" style={{ marginTop: 10 }}>{error}</p>}

      {quote && (
        <div style={{
          marginTop: 12, padding: '14px 16px', borderRadius: 12,
          border: '2px solid #3182f6', background: '#f2f6fb',
        }}>
          <div style={{ fontSize: 13.5, color: '#4e5968' }}>
            {isAgent ? '상품값 + 수수료 + 베트남까지 배송비 (예상)' : '베트남까지 배송비 (예상)'}
          </div>
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
            {quoting ? '계산 중…'
              : items.length === 0
                ? (rows.some((r) => parseProductUrl(r.productUrl)?.productId) ? '가격을 넣어주세요'
                  : isAgent ? '상품 링크를 붙여넣어 주세요' : '상품 링크 또는 이름·가격을 넣어주세요')
              : isAgent ? '얼마인지 보기' : '배송비 얼마인지 보기'}
          </button>
        )}
      </div>
    </>
  )

  return (
    <Layout title={`${t.name} — 폰으로 하기`}>
      <div className="section" style={{ paddingBottom: 6 }}>
        <h1 className="section__title">{t.emoji} {t.name}</h1>
        <p className="section__sub">{t.line} — 폰만 있으면 됩니다.</p>
      </div>

      {/* ── 방식 고르기 — 배송만 / 구매하고 배송까지 ──────────── */}
      <div className="section" style={{ paddingTop: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8 }}>{[toggleBtn('forwarding'), toggleBtn('agent')]}</div>
        {shared && (
          <p className="note" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
            ✓ 공유받은 상품 링크를 아래 첫 줄에 넣었습니다. <b>가격</b>만 적으면 바로 계산됩니다.
            이름은 안 적어도 되고, 적으면 무게가 더 정확해집니다.
          </p>
        )}
      </div>

      {!isAgent && (
        <>
          {/* ── 1. 쿠팡에 넣을 주소 ─────────────────────────────── */}
          <section className="panel">
            <div className="panel__head">1. 쇼핑몰 배송지에 이대로 넣어주세요</div>
            <div className="panel__body">
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="field__label" htmlFor="myname">받는 분 성함 (한글 또는 영문)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="myname" className="input" value={name} placeholder={`예) ${SAMPLE_NAME}`}
                    onChange={(e) => setName(e.target.value)}
                    style={{ fontSize: 17, minHeight: 52, flex: 1, minWidth: 0 }} />
                  {name ? (
                    /* 지난번 이름이 남아 있으면 한 번에 지웁니다 — 남의 이름으로 보내지 않게 */
                    <button type="button" onClick={() => setName('')}
                      style={{
                        flexShrink: 0, minHeight: 52, padding: '0 14px', borderRadius: 10,
                        border: '2px solid #e5e8eb', background: '#fff', color: '#8b95a1',
                        fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      }}>지우기</button>
                  ) : null}
                </div>
                <p className="note" style={{ marginTop: 6, fontSize: 13 }}>
                  이 이름으로 창고에서 소포를 찾습니다. 신청서에 적으실 이름과 <b>같아야</b> 합니다.
                </p>
              </div>

              <CopyRow label="받는 사람" value={WAREHOUSE.code} />
              <CopyRow label="우편번호" value={WAREHOUSE.zip} hint="주소 검색 대신 우편번호로 찾으면 빠릅니다" />
              <CopyRow label="주소" value={fullAddress} />
              <CopyRow label="상세주소 — 이게 빠지면 소포 주인을 못 찾습니다" value={detail}
                disabled={!detail} danger
                display={detail ? (
                  <>
                    {WAREHOUSE.code} <span style={markStyle}>{name.trim()}</span>
                  </>
                ) : (
                  <>
                    {WAREHOUSE.code} <span style={sampleStyle}>{SAMPLE_NAME}</span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#ff6a00', marginTop: 6 }}>
                      ↑ <span style={sampleStyle}>{SAMPLE_NAME}</span> 자리에 <b>본인 이름</b>을 넣어주세요 — 위 칸에 적으면 여기가 채워집니다
                    </span>
                  </>
                )}
                hint={detail ? '쇼핑몰 배송지의 «상세주소» 칸에 이대로 넣어주세요' : undefined} />
              <CopyRow label="전화번호" value={WAREHOUSE.phone} />

              <p className="note note--danger" style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.7 }}>
                ⚠️ <b>상세주소</b>가 가장 중요합니다. 「{WAREHOUSE.code}{' '}
                <span style={detail ? markStyle : sampleStyle}>{name.trim() || SAMPLE_NAME}</span>」처럼
                <b> 코드 뒤에 본인 이름</b>이 없으면, 창고에 물건이 도착해도 누구 것인지 알 수 없어
                배송이 늦어집니다.
              </p>
            </div>
          </section>

          {/* ── 2. 쿠팡으로 ─────────────────────────────────────── */}
          <section className="panel">
            <div className="panel__head">2. 쇼핑몰에서 결제하고 오세요</div>
            <div className="panel__body">
              <a className="btn" href="https://m.coupang.com/" target="_blank" rel="noreferrer"
                style={{ display: 'block', textAlign: 'center', minHeight: 56, fontSize: 17, lineHeight: '32px' }}>
                쇼핑몰 열기 →
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
                쇼핑몰 앱에서 상품 → <b>공유(또는 링크)</b> 버튼 → <b>링크 복사</b> → 아래 링크 칸에 붙여넣고
                <b>가격</b>만 적어 주세요. 링크가 없으면 이름과 가격만 적어도 됩니다.
              </p>
              {productRows}
            </div>
          </section>
        </>
      )}

      {isAgent && (
        <>
          {/* ── 구매하고 배송까지 — 주소 필요 없음, 상품만 ───────────── */}
          <section className="panel">
            <div className="panel__head">1. 무엇을 사드릴까요</div>
            <div className="panel__body">
              <p className="note" style={{ marginBottom: 12, fontSize: 13.5, lineHeight: 1.7 }}>
                🛒 한국 결제수단이 없어도 됩니다. <b>상품 링크·가격·개수</b>만 적어주시면
                저희가 대신 사서 베트남까지 보내드립니다. 결제는 다음 화면(신청서)에서
                <b> 상품값 + 수수료 + 배송비</b>를 한 번에 합니다.
                <br />
                <small>링크: 쇼핑몰 앱에서 상품 화면 → <b>공유(또는 링크)</b> 버튼 → <b>링크 복사</b> → 여기 붙여넣기.
                그다음 <b>가격</b>과 <b>개수</b>만 적으시면 됩니다.</small>
              </p>
              {productRows}
            </div>
          </section>
        </>
      )}

      {/* ── 앱처럼 쓰기 ─────────────────────────────────────── */}
      <section className="panel">
        <div className="panel__head">📱 폰에 앱처럼 두기</div>
        <div className="panel__body">
          <p className="note" style={{ fontSize: 13.5, lineHeight: 1.75 }}>
            <b>안드로이드(크롬)</b>: 오른쪽 위 ⋮ → <b>홈 화면에 추가</b>. 그 뒤로는 쇼핑몰 앱에서
            상품 <b>공유</b> → 「베트남 직구」를 고르면 링크가 이 화면으로 바로 옵니다.
            <br />
            <b>아이폰(사파리)</b>: 공유 버튼 → <b>홈 화면에 추가</b>. 링크는 복사해서 위 칸에 붙여넣습니다.
          </p>
        </div>
      </section>
    </Layout>
  )
}
