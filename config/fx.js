/**
 * 환율 정책 (KRW → VND)
 *
 * 하노이 고객에게는 VND로 표시하고, 내부 계산은 전부 KRW로 수행합니다.
 * (쿠팡 가격이 KRW이고 배송 요율도 KRW이므로 반올림 오차를 줄이기 위함)
 */

/** Node(백엔드)와 브라우저(확장) 양쪽에서 안전하게 환경변수를 읽습니다. */
const env = (key) =>
  (typeof process !== 'undefined' && process?.env ? process.env[key] : undefined)

const parseRate = (value, fallback) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const FX = {
  /** 1 KRW = ? VND — 환경변수로 덮어쓸 수 있습니다. */
  krwToVnd: parseRate(env('NEXT_PUBLIC_KRW_TO_VND'), 18.5),

  /**
   * 1 USD = ? KRW — 배송 요율이 USD 기준이라 필요합니다.
   * 상품가는 KRW, 운임은 USD, 고객 결제는 VND 라 통화가 셋입니다.
   * 내부 계산은 전부 KRW 로 통일하고 표시할 때만 환산합니다.
   */
  usdToKrw: parseRate(env('NEXT_PUBLIC_USD_TO_KRW'), 1380),

  /** 환전 스프레드 (고객 표시가에 반영되는 마진) */
  spread: parseRate(env('NEXT_PUBLIC_FX_SPREAD'), 0.015),

  /** VND 표시 반올림 단위 */
  vndRoundTo: 1000,

  /** 환율 기준일 표기용 */
  updatedAt: env('NEXT_PUBLIC_FX_UPDATED_AT') || null,
}
