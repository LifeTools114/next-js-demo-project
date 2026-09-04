/**
 * 눌러서 복사 — 어디서든 되게, 안 되면 안 된다고 알려주게.
 *
 * navigator.clipboard 는 **HTTPS(또는 localhost)에서만** 동작합니다.
 * 사장님 PC 주소(http://192.168.x.x:3000)로 폰에서 접속하면 이 값이 아예
 * 없어서, 예전 코드는 조용히 아무 일도 하지 않았습니다 — 고객 눈에는
 * "버튼이 고장난 것"으로 보입니다. 계좌번호를 못 옮기면 결제가 멈춥니다.
 *
 * 그래서 세 단계로 시도합니다.
 *   ① navigator.clipboard (HTTPS 정상 경로)
 *   ② 숨긴 textarea + execCommand('copy') (구형·HTTP 폴백)
 *   ③ 둘 다 실패 → false 를 돌려주어, 화면이 "직접 길게 눌러 복사해 주세요"를
 *      띄울 수 있게 합니다. 조용히 실패하지 않는 것이 핵심입니다.
 *
 * @returns {Promise<boolean>} 복사됐으면 true
 */
export async function copyText(value) {
  const text = String(value ?? '')
  if (!text) return false

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 권한 거부·비보안 컨텍스트 — 아래 폴백으로 */ }

  try {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = text
    // 화면 밖으로 밀지 않고 투명하게 둡니다 — iOS 는 화면 밖 요소를 선택하지 못합니다.
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length) // iOS 는 이것까지 해야 선택됩니다
    const ok = document.execCommand('copy')
    ta.remove()
    return Boolean(ok)
  } catch {
    return false
  }
}
