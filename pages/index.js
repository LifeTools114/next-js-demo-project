import Link from 'next/link'
import Layout from '../components/Layout'
import Flag from '../components/Flag'
import LinkStart from '../components/LinkStart'
import { SHIPPING, CONSOLIDATION, ITEM_SURCHARGES } from '../config/shipping'
import { FEES } from '../config/fees'
import { TAXES } from '../config/taxes'
import { DESTINATION, LISTED_BLOCK_RULES, LISTED_CONSULT_RULES } from '../config/eligibility'
import { krw } from '../lib/format'
import { roundingRuleText } from '../lib/pricing/shipping'
import { shopLink } from '../config/partners'

/**
 * 첫 화면 — 글은 최소로 (운영자 26-09-12: "글 좀 줄이고").
 * 폰: 링크 붙여넣기 하나(LinkStart). PC: 링크로 신청 버튼 + 설명 패널 셋(only-pc).
 * 배송 가능 지역은 헤더의 공지 바에, 요금·주문 이동은 하단 탭에 있으므로 여기서는 되풀이하지 않습니다.
 */
export default function Home({ ratePerKgUsd, agencyBaseKrw, blockedCategories, roundingRule, shop }) {
  return (
    <Layout>
      <div className="hero">
        <h1 className="hero__title">한국 쇼핑몰 <Flag code="kr" size={18} /> → 베트남 문 앞 <Flag code="vn" size={18} /></h1>
        <p className="hero__desc">
          직접 사신 물건은 <strong>배송만</strong>, 한국 카드가 없으면 <strong>구매까지</strong> 대신해 드립니다.
        </p>
      </div>

      {/* 폰 전용 시작점 — 「🔗 상품 링크 붙여넣기」 하나 + 두 가지 방법 두 줄 (PC 는 아래, 폰에서는 숨김) */}
      <LinkStart ratePerKgUsd={ratePerKgUsd} agencyBaseKrw={agencyBaseKrw} shop={shop} />

      {/* PC — 확장이 상품 화면을 읽어 주므로 이 버튼은 확장 없이 링크만으로 신청하는 길입니다 */}
      <div className="section only-pc" style={{ paddingTop: 0 }}>
        <Link href="/send" className="btn" style={{ minHeight: 58, fontSize: 18 }}>
          🔗 상품 링크로 신청하기
        </Link>
      </div>

      <section className="panel only-pc">
        <div className="panel__head">두 가지 방법</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">
              <strong>📦 배송만</strong>
              <br />
              <small>쇼핑몰 결제는 직접, 베트남까지만 맡기기</small>
            </span>
            <span className="row__value">${ratePerKgUsd}/kg</span>
          </div>
          <div className="row">
            <span className="row__label">
              <strong>🛒 구매하고 배송까지</strong>
              <br />
              <small>한국 카드가 없어도 저희가 대신 사서 보내기</small>
            </span>
            <span className="row__value">+ 수수료 {krw(agencyBaseKrw)}~</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            배송비 = 청구무게 × ${ratePerKgUsd}/kg · 청구무게는 {roundingRule} · 최소 {SHIPPING.minBillableKg}kg
          </p>
        </div>
      </section>

      <section className="panel only-pc">
        <div className="panel__head">확장프로그램이 해주는 일</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">⚖️ 무게 자동 산정</span>
            <span className="row__value">상품명·고시정보</span>
          </div>
          <div className="row">
            <span className="row__label">🧾 도착 가격 계산</span>
            <span className="row__value">무게 기반 배송비</span>
          </div>
          <div className="row">
            <span className="row__label">🚫 {DESTINATION.label} 통관 불가 사전 경고</span>
            <span className="row__value">{blockedCategories}개 유형</span>
          </div>
          <div className="row">
            <span className="row__label">📦 합배송 절감</span>
            <span className="row__value">무료 보관 {CONSOLIDATION.freeStorageDays}일</span>
          </div>
        </div>
      </section>

      <section className="panel only-pc">
        <div className="panel__head">추가 비용이 붙는 품목</div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">📱 전자·가전 <small>휴대폰·노트북·모니터·청소기 등</small></span>
            <span className="row__value">${ITEM_SURCHARGES.device.usd}/대</span>
          </div>
          <div className="row">
            <span className="row__label">🍷 파손주의 <small>유리·도자기 식기 등</small></span>
            <span className="row__value">${ITEM_SURCHARGES.fragile.usd}/개</span>
          </div>
          <div className="row">
            <span className="row__label">📦 대형 화물 <small>{ITEM_SURCHARGES.bulky.thresholdKg}kg 이상</small></span>
            <span className="row__value">${ITEM_SURCHARGES.bulky.usd}/건</span>
          </div>
          <div className="row">
            <span className="row__label">🏌️ 장척·특수 <small>골프채·스키·캐리어 등</small></span>
            <span className="row__value">견적 문의</span>
          </div>
        </div>
      </section>

      {/* 세금 안내 — 관세·VAT 를 걷는 정책일 때만 (현재 미징수, config/taxes.js) */}
      {TAXES.collect && (
        <section className="panel">
          <div className="panel__head">세금 안내</div>
          <div className="panel__body">
            <p className="note note--warn">
              ⚠️ {DESTINATION.label}은 2025년 2월 18일부터 소액 면세가 폐지되어{' '}
              <strong>금액과 관계없이 모든 수입 건에 관세와 VAT가 부과</strong>됩니다. VAT는 {Math.round(TAXES.vatRate * 100)}%입니다.
            </p>
          </div>
        </section>
      )}
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
      // 폰 화면의 「쿠팡으로 가기」 — 서버 환경변수의 파트너스 링크가 있으면 그것 (config/partners.js)
      shop: shopLink(),
    },
  }
}
