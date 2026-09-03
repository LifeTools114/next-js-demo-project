/**
 * 쿠팡 문구·셀렉터 저장소 — 번들 기본값 + 서버 설정(원격 갱신)
 *
 * 쿠팡이 화면 문구를 바꾸면 자동입력이 멈춥니다. 확장을 고쳐 배포하면
 * 고객이 새로고침할 때까지 반나절이 걸리므로, 문구를 서버(config/coupang-patterns.js)
 * 에서 받아 **추가로** 시도합니다. 서버에서 한 줄 고치면 몇 분 안에 반영됩니다.
 *
 * 절대 규칙 — 서버 설정은 "더하기"만 합니다
 *   list(key) 는 [서버 문구…, 번들 문구] 순서로 돌려주고, 호출부는 하나라도
 *   맞으면 진행합니다. 서버 값이 엉터리여도 오늘 되던 동작은 그대로 됩니다.
 *   (덮어쓰기 구조였다면 서버 설정 실수 하나로 전 고객이 멈춥니다)
 *
 * 안전 검사 — 서버에서 온 정규식은 다음을 통과해야 채택됩니다
 *   ① 길이 300자 이하  ② RegExp 로 컴파일됨
 *   ③ 긴 문자열에 돌려도 즉시 끝남 (ReDoS 로 화면이 멎지 않도록)
 *   실패하면 조용히 버리고 번들 기본값만 씁니다.
 *
 * ⚠️ MV3 원격 코드 실행 금지 — 여기서 받는 것은 "문자열 값"이며,
 *    코드는 확장에 번들되어 있습니다. new Function/eval 은 쓰지 않습니다.
 */

