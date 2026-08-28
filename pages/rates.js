import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import WeightBreakdown from '../components/WeightBreakdown'
import { estimateItemWeight, estimateShipmentWeight } from '../lib/weight/estimate'
import { calculateShipping, getRateTable } from '../lib/pricing/shipping'
import { SHIPPING } from '../config/shipping'
import { TAXES } from '../config/taxes'
import { krw, weight, kg } from '../lib/format'

/**
 * 배송 요금 안내 + 무게 산정 계산기.
 *
 * 무게 추정 엔진은 순수 계산 모듈이라 클라이언트에서 그대로 실행됩니다.
 * (서버 왕복 없이 입력하는 즉시 결과가 갱신됩니다)
 */
export default function RatesPage() {
  const [name, setName] = useState('토리든 다이브인 저분자 히알루론산 세럼 50ml')
  const [quantity, setQuantity] = useState(1)
  const [zone, setZone] = useState(SHIPPING.defaultZone)

  const rateTable = useMemo(() => getRateTable(), [])

  const { estimate, shipment, shipping } = useMemo(() => {
    const trimmed = name.trim()
    if (!trimmed) return { estimate: null, shipment: null, shipping: null }
    const est = estimateItemWeight({ productName: trimmed }, quantity)
    const ship = estimateShipmentWeight([{ productName: trimmed, quantity }])
    return {
      estimate: est,
      shipment: ship,
      shipping: calculateShipping(ship.chargeableG, {
        zone,
        restrictionSurchargeKrw: ship.restrictions.surchargeKrw,
      }),
    }
  }, [name, quantity, zone])

  return (
    <Layout title="배송 요금">
      <div className="hero">
        <h1 className="hero__title">국제배송 요금 · 무게 계산기</h1>
        <p className="hero__desc">
          배송비는 <strong>1kg당 요율 × 청구무게</strong>로 계산합니다. 청구무게는 실무게와
          부피무게 중 큰 값을 {SHIPPING.roundingStepKg}kg 단위로 올림합니다.
        </p>
      </div>

      <section className="panel">
        <div className="panel__head">구간별 1kg당 요율</div>
        <div className="panel__body">
          <table className="rate-table">
            <thead>
              <tr>
                <th>청구무게 구간</th>
                <th>1kg당</th>
                <th>예시</th>
              </tr>
            </thead>
            <tbody>
              {rateTable.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{krw(r.ratePerKg)}</td>
                  <td style={{ color: 'var(--ink-500)', fontSize: 12 }}>
                    {kg(r.exampleKg)} → {krw(r.exampleTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 12 }}>
            · 최소 청구무게 {SHIPPING.minBillableKg}kg · 박스당 최대 {SHIPPING.maxParcelKg}kg
            <br />· 부피무게 = 가로×세로×높이(cm) ÷ {SHIPPING.volumetricDivisor.toLocaleString('ko-KR')}
            <br />· 포장 박스 무게 {SHIPPING.boxWeightG}g 이 배송 건당 1회 가산됩니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">지역별 할증</div>
        <div className="panel__body">
          {Object.entries(SHIPPING.zones).map(([key, z]) => (
            <div className="row" key={key}>
              <span className="row__label">{z.label}</span>
              <span className="row__value">{z.surcharge === 0 ? '없음' : `+${krw(z.surcharge)}`}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="section" style={{ paddingBottom: 8 }}>
        <h2 className="section__title">무게 계산기</h2>
        <p className="section__sub">
          상품명을 입력하면 용량·제형·용기를 분석해 배송 무게와 요금을 추정합니다.
        </p>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="field">
          <label className="field__label" htmlFor="pname">
            상품명
          </label>
          <input
            id="pname"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 메디힐 티트리 마스크팩 10매"
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="qty">
              수량
            </label>
            <input
              id="qty"
              className="input"
              type="number"
              min="1"
              max="99"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label className="field__label" htmlFor="zone2">
              배송 지역
            </label>
            <select id="zone2" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              {Object.entries(SHIPPING.zones).map(([key, z]) => (
                <option key={key} value={key}>
                  {z.label.split(' (')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {estimate && <WeightBreakdown estimate={estimate} title="상품 무게 분석" />}

      {shipping && (
        <section className="panel">
          <div className="panel__head">
            <span>배송비</span>
            <span className="tag tag--weight">{shipping.tierLabel} 구간</span>
          </div>
          <div className="panel__body">
            <div className="row row--muted">
              <span className="row__label">상품 무게 + 박스 {SHIPPING.boxWeightG}g</span>
              <span className="row__value">{weight(shipment.chargeableG)}</span>
            </div>
            <div className="row">
              <span className="row__label">청구무게 ({SHIPPING.roundingStepKg}kg 올림)</span>
              <span className="row__value">{kg(shipping.billableKg)}</span>
            </div>
            <div className="row">
              <span className="row__label">
                {kg(shipping.billableKg)} × {krw(shipping.ratePerKg)}/kg
              </span>
              <span className="row__value">{krw(shipping.freight)}</span>
            </div>
            {shipping.zoneSurcharge > 0 && (
              <div className="row">
                <span className="row__label">지역 할증</span>
                <span className="row__value">{krw(shipping.zoneSurcharge)}</span>
              </div>
            )}
            {shipping.restrictionSurcharge > 0 && (
              <div className="row">
                <span className="row__label">위험물 취급 할증</span>
                <span className="row__value">{krw(shipping.restrictionSurcharge)}</span>
              </div>
            )}
            <div className="row row--total">
              <span className="row__label">국제배송비</span>
              <span className="row__value">{krw(shipping.total)}</span>
            </div>
            <p className="note" style={{ marginTop: 12 }}>
              배송비 외에 베트남 수입관세 {Math.round(TAXES.importDutyRate * 100)}% 와 VAT{' '}
              {Math.round(TAXES.vatRate * 100)}% 가 CIF(상품가+운임) 기준으로 부과됩니다.
              2025년 2월 18일부터 소액 면세 제도가 폐지되어 금액과 무관하게 과세됩니다.
            </p>
          </div>
        </section>
      )}
    </Layout>
  )
}
