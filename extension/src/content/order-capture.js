/**
 * 쿠팡 주문완료 자동 수집 (운영자 모드 전용)
 *
 * 운영자가 구매대행 발주를 쿠팡에서 결제하면, 주문완료 화면에서
 * 주문번호·결제액을 읽어 백엔드로 보냅니다. 매입 중 주문이 하나뿐이면
 * 서버가 매입 완료까지 자동 기록합니다 — 운영자는 결제 클릭만 합니다.
 *
 * 일반 고객에게는 아무 일도 하지 않습니다(토큰이 없으면 즉시 종료).
 * 추출 실패는 조용히 넘어갑니다 — 팝업의 수동 기록 폼이 보장 경로입니다.
 * 셀렉터는 /api/extension/config 의 selectors.orderNo / orderTotal 로
 * 재배포 없이 갱신할 수 있습니다.
 */
;(() => {
  const send = (type, payload) =>
    new Promise((resolve) => chrome.runtime.sendMessage({ type, payload }, (r) => resolve(r ?? { ok: false })))

  /** 주문완료 화면으로 보이는가 — URL 또는 본문 문구 */
  function looksLikeOrderComplete() {
    const text = (document.body?.innerText ?? '').slice(0, 6000)
    // 주문/결제 화면에도 브레드크럼 "주문결제 > 주문완료" 가 있으므로,
    // 결제 버튼이 살아 있는 화면은 완료로 보지 않습니다.
    if (/최종\s*결제\s*금액/.test(text) && /결제하기/.test(text)) return false
    if (/order.*(complete|done|success)|orderResult|thankyou/i.test(location.href)) return true
    return /주문이\s*완료|결제가\s*완료|구매가\s*완료/.test(text)
  }

  function bySelectors(selectors) {
    for (const sel of selectors ?? []) {
      try {
        const el = document.querySelector(sel)
        if (el?.textContent?.trim()) return el.textContent.trim()
      } catch { /* 잘못된 셀렉터는 건너뜀 */ }
    }
    return null
  }

  function extract(config) {
    const text = document.body?.innerText ?? ''
    const noRaw =
      bySelectors(config?.selectors?.orderNo) ??
      text.match(/주문\s*번호[^\d]{0,10}(\d{9,20})/)?.[1] ??
      new URLSearchParams(location.search).get('orderId')
    const amtRaw =
      bySelectors(config?.selectors?.orderTotal) ??
      text.match(/(?:총\s*결제\s*금액|결제\s*금액|총\s*주문\s*금액)[^\d]{0,20}([\d,]{4,})\s*원/)?.[1]

    const coupangOrderNo = String(noRaw ?? '').replace(/\D/g, '')
    const amountKrw = Number(String(amtRaw ?? '').replace(/[^\d]/g, ''))
    return { coupangOrderNo, amountKrw }
  }

  function toast(text, ok) {
    const el = document.createElement('div')
    el.textContent = text
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:10px;' +
      `font:600 13px/1.4 sans-serif;color:#fff;background:${ok ? '#17916b' : '#b3801d'};box-shadow:0 4px 14px rgba(0,0,0,.2)`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 6000)
  }

  /**
   * 고객 흐름 — 쿠팡 결제가 먼저입니다.
   * 주문완료 트랜잭션(주문번호)을 받아 [하노이 배송 신청] 버튼을 띄우고,
   * 누르면 견적함의 배송대행 상품 + 쿠팡 주문번호를 들고 배송비 결제
   * (체크아웃)로 넘어갑니다. 자동으로 열지 않습니다 — 사용자 클릭만.
   */
  function offerForwarding(coupangOrderNo) {
    const guard = `kb-offered-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* 안내가 두 번 떠도 해는 없습니다 */ }

    const card = document.createElement('div')
    card.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #f3d3dd;' +
      'border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:14px;width:260px;font:13px/1.5 sans-serif;color:#3d3644'
    card.innerHTML =
      '<b>🇻🇳 방금 결제하신 주문,<br>하노이로 받아보세요</b>' +
      '<div style="font-size:11.5px;color:#766b80;margin-top:4px">쿠팡 주문이 자동 연결되고, 국제배송비 청구서로 이어집니다.</div>' +
      '<button id="kb-fwd-go" style="margin-top:10px;width:100%;min-height:38px;border:0;border-radius:9px;' +
      'background:#ef4a76;color:#fff;font-weight:700;cursor:pointer">하노이 배송 신청</button>' +
      '<button id="kb-fwd-x" style="margin-top:6px;width:100%;min-height:30px;border:0;border-radius:9px;' +
      'background:transparent;color:#9a8fa5;cursor:pointer">닫기</button>'
    document.body.appendChild(card)
    card.querySelector('#kb-fwd-x').addEventListener('click', () => card.remove())
    card.querySelector('#kb-fwd-go').addEventListener('click', async () => {
      const res = await send('openCheckout', { coupangOrderNo })
      if (res?.ok) card.remove()
      else toast(res?.error ?? '견적함을 확인해 주세요.', false)
    })
  }

  /**
   * 결제와 동시에 배송요청 — 완료 화면을 감지하면 견적함의 배송대행
   * 상품 + 방금 쿠팡 주문번호로 배송비 결제(체크아웃)를 자동으로 엽니다.
   * 견적함이 비어 있으면 자동으로 열 수 없으므로 안내 카드로 대신합니다.
   */
  async function autoForward(coupangOrderNo) {
    const guard = `kb-fwd-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* 가드 불가 환경이면 카드 중복 정도만 감수합니다 */ }

    const res = await send('openCheckout', { coupangOrderNo })
    if (res?.ok) {
      toast('🇻🇳 하노이 배송 신청서를 새 탭에 열었습니다 — 수령인 정보만 입력하면 끝!', true)
    } else {
      offerForwarding(coupangOrderNo)
    }
  }

  async function runOrderComplete() {
    const cfg = await send('getConfig')
    const { coupangOrderNo, amountKrw } = extract(cfg?.config ?? {})
    if (!coupangOrderNo || coupangOrderNo.length < 9) return

    const st = await send('getAdminState')

    // ── 고객: 결제 감지 → 배송요청 자동 (운영자 토큰이 없는 브라우저) ──
    if (!st?.hasToken) {
      await autoForward(coupangOrderNo)
      return
    }

    // ── 운영자: 구매대행 매입 자동 기록 ──
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) return
    // 같은 주문번호를 이 탭에서 두 번 보내지 않습니다 (새로고침 대비).
    const guard = `kb-captured-${coupangOrderNo}`
    try {
      if (sessionStorage.getItem(guard)) return
      sessionStorage.setItem(guard, '1')
    } catch { /* sessionStorage 불가 환경이면 서버 쪽 상태가 중복을 막습니다 */ }

    const res = await send('captureCoupangOrder', { coupangOrderNo, amountKrw })
    if (res?.ok && res.data?.matched) {
      toast(`✓ 매입 기록됨 — ${res.data.order.orderNo} (쿠팡 ${coupangOrderNo})`, true)
    } else if (res?.ok) {
      toast('매입 자동 기록 보류 — 확장 팝업의 발주 목록에서 직접 기록하세요.', false)
    }
  }

  /**
   * ── 주문/결제 화면 도우미 ──
   * 결제 순간에도 "하노이 배송이 붙어 있다"가 보여야 고객이 안심하고
   * 결제합니다. 배송지가 창고 주소 + K-ECOM 코드인지 자동 검사하고,
   * 아니면 복사 버튼으로 바로 붙여넣게 합니다.
   */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const squash = (s) => String(s ?? '').replace(/\s+/g, '')

  async function renderCheckoutHelper() {
    try { if (sessionStorage.getItem('kb-helper-closed')) return } catch { /* 무시 */ }

    const cfg = await send('getConfig')
    const w = cfg?.config?.warehouse ?? {}
    const addr1 = w.address1 || '서울특별시 강서구 개화동로 11길 5'
    const zip = w.zip || '07504'
    const code = w.code || 'K-ECOM'

    const body = squash(document.body?.innerText ?? '')
    const okAddr = body.includes(squash(addr1)) || body.includes(squash('개화동로11길 5'))
    const okCode = body.includes(code)
    const cartRes = await send('getCart')
    const fwdCount = (cartRes?.cart ?? []).filter((i) => i.track !== 'agent').length

    let card = document.getElementById('kb-checkout-helper')
    if (!card) {
      card = document.createElement('div')
      card.id = 'kb-checkout-helper'
      card.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:280px;background:#fff;' +
        'border:1px solid #f3d3dd;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);' +
        'padding:13px;font:12.5px/1.55 sans-serif;color:#3d3644'
      document.body.appendChild(card)
    }

    const copyBtn = (label, value, id) =>
      `<button data-copy="${esc(value)}" id="${id}" style="margin-top:5px;width:100%;min-height:30px;border:1px solid #eee3ee;` +
      `border-radius:8px;background:#faf7fb;color:#574d61;cursor:pointer;text-align:left;padding:0 10px;font-size:12px">` +
      `📋 ${label} 복사</button>`

    const status = okAddr && okCode
      ? '<div style="margin-top:7px;padding:8px 10px;border-radius:9px;background:#e6f6f0;color:#17916b">' +
        '<b>✓ 배송지 확인됨</b> — 한국 창고 + K-ECOM 코드.<br>안심하고 결제하세요.</div>'
      : '<div style="margin-top:7px;padding:8px 10px;border-radius:9px;background:#fff3e6;color:#a05a12">' +
        '<b>⚠️ 배송지를 확인하세요</b><br>[배송지 변경]에서 아래 값을 붙여넣으세요.<br>' +
        '이 주소가 아니면 하노이로 배송되지 않습니다.</div>'

    card.innerHTML =
      '<b>🇻🇳 하노이 배송</b>' + status +
      copyBtn('창고 주소', `${addr1}`, 'kb-cp-addr') +
      copyBtn(`세부주소 ${code}(이름)`, `${code}()`, 'kb-cp-code') +
      copyBtn('우편번호', zip, 'kb-cp-zip') +
      '<div style="margin-top:6px;color:#9a8fa5;font-size:11px">세부주소는 붙여넣은 뒤 괄호 안에 본인 이름을 넣어주세요.</div>' +
      `<div style="margin-top:8px;color:#766b80;font-size:11.5px">${
        fwdCount > 0
          ? `견적함 ${fwdCount}개 — 결제하면 배송 신청서가 자동으로 열립니다.`
          : '결제 후 자동 신청까지 하려면 상품 페이지에서 [견적함에 담기]를 먼저 해주세요.'
      }</div>` +
      '<button id="kb-helper-x" style="margin-top:8px;width:100%;min-height:28px;border:0;border-radius:8px;' +
      'background:#faf7fb;color:#9a8fa5;cursor:pointer">닫기</button>'

    card.querySelectorAll('button[data-copy]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy)
          const orig = b.textContent
          b.textContent = '✓ 복사됨'
          setTimeout(() => { b.textContent = orig }, 1200)
        } catch { /* 클립보드 권한 없으면 값이 보이니 수동 복사 가능 */ }
      }),
    )
    card.querySelector('#kb-helper-x').addEventListener('click', () => {
      card.remove()
      try { sessionStorage.setItem('kb-helper-closed', '1') } catch { /* 무시 */ }
    })
  }

  async function run() {
    if (looksLikeOrderComplete()) return runOrderComplete()
    if (location.host === 'checkout.coupang.com') return renderCheckoutHelper()
  }

  // 결제·완료 화면이 SPA 전환으로 나타나는 경우까지 몇 초 재시도합니다.
  let tries = 0
  const timer = setInterval(() => {
    tries += 1
    run()
    if (tries >= 8) clearInterval(timer)
  }, 1500)
  run()
})()
