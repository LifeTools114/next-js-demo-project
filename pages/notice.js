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
  critical: { bg: '#fff0f0', border: '#ffc9c9', color: '#c92a2a', tag: '꼭 확인' },
  important: { bg: '#fff8e6', border: '#ffe3a3', color: '#a05a12', tag: '중요' },
  info: { bg: '#f2f6fb', border: '#dbe4f0', color: '#2b5e9e', tag: '안내' },
}

export default function NoticePage() {
  return (
    <Layout>
      <Head><title>공지사항 — 배송 전 꼭 확인</title></Head>

      <div className="hero">
        <h1 className="hero__title">공지사항</h1>
        <p className="hero__desc" style={{ fontSize: 15 }}>
          배송을 맡기시기 전에 꼭 알아두셔야 할 내용입니다.
          <b> 빨간색 항목은 돈이 걸린 내용</b>이라 특히 중요합니다.
        </p>
      </div>

      {noticesByCategory().map(({ category, items }) => (
        <section className="section" key={category}>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}>{category}</h2>
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
                <h3 style={{ fontSize: 16.5, fontWeight: 800, margin: '0 0 6px', color: '#191f28' }}>{n.title}</h3>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#333d4b', fontSize: 14.5, lineHeight: 1.75 }}>
                  {n.body.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </article>
            )
          })}
        </section>
      ))}

      <section className="section">
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}>접수 시 동의하시는 항목</h2>
        <ul style={{ paddingLeft: 18, color: '#333d4b', fontSize: 14.5, lineHeight: 1.9 }}>
          {REQUIRED_CONSENTS.map((c) => <li key={c.id}>{c.label}</li>)}
        </ul>
        {/* 전자상거래법 제10조 표시사항 — 상호·대표자·주소·신고번호 */}
        <div style={{
          marginTop: 14, padding: '12px 14px', border: '1px solid #e5e8eb',
          borderRadius: 10, background: '#f9fafb', fontSize: 13.5, lineHeight: 1.9, color: '#333d4b',
        }}>
          <div style={{ fontWeight: 800, color: '#191f28', marginBottom: 4 }}>사업자 정보</div>
          <div>상호 : {BUSINESS.name} ({BUSINESS.nameEn}) · 대표자 : {BUSINESS.ceo}</div>
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
