/**
 * 쿠팡 화면 문구·셀렉터 — 재배포 없이 고칠 수 있는 "대응 설정"
 *
 * 왜 여기 있나
 *   확장은 쿠팡 화면에서 [배송지 변경] 같은 **문구**를 보고 버튼을 찾습니다.
 *   쿠팡이 문구를 바꾸면(예: "배송지 변경" → "받는 곳 변경") 자동입력이
 *   멈추는데, 확장을 고쳐 배포하면 고객이 확장을 새로고침할 때까지
 *   하루가 걸립니다. 이 파일은 서버에서 내려보내는 값이라,
 *   **여기 한 줄 고치고 서버만 올리면 몇 분 안에 전 고객에게 반영**됩니다.
 *
 * 안전 규칙 (확장 쪽 patterns.js 에서 강제)
 *   1. 서버 문구는 **추가**만 됩니다 — 확장에 번들된 기본 문구는 그대로
 *      남아 함께 시도합니다. 서버 설정이 잘못돼도 오늘 되던 건 계속 됩니다.
 *   2. 서버가 죽어 있으면 번들 기본값으로 동작합니다.
 *   3. 코드가 아니라 값만 내려갑니다 (MV3 원격 코드 실행 금지 준수).
 *      정규식은 문자열로 내려가고 확장이 RegExp 로 컴파일하며,
 *      길이·컴파일·속도(ReDoS) 검사를 통과하지 못하면 무시합니다.
 *
 * 고치는 법 (운영자)
 *   ① 고객이 [🩺 진단 정보 복사]로 보낸 내용에서 실제 문구를 확인
 *   ② 아래 해당 항목의 `|` 뒤에 새 문구를 띄어쓰기 없이 추가
 *   ③ `version` 을 1 올리고 서버 재시작 → 확장은 6시간 캐시가 만료되기 전에도
 *      다음 결제 화면에서 새 설정을 받아옵니다 (확장 🔄 하면 즉시).
 *
 * ⚠️ 문구는 **공백을 지운 상태**로 비교합니다. "배송지 변경" → `배송지변경`.
 */

export const COUPANG_PATTERNS = {
  /** 값이 바뀔 때마다 1씩 올립니다 — 확장·관리자 화면이 이 번호로 반영 여부를 확인합니다. */
  version: 1,
  updatedAt: '2026-09-03',

  /**
   * 클릭 대상을 찾는 문구 (정규식 source). maxLen 은 "이 길이 이하의 요소만
   * 후보로 본다"는 뜻입니다 — 문구가 든 큰 컨테이너를 잘못 누르지 않게 합니다.
   */
  text: {
    /** 배송지 목록 창 열기 */
    openAddr: { source: '배송지변경|배송지선택|배송지수정', maxLen: 12 },
    /** 목록에서 새 주소 입력폼 열기 */
    addAddr: { source: '배송지추가|신규배송지|새배송지|주소추가', maxLen: 12 },
    /** 우편번호(다음 주소) 검색창 열기 */
    zipSearch: { source: '우편번호찾기|우편번호검색|주소찾기|주소검색', maxLen: 16 },
    /** 주소록 행의 [선택] */
    pick: { source: '^선택(하기)?$', maxLen: 8 },
    /** 결제 전 경고를 걸 [결제하기] */
    payButton: { source: '결제하기$', maxLen: 20 },
    /** 다음 우편번호 프레임의 검색 실행 버튼 */
    zipSubmit: { source: '검색', maxLen: 10 },
  },

  /** 배송지 입력폼의 칸 — CSS 셀렉터 (쉼표로 여러 개) */
  fields: {
    name: 'input[name*="name" i], input[placeholder*="받는"], input[placeholder*="이름"]',
    phone: 'input[type="tel"], input[name*="phone" i], input[placeholder*="휴대폰"], input[placeholder*="전화"]',
    detail: 'input[name*="detail" i], input[name*="addr2" i], input[placeholder*="상세"]',
  },

  /**
   * 자가진단 — 이 문구가 보이면 "결제 화면"으로 보고, 그때 필요한 앵커가
   * 하나도 안 잡히면 화면 구조가 바뀐 것으로 판단해 운영자에게 알립니다.
   * (개인정보는 보내지 않습니다 — 어떤 앵커가 몇 개 잡혔는지만)
   */
  health: {
    /** 이 문구들이 본문에 있어야 결제 화면으로 간주 */
    checkoutMarks: { source: '결제하기|최종결제금액|주문결제', maxLen: 0 },
    /** 결제 화면에서 최소한 하나는 잡혀야 하는 문구 키 */
    checkoutRequire: ['openAddr', 'payButton'],
    /** 배송지 입력폼에서 최소한 하나는 잡혀야 하는 문구 키 */
    addrFormRequire: ['zipSearch'],
  },
}

/** API 로 내보낼 형태 — 확장이 그대로 쓰는 값만 담습니다. */
export function coupangPatternPayload() {
  return {
    version: COUPANG_PATTERNS.version,
    updatedAt: COUPANG_PATTERNS.updatedAt,
    text: COUPANG_PATTERNS.text,
    fields: COUPANG_PATTERNS.fields,
    health: COUPANG_PATTERNS.health,
  }
}
