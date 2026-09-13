/**
 * 폰 첫 화면 — 상품 링크 붙여넣기 하나로 시작
 * (운영자 26-09-12: "사진으로 넣기를 빼고, 링크를 넣고, 옵션도 읽어와서 선택하고 금액을 자동으로")
 *
 * 쇼핑몰 앱에서 「공유 → 링크 복사」 한 뒤 「🔗 상품 링크 붙여넣기」를 누르면 클립보드의 링크를 읽어 /send 로 넘어갑니다.
 * 거기서 사장님 기기의 「대신 읽기」가 그 상품 화면을 열어 이름·옵션·가격을 채웁니다 (lib/peek-jobs.js).
 * 클립보드를 못 읽는 브라우저는 아래 칸에 길게 눌러 붙여넣습니다 — 링크가 들어오는 순간 넘어갑니다.
 * PC 화면은 그대로 두고, 이 블록은 폰 너비에서만 보입니다 (.only-mobile).
 * 폰 화면에서는 「쿠팡」을 밝혀 적습니다 (운영자 26-09-12: "핸드폰에서는 쿠팡 전용 표기 가능, 데스크탑 모델은 안 됨") —
 * PC 화면·확장에는 남의 상호를 쓰지 않습니다 (test/pwa.test.js 가 지킵니다).
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { krw } from '../lib/format'
import { parseProductUrl } from '../lib/coupang-url'
import { PARTNERS_NOTICE, SHOP_HOME } from '../config/partners'

export default function LinkStart({ ratePerKgUsd, agencyBaseKrw, shop }) {
  const router = useRouter()
  const [val, setVal] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  /** 쇼핑몰 상품 링크면 신청 화면으로 — 짧은 링크(link.coupang.com/a/…)도 서버가 풀어 줍니다 */
  const tryGo = (text) => {
    const link = parseProductUrl(text)
    if (!link) return false
    setBusy(true)
    router.push(`/send?url=${encodeURIComponent(link.url)}`)
    return true
  }
  const paste = async () => {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // 아이폰 일부·권한 거부 — 칸에 직접 붙여넣게
      setNote('아래 칸을 길게 눌러 「붙여넣기」 해 주세요.')
      document.getElementById('home-link')?.focus()
      return
    }
    if (tryGo(text)) return
    setVal(String(text ?? '').slice(0, 500))
    setNote(String(text ?? '').trim()
      ? '쿠팡 상품 링크가 아닙니다. 쿠팡 앱에서 상품 → 공유 → 링크 복사 뒤 다시 눌러 주세요.'
      : '복사한 링크가 없습니다. 쿠팡 앱에서 상품 → 공유 → 링크 복사 뒤 다시 눌러 주세요.')
  }

  return (
    <div className="only-mobile" data-link-start="1">
      <div className="section" style={{ paddingTop: 0 }}>
        <button type="button" className="btn" onClick={paste} disabled={busy}
          style={{ display: 'block', width: '100%', minHeight: 64, fontSize: 19, fontWeight: 900 }}>
          {busy ? '여는 중…' : '🔗 쿠팡 상품 링크 붙여넣기'}
        </button>
        <input id="home-link" className="input" type="url" inputMode="url" value={val} data-home-link="1"
          placeholder="또는 여기에 링크를 직접 붙여넣기"
          onChange={(e) => { const v = e.target.value; setVal(v); setNote(''); tryGo(v) }}
          style={{ marginTop: 8, minHeight: 48 }} />
        {note
          ? <p className="note" style={{ marginTop: 8, fontSize: 13, background: 'var(--warn-soft)', color: 'var(--warn)' }}>{note}</p>
          : <p className="note" style={{ marginTop: 8, textAlign: 'center' }}>쿠팡 앱 → 공유 → 링크 복사 → 붙여넣기. 이름·옵션·가격이 채워집니다 (<b>지금은 쿠팡 전용</b>).</p>}
        {/* 쿠팡으로 가기 — 아직 고르지 않은 분. 파트너스 링크가 설정돼 있으면 그 링크 + 고지 (config/partners.js) */}
        <a className="btn btn--ghost" href={shop?.href ?? SHOP_HOME} target="_blank" rel="noreferrer" data-shop-link={shop?.isPartner ? 'partner' : 'plain'}
          style={{ display: 'block', textAlign: 'center', marginTop: 8, minHeight: 48, fontSize: 15, fontWeight: 800, lineHeight: '26px' }}>
          🛍 쿠팡으로 가기 →
        </a>
        {shop?.isPartner ? <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 11.5, color: 'var(--ink-500)' }}>{PARTNERS_NOTICE}</p> : null}
      </div>

      <section className="panel">
        <div className="panel__head">두 가지 방법</div>
        <div className="panel__body">
          {/* 요금은 이름 옆에 — 오른쪽 칸에 두면 좁은 폰에서 설명 줄이 세 줄로 갈라집니다 */}
          <div className="row">
            <span className="row__label">
              <strong>📦 배송만</strong> <span style={{ color: 'var(--ink-500)', fontWeight: 700 }}>· ${ratePerKgUsd}/kg</span>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>
                <Link href="/send?track=forwarding"><b>창고 주소</b></Link>로 결제한 뒤 상품 링크
              </small>
            </span>
          </div>
          <div className="row">
            <span className="row__label">
              <strong>🛒 구매하고 배송까지</strong> <span style={{ color: 'var(--ink-500)', fontWeight: 700 }}>· ${ratePerKgUsd}/kg + 수수료 {krw(agencyBaseKrw)}~</span>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>링크만 · 옵션·개수 고르면 금액 계산</small>
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
