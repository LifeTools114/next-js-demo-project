import { Fragment } from 'react'

/**
 * 진행 단계 — 상품 → 견적 → 받는 분 → 완료 (명세 3.2 의 Step 1~5 를 우리 흐름에 맞춰 넷으로)
 *   /send      : 0 (상품·방식) → 견적이 뜨면 1
 *   /checkout  : 2 (받는 분·결제)
 *   /orders/…  : 3 (신청 완료 — 처음 받은 직후에만)
 */
const STEPS = ['상품', '견적', '받는 분', '완료']

export default function Steps({ current = 0, steps = STEPS }) {
  return (
    <nav className="steps" aria-label="진행 단계">
      {steps.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className="steps__line" data-done={i <= current} />}
          <span className="steps__item" data-state={i < current ? 'done' : i === current ? 'current' : 'todo'}>
            <span className="steps__num">{i < current ? '✓' : i + 1}</span>
            <span className="steps__label">{label}</span>
          </span>
        </Fragment>
      ))}
    </nav>
  )
}
