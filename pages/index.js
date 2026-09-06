import Link from 'next/link'
import Layout from '../components/Layout'
import ServiceAreaNotice from '../components/ServiceAreaNotice'
import Flag from '../components/Flag'
import { SHIPPING, CONSOLIDATION, ITEM_SURCHARGES } from '../config/shipping'
import { FEES } from '../config/fees'
import { TAXES } from '../config/taxes'
import { DESTINATION, LISTED_BLOCK_RULES, LISTED_CONSULT_RULES } from '../config/eligibility'
import { krw, usd } from '../lib/format'
import { usdToKrw, roundingRuleText } from '../lib/pricing/shipping'

export default function Home({ ratePerKgUsd, agencyBaseKrw, blockedCategories, roundingRule }) {
  return (
    <Layout badge="베트남 북부">
      <div className="hero">
        <h1 className="hero__title">쇼핑몰에서 산 물건, 베트남까지 <Flag code="kr" size={20} /> → <Flag code="vn" size={20} /></h1>
        <p className="hero__desc">
          쇼핑몰에서 직접 사시면 저희가 베트남까지 보내드립니다.
          한국 카드가 없으셔도 <strong>대신 사드릴 수</strong> 있습니다.
        </p>
      </div>

      <div className="section" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <ServiceAreaNotice />
      </div>

      {/*
        폰으로 오신 분이 가장 먼저 눌러야 할 것 — 확장은 폰에서 돌지 않으므로
        이 버튼이 폰 고객의 유일한 시작점입니다. 그래서 맨 위, 가장 크게.
      */}
      <div className="section" style={{ paddingTop: 0 }}>
        <Link href="/send" className="btn" style={{
          display: 'block', textAlign: 'center', minHeight: 62, fontSize: 19,
          fontWeight: 800, lineHeight: '38px',
        }}>
          📱 폰으로 바로 시작하기
        </Link>
        <p className="note" style={{ marginTop: 8, textAlign: 'center', fontSize: 13.5 }}>
          <b>배송만</b>은 쇼핑몰에 넣을 한국 창고 주소와 배송비를, <b>구매하고 배송까지</b>는 상품 링크만 주시면 전부 계산해 드립니다.
        </p>
      </div>

      <section className="panel">
        <div className="panel__head">이용 방식 두 가지</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">
              <strong>📦 배송만</strong>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>쇼핑몰에서 직접 사고, 베트남까지 배송만 맡기기</small>
            </span>
            <span className="row__value">${ratePerKgUsd}/kg</span>
          </div>
          <div className="row">
            <span className="row__label">
              <strong>🛒 구매하고 배송까지</strong>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>한국 카드가 없어도 저희가 대신 사서 보내드리기</small>
            </span>
            <span className="row__value">
              ${ratePerKgUsd}/kg + 수수료 {krw(agencyBaseKrw)}~
            </span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            국제배송비는 실무게와 부피무게 중 큰 값에 1kg당 ${ratePerKgUsd}
            ({krw(usdToKrw(ratePerKgUsd))})를 적용합니다. 청구무게는 {roundingRule} 로 올리며,
            최소 청구무게는 {SHIPPING.minBillableKg}kg 입니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">확장프로그램이 해주는 일</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">⚖️ 무게 자동 산정</span>
            <span className="row__value">상품명·고시정보 분석</span>
          </div>
          <div className="row">
            <span className="row__label">🧾 도착 가격 계산</span>
            <span className="row__value">무게 기반 국제배송비</span>
          </div>
          <div className="row">
            <span className="row__label">🚫 통관 불가 사전 경고</span>
            <span className="row__value">{blockedCategories}개 유형</span>
          </div>
          <div className="row">
            <span className="row__label">📦 합배송 절감 안내</span>
            <span className="row__value">무료 보관 {CONSOLIDATION.freeStorageDays}일</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            결제한 뒤 창고에서 반송되면 왕복 배송비가 발생합니다. 향수·주류·의약품·냉장냉동 식품처럼
            {DESTINATION.label} 통관이 막히는 품목은 <strong>주문 전에</strong> 차단해 드립니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">추가 비용이 붙는 품목</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">📱 전자·가전 기기 <small style={{ color: 'var(--ink-500)' }}>휴대폰·노트북·모니터·청소기·드라이기 등</small></span>
            <span className="row__value">${ITEM_SURCHARGES.device.usd}/대</span>
          </div>
          <div className="row">
            <span className="row__label">🍷 파손주의 <small style={{ color: 'var(--ink-500)' }}>유리·도자기 식기 등</small></span>
            <span className="row__value">${ITEM_SURCHARGES.fragile.usd}/개</span>
          </div>
          <div className="row">
            <span className="row__label">📦 대형 화물 <small style={{ color: 'var(--ink-500)' }}>청구무게 {ITEM_SURCHARGES.bulky.thresholdKg}kg 이상</small></span>
            <span className="row__value">${ITEM_SURCHARGES.bulky.usd}/건</span>
          </div>
          <div className="row">
            <span className="row__label">🏌️ 장척·특수 <small style={{ color: 'var(--ink-500)' }}>골프채·스키·낚싯대·캐리어 등</small></span>
            <span className="row__value">견적 문의</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            할증은 견적과 신청서 내역에 자동으로 표시됩니다. 전자기기는 한국 기기 특성상
            베트남 A/S 가 어렵습니다. 골프채 등 장척 화물은 접수 후 정확한 요금을 안내드립니다.
          </p>
        </div>
      </section>

      {/* 세금 안내 — 관세·VAT 를 걷는 정책일 때만 (현재 미징수, config/taxes.js) */}
      {TAXES.collect && (
        <section className="panel">
          <div className="panel__head">세금 안내</div>
          <div className="panel__body">
            <p className="note note--warn">
              ⚠️ {DESTINATION.label}은 2025년 2월 18일부터 소액 면세가 폐지되어{' '}
              <strong>금액과 관계없이 모든 수입 건에 관세와 VAT가 부과</strong>됩니다. 관세는 품목군마다
              다르며(신발 30%, 가방 25%, 의류·화장품 20% 등), VAT는 {Math.round(TAXES.vatRate * 100)}%입니다.
            </p>
          </div>
        </section>
      )}

      <div className="section" style={{ display: 'grid', gap: 10 }}>
        <Link href="/rates" className="btn">
          배송비 계산기 열기
        </Link>
        <Link href="/orders" className="btn btn--ghost">
          주문 조회
        </Link>
      </div>
    </Layout>
  )
}

export async function getStaticProps() {
  return {
    props: {
      ratePerKgUsd: SHIPPING.ratePerKgUsd,
      agencyBaseKrw: FEES.agencyBaseKrw,
      blockedCategories: LISTED_BLOCK_RULES.length + LISTED_CONSULT_RULES.length + 1, // +1 = 해외직구 상품 (요금 페이지 목록의 첫 줄)
      roundingRule: roundingRuleText(),
    },
  }
}
