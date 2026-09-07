/**
 * 폰 첫 화면 — 「캡처한 사진 넣기」 버튼 + 어디를 캡처하는지 (📦 배송만 · 🛒 구매하고 배송까지)
 *
 * 폰 고객은 쇼핑몰 앱을 쓰므로 공유로는 링크만 옵니다. 앱 화면을 **캡처**해 넣으면 서버가 글자를 읽어
 * 상품·개수·가격(주문완료 화면이면 주문번호까지)을 채웁니다 (운영자 26-09-07: "첫 페이지에 캡처 버튼, 방법을 밑에").
 * PC 화면은 그대로 두고, 이 블록은 폰 너비에서만 보입니다 (.only-mobile).
 */
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

/** 캡처 파일을 신청 화면으로 넘깁니다 — 공유로 받을 때와 같은 임시 보관함(kb-share) */
async function handToSend(router, file, track) {
  try {
    const cache = await caches.open('kb-share')
    await cache.put('/kb-share/shot', new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }))
    router.push(`/send?shot=1${track ? `&track=${track}` : ''}`)
  } catch {
    router.push(`/send${track ? `?track=${track}` : ''}`)
  }
}

function ShotButton({ track, children, big = false, testId }) {
  const router = useRouter()
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button type="button" className={big ? 'btn' : 'btn btn--ghost'} disabled={busy}
        onClick={() => ref.current?.click()}
        style={big
          ? { display: 'block', width: '100%', minHeight: 64, fontSize: 19, fontWeight: 900 }
          : { display: 'block', width: '100%', minHeight: 48, fontSize: 15, fontWeight: 800 }}>
        {busy ? '사진을 넘기는 중…' : children}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden data-home-shot={testId ?? track ?? 'any'}
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); await handToSend(router, f, track) }} />
    </>
  )
}

/** 폰 화면 그림 — 어디가 읽히는지 노랗게 */
const Phone = ({ title, children }) => (
  <svg viewBox="0 0 220 300" width="100%" style={{ maxWidth: 220, display: 'block', margin: '0 auto' }} role="img" aria-label={title}>
    <rect x="6" y="6" width="208" height="288" rx="18" fill="#fff" stroke="#c9d3e6" strokeWidth="2" />
    <rect x="6" y="6" width="208" height="34" rx="18" fill="#1b4fd8" />
    <rect x="6" y="24" width="208" height="16" fill="#1b4fd8" />
    <text x="110" y="28" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">{title}</text>
    {children}
  </svg>
)
const Hi = ({ x, y, w, h, label }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="5" fill="#ffe98a" stroke="#f0b429" strokeWidth="1.5" />
    <text x={x + 6} y={y + h / 2 + 4} fontSize="10.5" fontWeight="800" fill="#5a3d00">{label}</text>
  </g>
)
const Line = ({ x, y, w, label = '', c = '#4e5968' }) => (
  <g><rect x={x} y={y} width={w} height="9" rx="3" fill="#eef1f5" />{label && <text x={x + 4} y={y + 8} fontSize="9" fill={c}>{label}</text>}</g>
)

export function OrderShotFigure() {
  return (
    <Phone title="주문완료">
      <text x="110" y="62" textAnchor="middle" fontSize="11" fontWeight="800" fill="#191f28">주문이 완료되었습니다</text>
      <Hi x={30} y={72} w={160} h={18} label="주문번호 3102787036952" />
      <Line x={20} y={100} w={60} label="배송지" />
      <Line x={20} y={113} w={180} label="YS-ECOM 홍길동 (창고 주소)" />
      <rect x="20" y="132" width="180" height="1" fill="#e5e8eb" />
      <rect x="20" y="140" width="34" height="34" rx="4" fill="#dbe6ff" />
      <Hi x={60} y={140} w={140} h={16} label="분유 360g, 2개 (상품·옵션)" />
      <Hi x={60} y={160} w={100} h={14} label="31,800원 · 1개" />
      <rect x="20" y="182" width="34" height="34" rx="4" fill="#dbe6ff" />
      <Hi x={60} y={182} w={140} h={16} label="세럼 50ml (상품 2)" />
      <Hi x={60} y={202} w={100} h={14} label="39,800원 · 2개" />
      <rect x="20" y="226" width="180" height="1" fill="#e5e8eb" />
      <Hi x={20} y={236} w={180} h={16} label="총 결제금액 71,600원" />
      <text x="110" y="278" textAnchor="middle" fontSize="10" fill="#4e5968">↑ 이 화면 전체를 캡처</text>
    </Phone>
  )
}

