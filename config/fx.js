/**
 * 환율 정책 (KRW → VND)
 *
 * 하노이 고객에게는 VND로 표시하고, 내부 계산은 전부 KRW로 수행합니다.
 * (쿠팡 가격이 KRW이고 배송 요율도 KRW이므로 반올림 오차를 줄이기 위함)
 */

const parseRate = (value, fallback) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const FX = {
  /** 1 KRW = ? VND — 환경변수로 덮어쓸 수 있습니다. */
  krwToVnd: parseRate(process.env.NEXT_PUBLIC_KRW_TO_VND, 18.5),

  /** 환전 스프레드 (고객 표시가에 반영되는 마진) */
  spread: parseRate(process.env.NEXT_PUBLIC_FX_SPREAD, 0.015),

  /** VND 표시 반올림 단위 */
  vndRoundTo: 1000,

  /** 환율 기준일 표기용 */
  updatedAt: process.env.NEXT_PUBLIC_FX_UPDATED_AT || null,
}
