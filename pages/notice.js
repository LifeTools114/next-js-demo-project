/**
 * 공지사항 — 배송 전에 꼭 아셔야 하는 내용
 *
 * 접수 화면의 동의 항목이 여기를 근거로 합니다. 사고가 난 뒤 설명하면
 * 늦으므로, 자주 문제가 되는 것부터(중요도 순) 크게 보여줍니다.
 */
import Head from 'next/head'
import Layout from '../components/Layout'
import { noticesByCategory, BUSINESS, REQUIRED_CONSENTS } from '../config/legal'

const TONE = {
  critical: { bg: 'var(--danger-soft)', border: 'var(--danger)', color: 'var(--danger)', tag: '꼭 확인' },
  important: { bg: 'var(--warn-soft)', border: 'var(--warn)', color: 'var(--warn)', tag: '중요' },
  info: { bg: 'var(--accent-soft)', border: 'var(--line-2)', color: 'var(--accent)', tag: '안내' },
}

export default function NoticePage() {
  return (
    <Layout>
      <Head><title>이용약관 · 공지사항 — 배송 전 꼭 확인</title></Head>

      <div className="hero">
        <h1 className="hero__title">📋 이용약관 · 공지사항</h1>
        <p className="hero__desc">
          배송을 맡기시기 전에 꼭 확인하세요. <b>빨간 항목은 돈이 걸린 내용</b>입니다.
        </p>
      </div>

      {noticesByCategory().map(({ category, items }) => (
        <section className="section" key={category}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 10px' }}>{category}</h2>
          {items.map((n) => {
            const tone = TONE[n.severity] ?? TONE.info
            return (
              <article key={n.id} id={n.id} style={{
                background: tone.bg, border: `1px solid ${tone.border}`,
                borderRadius: 12, padding: '14px 16px', marginBottom: 10,
              }}>
                <div style={{
                  display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: '#fff',
                  background: tone.color, borderRadius: 999, padding: '2px 9px', marginBottom: 6,
                }}>{tone.tag}</div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>{n.title}</h3>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: '0.86rem', lineHeight: 1.7 }}>
                  {n.body.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </article>
            )
          })}
        </section>
      ))}

      <section className="section">
        <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 10px' }}>접수 시 동의하시는 항목</h2>
        <ul style={{ paddingLeft: 18, color: 'var(--text-2)', fontSize: '0.86rem', lineHeight: 1.9 }}>
          {REQUIRED_CONSENTS.map((c) => <li key={c.id}>{c.label}</li>)}
        </ul>
        {/* 전자상거래법 제10조 표시사항 — 상호·대표자·주소·신고번호 */}
        <div style={{
          marginTop: 14, padding: '12px 14px', border: '1px solid var(--line-2)',
          borderRadius: 10, background: 'var(--bg-2)', fontSize: '0.82rem', lineHeight: 1.9, color: 'var(--text-2)',
        }}>
          <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>사업자 정보</div>
          {/* 영문 상호는 없을 수도 있습니다 — 빈 괄호가 남지 않게 합니다 */}
          <div>
            상호 : {BUSINESS.name}{BUSINESS.nameEn ? ` (${BUSINESS.nameEn})` : ''} · 대표자 : {BUSINESS.ceo}
          </div>
          <div>사업장 : {BUSINESS.address}</div>
          <div>사업자등록번호 : {BUSINESS.bizNo}</div>
          <div>통신판매업 신고번호 : {BUSINESS.mailOrderNo}</div>
          <div>업종 : {BUSINESS.bizType}</div>
          {BUSINESS.tel ? <div>전화 : {BUSINESS.tel}</div> : null}
          {BUSINESS.email ? <div>이메일 : {BUSINESS.email}</div> : null}
          <div>분쟁 관할 : {BUSINESS.disputeVenue}</div>
        </div>
      </section>
    </Layout>
  )
}
