/**
 * 화면에 내보낼 때 가리기 — 이름·전화번호.
 * 주문번호만 아는 사람(공개 조회)과 /my 요약에 씁니다.
 */
export const maskPhone = (p) => String(p ?? '').replace(/(\d{3})\d+(\d{4})$/, '$1****$2')

/** 「박승우」→「박**」, 「Nguyễn Thị Mai」→「N***」 — 첫 글자만 남깁니다 */
export const maskName = (name) => {
  const s = String(name ?? '').trim()
  if (!s) return ''
  return s[0] + '*'.repeat(Math.min(3, Math.max(1, s.length - 1)))
}
