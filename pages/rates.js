import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import WeightBreakdown from '../components/WeightBreakdown'
import { estimateItemWeight, estimateShipmentWeight } from '../lib/weight/estimate'
import { calculateShipping, getRateTable, usdToKrw } from '../lib/pricing/shipping'
import { checkEligibility } from '../lib/eligibility'
import { classifyDuty } from '../lib/pricing/duty'
import { compareConsolidation } from '../lib/consolidation'
import { SHIPPING, CONSOLIDATION } from '../config/shipping'
import { TAXES } from '../config/taxes'
import { krw, usd, weight, kg } from '../lib/format'

/**
 * 요금 안내 + 무게·배송비 계산기.
 * 확장을 설치하지 않은 사람도 여기서 상품명만 넣어보고 확인할 수 있습니다.
 */
export default function RatesPage() {
  const [name, setName] = useState('토리든 다이브인 저분자 히알루론산 세럼 50ml')
  const [quantity, setQuantity] = useState(1)
  const [zone, setZone] = useState(SHIPPING.defaultZone)

  const rateTable = useMemo(() => getRateTable(), [])

  const result = useMemo(() => {
    const trimmed = name.trim()
    if (!trimmed) return null

    const eligibility = checkEligibility({ productName: trimmed, quantity })
    if (!eligibility.shippable) return { eligibility }

    const estimate = estimateItemWeight({ productName: trimmed }, quantity)
    const shipment = estimateShipmentWeight([{ productName: trimmed, quantity }])
    const shipping = calculateShipping(shipment.chargeableG, { zone })
    return { eligibility, estimate, shipment, shipping, duty: classifyDuty({ productName: trimmed }) }
  }, [name, quantity, zone])

  const consolidationDemo = useMemo(
    () =>
      compareConsolidation(
        [
          { orderNo: '1', items: [{ productName: '토리든 세럼 50ml', quantity: 2 }] },
          { orderNo: '2', items: [{ productName: '메디힐 마스크팩 10매', quantity: 2 }] },
          { orderNo: '3', items: [{ productName: '라운드랩 선크림 50ml', quantity: 3 }] },
        ],
        { zone },
      ),
    [zone],
  )

  return (
    <Layout title="배송 요금">
      <div className="hero">
        <h1 className="hero__title">국제배송 요금 · 무게 계산기</h1>
        <p className="hero__desc">
          배송비는 <strong>1kg당 ${SHIPPING.ratePerKgUsd}</strong> × 청구무게입니다. 청구무게는 실무게와
          부피무게 중 큰 값을 {SHIPPING.roundingStepKg}kg 단위로 올립니다.
        </p>
      </div>

      <section className="panel">
        <div className="panel__head">무게별 배송비</div>
        <div className="panel__body">
          <table className="rate-table">
            <thead>
              <tr>
                <th>청구무게</th>
                <th>USD</th>
                <th>원화</th>
              </tr>
            </thead>
            <tbody>
              {rateTable.map((r) => (
                <tr key={r.kg}>
                  <td>{kg(r.kg)}</td>
                  <td>{usd(r.usd)}</td>
                  <td>{krw(r.krw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 12 }}>
            · 최소 청구무게 {SHIPPING.minBillableKg}kg · 박스당 최대 {SHIPPING.maxParcelKg}kg
            <br />· 부피무게 = 가로×세로×높이(cm) ÷ {SHIPPING.volumetricDivisor.toLocaleString('ko-KR')}
            <br />· 포장 박스 {SHIPPING.boxWeightG}g 이 배송 건당 1회 가산됩니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">지역별 할증</div>
        <div className="panel__body">
          {Object.entries(SHIPPING.zones).map(([key, z]) => (
            <div className="row" key={key}>
              <span className="row__label">{z.label}</span>
              <span className="row__value">{z.surchargeUsd === 0 ? '없음' : `+${usd(z.surchargeUsd)}`}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="section" style={{ paddingBottom: 8 }}>
        <h2 className="section__title">무게 계산기</h2>
        <p className="section__sub">상품명을 입력하면 배송 가능 여부와 예상 무게·배송비를 알려드립니다.</p>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <div className="field">
          <label className="field__label" htmlFor="pname">상품명</label>
          <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="예: 메디힐 티트리 마스크팩 10매" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="qty">수량</label>
            <input id="qty" className="input" type="number" min="1" max="99" inputMode="numeric"
              value={quantity} onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label className="field__label" htmlFor="zone2">배송 지역</label>
            <select id="zone2" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              {Object.entries(SHIPPING.zones).map(([k, z]) => (
                <option key={k} value={k}>{z.label.split(' (')[0]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {result && !result.eligibility.shippable && (
        <div className="section" style={{ paddingTop: 0 }}>
          <p className="note note--danger">
            🚫 <strong>{result.eligibility.label}</strong> — 배송할 수 없는 상품입니다.
            <br />
            {result.eligibility.reason}
          </p>
        </div>
      )}

      {result?.estimate && (
        <>
          <WeightBreakdown estimate={result.estimate} title="상품 무게 분석" />

          <section className="panel">
            <div className="panel__head">
              <span>배송비</span>
              <span className="tag tag--weight">{result.duty.label} 관세 {Math.round(result.duty.dutyRate * 100)}%</span>
            </div>
            <div className="panel__body">
              <div className="row row--muted">
                <span className="row__label">상품 무게 + 박스 {SHIPPING.boxWeightG}g</span>
                <span className="row__value">{weight(result.shipment.chargeableG)}</span>
              </div>
              <div className="row">
                <span className="row__label">청구무게 ({SHIPPING.roundingStepKg}kg 올림)</span>
                <span className="row__value">{kg(result.shipping.billableKg)}</span>
              </div>
              <div className="row">
                <span className="row__label">{kg(result.shipping.billableKg)} × {usd(result.shipping.ratePerKgUsd)}/kg</span>
                <span className="row__value">{usd(result.shipping.freightUsd)}</span>
              </div>
              {result.shipping.zoneSurchargeUsd > 0 && (
                <div className="row">
                  <span className="row__label">지역 할증</span>
                  <span className="row__value">{usd(result.shipping.zoneSurchargeUsd)}</span>
                </div>
              )}
              <div className="row row--total">
                <span className="row__label">국제배송비</span>
                <span className="row__value">{usd(result.shipping.totalUsd)}</span>
              </div>
              <div className="row row--muted">
                <span className="row__label">원화 환산</span>
                <span className="row__value">{krw(result.shipping.totalKrw)}</span>
              </div>
              <p className="note" style={{ marginTop: 12 }}>
                배송비 외에 수입관세 {Math.round(result.duty.dutyRate * 100)}%({result.duty.label})와 VAT{' '}
                {Math.round(TAXES.vatRate * 100)}%가 CIF(상품가+운임) 기준으로 부과됩니다. 2025년 2월 18일부터
                소액 면세가 폐지되어 금액과 무관하게 과세됩니다.
              </p>
            </div>
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel__head">
          <span>합배송 절감 예시</span>
          <span className="tag tag--ok">{Math.round(consolidationDemo.savingsRate * 100)}% 절약</span>
        </div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">개별 발송 3건 ({consolidationDemo.separate.billableKg}kg)</span>
            <span className="row__value">{usd(consolidationDemo.separate.totalUsd)}</span>
          </div>
          <div className="row">
            <span className="row__label">
              합배송 1건 ({consolidationDemo.consolidated.billableKg}kg, 취급비 {usd(CONSOLIDATION.handlingFeeUsd)} 포함)
            </span>
            <span className="row__value">{usd(consolidationDemo.consolidated.totalUsd)}</span>
          </div>
          <div className="row row--total">
            <span className="row__label">절감액</span>
            <span className="row__value">{usd(consolidationDemo.savingsUsd)}</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            한국 창고에서 {CONSOLIDATION.freeStorageDays}일간 무료 보관하며, 도착한 주문들을 묶어 한 박스로
            보냅니다. 박스 무게와 {SHIPPING.roundingStepKg}kg 올림이 건별이 아니라 1회만 적용되어 절감됩니다.
          </p>
        </div>
      </section>
    </Layout>
  )
}
