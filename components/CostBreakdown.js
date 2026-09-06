import { useState } from 'react'
import { krw, vnd, kg } from '../lib/format'
import { SETTLEMENT } from '../config/fees'

/**
 * 랜딩코스트(하노이 문 앞까지의 총 비용) 명세.
 * 베트남은 2025-02-18 부터 소액 면세가 폐지되어 관세·VAT가 항상 붙으므로
 * 이를 감춘 견적은 실제 청구액과 어긋납니다.
 */

/** 할증 줄 비용 안내 — ⓘ에 올리면(title) 또는 누르면 왜 붙는 비용인지 보여줍니다. */
const rowInfoText = (row) => {
  const k = row.key ?? ''
  const l = row.label ?? ''
  if (k === 'surcharge-device' || l.includes('기기 취급')) {
    return '물류사 항공특송의 전자·가전 특수 취급비 — 기기당 $40, 대수만큼 부과됩니다. 파손 위험 화물 검수·별도 포장 비용이며, 한국 기기는 베트남에서 A/S 가 어렵습니다.'
  }
  if (k === 'domestic') {
    return '쇼핑몰 판매자가 한국 창고까지 보내는 국내 배송비입니다. 저희가 대신 결제하므로 그대로 전달합니다 — ' +
      '판매자마다 한 번만 붙고, 그 판매자 무료배송 조건을 넘으면 아예 붙지 않습니다.'
  }
  if (k === 'surcharge-fragile' || l.includes('파손주의')) return '유리·도자기 등 파손 위험 품목의 완충 보강 포장비 — 개당 $2.'
  if (k === 'surcharge-bulky' || l.includes('대형 화물')) return '청구무게 10kg 이상 대형 화물 취급비 — 건당 $5.'
  return null
}

export default function CostBreakdown({ quote }) {
  const [infoKey, setInfoKey] = useState(null)
  if (!quote) return null
  const hasRange = quote.range && quote.range.high > quote.range.low

  return (
    <section className="panel">
      <div className="panel__head">
        <span>예상 견적</span>
        <span className="tag tag--weight">청구무게 {kg(quote.shipping.billableKg)}</span>
      </div>
      <div className="panel__body">
        {quote.breakdown.map((row) => {
          const info = rowInfoText(row)
          return (
            <div key={row.key}>
              <div className="row">
                <span className="row__label">
                  {row.label}
                  {info && (
                    <button type="button" title={info} aria-label="비용 안내"
                      onClick={() => setInfoKey(infoKey === row.key ? null : row.key)}
                      style={{
                        border: 0, background: infoKey === row.key ? '#3182f6' : '#eef4fb',
                        color: infoKey === row.key ? '#fff' : '#3182f6',
                        borderRadius: '50%', width: 17, height: 17, fontSize: 11,
                        lineHeight: 1, cursor: 'pointer', padding: 0, marginLeft: 5, verticalAlign: 1,
                      }}>ⓘ</button>
                  )}
                </span>
                <span className="row__value">{krw(row.krw)}</span>
              </div>
              {info && infoKey === row.key && (
                <p className="note" style={{ margin: '2px 0 8px', fontSize: 12 }}>{info}</p>
              )}
            </div>
          )
        })}

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

        {quote.sourcing?.hasOverseas && (
          <p className="note note--warn" style={{ marginTop: 10 }}>
            🌏 <strong>{quote.sourcing.notice.title}</strong>
            <br />
            {quote.sourcing.notice.body}
            <br />
            <br />
            {quote.sourcing.notice.costNote}
          </p>
        )}

        {quote.sourcing?.schedule && (
          <p className="note" style={{ marginTop: 10 }}>
            📦 베트남 도착 예상{' '}
            <strong>
              {quote.sourcing.schedule.totalDays.min}~{quote.sourcing.schedule.totalDays.max}영업일
            </strong>
            <br />
            <small>
              쇼핑몰→한국창고 {quote.sourcing.schedule.toWarehouseDays.min}~
              {quote.sourcing.schedule.toWarehouseDays.max}일 + 한국창고→베트남{' '}
              {quote.sourcing.schedule.toHanoiDays.min}~{quote.sourcing.schedule.toHanoiDays.max}일
            </small>
          </p>
        )}

        <p className="note note--warn" style={{ marginTop: 10 }}>
          ℹ️ {SETTLEMENT.notice}
        </p>
      </div>
    </section>
  )
}
