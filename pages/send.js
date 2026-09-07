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
 * 사진 넣는 곳은 화면에 📷 버튼 **하나**(data-shot-input 하나)뿐입니다 — 줄마다 두지 않습니다 (운영자 26-09-07:
 * "사진 올리는 곳이 너무 많다"). 상품 화면 캡처는 비어 있는 첫 줄을, 주문완료 캡처는 줄 전체를 새로 채웁니다.
 * 설명 글은 최소로 — 버튼 이름이 곧 설명입니다 (운영자 26-09-07: "필요없는 말이 너무 많다").
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
  /** 줄별 「링크 미리 읽기」 상태 — { i: 'loading' | 'ok' | 'resolved' | 'fail' } */
  const [peek, setPeek] = useState({})
  /** 줄별 「캡처 읽기」 상태 — { i: 'loading' | 'ok' | 'fail' | 'off' } */
  const [ocr, setOcr] = useState({})
  /** 결제 완료 화면 캡처에서 읽은 쇼핑몰 주문 — { orderNo, itemCount, warehouse, moreItems } */
  const [shopOrder, setShopOrder] = useState(null)

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
    // 캡처 공유(안드로이드: 캡처 → 공유 → 베트남 직구) — 서비스 워커가 kb-share 에 넣어 둔 이미지를 읽습니다
    if (q.shot === '1' && typeof caches !== 'undefined') {
      ;(async () => {
        try {
          const cache = await caches.open('kb-share')
          const res = await cache.match('/kb-share/shot')
          if (!res) return
          const blob = await res.blob()
          await cache.delete('/kb-share/shot')
          if (q.track !== 'forwarding' && q.track !== 'agent') setTrack('forwarding')
          ocrFill(0, blob)
        } catch { /* 보관함이 없으면 그냥 빈 화면 */ }
      })()
      router.replace('/send', undefined, { shallow: true })
      return
    }
    // 결제 완료 알림 문자(알림톡·SMS)를 공유하면 — 캡처 없이 글자만으로 주문번호·상품을 읽습니다
    const sharedText = [q.title, q.text].filter(Boolean).join('\n')
    if (/주문\s*번호\s*[:：]?\s*\d/.test(sharedText)) {
      applyInterpretation({ ok: true, kind: 'text' }, sharedText)
      router.replace('/send', undefined, { shallow: true })
      return
    }
    const { link, productName } = fromShare({ title: q.title, text: q.text, url: q.url })
    if (link) {
      setRows([{ ...emptyRow(), productUrl: link.url, productName }])
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
      let d = await res.json()
      // 읽기 기기(사장님 PC·폰)가 대신 여는 중 — 최대 30초 동안 2초마다 물어봅니다 (운영자 아이디어 26-09-07)
      if (!d.ok && d.reason === 'pending' && d.jobId) {
        const until = Date.now() + 30000
        while (Date.now() < until) {
          await new Promise((r) => setTimeout(r, 2000))
          const jr = await fetch(`/api/product-peek?job=${encodeURIComponent(d.jobId)}`)
          const jd = await jr.json()
          if (jd.ok || jd.reason !== 'pending') { d = jd; break }
        }
        if (!d.ok && d.reason === 'pending') d = { ok: false, reason: 'worker-timeout', productId: d.productId, url: d.url }
      }
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

  /**
   * 캡처(이미지) → 서버가 글자를 읽어(OCR) 상품명·가격을 채웁니다 (운영자 26-09-07).
   * 이미지는 읽는 동안만 서버에 있고 저장되지 않습니다. 읽은 값은 고객이 확인·수정합니다.
   */
  /**
   * 결제 완료 화면(주문)을 읽었으면 — 배송만으로 놓고, 상품들을 줄로 펼치고, 쇼핑몰 주문번호를 붙입니다.
   * 이것이 「앱에서 사고 → 캡처 → 배송비 결제」의 핵심 (운영자 26-09-07).
   */
  const applyOrder = (d) => {
    const items = (d.items ?? []).filter((it) => it.productName || it.productPrice)
    setTrack('forwarding')
    setShopOrder({ orderNo: d.orderNo ?? null, itemCount: items.length, warehouse: d.warehouse ?? null, moreItems: d.moreItems ?? 0 })
    if (items.length) {
      setRows(items.map((it) => ({
        ...emptyRow(),
        productName: it.productName ?? '',
        productPrice: it.productPrice ?? '',
        quantity: it.quantity ?? 1,
        shotOption: it.option ?? '',
      })))
    }
    // 「읽는 중」 표시는 여기서 반드시 끝냅니다 — 상품이 안 읽힌 주문(번호만)도 📷 버튼이 멈추지 않게
    setOcr((p) => (items.length
      ? Object.fromEntries(items.map((_, k) => [k, 'ok']))
      : Object.fromEntries(Object.entries(p).filter(([, v]) => v === 'ok'))))
    if (d.warehouse?.name && !name.trim()) setName(d.warehouse.name)
  }

  const applyInterpretation = async (d, textForOrder) => {
    if (d.kind === 'text') {
      // 문자만으로 — 서버의 해석기를 그대로 씁니다 (같은 규칙)
      const res = await fetch('/api/ocr/text', { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: textForOrder })
      const parsed = await res.json()
      if (parsed.ok && parsed.kind === 'order') applyOrder(parsed)
      return
    }
  }

  const ocrFill = async (i, blob) => {
    if (!blob) return
    // 지난 실패·꺼짐 표시는 지우고(버튼 아래 안내가 하나만 보이게) 읽은 줄의 ok 표시는 둡니다
    setOcr((p) => ({ ...Object.fromEntries(Object.entries(p).filter(([, v]) => v === 'ok')), [i]: 'loading' }))
    setQuote(null)
    try {
      const res = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': blob.type || 'image/png' }, body: blob })
      const d = await res.json()
      if (!d.ok) { setOcr((p) => ({ ...p, [i]: d.reason === 'ocr-not-installed' ? 'off' : 'fail' })); return }
      if (d.kind === 'order') { applyOrder(d); return }
      setRows((prev) => prev.map((r, k) => (k !== i ? r : {
        ...r,
        productName: d.productName || r.productName,
        productPrice: d.productPrice ?? r.productPrice,
        shotOption: d.option ?? '',
        edit: false,
      })))
      setOcr((p) => ({ ...p, [i]: 'ok' }))
    } catch {
      setOcr((p) => ({ ...p, [i]: 'fail' }))
    }
  }

  /** 📷 버튼은 하나 — 상품 캡처는 비어 있는 첫 줄에, 없으면 새 줄에. (주문완료 캡처면 applyOrder 가 줄 전체를 바꿉니다) */
  const ocrShot = (blob) => {
    // 이름·가격이 아직 없는 첫 줄 — 링크만 붙여넣은 줄(가격 없음)도 여기 해당해, 링크는 두고 이름·가격만 채웁니다
    const target = rows.findIndex((r) => !(String(r.productName ?? '').trim() && Number(r.productPrice) > 0))
    if (target >= 0) { ocrFill(target, blob); return }
    setRows((prev) => [...prev, emptyRow()])
    ocrFill(rows.length, blob)
  }

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
    const no = shopOrder?.orderNo && track === 'forwarding' ? `&coupang=${encodeURIComponent(shopOrder.orderNo)}` : ''
    router.push(`/checkout?cart=${cart}${no}`)
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

  const orderCard = shopOrder && (
    <div data-shop-order="1" style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 12, border: '2px solid #17916b', background: '#f2fbf7' }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: '#0f6e4f' }}>✓ 결제 완료 화면에서 읽었습니다</div>
      <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.6 }}>
        쇼핑몰 주문번호 <b>{shopOrder.orderNo ?? '(못 읽음 — 아래에 적어 주세요)'}</b> · 상품 <b>{shopOrder.itemCount}</b>개
        {shopOrder.moreItems ? <> · 외 {shopOrder.moreItems}건은 아래에 더해 주세요</> : null}
      </div>
      {shopOrder.warehouse && !shopOrder.warehouse.found && (
        <p className="note" style={{ marginTop: 8, fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>
          ⚠ 배송지에 창고 코드({WAREHOUSE.code})가 보이지 않습니다. 배송지가 창고 주소인지 확인해 주세요.
        </p>
      )}
      {!shopOrder.orderNo && (
        <input className="input" inputMode="numeric" placeholder="쇼핑몰 주문번호 (숫자만)" style={{ marginTop: 8, minHeight: 46 }}
          onChange={(e) => setShopOrder((o) => ({ ...o, orderNo: e.target.value.replace(/\D/g, '').slice(0, 20) || null }))} />
      )}
    </div>
  )

  /** 📷 사진 넣는 곳 — 화면에 하나뿐. 읽는 중·실패 안내도 여기 한 곳에만 */
  const shotState = Object.values(ocr).find((v) => v !== 'ok') ?? null
  const shotButton = (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54,
        borderRadius: 12, border: '2px dashed #3182f6', background: '#f5f8ff', color: '#0a2e9c', fontSize: 16, fontWeight: 900, cursor: 'pointer',
      }}>
        {shotState === 'loading' ? '⏳ 읽는 중…' : isAgent ? '📷 상품 화면 캡처 넣기' : '📷 주문완료 화면 캡처 넣기'}
        <input type="file" accept="image/*" hidden data-shot-input="0"
          onChange={(e) => { const f = e.target.files?.[0]; if (f && shotState !== 'loading') ocrShot(f); e.target.value = '' }} />
      </label>
      {shotState === 'fail' && (
        <p className="note" style={{ margin: '8px 0 0', fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>못 읽었습니다. 아래에 직접 적어 주세요.</p>
      )}
      {shotState === 'off' && (
        <p className="note" style={{ margin: '8px 0 0', fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>지금은 캡처 읽기를 쓸 수 없습니다. 아래에 직접 적어 주세요.</p>
      )}
    </div>
  )

  const productRows = (
    <>
      {shotButton}
      {orderCard}
      {rows.map((r, i) => {
        const link = parseProductUrl(r.productUrl)
        const auto = (peek[i] === 'ok' || (ocr[i] === 'ok' && r.productName && r.productPrice)) && !r.edit
        const qty = Math.max(1, Math.min(Number(r.quantity) || 1, 99))
        // 배송만에서 캡처로 읽힌 줄은 링크 칸을 접습니다 — 이미 산 물건이라 링크는 필요 없습니다 (구매하고 배송까지는 링크가 필수)
        const showLink = isAgent || !auto || Boolean(r.productUrl)
        return (
          <div key={i} style={{
            border: '1px solid #e5e8eb', borderRadius: 12, padding: 12, marginBottom: 10, background: '#fbfcfd',
          }}>
            {/* 1) 링크 — 고객은 이것만 붙여넣습니다 (운영자 26-09-06: "고객이 링크만 붙여넣게 합시다") */}
            {showLink && (
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
            )}
            {r.productUrl && !link && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>
                상품 링크가 아닌 것 같습니다 (앱에서 공유 → 링크 복사).
              </p>
            )}
            {peek[i] === 'loading' && <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5 }}>⏳ 상품 정보를 읽는 중…</p>}
            {peek[i] === 'resolved' && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: '#e6f6f0', color: '#0f6e4f' }}>
                ✓ 링크 확인됨 (상품 번호 {link?.productId}). <b>가격</b>을 적어 주세요.
              </p>
            )}
            {peek[i] === 'fail' && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: '#fff4e5', color: '#9a5b00' }}>
                쇼핑몰 상품 링크로 확인되지 않았습니다. 이름·가격을 적어 주세요.
              </p>
            )}

            {auto ? (
              /* 2) 읽어온 상품 — 고객이 고른 옵션 그대로. 개수만 정합니다 */
              <div data-auto-item="1" style={{ border: '1px solid #b7e4d2', background: '#f2fbf7', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#17916b', fontWeight: 800 }}>
                  {ocr[i] === 'ok' ? `✓ 캡처에서 읽은 상품${r.shotOption ? ` · 옵션 ${r.shotOption}` : ''}` : '✓ 읽어온 상품 (고른 옵션 그대로)'}
                </div>
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
                    고치기
                  </button>
                </div>
              </div>
            ) : (
              /* 3) 직접 적기 — 링크를 못 읽었거나 링크가 없을 때 */
              <>
                <input className="input" value={r.productName} placeholder="상품 이름"
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
        }}>+ 상품 하나 더</button>

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
            청구무게 {quote.shipping?.billableKg}kg · 창고 실측 후 확정
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
                  : isAgent ? '상품 링크를 붙여넣어 주세요' : '캡처를 넣거나 상품을 적어주세요')
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
      </div>

      {/* ── 방식 고르기 — 배송만 / 구매하고 배송까지 ──────────── */}
      <div className="section" style={{ paddingTop: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8 }}>{[toggleBtn('forwarding'), toggleBtn('agent')]}</div>
      </div>

      {!isAgent && (
        <>
          {/* ── 1. 쿠팡에 넣을 주소 ─────────────────────────────── */}
          <section className="panel">
            <div className="panel__head">1. 쇼핑몰 배송지에 이대로 넣어주세요</div>
            <div className="panel__body">
              <div className="field" style={{ marginBottom: 14 }}>
                <label className="field__label" htmlFor="myname">받는 분 성함</label>
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
              </div>

              <CopyRow label="받는 사람" value={WAREHOUSE.code} />
              <CopyRow label="우편번호" value={WAREHOUSE.zip} />
              <CopyRow label="주소" value={fullAddress} />
              <CopyRow label="상세주소 — 이름이 빠지면 소포 주인을 못 찾습니다" value={detail}
                disabled={!detail} danger
                display={detail ? (
                  <>
                    {WAREHOUSE.code} <span style={markStyle}>{name.trim()}</span>
                  </>
                ) : (
                  <>
                    {WAREHOUSE.code} <span style={sampleStyle}>{SAMPLE_NAME}</span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#ff6a00', marginTop: 6 }}>
                      ↑ <span style={sampleStyle}>{SAMPLE_NAME}</span> 자리에 <b>본인 이름</b>을 넣어주세요 (위 칸에 적기)
                    </span>
                  </>
                )} />
              <CopyRow label="전화번호" value={WAREHOUSE.phone} />
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
              <p className="note" style={{ marginTop: 10, fontSize: 13.5 }}>
                배송지를 위 주소로 바꿔 결제한 뒤 돌아오세요.
              </p>
            </div>
          </section>

          {/* ── 3. 상품 담고 신청 — 📷 주문완료 캡처 하나면 상품·개수·가격·주문번호까지 ── */}
          <section className="panel">
            <div className="panel__head">3. 무엇을 사셨나요</div>
            <div className="panel__body">
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
              <p className="note" style={{ marginBottom: 12, fontSize: 13.5 }}>
                상품 링크를 붙여넣고 가격·개수를 확인하세요. 상품값 + 수수료 + 배송비를 신청서에서 한 번에 결제합니다.
              </p>
              {productRows}
            </div>
          </section>
        </>
      )}

    </Layout>
  )
}