globalThis.KBPatterns = (() => {
  /** 확장에 번들된 기본 문구 — 서버가 죽어도 이 값으로 동작합니다. */
  const BUNDLED = {
    text: {
      openAddr: { source: '배송지변경|배송지선택', maxLen: 12 },
      addAddr: { source: '배송지추가|신규배송지|새배송지', maxLen: 12 },
      zipSearch: { source: '우편번호찾기|우편번호검색|주소찾기|주소검색', maxLen: 16 },
      pick: { source: '^선택(하기)?$', maxLen: 8 },
      payButton: { source: '결제하기$', maxLen: 20 },
      zipSubmit: { source: '검색', maxLen: 10 },
    },
    fields: {
      name: 'input[name*="name" i], input[placeholder*="받는"], input[placeholder*="이름"]',
      phone: 'input[type="tel"], input[name*="phone" i], input[placeholder*="휴대폰"], input[placeholder*="전화"]',
      detail: 'input[name*="detail" i], input[name*="addr2" i], input[placeholder*="상세"]',
    },
    health: {
      checkoutMarks: { source: '결제하기|최종결제금액|주문결제', maxLen: 0 },
      checkoutRequire: ['openAddr', 'payButton'],
      addrFormRequire: ['zipSearch'],
    },
  }

  const MAX_SOURCE = 300
  const MAX_OPTIONAL = 8
  const MAX_ALTERNATIVES = 40

  /**
   * 서버 정규식 채택 검사 — 통과한 것만 씁니다.
   *
   * ReDoS(정규식 하나로 화면이 멎는 것)는 **무한 반복**(`*` `+` `{n,}`)에서
   * 생깁니다. 우리가 찾는 것은 "배송지 변경" 같은 **짧은 라벨**이라 무한
   * 반복이 애초에 필요 없으므로, 아예 금지해 위험을 원천 차단합니다.
   * (시간을 재서 거르는 방식은 재는 동안 이미 멎기 때문에 쓰지 않습니다)
   */
  function safeRegExp(source) {
    if (typeof source !== 'string' || source.length === 0 || source.length > MAX_SOURCE) return null
    // 무한 반복 금지 — 이스케이프된 \* \+ 도 함께 막힙니다(문구에 쓸 일이 없습니다).
    if (/[*+{}]/.test(source)) return null
    // 선택(?)은 안전하지만 겹치면 경우의 수가 커지므로 개수를 제한합니다.
    if ((source.match(/\?/g) ?? []).length > MAX_OPTIONAL) return null
    if ((source.match(/\|/g) ?? []).length > MAX_ALTERNATIVES) return null
    try { return new RegExp(source) } catch { return null }
  }

  /** CSS 셀렉터 유효성 — 잘못된 셀렉터는 querySelectorAll 에서 통째로 예외를 냅니다. */
  function safeSelector(sel) {
    if (typeof sel !== 'string' || sel.length === 0 || sel.length > 600) return null
    // 브라우저에서는 실제로 파싱시켜 봅니다. (노드 테스트에는 document 가 없어 괄호 짝만 봅니다)
    if (typeof document === 'undefined') {
      const bal = (a, b) => sel.split(a).length === sel.split(b).length
      const ok = /^[^{}<>]+$/.test(sel) && bal('[', ']') && bal('(', ')')
        && sel.split('"').length % 2 === 1 && sel.split("'").length % 2 === 1
      return ok ? sel : null
    }
    try { document.createDocumentFragment().querySelector(sel); return sel } catch { return null }
  }

  const compiled = { text: {}, fields: {}, health: {} }
  for (const [key, def] of Object.entries(BUNDLED.text)) {
    compiled.text[key] = { list: [new RegExp(def.source)], maxLen: def.maxLen }
  }
  for (const [key, sel] of Object.entries(BUNDLED.fields)) compiled.fields[key] = [sel]
  compiled.health = {
    checkoutMarks: [new RegExp(BUNDLED.health.checkoutMarks.source)],
    checkoutRequire: BUNDLED.health.checkoutRequire.slice(),
    addrFormRequire: BUNDLED.health.addrFormRequire.slice(),
  }

  /** 어디서 온 설정인지 — 진단·자가진단 보고에 함께 담습니다. */
  const meta = { version: 0, source: 'bundled', appliedAt: 0, rejected: [] }

  /**
   * 서버 설정 반영 (config.coupang). 여러 번 불러도 안전하며,
   * 같은 버전이면 다시 컴파일하지 않습니다.
   */
  function apply(remote) {
    if (!remote || typeof remote !== 'object') return meta
    const version = Number(remote.version) || 0
    if (version && version === meta.version && meta.source === 'server') return meta
    const rejected = []

    for (const [key, def] of Object.entries(remote.text ?? {})) {
      if (!compiled.text[key]) continue // 확장이 모르는 키는 무시 — 코드가 쓰지 않습니다
      const re = safeRegExp(def?.source)
      if (!re) { rejected.push(`text.${key}`); continue }
      const bundled = new RegExp(BUNDLED.text[key].source)
      // 서버 문구를 앞에, 번들 문구를 뒤에 — 둘 다 시도합니다.
      compiled.text[key].list = re.source === bundled.source ? [bundled] : [re, bundled]
      const maxLen = Number(def?.maxLen)
      compiled.text[key].maxLen = Number.isFinite(maxLen) && maxLen > 0
        ? Math.max(maxLen, BUNDLED.text[key].maxLen) : BUNDLED.text[key].maxLen
    }

    for (const [key, sel] of Object.entries(remote.fields ?? {})) {
      if (!compiled.fields[key]) continue
      const ok = safeSelector(sel)
      if (!ok) { rejected.push(`fields.${key}`); continue }
      const bundled = BUNDLED.fields[key]
      compiled.fields[key] = ok === bundled ? [bundled] : [ok, bundled]
    }

    const marks = safeRegExp(remote.health?.checkoutMarks?.source)
    if (marks) {
      const bundled = new RegExp(BUNDLED.health.checkoutMarks.source)
      compiled.health.checkoutMarks = marks.source === bundled.source ? [bundled] : [marks, bundled]
    }
    for (const k of ['checkoutRequire', 'addrFormRequire']) {
      const v = remote.health?.[k]
      if (Array.isArray(v) && v.every((x) => typeof x === 'string' && compiled.text[x])) {
        compiled.health[k] = v.slice(0, 8)
      }
    }

    meta.version = version
    meta.source = 'server'
    meta.appliedAt = Date.now()
    meta.rejected = rejected
    return meta
  }

  /** 이 키로 시도할 정규식 목록 (서버 → 번들 순) */
  const list = (key) => compiled.text[key]?.list ?? []
  /** 후보 요소의 최대 글자 수 */
  const maxLen = (key) => compiled.text[key]?.maxLen ?? 12
  /** 공백 제거한 문구가 하나라도 맞는가 */
  const test = (key, text) => list(key).some((re) => re.test(text))
  /** 입력칸 셀렉터 — 서버·번들을 한 줄로 합칩니다 (중복 제거) */
  const field = (key) => [...new Set(compiled.fields[key] ?? [])].join(', ')
  /** 결제 화면으로 보이는 본문인가 */
  const looksLikeCheckout = (text) => compiled.health.checkoutMarks.some((re) => re.test(text))
  const require = (kind) =>
    (kind === 'addrForm' ? compiled.health.addrFormRequire : compiled.health.checkoutRequire).slice()
  const info = () => ({ ...meta, rejected: meta.rejected.slice() })

  return { apply, list, maxLen, test, field, looksLikeCheckout, require, info, BUNDLED, safeRegExp, safeSelector }
})()
