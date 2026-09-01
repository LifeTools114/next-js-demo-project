/**
 * 고객 문의 채널
 *
 * 카카오톡 오픈채팅 하나로 받습니다 (운영자 지시 26-09-01).
 * 견적서·사이트 하단·주문 상세에서 모두 이 한 곳을 참조하므로,
 * 채널이 바뀌면 여기만 고치면 됩니다. env 로도 교체 가능합니다.
 */
export const CONTACT = {
  kakaoOpenChat: process.env.KAKAO_OPEN_CHAT || 'https://open.kakao.com/o/sbjQwALi',
  label: '카카오톡 오픈채팅',
  /**
   * 인쇄된 견적서에서는 링크를 누를 수 없는 경우가 있어 QR 이미지를 함께
   * 싣습니다. public/ 에 파일을 넣으면 자동으로 표시됩니다. (없으면 생략)
   */
  qrPath: process.env.KAKAO_QR_PATH || '/kakao-openchat-qr.png',
}
