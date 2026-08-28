/** 표시 포맷 유틸 (클라이언트/서버 공용 — 서버 전용 모듈을 import 하지 않습니다) */

import { FX } from '../config/fx.js'

export const krw = (n) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`

export const vnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('en-US')}₫`

/** KRW → VND (환전 스프레드 포함, 1,000동 단위 반올림) */
export const toVnd = (krwAmount) => {
  const raw = (Number(krwAmount) || 0) * FX.krwToVnd * (1 + FX.spread)
  return Math.round(raw / FX.vndRoundTo) * FX.vndRoundTo
}

/** g 단위를 사람이 읽기 좋게 (1kg 미만은 g, 이상은 kg) */
export const weight = (grams) => {
  const g = Number(grams) || 0
  return g >= 1000 ? `${(g / 1000).toFixed(2)}kg` : `${Math.round(g)}g`
}

export const kg = (kilos) => `${(Number(kilos) || 0).toFixed(1)}kg`

export const CONFIDENCE_TAG = {
  high: { label: '무게 정확', className: 'tag tag--ok' },
  medium: { label: '무게 추정', className: 'tag tag--weight' },
  low: { label: '무게 불확실', className: 'tag tag--warn' },
}

export const formatDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