export function ProductShotFigure() {
  return (
    <Phone title="상품 화면">
      <rect x="20" y="50" width="180" height="70" rx="6" fill="#dbe6ff" />
      <text x="110" y="90" textAnchor="middle" fontSize="10" fill="#4e5968">상품 사진</text>
      <Hi x={20} y={128} w={180} h={16} label="OSA 저자극 샴푸 410ml, 6개 (상품명)" />
      <Line x={20} y={150} w={110} label="★★★★★ 12,345개 상품평" />
      <Hi x={20} y={166} w={90} h={18} label="88,560원 (가격)" />
      <Hi x={20} y={192} w={150} h={16} label="옵션: 410ml, 6개 (고른 옵션)" />
      <Hi x={20} y={214} w={80} h={16} label="개수 2" />
      <rect x="20" y="256" width="86" height="22" rx="6" fill="#eef1f5" />
      <text x="63" y="271" textAnchor="middle" fontSize="9.5" fill="#4e5968">장바구니</text>
      <rect x="114" y="256" width="86" height="22" rx="6" fill="#1b4fd8" />
      <text x="157" y="271" textAnchor="middle" fontSize="9.5" fill="#fff">바로구매</text>
      <text x="110" y="292" textAnchor="middle" fontSize="10" fill="#4e5968">↑ 옵션·개수 고른 뒤 캡처</text>
    </Phone>
  )
}

export default function CaptureGuide() {
  return (
    <div className="only-mobile" data-capture-guide="1">
      <div className="section" style={{ paddingTop: 0 }}>
        <ShotButton big testId="any">📷 캡처한 사진 넣기</ShotButton>
        <p className="note" style={{ marginTop: 8, textAlign: 'center', fontSize: 13.5, lineHeight: 1.6 }}>
          쇼핑몰 앱 화면을 <b>캡처</b>해서 넣으면 상품·개수·가격을 읽어 신청서를 채워 드립니다.
          안드로이드는 캡처 직후 <b>공유 → 「베트남 직구」</b>로 보내도 됩니다.
        </p>
      </div>

      <section className="panel">
        <div className="panel__head">📦 배송만 — 쇼핑몰에서 직접 사신 분</div>
        <div className="panel__body">
          <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            <li>쇼핑몰 앱에서 배송지를 <b>저희 창고 주소</b>로 하고 결제합니다. <Link href="/send?track=forwarding"><b>창고 주소 보기</b></Link></li>
            <li>결제 직후 뜨는 <b>「주문완료」 화면</b>을 캡처합니다. 주문번호·상품·총 결제금액이 한 화면에 보이게. (나중에는 마이페이지 → 주문 상세 화면도 됩니다)</li>
            <li>아래 버튼으로 그 캡처를 넣습니다. 상품·개수·가격·<b>주문번호</b>까지 채워진 신청서가 열리면 받으실 분만 확인하고 배송비를 결제합니다.</li>
          </ol>
          <OrderShotFigure />
          <div style={{ marginTop: 12 }}><ShotButton track="forwarding">📷 주문완료 화면 캡처 넣기</ShotButton></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">🛒 구매하고 배송까지 — 저희가 대신 사드리는 분</div>
        <div className="panel__body">
          <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            <li>쇼핑몰 앱의 <b>상품 화면</b>에서 옵션과 개수를 고른 뒤 캡처합니다. 상품명·옵션·가격이 보이게.</li>
            <li>같은 화면에서 <b>공유 → 링크 복사</b>도 해 둡니다. 정확히 그 상품을 저희가 사야 하니까요.</li>
            <li>아래 버튼으로 캡처를 넣고, 열리는 화면에 링크를 붙여넣습니다. 개수를 확인하면 상품값+수수료+배송비가 바로 계산됩니다.</li>
          </ol>
          <ProductShotFigure />
          <div style={{ marginTop: 12 }}><ShotButton track="agent">📷 상품 화면 캡처 넣기</ShotButton></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">잘 읽히는 캡처</div>
        <div className="panel__body">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8, color: '#4e5968' }}>
            <li>글자가 잘리지 않게, 확대하지 말고 <b>기본 크기</b>로.</li>
            <li>어두운 화면 모드보다 <b>밝은 모드</b>가 잘 읽힙니다.</li>
            <li>상품이 많아 한 화면에 안 들어가면 <b>스크롤 캡처</b>(긴 캡처)나 두 장으로.</li>
            <li>읽힌 값이 틀리면 화면에서 바로 고칠 수 있습니다. 못 읽으면 직접 적는 칸이 열립니다.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
