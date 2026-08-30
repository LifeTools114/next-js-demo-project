import Link from 'next/link'
import Layout from '../components/Layout'
import { SHIPPING, CONSOLIDATION, ITEM_SURCHARGES } from '../config/shipping'
import { FEES } from '../config/fees'
import { TAXES } from '../config/taxes'
import { DESTINATION, BLOCK_RULES } from '../config/eligibility'
import { krw, usd } from '../lib/format'
import { usdToKrw, roundingRuleText } from '../lib/pricing/shipping'

export default function Home({ ratePerKgUsd, agencyBaseKrw, blockedCategories, roundingRule }) {
  return (
    <Layout badge="베트남 하노이">
      <div className="hero">
        <h1 className="hero__title">쿠팡에서 바로, 하노이 도착 가격 🇰🇷 → 🇻🇳</h1>
        <p className="hero__desc">
          크롬 확장프로그램을 설치하면 <strong>쿠팡 상품 페이지에서 바로</strong> 무게와
          국제배송비를 계산한 하노이 도착 가격이 뜹니다. 통관이 막히는 상품은 주문 전에 알려드립니다.
        </p>
      </div>

      <section className="panel">
        <div className="panel__head">이용 방식 두 가지</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">
              <strong>배송대행</strong>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>쿠팡에서 직접 결제하고 배송만 맡기기</small>
            </span>
            <span className="row__value">${ratePerKgUsd}/kg</span>
          </div>
          <div className="row">
            <span className="row__label">
              <strong>구매대행</strong>
              <br />
              <small style={{ color: 'var(--ink-500)' }}>한국 카드가 없어도 결제까지 대신</small>
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
            결제한 뒤 창고에서 반송되면 왕복 배송비가 발생합니다. 향수·주류·의약품·축산물처럼
            {DESTINATION.label} 통관이 막히는 품목은 <strong>주문 전에</strong> 차단해 드립니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">추가 비용이 붙는 품목</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">📱 전자기기 <small style={{ color: 'var(--ink-500)' }}>휴대폰·태블릿·노트북·PC·모니터</small></span>
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
            <span className="row__label">🎿 장척·특수 <small style={{ color: 'var(--ink-500)' }}>스키·낚싯대·캐리어 등</small></span>
            <span className="row__value">견적 문의</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            할증은 견적과 신청서 내역에 자동으로 표시됩니다. 전자기기는 한국 기기 특성상
            베트남 A/S 가 어렵습니다. 골프채는 베트남 특별소비세 품목이라 접수하지 않습니다.
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
      blockedCategories: BLOCK_RULES.length,
      roundingRule: roundingRuleText(),
    },
  }
}
