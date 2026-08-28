/**
 * 쿠팡 파트너스 제휴 정책
 *
 * ⚠️ 중요 — 제휴 수수료는 "배송대행" 트랙에서만 발생합니다.
 *
 *   배송대행: 고객이 직접 쿠팡에서 결제 → 우리 제휴 링크 경유 → 수수료 발생 ✅
 *   구매대행: 우리가 대신 결제 → 파트너스는 본인 구매에 수수료를 지급하지 않음 ❌
 *
 * 구매대행 주문에 제휴 링크를 붙이는 것은 수수료도 못 받으면서
 * 자기 구매(self-referral)로 계정 제재 사유가 될 수 있으므로 붙이지 않습니다.
 */

/** Node 와 브라우저 양쪽에서 안전하게 환경변수를 읽습니다. */
const env = (key) =>
  (typeof process !== 'undefined' && process?.env ? process.env[key] : undefined)

export const AFFILIATE = {
  /** 트랙별 제휴 링크 적용 여부 */
  applyTo: {
    forwarding: true, // 배송대행 — 고객이 직접 구매
    agent: false, // 구매대행 — 본인 구매라 수수료 미지급
  },

  /**
   * 쿠팡 파트너스 채널 아이디.
   * 모든 제휴 링크에 이 값이 subId 로 들어가야 수수료가 계정에 귀속됩니다.
   * 비밀값이 아니므로(링크에 그대로 노출됨) 코드에 두고, 환경변수로 덮어쓸 수 있게 합니다.
   */
  defaultSubId: env('COUPANG_SUB_ID') || 'acma2000',

  /**
   * 카테고리별 대략적인 수수료율 — 예상 수익 표시용이며 실제 정산과 다를 수 있습니다.
   * 파트너스 수수료는 최대 3% 수준입니다.
   */
  estimatedRate: { beauty: 0.03, fashion: 0.03, food: 0.02, living: 0.02, electronics: 0.01, default: 0.02 },

  /** 클릭 후 구매 인정 기간 (시간) */
  cookieWindowHours: 24,

  /**
   * 크롬 웹스토어 정책 대응.
   *
   * 정책이 금지하는 것은 "제휴 링크" 자체가 아니라
   *   (1) 사용자에게 실질 이익 없이
   *   (2) 고지 없이
   *   (3) 사용자 행동 없이 (백그라운드 URL 치환)
   * 삽입하는 행위입니다.
   *
   * 따라서 다음 세 가지를 반드시 지킵니다.
   *   - 페이지 로드 시 URL 을 몰래 바꾸지 않는다 (버튼 클릭 시에만 제휴 링크로 이동)
   *   - 링크 옆에 고지 문구를 항상 표시한다
   *   - 스토어 설명과 개인정보처리방침에도 명시한다
   */
  compliance: {
    neverRewriteUrlsSilently: true,
    requireUserAction: true,
    disclosure:
      '이 버튼은 쿠팡 파트너스 제휴 링크로 연결됩니다. 이를 통해 구매하시면 저희가 일정액의 수수료를 받으며, 고객님이 지불하시는 금액은 동일합니다.',
    disclosureShort: '제휴 링크 · 구매가는 동일합니다',
  },
}

/** 이 트랙에 제휴 링크를 붙여도 되는가 */
export const canUseAffiliate = (track) => AFFILIATE.applyTo[track] === true
