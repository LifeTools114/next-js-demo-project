import { useState } from 'react'
import { WAREHOUSE, detailAddressFor } from '../config/warehouse'
import { copyText } from '../lib/copy'

/**
 * 쇼핑몰 배송지에 넣을 한국 창고 주소 — 한 항목씩 눌러 복사 (외워 옮겨적지 않게).
 * /send(배송만)와 /guide(이용 안내)가 같이 씁니다.
 *
 * 가장 자주 깨지는 곳은 **상세주소**입니다. "YS-ECOM 이름"이 빠지면 창고에서 소포 주인을 못 찾습니다.
 * 그래서 이름을 먼저 받아 상세주소를 만들어 드리고, 이름이 없으면 그 칸은 복사조차 되지 않게 막아 둡니다.
 *
 * 예시 이름은 **누가 봐도 예시**여야 합니다. 예전에는 브라우저에 저장된 이름이 그대로 떠서 남의 이름을
 * 자기 이름인 줄 알고 넣는 일이 생겼습니다 (운영자 26-09-06). 비어 있으면 '홍길동'을 회색 예시로,
 * 이름을 넣으면 노랗게 칠해 "이 부분이 당신 이름"임을 보입니다.
 */
export const SAMPLE_NAME = '홍길동'
export const markStyle = {
  background: '#ffe98a', color: '#1f2937', padding: '1px 6px', borderRadius: 6,
  fontWeight: 900, boxShadow: 'inset 0 -2px 0 #f0b429',
}
const sampleStyle = { ...markStyle, background: 'var(--surface-2)', color: 'var(--text-3)', boxShadow: 'none' }

/** 눌러서 복사되는 한 줄 — 폰에서 손가락으로 누르기 좋은 크기로. */
export function CopyRow({ label, value, display, hint, disabled, danger }) {
  const [state, setState] = useState('')
  const done = state === 'ok'
  const copy = async () => {
    if (disabled || !value) return
    // 복사가 막히는 환경에서도 조용히 실패하지 않습니다 (lib/copy.js 참고)
    setState((await copyText(value)) ? 'ok' : 'fail')
    setTimeout(() => setState(''), 1800)
  }

  return (
    <button type="button" onClick={copy} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '12px 14px', marginBottom: 8, borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
        border: danger ? '1.5px solid var(--warn)' : '1px solid var(--line-2)',
        background: done ? 'var(--ok-soft)' : danger ? 'var(--warn-soft)' : 'var(--bg-2)', font: 'inherit',
      }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.76rem', color: danger ? 'var(--warn)' : 'var(--text-3)', fontWeight: 700 }}>{label}</span>
        <span style={{
          display: 'block', fontSize: '1.05rem', fontWeight: 800, color: disabled ? 'var(--text-4)' : 'var(--text)',
          marginTop: 2, wordBreak: 'break-all', lineHeight: 1.45,
        }}>
          {display ?? value ?? ''}
        </span>
        {hint ? <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-3)', marginTop: 3 }}>{hint}</span> : null}
      </span>
      <span style={{
        flexShrink: 0, fontSize: '0.86rem', fontWeight: 800,
        color: done ? 'var(--ok)' : disabled ? 'var(--text-4)' : 'var(--accent)',
      }}>
        {done ? '✓ 복사됨' : state === 'fail' ? '길게 눌러 복사' : '복사'}
      </span>
    </button>
  )
}

/** 이름 칸 + 복사 줄 다섯 — name/onName 은 부모가 들고 있습니다 (신청서와 같은 이름을 쓰게) */
export default function WarehouseAddress({ name, onName }) {
  const detail = name.trim() ? detailAddressFor(name) : ''
  const fullAddress = `${WAREHOUSE.address1}${WAREHOUSE.address2 ? ` ${WAREHOUSE.address2}` : ''}`
  return (
    <>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="field__label" htmlFor="myname">받는 분 성함</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="myname" className="input" value={name} placeholder={`예) ${SAMPLE_NAME}`}
            onChange={(e) => onName(e.target.value)}
            style={{ minHeight: 50, flex: 1, minWidth: 0 }} />
          {name ? (
            /* 지난번 이름이 남아 있으면 한 번에 지웁니다 — 남의 이름으로 보내지 않게 */
            <button type="button" onClick={() => onName('')} className="btn btn--ghost btn--sm"
              style={{ flexShrink: 0, minHeight: 50 }}>지우기</button>
          ) : null}
        </div>
      </div>

      <CopyRow label="받는 사람" value={WAREHOUSE.code} />
      <CopyRow label="우편번호" value={WAREHOUSE.zip} />
      <CopyRow label="주소" value={fullAddress} />
      <CopyRow label="상세주소 — 이름이 빠지면 소포 주인을 못 찾습니다" value={detail}
        disabled={!detail} danger
        display={detail ? (
          <>
            {WAREHOUSE.code} <span style={markStyle}>{name.trim()}</span>
          </>
        ) : (
          <>
            {WAREHOUSE.code} <span style={sampleStyle}>{SAMPLE_NAME}</span>
            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--warn)', marginTop: 6 }}>
              ↑ <span style={sampleStyle}>{SAMPLE_NAME}</span> 자리에 <b>본인 이름</b>을 넣어주세요 (위 칸에 적기)
            </span>
          </>
        )} />
      <CopyRow label="전화번호" value={WAREHOUSE.phone} />
    </>
  )
}
