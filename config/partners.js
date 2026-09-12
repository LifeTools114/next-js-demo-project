/**
 * 「쿠팡으로 가기」 버튼의 주소 — 폰 화면 전용 (운영자 26-09-12: "쿠팡 사이트로 이동하기 버튼을 간단하게, 쿠팡 수수료도 받을 수 있게").
 *
 * 서버 .env.local 에 COUPANG_PARTNERS_LINK (쿠팡 파트너스 사이트에서 만든 https://link.coupang.com/… 링크)가 있으면
 * 그 링크를, 없으면 보통 쿠팡 주소를 씁니다. 파트너스 링크가 있는 화면에는 아래 고지를 반드시 함께 보입니다 (공정위 표시 의무).
 *
 * ⚠️ 쓰지 않는 곳
 *   · 구매대행 발주(운영자가 직접 사는 것) — 파트너스 약관상 본인 구매는 수수료 대상이 아니며 제재 사유입니다.
 *   · 확장(스토어 배포본)과 PC 너비 화면 — 데스크탑 쪽에는 제휴 코드도, 남의 상호도 넣지 않습니다.
 *   · 값은 서버 환경변수에서만 읽습니다. 링크 자체는 비밀이 아니지만 저장소에는 넣지 않습니다.
 */
export const SHOP_HOME = 'https://www.coupang.com/'
export const PARTNERS_NOTICE = '이 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'

/** 버튼 주소 — { href, isPartner }. 파트너스 링크는 쿠팡 도메인의 https 주소일 때만 인정합니다 */
export function shopLink(env = process.env) {
  const v = String(env.COUPANG_PARTNERS_LINK ?? '').trim()
  const isPartner = /^https:\/\/(link\.coupang\.com|www\.coupang\.com)\/\S+$/.test(v)
  return { href: isPartner ? v.slice(0, 300) : SHOP_HOME, isPartner }
}
