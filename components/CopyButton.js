import { useState } from 'react'
import { copyText } from '../lib/copy'

/**
 * 눌러서 복사되는 버튼 — 계좌번호·주문번호처럼 손으로 옮겨 적다 틀리는 값에.
 *
 * 왜 컴포넌트로 뺐나
 *   예전에는 버튼 안에서 `el.textContent = '✓ 복사되었습니다'` 로 글자를 바꿨는데,
 *   React 가 다시 그리면서 그 글자를 원래대로 돌려놓아 **고객 눈에는 아무 일도
 *   일어나지 않았습니다.** 복사는 됐는데 됐는지 알 수가 없었던 것입니다.
 *   그래서 표시 상태를 React 상태로 들고 있게 했습니다.
 *
 * 복사가 막히는 환경(HTTPS 아님·권한 거부)에서는 "길게 눌러 복사해 주세요"로
 * 바꿔 알려줍니다 — 조용히 실패하지 않는 것이 이 버튼의 핵심입니다.
 */
export default function CopyButton({ value, label, okText = '✓ 복사되었습니다', style }) {
  const [state, setState] = useState('')

  return (
    <button type="button"
      onClick={async () => {
        setState((await copyText(value)) ? 'ok' : 'fail')
        setTimeout(() => setState(''), 1800)
      }}
      style={style}>
      {state === 'ok' ? okText : state === 'fail' ? '길게 눌러 복사해 주세요' : (label ?? value)}
    </button>
  )
}
