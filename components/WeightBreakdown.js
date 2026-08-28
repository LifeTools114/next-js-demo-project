import { weight, CONFIDENCE_TAG } from '../lib/format'

/**
 * 무게 산출 근거 패널.
 * 구매대행에서 배송비 분쟁의 대부분은 "왜 이 무게냐"에서 나오므로,
 * 계산 과정을 그대로 노출합니다.
 */
export default function WeightBreakdown({ estimate, title = '무게 산정 내역' }) {
  if (!estimate) return null
  const conf = CONFIDENCE_TAG[estimate.confidence?.level ?? estimate.confidence] ?? CONFIDENCE_TAG.low

  return (
    <section className="panel">
      <div className="panel__head">
        <span>{title}</span>
        <span className={conf.className}>{conf.label}</span>
      </div>
      <div className="panel__body">
        {estimate.form && (
          <div className="row row--muted">
            <span className="row__label">제형 / 용기</span>
            <span className="row__value">
              {estimate.form.label} · {estimate.container?.label}
            </span>
          </div>
        )}
        <div className="row">
          <span className="row__label">내용물</span>
          <span className="row__value">{weight(estimate.netG)}</span>
        </div>
        <div className="row">
          <span className="row__label">용기 무게</span>
          <span className="row__value">{weight(estimate.tareG)}</span>
        </div>
        <div className="row">
          <span className="row__label">완충재·포장</span>
          <span className="row__value">{weight(estimate.packingG)}</span>
        </div>
        <div className="row">
          <span className="row__label">실무게</span>
          <span className="row__value">{weight(estimate.actualG)}</span>
        </div>
        <div className="row row--muted">
          <span className="row__label">부피무게 ({estimate.volumetricCm3?.toLocaleString('ko-KR')}cm³ ÷ 6000)</span>
          <span className="row__value">{weight(estimate.volumetricG)}</span>
        </div>
        <div className="row row--total">
          <span className="row__label">
            청구무게 <small>({estimate.chargeableBy === 'actual' ? '실무게 기준' : '부피무게 기준'})</small>
          </span>
          <span className="row__value">{weight(estimate.chargeableG)}</span>
        </div>

        {estimate.basis?.length > 0 && (
          <p className="note" style={{ marginTop: 12 }}>
            {estimate.basis.map((line, i) => (
              <span key={i}>
                · {line}
                <br />
              </span>
            ))}
          </p>
        )}

      </div>
    </section>
  )
}
