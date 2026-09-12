/**
 * 폰에서 하는 길 — 확장 없이 혼자 끝내는 화면 (📦 배송만 · 🛒 구매하고 배송까지)
 *
 * 폰 고객은 **상품 링크 하나**로 시작합니다 (운영자 26-09-12: "사진으로 넣기를 빼고, 링크를 넣고, 옵션도 읽어와서
 * 선택하고 금액을 자동으로"). 쇼핑몰 앱의 「공유 → 링크 복사」 → 이 화면의 「붙여넣기」 → 서버가 링크를 풀고,
 * 사장님 기기의 「대신 읽기」(lib/peek-jobs.js)가 그 상품 화면을 열어 이름·가격·용량·**옵션 목록**을 돌려줍니다.
 * 고객이 옵션을 바꾸면 그 옵션의 화면을 한 번 더 읽어 가격을 맞춥니다. 읽기 기기가 없으면 가격만 직접 적습니다.
 *
 * 구매하고 배송까지(구매대행)는 창고 주소가 필요 없습니다 — 링크·개수만으로 신청서에서 상품값+수수료+배송비를
 * 한 번에 결제합니다. 폰 웹앱(홈 화면에 추가)의 「공유」는 ?url=·?text=·?title= 로 들어와 첫 줄에 채워집니다.
 *
 * 배송만은 이 화면이 하는 일이 셋입니다.
 *   ① 쿠팡에 넣을 주소를 **한 항목씩 눌러 복사**하게 (외워 옮겨적지 않게)
 *   ② 쿠팡 앱으로 보내드리고
 *   ③ 돌아오시면 상품 링크를 넣어 신청서로 잇습니다
 * 가장 자주 깨지는 곳은 **상세주소**입니다. "YS-ECOM 이름"이 빠지면 창고에서 소포 주인을 못 찾습니다.
 * 그래서 이름을 먼저 받아 상세주소를 만들어 드리고, 이름이 없으면 그 칸은 복사조차 되지 않게 막아 둡니다.
 *
 * 설명 글은 최소로 — 버튼 이름이 곧 설명입니다 (운영자 26-09-07: "필요없는 말이 너무 많다").
 * 상호: 폰 너비에서만 「쿠팡」을 밝혀 적고(운영자 26-09-12), PC 너비와 서버 렌더는 「쇼핑몰」 — 데스크탑 쪽에는 남의 상호를 쓰지 않습니다.
 * 캡처(사진) 길은 운영자 지시(26-09-12)로 뺐습니다. 결제 완료 알림 문자를 공유하는 길(글자만)은 남아 있습니다.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Steps from '../components/Steps'
import WarehouseAddress from '../components/WarehouseAddress'
import { TRACKS } from '../config/tracks'
import { krw, vnd } from '../lib/format'
import { fromShare, parseProductUrl } from '../lib/coupang-url'
import { PARTNERS_NOTICE, SHOP_HOME, shopLink } from '../config/partners'

const RECIPIENT_KEY = 'kbeauty-hanoi:recipient'

/** 클립보드의 상품 링크 — 못 읽으면 null (권한 거부·미지원 브라우저) */
async function readClipboardLink() {
  try {
    const text = await navigator.clipboard.readText()
    return { text, link: parseProductUrl(text) }
  } catch {
    return null
  }
}

