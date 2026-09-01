/**
 * 견적서 인쇄 화면 — 임시(?kind=provisional) / 최종(?kind=final)
 *
 * 물류사 DEBIT NOTE 양식을 참고하되 고객에게 필요 없는 칸(License No, Fax,
 * Notify, Incoterms, Customs No, C/I No 등)은 모두 뺐습니다.
 * 브라우저 인쇄(Ctrl+P)로 그대로 PDF 저장해 고객에게 보냅니다.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const won = (n) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`
const dong = (n) => `₫${Math.round(Number(n) || 0).toLocaleString('ko-KR')}`
const day = (iso) => (iso ? String(iso).slice(0, 10) : '')

export default function QuotePage() {
  const router = useRouter()
  const { id, kind } = router.query
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const url = `/api/orders/${id}/quote-doc${kind ? `?kind=${kind}` : ''}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => (d.ok ? setDoc(d.doc) : setError(d.error ?? '견적서를 불러오지 못했습니다.')))
      .catch(() => setError('서버에 연결할 수 없습니다.'))
  }, [id, kind])

  if (error) return <main style={{ padding: 40, font: '14px sans-serif' }}>{error}</main>
  if (!doc) return <main style={{ padding: 40, font: '14px sans-serif' }}>불러오는 중…</main>

  const isFinal = doc.kind === 'final'
  return (
    <>
      <Head><title>{`${doc.title} ${doc.docNo}`}</title></Head>
      <style jsx global>{`
        body { margin: 0; background: #f2f4f6; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none; margin: 0; width: auto; }
        }
      `}</style>

      <div className="no-print" style={bar}>
        <button onClick={() => window.print()} style={printBtn}>🖨 인쇄 / PDF 저장</button>
        <span style={{ color: '#8b95a1', fontSize: 12 }}>
          {isFinal ? '최종 견적서' : '임시 견적서'} · 주문 {doc.orderNo}
        </span>
      </div>

      <div className="sheet" style={sheet}>
        {/* 머리글 — 발행 주체 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>{doc.issuer.brand}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b3138', marginTop: 3 }}>{doc.issuer.name}</div>
            <div style={{ fontSize: 12, color: '#4e5968', marginTop: 2, maxWidth: 440 }}>{doc.issuer.address}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12.5, color: '#2b3138' }}>
            <div>담당 : {doc.issuer.pic}</div>
            {doc.contact ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: 'flex-end' }}>
                <div>
                  <div>문의 : {doc.contact.label}</div>
                  {doc.contact.kakaoId
                    ? <div style={{ fontWeight: 800, color: '#191f28' }}>ID : {doc.contact.kakaoId}</div>
                    : null}
                  {doc.contact.url
                    ? <a href={doc.contact.url} style={{ color: '#1b64da', fontSize: 11.5 }}>{doc.contact.url}</a>
                    : null}
                </div>
                {/* 인쇄본에서 바로 스캔할 수 있게 — 주소가 없거나 이미지가 없으면 숨깁니다 */}
                {doc.contact.url ? (
                  <img src={doc.contact.qrPath} alt="" width={74} height={74}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                    style={{ border: '1px solid #e5e8eb', borderRadius: 6 }} />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ borderTop: '2px solid #17916b', margin: '10px 0 14px' }} />

        {/* 제목 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>{doc.title}</div>
          <div style={{ fontSize: 12, color: '#4e5968', letterSpacing: 2 }}>{doc.titleEn}</div>
        </div>

        <div style={{ ...row, marginTop: 14, borderTop: '1px solid #d7dbe0', borderBottom: '1px solid #d7dbe0', padding: '8px 0' }}>
          <Field label="견적번호" value={doc.docNo} bold />
          <Field label="발행일" value={day(doc.issuedAt)} />
          <Field label={isFinal ? '주문번호' : '유효기간'} value={isFinal ? doc.orderNo : `${day(doc.validUntil)} 까지`} />
        </div>

        {/* 고객 */}
        <div style={{ ...row, marginTop: 12 }}>
          <Field label="고객" value={doc.customer.name || '-'} bold wide />
          <Field label="연락처" value={doc.customer.phone || '-'} />
        </div>
        <div style={{ marginTop: 4 }}>
          <Field label="구분" value={doc.trackLabel} wide />
        </div>

        {/* 운송 정보 — 최종 견적서만 (물류사 청구서에서 옮긴 사실 정보) */}
        {isFinal && doc.shipment ? (
          <div style={{ ...row, marginTop: 10, background: '#f9fafb', padding: '8px 10px', borderRadius: 8 }}>
            <Field label="운송장 (HAWB)" value={doc.shipment.hawbNo || '-'} />
            <Field label="항공편" value={doc.shipment.flight || '-'} />
            <Field label="출발" value={day(doc.shipment.etd) || '-'} />
            <Field label="도착" value={day(doc.shipment.eta) || '-'} />
          </div>
        ) : null}

        {/* 무게 */}
        <div style={{ ...row, marginTop: 10 }}>
          <Field label="무게 기준" value={doc.weight.basis} />
          {isFinal
            ? <>
                <Field label="접수 시 추정" value={`${doc.weight.estimatedKg}kg`} />
                <Field label="창고 실측" value={`${doc.weight.chargeableKg}kg`} bold />
              </>
            : <>
                <Field label="추정 무게" value={`${doc.weight.chargeableKg}kg`} bold />
                <Field label="정확도" value={doc.weight.confidence ?? '-'} />
              </>}
        </div>

        {/* 내역 */}
        <table style={table}>
          <thead>
            <tr style={{ background: '#eef1f4' }}>
              <th style={{ ...th, textAlign: 'left' }}>항목</th>
              <th style={th}>금액 (원)</th>
              <th style={th}>금액 (동)</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.key}>
                <td style={{ ...td, textAlign: 'left' }}>{l.label}</td>
                <td style={td}>{won(l.krw)}</td>
                <td style={td}>{dong(l.vnd)}</td>
              </tr>
            ))}
            <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
              <td style={{ ...td, textAlign: 'left' }}>합계</td>
              <td style={td}>{won(doc.totalKrw)}</td>
              <td style={{ ...td, color: '#d32f3c', fontSize: 15 }}>{dong(doc.totalVnd)}</td>
            </tr>
          </tbody>
        </table>

        {/* 최종 견적서: 임시분과의 차액 판정 */}
        {isFinal ? (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8,
            background: doc.adjust ? '#fff8e6' : '#e6f6f0',
            color: doc.adjust ? '#8a4a0a' : '#0f7355', fontSize: 13.5, lineHeight: 1.7,
          }}>
            <b>{doc.adjustLabel}</b>
            <div style={{ marginTop: 4, color: '#2b3138' }}>
              임시 견적 {won(doc.provisionalKrw)} ({dong(doc.provisionalVnd)}) · 실측 재계산 {won(doc.recalculatedKrw)}
              {' · '}차액 {doc.diffKrw > 0 ? '+' : ''}{won(doc.diffKrw)} ({doc.diffVnd > 0 ? '+' : ''}{dong(doc.diffVnd)})
            </div>
            <div style={{ marginTop: 2, color: '#4e5968', fontSize: 12 }}>
              기준: 차액 {dong(doc.thresholdVnd)} 이상일 때만 추가 청구 또는 환불합니다.
            </div>
          </div>
        ) : null}

        {/* 입금 계좌 */}
        <div style={{ marginTop: 14, borderTop: '1px solid #d7dbe0', paddingTop: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>입금 계좌</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {doc.payment.map((p) => (
              <div key={p.currency} style={{
                flex: '1 1 240px', border: '1px solid #e5e8eb', borderRadius: 8, padding: '8px 10px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1b64da' }}>
                  {p.currency === 'KRW' ? '한국 계좌 (원화 입금)' : '베트남 계좌 (동화 입금)'}
                </div>
                <div style={{ fontSize: 13, color: '#2b3138', lineHeight: 1.7, marginTop: 3 }}>
                  <div>{p.bank}</div>
                  <div style={{ fontWeight: 800, color: '#111418', fontSize: 15.5 }}>{p.account}</div>
                  <div>예금주 : {p.holder}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ color: '#d32f3c', fontWeight: 700, fontSize: 12.5, marginTop: 8 }}>
            입금 시 메모에 주문번호 <b>{doc.orderNo}</b> 를 반드시 입력해 주세요. (두 계좌 중 편한 쪽으로 보내시면 됩니다)
          </div>
        </div>

        {/* 비고 */}
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#2b3138', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 800, color: '#111418', marginBottom: 3, fontSize: 13.5 }}>안내</div>
          {doc.notes.map((n, i) => <div key={i}>· {n}</div>)}
        </div>
      </div>
    </>
  )
}

function Field({ label, value, bold, wide }) {
  return (
    <div style={{ flex: wide ? '1 1 100%' : '1 1 0', minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: '#4e5968' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: bold ? 800 : 700, color: '#111418', wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}

const bar = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
  background: '#fff', borderBottom: '1px solid #e5e8eb', position: 'sticky', top: 0, zIndex: 10,
}
const printBtn = {
  border: 0, borderRadius: 8, background: '#17916b', color: '#fff',
  padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
}
const sheet = {
  width: 760, margin: '20px auto', background: '#fff', padding: '28px 32px',
  boxShadow: '0 2px 12px rgba(0,0,0,.08)', font: '14.5px/1.65 sans-serif', color: '#111418',
}
const row = { display: 'flex', gap: 14, flexWrap: 'wrap' }
const table = { width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13.5 }
const th = { padding: '9px 10px', borderTop: '1px solid #c9d0d8', borderBottom: '1px solid #c9d0d8', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: '#2b3138' }
const td = { padding: '9px 10px', borderBottom: '1px solid #e3e7ec', textAlign: 'right' }
