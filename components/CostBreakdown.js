import { krw, vnd, kg } from '../lib/format'
import { SETTLEMENT } from '../config/fees'

/**
 * 랜딩코스트(하노이 문 앞까지의 총 비용) 명세.
 * 베트남은 2025-02-18 부터 소액 면세가 폐지되어 관세·VAT가 항상 붙으므로
 * 이를 감춘 견적은 실제 청구액과 어긋납니다.
 */
export default function CostBreakdown({ quote }) {
  if (!quote) return null
  const hasRange = quote.range && quote.range.high > quote.range.low

  return (
    <section className="panel">
      <div className="panel__head">
        <span>예상 견적</span>
        <span className="tag tag--weight">청구무게 {kg(quote.shipping.billableKg)}</span>
      </div>
      <div className="panel__body">
        {quote.breakdown.map((row) => (
          <div className="row" key={row.key}>
            <span className="row__label">{row.label}</span>
            <span className="row__value">{krw(row.krw)}</span>
          </div>
        ))}

        <div className="row row--total">
          <span className="row__label">총 예상 결제액</span>
          <span className="row__value">{krw(quote.total)}</span>
        </div>
        <div className="row row--muted">
          <span className="row__label">베트남동 환산</span>
          <span className="row__value">{vnd(quote.totalVnd)}</span>
        </div>

        {hasRange && (
          <p className="note" style={{ marginTop: 12 }}>
            실측 무게에 따라 <strong>{krw(quote.range.low)} ~ {krw(quote.range.high)}</strong> 범위에서
            확정됩니다.
          </p>
        )}

        {quote.shipping?.leadTimeDays && (
          <p className="note" style={{ marginTop: 10 }}>
            📦 하노이 도착 예상 {quote.shipping.leadTimeDays.min}~{quote.shipping.leadTimeDays.max}영업일
          </p>
        )}

        <p className="note note--warn" style={{ marginTop: 10 }}>
          ℹ️ {SETTLEMENT.notice}
        </p>
      </div>
    </section>
  )
}