export default function SendPage({ shop }) {
  const router = useRouter()
  const [track, setTrack] = useState('forwarding')
  const [name, setName] = useState('')
  const emptyRow = () => ({ productName: '', productPrice: '', quantity: 1, productUrl: '', spec: '', edit: false, options: [], optionLabel: '' })
  const [rows, setRows] = useState([emptyRow()])
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState(null)
  /** 줄별 「링크 읽기」 상태 — { i: 'loading' | 'ok' | 'option' | 'resolved' | 'fail' } ('option' = 옵션 가격을 읽는 중, 카드는 그대로) */
  const [peek, setPeek] = useState({})
  /** 줄별 붙여넣기 안내 — { i: '…' } */
  const [pasteNote, setPasteNote] = useState({})
  /** 결제 완료 알림 문자(공유)에서 읽은 쇼핑몰 주문 — { orderNo, itemCount, warehouse, moreItems } */
  const [shopOrder, setShopOrder] = useState(null)
  /** 폰 너비인가 — 폰에서만 「쿠팡」을 밝혀 적습니다 (마운트 뒤에 정하므로 서버 렌더와 어긋나지 않습니다) */
  const [isPhone, setIsPhone] = useState(false)
  useEffect(() => {
    try {
      const mq = window.matchMedia('(max-width: 819px)')
      const apply = () => setIsPhone(mq.matches)
      apply(); mq.addEventListener?.('change', apply)
      return () => mq.removeEventListener?.('change', apply)
    } catch { /* 지원하지 않으면 「쇼핑몰」 */ }
  }, [])
  const shopWord = isPhone ? '쿠팡' : '쇼핑몰'
  // 「열기」 버튼 — 폰 너비에서 파트너스 링크가 있으면 그 링크(고지와 함께), 아니면 보통 주소
  const shopHref = isPhone && shop?.isPartner ? shop.href : SHOP_HOME

  // 신청서에서 쓰던 이름이 있으면 그대로 씁니다 — 두 번 적지 않게.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECIPIENT_KEY) ?? 'null')
      if (saved?.name) setName(saved.name)
    } catch { /* 없으면 빈 칸으로 */ }
  }, [])

  /**
   * 주소창으로 들어온 것 — ?track=agent (홈·바로가기), 첫 화면 「붙여넣기」(?url=) 와
   * 쿠팡 앱 「공유」(share_target: ?url= ?text= ?title=) 는 첫 줄에 링크·이름을 채웁니다.
   */
  useEffect(() => {
    if (!router.isReady) return
    const q = router.query
    if (q.track === 'agent') setTrack('agent')
    // 결제 완료 알림 문자(알림톡·SMS)를 공유하면 — 글자만으로 주문번호·상품을 읽습니다
    const sharedText = [q.title, q.text].filter(Boolean).join('\n')
    if (/주문\s*번호\s*[:：]?\s*\d/.test(sharedText)) {
      applyInterpretation(sharedText)
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
  /** 신청서로 넘길 수 있는 줄만 (이름과 가격이 있는 것 — 구매하고 배송까지는 링크도) */
  const items = useMemo(() => rows
    .map((r, i) => {
      const link = parseProductUrl(r.productUrl)
      // 쇼핑몰 앱의 공유는 링크만 넘겨줍니다 — 이름을 안 적어도 상품 번호로 신청은 되게 하고,
      // 이름을 적으면 무게(배송비)가 더 정확해집니다 (운영자 26-09-06: "링크만 가지고 오네").
      const typedName = String(r.productName ?? '').trim()
      const baseName = typedName || (link?.productId ? `상품 ${link.productId}` : '')
      // 고른 옵션 이름은 상품명에 붙여 둡니다 — 사장님이 발주할 때 어떤 옵션인지 바로 보이게 (이미 들어 있으면 그대로)
      const opt = String(r.optionLabel ?? '').trim()
      const productName = baseName && opt && !baseName.includes(opt) ? `${baseName} · 옵션 ${opt}` : baseName
      return {
        productId: link?.productId ?? `m-${i}`,
        productName,
        productPrice: Math.max(0, Math.round(Number(r.productPrice) || 0)),
        quantity: Math.max(1, Math.min(Number(r.quantity) || 1, 99)),
        productUrl: link?.url ?? String(r.productUrl ?? '').trim().slice(0, 500),
        specOverride: r.spec || null,
        track,
      }
    })
    .filter((r) => r.productName && r.productPrice > 0 && (!isAgent || r.productUrl)), [rows, track, isAgent])

  const setRow = (i, patch) => { setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r))); setQuote(null) }

  /**
   * 링크를 넣으면 서버가 링크를 풀고, 읽기 기기가 그 상품 화면을 열어 이름·가격·용량·옵션을 채웁니다.
   * 읽기 기기가 없으면 「링크 확인됨 · 가격만」 — 흐름은 끊기지 않습니다. 이미 적힌 칸은 덮어쓰지 않습니다.
   * force 는 옵션을 바꿔 그 옵션의 화면을 읽을 때 — 이름·가격을 그 옵션 값으로 바꿉니다.
   */
  const peekRow = async (i, url, { force = false, hop = 0 } = {}) => {
    if (!parseProductUrl(url)) return
    setPeek((p) => ({ ...p, [i]: force ? 'option' : 'loading' }))
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
      if (!d.ok && d.reason === 'redirect' && d.redirect && hop < 2 && parseProductUrl(d.redirect)?.productId) {
        // 브랜드관·기획전 링크 — 읽기 기기가 찾아온 진짜 상품 주소로 한 번 더 읽습니다
        setRows((prev) => prev.map((r, k) => (k !== i ? r : { ...r, productUrl: d.redirect })))
        return peekRow(i, d.redirect, { force, hop: hop + 1 })
      }
      if (!d.ok) {
        // 번호·정식 주소만 확인된 경우(읽기 기기 없음) — 주소는 정식으로 바꿔 두고 가격만 받습니다
        if (d.productId && d.url) setRows((prev) => prev.map((r, k) => (k !== i ? r : { ...r, productUrl: d.url })))
        // 옵션 화면을 못 읽었으면 카드는 그대로 두고(값은 이전 옵션의 것) 가격만 다시 적게 합니다
        setPeek((p) => ({ ...p, [i]: d.productId ? 'resolved' : 'fail' }))
        return
      }
      setRows((prev) => prev.map((r, k) => (k !== i ? r : {
        ...r,
        productUrl: d.url ?? r.productUrl,
        productName: force || !r.productName?.trim() ? (d.productName || r.productName) : r.productName,
        productPrice: force || !r.productPrice ? (d.productPrice ?? r.productPrice) : r.productPrice,
        spec: d.spec ?? r.spec ?? '',
        // 옵션 목록은 새로 읽힌 것이 있으면 그것으로, 없으면 지난 목록 유지 (선택 표시는 이 줄의 주소 기준)
        options: markSelected(d.options?.length ? d.options : r.options, d.url ?? r.productUrl),
        edit: false,
      })))
      setPeek((p) => ({ ...p, [i]: 'ok' }))
    } catch {
      setPeek((p) => ({ ...p, [i]: 'fail' }))
    }
  }

  /** 옵션 목록에서 이 줄의 주소(옵션 번호)와 같은 것에 선택 표시 */
  const markSelected = (options, url) => {
    const link = parseProductUrl(url)
    const list = Array.isArray(options) ? options : []
    if (!link) return list
    const byUrl = list.some((o) => (o.vendorItemId && o.vendorItemId === link.vendorItemId) || (o.itemId && !o.vendorItemId && o.itemId === link.itemId))
    return list.map((o) => ({
      ...o,
      selected: byUrl
        ? (o.vendorItemId && o.vendorItemId === link.vendorItemId) || (o.itemId && !o.vendorItemId && o.itemId === link.itemId)
        : Boolean(o.selected),
    }))
  }

  /** 옵션 칩을 누르면 — 링크가 있는 옵션은 그 화면을 읽어 가격을 맞추고, 없는 옵션은 이름표만 붙입니다 */
  const pickOption = (i, opt) => {
    const row = rows[i]
    if (!row) return
    const options = row.options.map((o) => ({ ...o, selected: o === opt }))
    if (opt.url) {
      setRow(i, { options, optionLabel: opt.label, productUrl: opt.url, productPrice: opt.price ?? row.productPrice })
      peekRow(i, opt.url, { force: true })
    } else {
      setRow(i, { options, optionLabel: opt.label, productPrice: opt.price ?? row.productPrice })
    }
  }

  /** 줄의 「붙여넣기」 — 클립보드의 링크를 넣고 바로 읽습니다 */
  const pasteInto = async (i) => {
    const got = await readClipboardLink()
    if (!got) {
      setPasteNote((p) => ({ ...p, [i]: '칸을 길게 눌러 「붙여넣기」 해 주세요.' }))
      document.getElementById(`link-${i}`)?.focus()
      return
    }
    if (!got.link) {
      setPasteNote((p) => ({ ...p, [i]: String(got.text ?? '').trim() ? `${shopWord} 상품 링크가 아닙니다 (${shopWord} 앱에서 공유 → 링크 복사).` : `복사한 링크가 없습니다 (${shopWord} 앱에서 공유 → 링크 복사).` }))
      return
    }
    setPasteNote((p) => ({ ...p, [i]: '' }))
    setRow(i, { productUrl: got.link.url, edit: false })
    peekRow(i, got.link.url)
  }
  const switchTrack = (next) => { setTrack(next); setQuote(null); setError(null) }

  /**
   * 결제 완료 알림 문자(공유)를 읽었으면 — 배송만으로 놓고, 상품들을 줄로 펼치고, 쇼핑몰 주문번호를 붙입니다.
   */
  const applyShopOrder = (d) => {
    const list = (d.items ?? []).filter((it) => it.productName || it.productPrice)
    setTrack('forwarding')
    setShopOrder({ orderNo: d.orderNo ?? null, itemCount: list.length, warehouse: d.warehouse ?? null, moreItems: d.moreItems ?? 0 })
    if (list.length) {
      setRows(list.map((it) => ({
        ...emptyRow(),
        productName: it.productName ?? '',
        productPrice: it.productPrice ?? '',
        quantity: it.quantity ?? 1,
        optionLabel: it.option ?? '',
      })))
      setPeek(Object.fromEntries(list.map((_, k) => [k, 'ok'])))
    }
    if (d.warehouse?.name && !name.trim()) setName(d.warehouse.name)
  }

  const applyInterpretation = async (textForOrder) => {
    try {
      // 문자만으로 — 서버의 해석기를 그대로 씁니다 (같은 규칙)
      const res = await fetch('/api/ocr/text', { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: textForOrder })
      const parsed = await res.json()
      if (parsed.ok && parsed.kind === 'order') applyShopOrder(parsed)
    } catch { /* 못 읽으면 빈 화면 — 직접 적습니다 */ }
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
          border: on ? '2px solid var(--accent)' : '1px solid var(--line-2)',
          background: on ? 'var(--accent-soft)' : 'var(--bg-2)', color: on ? 'var(--text)' : 'var(--text-2)',
          boxShadow: on ? '0 0 0 3px var(--accent-soft)' : 'none', font: 'inherit',
        }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 900 }}>{tt.emoji} {tt.name}</span>
        <span style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{tt.line}</span>
      </button>
    )
  }

  /**
   * 결제 완료 알림 문자를 공유해 읽힌 상품·주문번호는 화면에 따로 보이지 않습니다 — 상품 줄로 펼쳐지고, 번호는 신청서에만
   * 조용히 붙습니다 (운영자 26-09-12: "주문번호 … 이런 내용은 빼주세요"). 창고에서는 「YS-ECOM 이름」으로 찾습니다.
   */
  const orderCard = null

  const chipStyle = (on) => ({
    border: on ? '2px solid var(--accent)' : '1.5px solid var(--line-2)', background: on ? 'var(--accent-soft)' : 'var(--bg-2)', color: on ? 'var(--accent)' : 'var(--text-2)',
    borderRadius: 999, padding: '7px 12px', fontSize: 13.5, fontWeight: on ? 900 : 700, cursor: 'pointer', maxWidth: '100%',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  })

  const productRows = (
    <>
      {orderCard}
      {rows.map((r, i) => {
        const link = parseProductUrl(r.productUrl)
        const auto = !r.edit && (peek[i] === 'ok' || peek[i] === 'option') && Boolean(String(r.productName ?? '').trim()) && Number(r.productPrice) > 0
        const qty = Math.max(1, Math.min(Number(r.quantity) || 1, 99))
        // 배송만에서 알림 문자로 읽힌 줄은 링크 칸을 접습니다 — 이미 산 물건이라 링크는 필요 없습니다 (구매하고 배송까지는 링크가 필수)
        const showLink = isAgent || !auto || Boolean(r.productUrl)
        return (
          <div key={i} style={{
            border: '1px solid var(--line-2)', borderRadius: 12, padding: 12, marginBottom: 10, background: 'var(--bg-2)',
          }}>
            {/* 1) 링크 — 고객은 이것만 붙여넣습니다 (운영자 26-09-06: "고객이 링크만 붙여넣게 합시다") */}
            {showLink && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input id={`link-${i}`} className="input" type="url" inputMode="url" value={r.productUrl}
                  placeholder={`${shopWord} 상품 링크`}
                  onChange={(e) => {
                    const v = e.target.value
                    setRow(i, { productUrl: v, edit: false })
                    // 붙여넣기처럼 한 번에 완전한 링크가 들어오면 바로 읽습니다
                    if (parseProductUrl(v)?.productId || /link\.coupang\.com/.test(v)) peekRow(i, v)
                  }}
                  onBlur={(e) => { if (parseProductUrl(e.target.value) && !peek[i]) peekRow(i, e.target.value) }}
                  style={{ flex: 1, minWidth: 0, fontSize: 15, minHeight: 52, borderColor: r.productUrl && !link ? 'var(--danger)' : (auto ? 'var(--ok)' : undefined) }} />
                <button type="button" data-paste-link={i} onClick={() => pasteInto(i)}
                  style={{ flexShrink: 0, minHeight: 52, padding: '0 14px', borderRadius: 10, border: '2px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>
                  붙여넣기
                </button>
              </div>
            )}
            {pasteNote[i] && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: 'var(--warn-soft)', color: 'var(--warn)' }}>{pasteNote[i]}</p>
            )}
            {r.productUrl && !link && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                {shopWord} 상품 링크가 아닌 것 같습니다 ({shopWord} 앱에서 공유 → 링크 복사).
              </p>
            )}
            {peek[i] === 'loading' && <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5 }}>⏳ 상품 정보를 읽는 중… (몇 초)</p>}
            {peek[i] === 'resolved' && !auto && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: 'var(--ok-soft)', color: 'var(--ok)' }}>
                ✓ 링크 확인됨 (상품 번호 {link?.productId}). <b>가격</b>을 적어 주세요.
              </p>
            )}
            {peek[i] === 'fail' && (
              <p className="note" style={{ margin: '0 0 8px', fontSize: 12.5, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                {shopWord} 상품 링크로 확인되지 않았습니다. 이름·가격을 적어 주세요.
              </p>
            )}

            {auto ? (
              /* 2) 읽어온 상품 — 옵션을 고르고 개수만 정합니다 */
              <div data-auto-item="1" style={{ border: '1px solid var(--ok)', background: 'var(--ok-soft)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 800 }}>
                  {peek[i] === 'option' ? '⏳ 옵션 가격 읽는 중…' : '✓ 읽어온 상품'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.4 }}>{r.productName}</div>
                {r.options?.length > 0 && (
                  <div style={{ marginTop: 8 }} data-options="1">
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 700, marginBottom: 4 }}>옵션</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.options.map((o, k) => (
                        <button key={k} type="button" data-option-chip={k} aria-pressed={Boolean(o.selected)} onClick={() => pickOption(i, o)} style={chipStyle(Boolean(o.selected))}>
                          {o.label}{o.price ? ` · ${krw(o.price)}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>{krw(Number(r.productPrice) || 0)}</span>
                  {r.spec ? <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>용량 {r.spec}</span> : null}
                  <span style={{ flex: 1 }} />
                  {/* 개수 − n + 는 한 덩어리로 — 좁은 폰에서 줄이 갈라지지 않게 */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 700 }}>개수</span>
                    <button type="button" aria-label="개수 줄이기" onClick={() => setRow(i, { quantity: Math.max(1, qty - 1) })}
                      style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid var(--line-2)', background: 'var(--bg-2)', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>−</button>
                    <span data-qty="1" style={{ minWidth: 24, textAlign: 'center', fontSize: 18, fontWeight: 900 }}>{qty}</span>
                    <button type="button" aria-label="개수 늘리기" onClick={() => setRow(i, { quantity: Math.min(99, qty + 1) })}
                      style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid var(--line-2)', background: 'var(--bg-2)', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>+</button>
                  </span>
                </div>
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <button type="button" onClick={() => setRow(i, { edit: true })}
                    style={{ border: 0, background: 'transparent', color: 'var(--text-3)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
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
                  style={{ border: '1px solid var(--danger)', borderRadius: 8, background: 'var(--bg-2)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 800, padding: '6px 10px', cursor: 'pointer' }}>
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
          width: '100%', minHeight: 48, borderRadius: 10, border: '2px dashed var(--line-2)',
          background: 'var(--bg-2)', color: 'var(--accent)', fontSize: 15, fontWeight: 800, cursor: 'pointer',
        }}>+ 상품 하나 더</button>

      {error && <p className="note note--danger" style={{ marginTop: 10 }}>{error}</p>}

      {quote && (
        <div style={{
          marginTop: 12, padding: '14px 16px', borderRadius: 12,
          border: '1px solid var(--accent)', background: 'var(--accent-soft)', boxShadow: '0 0 0 3px var(--accent-soft)',
        }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
            {isAgent ? '상품값 + 수수료 + 베트남까지 배송비 (예상)' : '베트남까지 배송비 (예상)'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
            {krw(quote.total)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>≈ {vnd(quote.totalVnd)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6 }}>
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
                  : isAgent ? '상품 링크를 붙여넣어 주세요' : '상품 링크 또는 이름·가격을 넣어주세요')
              : isAgent ? '얼마인지 보기' : '배송비 얼마인지 보기'}
          </button>
        )}
      </div>
    </>
  )

  return (
    <Layout title={t.name}>
      <Steps current={quote ? 1 : 0} />
      <div className="section" style={{ paddingTop: 8, paddingBottom: 6 }}>
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
            <div className="panel__head">1. {shopWord} 배송지에 이대로 넣어주세요</div>
            <div className="panel__body">
              {/* 이름 칸 + 눌러서 복사 다섯 줄 — components/WarehouseAddress.js (이용 안내와 같은 것) */}
              <WarehouseAddress name={name} onName={setName} />
            </div>
          </section>

          {/* ── 2. 쿠팡으로 ─────────────────────────────────────── */}
          <section className="panel">
            <div className="panel__head">2. {shopWord}에서 결제하고 오세요</div>
            <div className="panel__body">
              <a className="btn" href={shopHref} target="_blank" rel="noreferrer" data-shop-link={isPhone && shop?.isPartner ? 'partner' : 'plain'}
                style={{ display: 'block', textAlign: 'center', minHeight: 56, fontSize: 17, lineHeight: '32px' }}>
                {shopWord} 열기 →
              </a>
              <p className="note" style={{ marginTop: 10, fontSize: 13.5 }}>
                배송지를 위 주소로 바꿔 결제한 뒤 돌아오세요.
              </p>
              {isPhone && shop?.isPartner ? <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ink-500)' }}>{PARTNERS_NOTICE}</p> : null}
            </div>
          </section>

          {/* ── 3. 상품 담고 신청 — 상품 링크 ───────────────────── */}
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
          {/* ── 구매하고 배송까지 — 주소 필요 없음, 링크만 ───────────── */}
          <section className="panel">
            <div className="panel__head">1. 무엇을 사드릴까요</div>
            <div className="panel__body">
              <p className="note" style={{ marginBottom: 12 }}>
                링크만 붙여넣으세요 — 이름·옵션·가격이 채워집니다. 결제는 신청서에서 한 번에.
              </p>
              {productRows}
            </div>
          </section>
        </>
      )}

    </Layout>
  )
}

/** 「열기」 버튼 주소 — 서버 환경변수의 파트너스 링크 (config/partners.js). 빌드 때 읽으므로 바꾸면 deploy/update.sh 로 다시 빌드 */
export async function getStaticProps() {
  return { props: { shop: shopLink() } }
}
