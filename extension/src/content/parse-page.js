/**
 * 결제창·장바구니 본문 텍스트 → 상품 목록 파서 (순수 함수)
 *
 * order-capture.js 의 IIFE 안에 있으면 테스트할 수 없어서 분리했습니다.
 * DOM 을 만지지 않고 텍스트만 받으므로 노드 테스트가 실제 배포 코드를
 * 그대로 검증합니다 (test/page-parse.test.js).
 *
 * 반환 항목: { productName, quantity, productPrice }
 *   - productPrice 는 단가입니다. 화면 합계는 첫 항목 수량으로 나눠 단가화
 *     합니다 (견적 엔진이 단가 × 수량으로 합산하므로).
 *   - 옵션 줄("옵션: 100ml, 3개")은 무게 추정에 필요해 상품명에 붙입니다.
 */
;(() => {
  const NOT_A_NAME = /배송지|요청사항|결제|금액|쿠팡캐시|할인|수량|삭제|선택|쿠폰|무료배송|도착|장바구니|주문/

  function extractItemsFromText(text) {
    const items = []

    // 형식 1 (결제창): "상품명 \n 수량 N개"
    const re = /([^\n]{6,120})\n\s*수량\s*(\d+)\s*개/g
    let m
    while ((m = re.exec(text)) && items.length < 20) {
      let name = m[1].trim()
      // "옵션: 100ml, 3개" 줄이 수량 바로 앞이면 진짜 상품명은 그 앞 줄 —
      // 옵션의 용량·개수는 무게 추정에 필요하므로 이름 뒤에 붙입니다.
      if (/^옵션\s*[:：]/.test(name)) {
        const prev = text.slice(0, m.index).split('\n').map((l) => l.trim()).filter(Boolean).pop()
        if (prev && prev.length >= 6 && !NOT_A_NAME.test(prev) && !/^[\d,]+원?$/.test(prev)) {
          name = `${prev} (${name.replace(/^옵션\s*[:：]\s*/, '')})`
        }
      }
      if (NOT_A_NAME.test(name)) continue
      items.push({ productName: name.slice(0, 160), quantity: Number(m[2]) || 1, productPrice: 0 })
    }

    // 형식 2 (장바구니): "수량" 라벨과 숫자가 줄로 분리 — 가장 가까운 앞줄을 상품명으로
    if (items.length === 0) {
      const lines = text.split('\n').map((l) => l.trim())
      for (let i = 0; i < lines.length && items.length < 20; i++) {
        const qm = lines[i].match(/^수량\s*(\d*)$/)
        if (!qm) continue
        const qty = Number(qm[1] || lines[i + 1]?.match(/^(\d{1,3})$/)?.[1] || 1)
        for (let back = i - 1; back >= Math.max(0, i - 5); back--) {
          const cand = lines[back]
          if (cand.length >= 6 && cand.length <= 120 && !NOT_A_NAME.test(cand) &&
              !/^[\d,]+원?$/.test(cand) && !/^옵션/.test(cand)) {
            items.push({ productName: cand.slice(0, 160), quantity: qty || 1, productPrice: 0 })
            break
          }
        }
      }
    }

    // 두 형식 공통: 상품명 다음 몇 줄 안의 "옵션:" 줄을 이름에 붙입니다.
    // 용량·개수(예: 100ml, 3개)가 옵션 줄에만 있으면 무게 추정이 빗나갑니다.
    if (items.length > 0) {
      const all = text.split('\n').map((l) => l.trim())
      for (const it of items) {
        const at = all.findIndex((l) => l.startsWith(it.productName.slice(0, 40)))
        if (at < 0) continue
        const opt = all.slice(at + 1, at + 4).find((l) => /^옵션\s*[:：]/.test(l))
        if (!opt) continue
        const optText = opt.replace(/^옵션\s*[:：]\s*/, '')
        if (!it.productName.includes(optText)) {
          it.productName = `${it.productName} (${optText})`.slice(0, 160)
        }
      }
    }

    // 합계 — 결제창·장바구니 표기 모두 시도.
    // "총 상품 가격"은 즉시할인 전 금액이라, 실제 낼 "총 결제 금액"이
    // 더 낮으면 그쪽을 씁니다 (할인 반영 — 구매대행 매입가 기준).
    // 결제 금액이 더 높은 경우는 국내 배송비가 붙은 것이므로 상품가 쪽을 유지합니다.
    const asNum = (regex) => Number((text.match(regex)?.[1] ?? '').replace(/,/g, ''))
    const goodsKrw = asNum(/(?:총\s*상품\s*(?:가격|금액)|상품\s*금액)\s*:?\s*([\d,]+)\s*원/)
    const paidKrw = asNum(/(?:최종|총)\s*결제\s*금액\s*:?\s*([\d,]+)\s*원/)

    /**
     * 계정 전용 쿠폰(와우 가입 쿠폰 등)은 이 고객 계정에서만 깎입니다 —
     * 대리 구매자는 쓸 수 없으므로 구매대행 기준가에 반영하면 그 가격으로
     * 살 수 없는 견적이 나갑니다. 쿠폰 할인 줄(-30,000원 등)을 합산해
     * 결제 금액에 되돌립니다. (즉시할인·와우회원가는 누구에게나 같으므로 유지)
     */
    // 사이드바에서 "쿠\n폰할인"처럼 단어가 줄바꿈으로 쪼개지므로,
    // 공백을 전부 지운 텍스트에서 '쿠폰 … -금액원' 패턴을 찾습니다.
    let couponKrw = 0
    const flat = text.replace(/\s+/g, '')
    const couponRe = /쿠폰[^\d-]{0,12}-([\d,]{3,})원/g
    let cm
    while ((cm = couponRe.exec(flat))) couponKrw += Number(cm[1].replace(/,/g, ''))
    const basisKrw = paidKrw > 0 ? paidKrw + couponKrw : 0
    const totalKrw = basisKrw > 0 && (!(goodsKrw > 0) || basisKrw < goodsKrw) ? basisKrw : goodsKrw

    if (items.length === 0 || !Number.isFinite(totalKrw) || totalKrw <= 0) return []
    // 개별 단가는 화면에 없을 수 있어 합계를 첫 항목에 둡니다.
    // 견적 엔진은 단가×수량으로 합산하므로 첫 항목 수량으로 나눠 단가로 만듭니다.
    items[0].productPrice = Math.round(totalKrw / (items[0].quantity || 1))
    return items
  }

  globalThis.KBPageParse = { NOT_A_NAME, extractItemsFromText }
})()
