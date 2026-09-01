/**
 * 고객 문의 채널
 *
 * 카카오톡으로 받습니다 (운영자 지시 26-09-01).
 * 견적서·사이트 하단에서 모두 이 한 곳을 참조하므로, 채널이 바뀌면
 * 여기만 고치면 됩니다. env 로도 교체 가능합니다.
 *
 * 오픈채팅 주소는 비워둘 수 있습니다 — 그러면 견적서·사이트에서 오픈채팅
 * 줄과 QR 이 함께 사라지고 카카오톡 ID 안내만 남습니다. 새 방을 열면
 * 주소를 넣고 QR(public/kakao-openchat-qr.png)만 그 주소로 다시 만드세요.
 */
/** 공백만 넣어 비활성화할 수 있게 — 값이 비면 그 줄은 화면에서 사라집니다. */
const env = (key, fallback) => (process.env[key] ?? fallback ?? '').trim()

export const CONTACT = {
  /** 카카오톡 아이디로 검색해 1:1 문의도 가능합니다 */
  kakaoId: env('KAKAO_ID', 'vietnam911'),
  kakaoOpenChat: env('KAKAO_OPEN_CHAT', 'https://open.kakao.com/o/sbjQwALi'),
  label: '카카오톡',
  /**
   * 인쇄된 견적서에서는 링크를 누를 수 없는 경우가 있어 QR 이미지를 함께
   * 싣습니다. public/ 에 파일을 넣으면 자동으로 표시됩니다. (없으면 생략)
   */
  qrPath: env('KAKAO_QR_PATH', '/kakao-openchat-qr.png'),
}
