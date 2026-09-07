/**
 * 폰 첫 화면 — 「📷 캡처한 사진 넣기」 버튼 하나 + 무엇을 캡처하는지 두 줄 (📦 배송만 · 🛒 구매하고 배송까지)
 *
 * 폰 고객은 쇼핑몰 앱을 쓰므로 공유로는 링크만 옵니다. 앱 화면을 **캡처**해 넣으면 서버가 글자를 읽어
 * 상품·개수·가격(주문완료 화면이면 주문번호까지)을 채웁니다 (운영자 26-09-07: "첫 페이지에 캡처 버튼, 방법을 밑에").
 *
 * 사진 넣는 곳은 이 버튼 **하나**뿐이고 긴 설명·그림은 두지 않습니다 (운영자 26-09-07: "필요없는 말이
 * 너무 많다 — 꼭 필요한 사진만 올리게"). 주문완료 화면인지 상품 화면인지는 서버가 읽어서 가립니다.
 * PC 화면은 그대로 두고, 이 블록은 폰 너비에서만 보입니다 (.only-mobile).
 */
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { krw } from '../lib/format'

/** 캡처 파일을 신청 화면으로 넘깁니다 — 공유로 받을 때와 같은 임시 보관함(kb-share) */
async function handToSend(router, file) {
  try {
    const cache = await caches.open('kb-share')
    await cache.put('/kb-share/shot', new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }))
    router.push('/send?shot=1')
  } catch {
    router.push('/send')
  }
}

export default function CaptureGuide({ ratePerKgUsd, agencyBaseKrw }) {
  const router = useRouter()
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="only-mobile" data-capture-guide="1">
      <div className="section" style={{ paddingTop: 0 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.click()}
          style={{ display: 'block', width: '100%', minHeight: 64, fontSize: 19, fontWeight: 900 }}>
          {busy ? '사진을 넘기는 중…' : '📷 캡처한 사진 넣기'}
        </button>
        <input ref={ref} type="file" accept="image/*" hidden data-home-shot="any"
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); await handToSend(router, f) }} />
        <p className="note" style={{ marginTop: 8, textAlign: 'center', fontSize: 13.5 }}>
          쇼핑몰 앱 화면을 캡처해 넣으면 신청서가 채워집니다.
        </p>
      </div>

      <section className="panel">
        <div className="panel__head">무엇을 캡처하나요</div>
        <div className="panel__body">
          {/* 요금은 이름 옆에 — 오른쪽 칸에 두면 좁은 폰에서 설명 줄이 세 줄로 갈라집니다 */}
          <div className="row">
            <span className="row__label">
              <strong>📦 배송만</strong> <span style={{ color: 'var(--ink-500)', fontWeight: 700 }}>· ${ratePerKgUsd}/kg</span>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>
                <Link href="/send?track=forwarding"><b>창고 주소</b></Link>로 결제한 뒤 <b>「주문완료」 화면</b>
              </small>
            </span>
          </div>
          <div className="row">
            <span className="row__label">
              <strong>🛒 구매하고 배송까지</strong> <span style={{ color: 'var(--ink-500)', fontWeight: 700 }}>· ${ratePerKgUsd}/kg + 수수료 {krw(agencyBaseKrw)}~</span>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>옵션·개수를 고른 <b>상품 화면</b> + 링크 복사</small>
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
