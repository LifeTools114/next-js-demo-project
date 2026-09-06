import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import ServiceAreaNotice from '../components/ServiceAreaNotice'
import WeightBreakdown from '../components/WeightBreakdown'
import { estimateItemWeight, estimateShipmentWeight } from '../lib/weight/estimate'
import { calculateShipping, getRateTable, usdToKrw, roundingRuleText, toBillableKg } from '../lib/pricing/shipping'
import { checkEligibility } from '../lib/eligibility'
import { classifyDuty } from '../lib/pricing/duty'
import { compareConsolidation } from '../lib/consolidation'
import { SHIPPING, CONSOLIDATION, ITEM_SURCHARGES, RETURN_SHIPPING, estimateReturnShippingUsd } from '../config/shipping'
import { MAINTENANCE } from '../config/maintenance'
import { maintenanceStatus } from '../lib/maintenance'
import { DESTINATION, LISTED_BLOCK_RULES } from '../config/eligibility'
import { TAXES } from '../config/taxes'
import { FEES } from '../config/fees'
import { REFUND_DAYS, RETURN_POLICY } from '../config/payment'
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
  const roundingRule = useMemo(() => roundingRuleText(), [])
  const maint = useMemo(() => maintenanceStatus(new Date(), DESTINATION.country), [])

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
          부피무게 중 큰 값을 올려서 계산합니다 ({roundingRule}).
        </p>
      </div>

      <div className="section" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <ServiceAreaNotice />
      </div>

      {/* ── 전체 요금표 — 모든 경우의 수 한눈에 (운영자 지시 26-08-31) ── */}
      <section className="panel">
        <div className="panel__head">
          <span>두 가지 방법 — 내는 돈 비교</span>
        </div>
        <div className="panel__body">
          <div style={{ overflowX: 'auto' }}>
            <table className="rate-table">
              <thead>
                <tr>
                  <th>항목</th>
                  <th>📦 배송만</th>
                  <th>🛒 구매하고 배송까지</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>쇼핑몰 상품값</td>
                  <td>본인이 직접 결제<br /><small>쿠폰·와우 할인 자유</small></td>
                  <td>상품가 그대로 청구<br /><small>개인 쿠폰 사용 불가</small></td>
                </tr>
                <tr>
                  <td>한국 내 배송비</td>
                  <td>본인이 쇼핑몰에 직접<br /><small>견적에 넣지 않습니다</small></td>
                  <td>쇼핑몰 화면 그대로<br />
                    <small>판매자마다 한 번 — 그 판매자 무료배송 조건을 넘으면 0원</small></td>
                </tr>
                <tr>
                  <td>대행 수수료</td>
                  <td>없음</td>
                  <td>기본 {krw(FEES.agencyBaseKrw)}<br />
                    <small>상품가 {krw(FEES.agencyBaseMaxGoodsKrw)}·{FEES.agencyBaseMaxItems}종까지 —
                      초과분 {Math.round(FEES.agencyExcessRate * 100)}% + 종당 {krw(FEES.agencyPerExtraItemKrw)}</small></td>
                </tr>
                <tr>
                  <td>국제배송비</td>
                  <td colSpan={2}>공통 — 청구무게 × ${SHIPPING.ratePerKgUsd}/kg (아래 표)</td>
                </tr>
                <tr>
                  <td>1회 한도</td>
                  <td>—</td>
                  <td>상품가 합계 {krw(FEES.agentMaxGoodsKrw)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="rate-table">
              <thead>
                <tr>
                  <th>예시 총액</th>
                  <th>📦 배송만</th>
                  <th>🛒 구매하고 배송까지</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 5].map((w) => {
                  const freight = usdToKrw(SHIPPING.ratePerKgUsd * w)
                  return (
                    <tr key={w}>
                      <td>{w}kg 기준</td>
                      <td>{krw(freight)}</td>
                      <td>상품가 + {krw(FEES.agencyBaseKrw + freight)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            대신 사드리는 예시는 기본 수수료({krw(FEES.agencyBaseKrw)}) 기준이며, 전자·가전 등
            할증 품목은 아래 추가금액이 더해집니다. 도착은 {SHIPPING.leadTimeDays.min + 1}~
            {SHIPPING.leadTimeDays.max + 3}영업일(쇼핑몰→창고 1~3 + 창고→베트남{' '}
            {SHIPPING.leadTimeDays.min}~{SHIPPING.leadTimeDays.max})입니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <span>교환·반품 요금</span>
          <span className="tag tag--warn">비용 전액 구매자 부담</span>
        </div>
        <div className="panel__body">
          <div style={{ overflowX: 'auto' }}>
            <table className="rate-table">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>금액</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>반송비 (베트남→한국) · {RETURN_SHIPPING.baseKg}kg까지</td>
                  <td>${RETURN_SHIPPING.baseUsd} ({krw(usdToKrw(RETURN_SHIPPING.baseUsd))})</td>
                </tr>
                <tr>
                  <td>반송비 · {RETURN_SHIPPING.baseKg}kg 초과 kg당</td>
                  <td>+${RETURN_SHIPPING.perKgUsd} ({krw(usdToKrw(RETURN_SHIPPING.perKgUsd))})</td>
                </tr>
                <tr>
                  <td>반송비 예시 3kg / 5kg</td>
                  <td>${estimateReturnShippingUsd(3)} / ${estimateReturnShippingUsd(5)}</td>
                </tr>
                <tr>
                  <td>대신 사드린 건의 반품·교환 처리비</td>
                  <td>{krw(RETURN_SHIPPING.agentHandlingKrw)}</td>
                </tr>
                <tr>
                  <td>교환 시 재배송(한국→베트남)</td>
                  <td>국제배송비 다시 청구<br /><small>대신 사드린 건은 수수료 포함</small></td>
                </tr>
                <tr>
                  <td>반품 환불액</td>
                  <td>낸 금액 − 대신 구매 수수료<br />
                    <small>배송만 맡기신 건은 ${RETURN_POLICY.forwardingRefundFeeUsd} 차감 · 품절 등 당사 사유는 전액</small></td>
                </tr>
                <tr>
                  <td>환불 지급</td>
                  <td>영업일 {REFUND_DAYS.min}~{REFUND_DAYS.max}일</td>
                </tr>
                <tr>
                  <td>쇼핑몰 반품배송비</td>
                  <td>별도 (쇼핑몰 정책 요율)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note note--warn" style={{ marginTop: 10, lineHeight: 1.7 }}>
            ⚠️ {RETURN_SHIPPING.blockedNote} — 해당 품목은 교환·반품이 불가합니다.
            <br />
            반송은 <b>사전 접수 필수</b> · {RETURN_SHIPPING.customsNote} · 당일 픽업 시 한국 도착{' '}
            {RETURN_SHIPPING.leadTime.pickupToKoreaDays.min}~{RETURN_SHIPPING.leadTime.pickupToKoreaDays.max}일.
            저렴한 상품은 왕복 비용이 상품가를 넘는 경우가 많으니 신청서의{' '}
            <b>교환·반품 비용 미리보기</b>를 확인하세요.
          </p>
        </div>
      </section>

      {/* ── 예시로 보는 모든 경우 — 실제 계산식 그대로 (운영자 지시 26-08-31) ── */}
      <section className="panel">
        <div className="panel__head">📚 예시로 보는 요금 — 모든 경우</div>
        <div className="panel__body">
          {(() => {
            const F = (w) => usdToKrw(SHIPPING.ratePerKgUsd * w) // 국제배송비(원)
            const U = (u) => usdToKrw(u)
            const base = FEES.agencyBaseKrw
            // 예시 4: 상품가 15만·6종 — 기본 + 10만 초과분 5% + 5종 초과 종당 1,000
            const fee4 = base + Math.round(50000 * FEES.agencyExcessRate) + FEES.agencyPerExtraItemKrw
            const dev = ITEM_SURCHARGES.device.usd
            const rows = [
              ['📦 배송만 · 화장품 1kg', `배송비 1kg × $${SHIPPING.ratePerKgUsd}`, krw(F(1))],
              ['📦 배송만 · 2kg', `2kg × $${SHIPPING.ratePerKgUsd}`, krw(F(2))],
              ['🛒 대신 구매 · 상품 50,000원 · 1kg', `상품가 + 수수료 ${krw(base)} + 배송 ${krw(F(1))}`, krw(50000 + base + F(1))],
              ['🛒 대신 구매 · 상품 150,000원 · 6종 · 2kg', `수수료 ${krw(fee4)} (기본+초과분 5%+종당 1,000) + 배송 ${krw(F(2))}`, krw(150000 + fee4 + F(2))],
              ['🛒 대신 구매 · 무선청소기 89,000원 · 1kg', `+ 기기 취급 $${dev} (${krw(U(dev))})`, krw(89000 + base + F(1) + U(dev))],
              ['📦 배송만 · 도자기 그릇 2개 · 2kg', `+ 파손주의 $${ITEM_SURCHARGES.fragile.usd}×2`, krw(F(2) + U(ITEM_SURCHARGES.fragile.usd * 2))],
              ['📦 배송만 · 대형 12kg', `12kg × $${SHIPPING.ratePerKgUsd} + 대형 $${ITEM_SURCHARGES.bulky.usd}`, krw(F(12) + U(ITEM_SURCHARGES.bulky.usd))],
              ['교환 왕복 · 배송만 1kg', `반송 $${estimateReturnShippingUsd(1)} + 재배송 ${krw(F(1))}`, krw(U(estimateReturnShippingUsd(1)) + F(1))],
              ['교환 왕복 · 대신 구매 1kg', `+ 처리 ${krw(RETURN_SHIPPING.agentHandlingKrw)} + 수수료 ${krw(base)}`,
                krw(U(estimateReturnShippingUsd(1)) + RETURN_SHIPPING.agentHandlingKrw + F(1) + base)],
              ['반품 환불 · 대신 구매 (67,420원 결제)', `수수료 ${krw(base)} 제외 환불 · 반송비 별도 본인 부담`, krw(67420 - base)],
              ['반품 환불 · 배송만 (12,420원 결제)', `$${RETURN_POLICY.forwardingRefundFeeUsd} 차감 · 반송비 별도 → 실익 확인 필요`,
                krw(12420 - U(RETURN_POLICY.forwardingRefundFeeUsd))],
            ]
            return (
              <div style={{ overflowX: 'auto' }}>
                <table className="rate-table">
                  <thead>
                    <tr><th>사례</th><th>계산</th><th>금액</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(([c, f, total]) => (
                      <tr key={c}>
                        <td>{c}</td>
                        <td><small>{f}</small></td>
                        <td>{total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
          <p className="note" style={{ marginTop: 10 }}>
            골프채·스키 등 장척과 100만원 이상 고액은 <b>견적 문의</b>, 향수·주류 등 금지 품목과{' '}
            <b>해외직구(로켓직구) 상품은 접수 불가</b>입니다. 무게는 상품명 기반 추정 후 창고
            실측으로 정산되므로 실제 청구액은 달라질 수 있습니다.
          </p>
        </div>
      </section>

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
        <div className="panel__head">
          <span>점검 시간 (쉬는시간)</span>
          <span className="tag">{maint.windowKst.start}~{maint.windowKst.end} 한국시간</span>
        </div>
        <div className="panel__body">
          <div className="row">
            <span className="row__label">한국시간 기준</span>
            <span className="row__value">매일 {maint.windowKst.start} ~ {maint.windowKst.end}</span>
          </div>
          {maint.windowLocal && (
            <div className="row">
              <span className="row__label">{DESTINATION.label} 현지 기준</span>
              <span className="row__value">매일 {maint.windowLocal.start} ~ {maint.windowLocal.end}</span>
            </div>
          )}
          <p className="note" style={{ marginTop: 12 }}>
            이 시간에는 쇼핑몰 가격 정보가 정확하지 않을 수 있어 견적과 매입을 잠시 멈춥니다.
            주문 접수·입금 확인·발송처럼 쇼핑몰과 무관한 작업은 그대로 진행됩니다.
            <br />
            <small>
              쇼핑몰이 공개 점검 시각을 명시하지 않아 운영 관찰에 따라 조정되는 설정값입니다.
              변경 시 이 페이지에 반영됩니다.
            </small>
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">배송 지역 · 도착 소요일</div>
        <div className="panel__body">
          {Object.entries(SHIPPING.zones).map(([key, z]) => (
            <div className="row" key={key}>
              <span className="row__label">{z.label}</span>
              <span className="row__value">{z.surchargeUsd === 0 ? '할증 없음' : `+${usd(z.surchargeUsd)}`}</span>
            </div>
          ))}
          <div className="row">
            <span className="row__label">베트남 도착 소요</span>
            <span className="row__value">{SHIPPING.leadTimeDays.min}~{SHIPPING.leadTimeDays.max}영업일</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>{SHIPPING.serviceAreaNotice}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">상품 할증</div>
        <div className="panel__body">
          {Object.entries(ITEM_SURCHARGES).map(([key, sc]) => (
            <div className="row" key={key}>
              <span className="row__label">
                {sc.label}
                <br />
                <small style={{ color: 'var(--ink-500)' }}>{sc.description}</small>
              </span>
              <span className="row__value">+{usd(sc.usd)}</span>
            </div>
          ))}
          <div className="row">
            <span className="row__label">
              장척·특수 (골프채·스키·캐리어 등) / 고액(100만원↑) / 중량(15kg↑)
              <br />
              <small style={{ color: 'var(--ink-500)' }}>항공 특수 취급·보험 확인이 필요한 품목</small>
            </span>
            <span className="row__value">견적 문의</span>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            일반 화장품 유리용기(크림 단지 등)는 표준 완충 포장에 포함되어 할증하지 않습니다.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">배송 금지 품목</div>
        <div className="panel__body">
          {/* 해외직구 차단 — 키워드 규칙이 아니라 배지 판별이라 별도 표기 (26-08-31) */}
          <div className="row">
            <span className="row__label">
              해외직구 상품 (로켓직구·판매자 해외배송)
              <br />
              <small style={{ color: 'var(--ink-500)' }}>
                중국 등 해외에서 발송되는 직구 상품은 접수하지 않습니다 — 한국 내 발송 상품만
              </small>
            </span>
            <span className="row__value">🚫</span>
          </div>
          {LISTED_BLOCK_RULES.map((r) => (
            <div className="row" key={r.id}>
              <span className="row__label">
                {r.label}
                <br />
                <small style={{ color: 'var(--ink-500)' }}>{r.reason}</small>
              </span>
              <span className="row__value">🚫</span>
            </div>
          ))}
          <p className="note" style={{ marginTop: 12 }}>
            확장프로그램이 쇼핑몰 상품 페이지에서 <strong>주문 전에</strong> 자동으로 알려드립니다.
            결제 후 창고에서 반송되면 왕복 배송비가 발생하기 때문입니다.
          </p>
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
          {Object.keys(SHIPPING.zones).length > 1 && (
            <div className="field" style={{ flex: 2 }}>
              <label className="field__label" htmlFor="zone2">배송 지역</label>
              <select id="zone2" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
                {Object.entries(SHIPPING.zones).map(([k, z]) => (
                  <option key={k} value={k}>{z.label}</option>
                ))}
              </select>
            </div>
          )}
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
                <span className="row__label">청구무게 ({roundingRule})</span>
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
                추가 비용 품목: 전자기기(휴대폰·태블릿·노트북·PC·모니터) ${ITEM_SURCHARGES.device.usd}/대 ·
                파손주의 ${ITEM_SURCHARGES.fragile.usd}/개 · 대형({ITEM_SURCHARGES.bulky.thresholdKg}kg↑) ${ITEM_SURCHARGES.bulky.usd}/건 ·
                골프채·스키·캐리어 등 장척은 견적 문의. 할증은 견적 내역에 자동 표시됩니다.
              </p>
              {/* 세금 문구 — 관세·VAT 를 걷는 정책일 때만 (현재 미징수, config/taxes.js) */}
              {TAXES.collect && (
                <p className="note" style={{ marginTop: 12 }}>
                  배송비 외에 수입관세 {Math.round(result.duty.dutyRate * 100)}%({result.duty.label})와 VAT{' '}
                  {Math.round(TAXES.vatRate * 100)}%가 CIF(상품가+운임) 기준으로 부과됩니다. 2025년 2월 18일부터
                  소액 면세가 폐지되어 금액과 무관하게 과세됩니다.
                </p>
              )}
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
            보냅니다. 박스 무게와 올림 손실이 건별이 아니라 1회만 적용되어 절감됩니다.
          </p>
        </div>
      </section>
    </Layout>
  )
}
