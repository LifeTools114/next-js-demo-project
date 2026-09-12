import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import WarehouseAddress from '../components/WarehouseAddress'
import { serviceAreaText } from '../components/ServiceAreaNotice'
import { BUSINESS } from '../config/legal'
import { CONTACT } from '../config/contact'
import { SHIPPING } from '../config/shipping'
import { FEES } from '../config/fees'
import { krw } from '../lib/format'

/**
 * 📖 이용 안내 — 하단 탭 넷째 (명세 3.2 4️⃣)
 *   · 쇼핑몰 배송지에 넣을 한국 주소 원클릭 복사 (신청서와 같은 이름을 씁니다)
 *   · 두 가지 방법 · 배송 지역과 기간 · 문의 · 사업자 정보 · 약관/개인정보 링크
 * PC 에서도 보이는 화면이라 남의 상호는 적지 않습니다 — 「쇼핑몰」.
 */
const RECIPIENT_KEY = 'kbeauty-hanoi:recipient'

export default function GuidePage() {
  const [name, setName] = useState('')
  const { cities, notServed } = serviceAreaText()

  // 신청서에서 쓰던 이름이 있으면 그대로 — 두 번 적지 않게
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECIPIENT_KEY) ?? 'null')
      if (saved?.name) setName(saved.name)
    } catch { /* 없으면 빈 칸 */ }
  }, [])

  return (
    <Layout title="이용 안내">
      <div className="section" style={{ paddingBottom: 6 }}>
        <h1 className="section__title">📖 이용 안내</h1>
      </div>

      <section className="panel">
        <div className="panel__head">📦 배송만 — 쇼핑몰 배송지에 이대로</div>
        <div className="panel__body">
          <WarehouseAddress name={name} onName={setName} />
          <Link href="/send?track=forwarding" className="btn" style={{ marginTop: 4 }}>배송만 신청하기 →</Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">두 가지 방법</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label"><strong>📦 배송만</strong><br /><small>쇼핑몰 결제는 직접, 베트남까지만 맡기기</small></span>
            <span className="row__value">${SHIPPING.ratePerKgUsd}/kg</span>
          </div>
          <div className="row">
            <span className="row__label"><strong>🛒 구매하고 배송까지</strong><br /><small>한국 카드가 없어도 링크만 주시면 대신 구매</small></span>
            <span className="row__value">+ 수수료 {krw(FEES.agencyBaseKrw)}~</span>
          </div>
          <Link href="/send?track=agent" className="btn btn--ghost" style={{ marginTop: 10 }}>구매하고 배송까지 신청 →</Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">🚚 배송 지역 · 기간</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">배송 가능<br /><b>{cities}</b></span>
          </div>
          <div className="row">
            <span className="row__label">배송 불가<br /><b style={{ color: 'var(--danger)' }}>{notServed}</b></span>
          </div>
          <div className="row">
            <span className="row__label">한국 창고 → 베트남</span>
            <span className="row__value">{SHIPPING.leadTimeDays.min}~{SHIPPING.leadTimeDays.max}영업일</span>
          </div>
          <p className="note" style={{ marginTop: 10 }}>요금표와 계산기는 <Link href="/rates"><b>📊 요금</b></Link> 탭에 있습니다.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">💬 문의</div>
        <div className="panel__body">
          {CONTACT.kakaoOpenChat ? (
            <a href={CONTACT.kakaoOpenChat} target="_blank" rel="noreferrer" className="btn">💬 {CONTACT.label} 오픈채팅</a>
          ) : null}
          {CONTACT.kakaoId ? (
            <div className="row" style={{ marginTop: 6 }}>
              <span className="row__label">{CONTACT.label} ID</span>
              <span className="row__value" style={{ color: 'var(--accent)' }}>{CONTACT.kakaoId}</span>
            </div>
          ) : null}
          {CONTACT.hours ? (
            <div className="row">
              <span className="row__label">운영시간</span>
              <span className="row__value">{CONTACT.hours}</span>
            </div>
          ) : null}
        </div>
      </section>

      {/* 전자상거래법 제10조 표시사항 */}
      <section className="panel">
        <div className="panel__head">🏛 사업자 정보</div>
        <div className="panel__body" style={{ fontSize: '0.82rem', lineHeight: 1.9, color: 'var(--text-2)' }}>
          <div>상호 : <b>{BUSINESS.name}</b>{BUSINESS.nameEn ? ` (${BUSINESS.nameEn})` : ''}</div>
          <div>대표자 : {BUSINESS.ceo}</div>
          <div>사업자등록번호 : {BUSINESS.bizNo}</div>
          <div>통신판매업 신고 : {BUSINESS.mailOrderNo}</div>
          <div>사업장 : {BUSINESS.address}</div>
          {BUSINESS.tel ? <div>전화 : {BUSINESS.tel}</div> : null}
          {BUSINESS.email ? <div>이메일 : {BUSINESS.email}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Link href="/notice" className="btn btn--ghost btn--sm">📋 이용약관</Link>
            <Link href="/privacy" className="btn btn--ghost btn--sm">📜 개인정보 처리방침</Link>
          </div>
        </div>
      </section>
    </Layout>
  )
}
