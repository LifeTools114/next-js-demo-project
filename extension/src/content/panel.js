/**
 * 쿠팡 페이지에 띄우는 견적 패널
 *
 * Shadow DOM 을 쓰는 이유: 쿠팡의 CSS 가 우리 패널을 깨뜨리거나
 * 우리 CSS 가 쿠팡 페이지를 망가뜨리는 것을 양방향으로 막습니다.
 * 남의 사이트에 UI 를 얹는 이상 이건 선택이 아니라 필수입니다.
 */

const KBPanel = (() => {
  const HOST_ID = 'kb-hanoi-panel-host'

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
.wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 340px; max-width: calc(100vw - 32px); }
.fab { width: 56px; height: 56px; border-radius: 50%; border: 0; margin-left: auto; display: flex;
  align-items: center; justify-content: center; font-size: 24px; cursor: pointer;
  background: #3182f6; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.22); }
.fab[data-state="blocked"] { background: #c53030; }
.fab[data-state="error"] { background: #4e5968; }
.card { background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(27,18,32,.2);
  overflow: hidden; border: 1px solid #e5e8eb; max-height: 76vh; display: flex; flex-direction: column; }
.head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #f2f4f6; border-bottom: 1px solid #e5e8eb; }
.head b { font-size: 13.5px; color: #191f28; flex: 1; }
.head button { background: none; border: 0; font-size: 18px; cursor: pointer; color: #4e5968; line-height: 1; padding: 4px; }
.body { padding: 12px 14px; overflow-y: auto; }
.row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; font-size: 13px; }
.row + .row { border-top: 1px dashed #e5e8eb; }
.row .l { color: #333d4b; flex: 1; min-width: 0; }
.row .v { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.total { border-top: 2px solid #191f28; margin-top: 8px; padding-top: 10px; font-size: 14px; }
.total .v { font-size: 17px; }
.vnd { text-align: right; color: #f04452; font-weight: 800; font-size: 15px; margin-top: 2px; }
.name { font-size: 12.5px; line-height: 1.45; color: #333d4b; margin: 0 0 10px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tag { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 3px 7px; border-radius: 6px; margin-right: 4px; }
.tag.ok { background: #e6f6f0; color: #17916b; }
.tag.warn { background: #fff4e6; color: #b7791f; }
.tag.info { background: #eef4ff; color: #3b5bdb; }
.blocked { background: #fff0f0; border: 1px solid #ffd5d5; border-radius: 10px; padding: 12px; }
.blocked h4 { margin: 0 0 6px; font-size: 13.5px; color: #9b2c2c; }
.blocked p { margin: 0; font-size: 12.5px; color: #742a2a; line-height: 1.5; }
.note { background: #f9fafb; border-radius: 8px; padding: 9px 10px; font-size: 12px; color: #4e5968; line-height: 1.55; margin-top: 10px; }
.note.warn { background: #fff8ef; color: #8a5a10; }
.note.tip { background: #f0faf4; color: #1d6b40; }
.note.added { background: #e6f6f0; color: #17916b; font-weight: 700; text-align: center; margin-top: 0; }
.hero { text-align: center; padding: 12px 0 4px; }
.hero .cap { font-size: 12.5px; font-weight: 700; color: #333d4b; }
.hero .krw { font-size: 28px; font-weight: 800; color: #3182f6; letter-spacing: -0.5px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.hero .vnd2 { font-size: 17px; font-weight: 800; color: #f04452; margin-top: 1px; font-variant-numeric: tabular-nums; }
.hero .meta { font-size: 12px; color: #4e5968; margin-top: 6px; }
.hero .meta.sub { font-size: 11px; color: #8b95a1; margin-top: 2px; }
.detail-toggle { width: 100%; min-height: 34px; margin-top: 10px; border: 1px solid #e5e8eb; border-radius: 9px;
  background: #fff; color: #333d4b; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.btns { padding: 0 14px 14px; display: grid; gap: 8px; }
.btn { min-height: 42px; border: 0; border-radius: 10px; font-weight: 700; font-size: 13.5px; cursor: pointer;
  background: #3182f6; color: #fff; display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn.ghost { background: #fff; color: #333d4b; border: 1px solid #e5e8eb; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.disc { font-size: 10.5px; color: #4e5968; line-height: 1.45; text-align: center; margin-top: -2px; }
/* 첫 화면의 두 줄 가격표 — 결제창 카드와 같은 생김새. 행을 누르면 선택. */
.pricebox { border: 1px solid #e5e8eb; border-radius: 12px; background: #fff; overflow: hidden; }
.prow { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%;
  padding: 10px 12px; border: 0; background: #fff; cursor: pointer; text-align: left; font: inherit; }
.prow + .prow { border-top: 1px solid #f2f4f6; }
.prow[aria-pressed="true"] { background: #f4f8ff; box-shadow: inset 3px 0 0 #3182f6; }
.prow .pl b { font-size: 13.5px; font-weight: 800; color: #191f28; display: block; }
.prow .pl small { font-size: 10.5px; color: #8b95a1; }
.prow .pk { font-size: 18px; font-weight: 800; color: #3182f6; display: block; text-align: right;
  white-space: nowrap; font-variant-numeric: tabular-nums; }
.prow .pv { font-size: 11px; font-weight: 700; color: #f04452; white-space: nowrap; display: block; text-align: right; }
.wline { font-size: 11px; color: #8b95a1; margin-top: 6px; }
.track { display: flex; gap: 8px; margin-bottom: 4px; }
.track button { flex: 1; min-height: 52px; border: 2px solid #e5e8eb; background: #fff; border-radius: 11px;
  font-size: 15px; font-weight: 800; color: #333d4b; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px; }
.track button small { font-size: 10.5px; font-weight: 600; color: #8b95a1; }
.track button[aria-pressed="true"] { background: #3182f6; border-color: #3182f6; color: #fff; }
.track button[aria-pressed="true"] small { color: #cfe0fc; }
.err { font-size: 12.5px; color: #b7791f; background: #fff8ef; border-radius: 8px; padding: 10px; line-height: 1.5; }
.maint { background: #f2f0f7; border: 1px solid #ddd8e6; border-radius: 10px; padding: 14px; text-align: center; }
.maint .icon { font-size: 28px; display: block; margin-bottom: 8px; }
.maint h4 { margin: 0 0 6px; font-size: 14px; color: #3b3350; }
.maint p { margin: 0 0 10px; font-size: 12.5px; color: #5b5470; line-height: 1.55; }
.maint .when { font-size: 12px; font-weight: 700; color: #333d4b; background: #fff; border-radius: 8px; padding: 8px 10px; }
.maint .countdown { font-size: 20px; font-weight: 800; color: #3182f6; margin: 6px 0 2px; font-variant-numeric: tabular-nums; }
.banner { background: #fff8ef; border: 1px solid #ffe8cc; border-radius: 9px; padding: 9px 11px;
  font-size: 11.5px; color: #8a5a10; line-height: 1.5; margin-bottom: 10px; }
`

  let host = null
  let root = null
  let open = false
  let state = { view: 'loading' }
  let handlers = {}

  function ensureHost() {
    if (host && document.body.contains(host)) return
    host = document.createElement('div')
    host.id = HOST_ID
    root = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = CSS
    root.appendChild(style)
    const wrap = document.createElement('div')
    wrap.className = 'wrap'
    root.appendChild(wrap)
    document.body.appendChild(host)
  }

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  /**
   * "○○g 더 담아도 배송비 동일" 여유 무게 안내.
   * 추정오차로 과약속하지 않도록 10g 단위로 내림하고, 50g 미만이면 숨깁니다.
   */
  function headroomNote(q) {
    const raw = q?.shipping?.headroomG ?? 0
    const shown = Math.floor(raw / 10) * 10
    if (shown < 50) return ''
    const fmtW = state.fmt?.weight ?? ((g) => `${g}g`)
    return `<div class="note tip">💡 약 <b>${esc(fmtW(shown))}</b> 더 담아도 배송비가 같습니다
      <small>(청구무게 ${esc(String(q.shipping.billableKg))}kg 까지)</small></div>`
  }

  /**
   * 배송대행 구매 전 안내 — 쿠팡 결제를 먼저 하는 흐름이므로,
   * 배송지(한국 창고)를 결제 전에 보여줘야 합니다. 주문완료 화면에서
   * 확장이 배송 신청 버튼을 띄워 우리 주문과 자동 연결됩니다.
   */
  function warehouseNote() {
    if (state.track !== 'forwarding') return ''
    const w = state.warehouse
    if (!w) return ''
    const addr = w.configured
      ? `${w.address1 ?? ''}${w.zip ? ` (${w.zip})` : ''}`.trim()
      : '창고 확정 후 안내됩니다'
    const code = w.code ?? 'K-ECOM'
    return `<div class="note">🏠 쿠팡 배송지 입력법
      <br>· 이름: <b>${esc(code)}</b>
      <br>· 주소: <span style="user-select:all">${esc(addr)}</span>
      <br>· 상세주소: <b>${esc(code)} 본인이름</b>
      <br><small>결제 화면에서 주소 복사 버튼이 다시 안내됩니다. 결제하면 배송 신청서가 자동으로 열립니다.</small></div>`
  }

  /** 최소 주문 금액 미달 안내 — 담기는 막지 않습니다 (견적함에 모아 채울 수 있으므로). */
  function minOrderNote(q) {
    const mo = q?.minOrder
    if (!mo || mo.met) return ''
    return `<div class="note warn">🧺 최소 주문 금액은 상품가 합계 <b>${esc(state.fmt.krw(mo.goodsKrw))}</b> 입니다.
      다른 상품과 함께 <b>${esc(state.fmt.krw(mo.shortfallKrw))}</b> 이상 더 담으면 주문할 수 있습니다.</div>`
  }

  function fabState() {
    if (state.view === 'manual-quote') return 'manual'
    if (state.view === 'maintenance') return 'maintenance'
    if (state.view === 'blocked') return 'blocked'
    if (state.view === 'error') return 'error'
    return 'ok'
  }

  function renderBody() {
    if (state.view === 'loading') return '<div class="body"><div class="err">계산 중…</div></div>'

    if (state.view === 'manual-quote') {
      return `<div class="body">
        <p class="name">${esc(state.productName)}</p>
        <div class="mq">
          <span class="tagline">${esc(state.label)}</span>
          <h4 style="margin-top:8px">견적 문의가 필요한 상품입니다</h4>
          <p>${esc(state.reason)}</p>
          ${state.notice ? `<p style="color:#8a5a10">⚠️ ${esc(state.notice)}</p>` : ''}
        </div>
        <div class="note">이런 상품은 무게·파손 취급·보험 조건이 상품마다 달라
        자동 견적이 정확하지 않습니다. 물류사 견적을 받아 안내해 드립니다.</div>
      </div>
      <div class="btns"><button class="btn" data-act="add">견적 문의 담기</button></div>`
    }

    if (state.view === 'maintenance') {
      const m = state.maintenance
      return `<div class="body"><div class="maint">
        <span class="icon">🌙</span>
        <h4>${esc(m.label)}</h4>
        <p>${esc(m.reason)}</p>
        <div class="countdown">${esc(m.minutesUntilEnd)}분 뒤 재개</div>
        <div class="when">${esc(m.timezoneHint)}</div>
      </div>
      <div class="note">점검 중에는 쿠팡 가격이 정확하지 않을 수 있어 견적을 멈춥니다.
      잘못된 금액을 보여드리는 것보다 잠시 기다리시는 편이 낫기 때문입니다.</div>
      </div>`
    }

    if (state.view === 'error') {
      return `<div class="body"><div class="err">⚠️ ${esc(state.message)}</div>
        <div class="note">쿠팡 페이지 구조가 바뀌면 정보를 읽지 못할 수 있습니다.
        잘못된 금액을 보여주는 대신 계산을 중단했습니다.</div></div>`
    }

    if (state.view === 'blocked') {
      return `<div class="body">
        <p class="name">${esc(state.productName)}</p>
        <div class="blocked">
          <h4>🚫 배송할 수 없는 상품입니다</h4>
          <p><b>${esc(state.label)}</b><br>${esc(state.reason)}</p>
        </div>
        <div class="note">결제 후 창고에서 반송되면 왕복 배송비가 발생합니다.
        주문 전에 알려드리는 것이 이 도구의 목적입니다.</div>
      </div>`
    }

    const q = state.quote
    const rows = q.breakdown
      .map((r) => `<div class="row"><span class="l">${esc(r.label)}</span><span class="v">${esc(state.fmt.krw(r.krw))}</span></div>`)
      .join('')

    const warn = q.eligibility.warnings.length
      ? `<div class="note warn">⚠️ ${q.eligibility.warnings.map((w) => esc(w.message)).join('<br>')}</div>`
      : ''

    const surcharged = q.taxes.surcharged.length
      ? `<div class="note">세금이 더 붙는 품목: ${q.taxes.surcharged
          .map((s) => `${esc(s.label)} ${Math.round(s.dutyRate * 100)}%`)
          .join(', ')} (추가 ${esc(state.fmt.krw(q.taxes.extraDutyKrw))})</div>`
      : ''


    const sched = q.sourcing?.schedule ?? {
      totalDays: q.shipping.leadTimeDays,
      toWarehouseDays: { min: 0, max: 0 },
      toHanoiDays: q.shipping.leadTimeDays,
    }

    // 해외직구 상품은 도착이 늦고 비용을 다시 확인해야 합니다.
    const overseasBlock = q.sourcing?.hasOverseas
      ? `<div class="note warn"><b>🌏 ${esc(q.sourcing.notice.title)}</b><br>
          ${esc(q.sourcing.notice.body)}<br><br>${esc(q.sourcing.notice.costNote)}</div>`
      : ''

    const banner = state.maintenanceNotice
      ? `<div class="banner">⏰ ${esc(state.maintenanceNotice)}</div>`
      : ''

    // 운영자 발주 힌트 — 일반 고객에게는 절대 뜨지 않습니다 (토큰 필요)
    const opHint = state.operatorHint
      ? `<div class="note tip">📋 발주 <b>${esc(state.operatorHint.orderNo)}</b> —
          이 상품 <b>${esc(String(state.operatorHint.quantity))}개</b>
          ${state.operatorHint.unitPriceKrw > 0
            ? `· 고객 표시가 <b>${esc(state.fmt.krw(state.operatorHint.unitPriceKrw))}</b><br>
               <small>이 가격(이하)인지 확인 후 담으세요. 초과 시 결제 중단 → 검토.</small>`
            : ''}</div>`
      : ''

    /**
     * 어느 화면에서든 같은 첫인상: "배송대행 얼마 / 구매대행 얼마" 두 줄.
     * (결제창 카드와 동일한 레이아웃) 행을 누르면 그 트랙이 선택되고,
     * 세부 내역·안내는 [자세한 내역]을 눌러야 펼쳐집니다.
     * 단, 돈이 더 나가거나 주문이 막히는 경고는 항상 보입니다.
     */
    const qs = state.quotes ?? {}
    const priceRow = (id, label, sub, qq) => qq
      ? `<button class="prow" data-track="${id}" aria-pressed="${state.track === id}">
          <span class="pl"><b>${label}</b><small>${sub}</small></span>
          <span class="pr"><b class="pk">${esc(state.fmt.krw(qq.total))}</b>
            <small class="pv">≈ ${esc(state.fmt.vnd(qq.totalVnd))}</small></span>
        </button>`
      : ''

    return `<div class="body">
      ${banner}${opHint}
      <p class="name">${esc(state.productName)}</p>
      <div class="pricebox">
        ${priceRow('forwarding', '배송대행', '배송비 · 쿠팡 결제는 내가', qs.forwarding ?? (state.track === 'forwarding' ? q : null))}
        ${priceRow('agent', '구매대행', '총액 · 결제까지 맡김', qs.agent ?? (state.track === 'agent' ? q : null))}
      </div>
      <div class="wline">📦 실측 <b>${(q.weight.chargeableG / 1000).toFixed(1)}kg</b> → 청구 <b>${q.shipping.billableKg}kg</b> · ${esc(state.confidenceLabel)} · 도착 ${esc(sched.totalDays.min)}~${esc(sched.totalDays.max)}일</div>
      ${minOrderNote(q)}${surcharged}${warn}${overseasBlock}
      <button class="detail-toggle" data-act="detail">${state.detailOpen ? '자세한 내역 접기 ▴' : '자세한 내역 보기 ▾'}</button>
      ${state.detailOpen
        ? `<div style="margin-top:8px">${rows}</div>
           ${state.track === 'agent'
             ? '<div class="note">와우회원가는 되도록 반영합니다. 쿠폰·신규가입 할인 등 개인 혜택은 사용할 수 없고, 타임세일·마감임박 등 기간 한정 할인가는 발주 시점에 끝나면 반영되지 않을 수 있습니다.</div>'
             : '<div class="note">본인 결제라 쿠폰·회원 할인을 모두 그대로 쓸 수 있습니다.</div>'}
           <div class="note">무게 기준: ${esc(state.ruleText ?? '')} · 입고 후 실측으로 정산합니다.</div>
           ${headroomNote(q)}${warehouseNote()}
           <div class="note">📦 쿠팡→한국창고 ${esc(sched.toWarehouseDays.min)}~${esc(sched.toWarehouseDays.max)}일 +
             한국창고→하노이 ${esc(sched.toHanoiDays.min)}~${esc(sched.toHanoiDays.max)}일</div>
           <div class="note">표시 금액은 상품명 기반 추정 무게로 계산한 예상 견적입니다.
           한국 창고 입고 후 실측하여 차액을 정산합니다.</div>`
        : ''}
    </div>`
  }

  function renderButtons() {
    if (state.view !== 'quote') return ''
    const label = state.track === 'forwarding' ? '견적함에 담기' : '구매대행 견적함에 담기'

    // 담기 전 — 담기 버튼 하나. 견적함에 이미 담긴 게 있으면 개수만 살짝.
    if (!state.added) {
      return `<div class="btns">
        <button class="btn" data-act="add">${label}</button>
        ${state.cartCount > 0 ? `<div class="disc">🧺 견적함에 ${state.cartCount}개 담겨 있어요</div>` : ''}
      </div>`
    }

    // 담은 후 — "됐다"는 확인과 다음 행동(주문서 작성 / 더 담기)을 보여줍니다.
    return `<div class="btns">
      <div class="note added">✓ 견적함에 담겼습니다 — 현재 ${state.cartCount ?? 1}개</div>
      <button class="btn" data-act="checkout">주문서 바로 작성 →</button>
      <button class="btn ghost" data-act="add">같은 상품 1개 더 담기</button>
      <div class="disc">담긴 상품은 브라우저 오른쪽 위 확장 아이콘(🇻🇳, 숫자 배지)에서 언제든 볼 수 있어요.</div>
    </div>`
  }

  function render() {
    ensureHost()
    const wrap = root.querySelector('.wrap')
    if (!open) {
      const icon =
        state.view === 'blocked' ? '🚫'
        : state.view === 'maintenance' ? '🌙'
        : state.view === 'manual-quote' ? '📋'
        : '🇻🇳'
      wrap.innerHTML = `<button class="fab" data-state="${fabState()}" title="하노이 배송 견적">${icon}</button>`
      wrap.querySelector('.fab').addEventListener('click', () => {
        open = true
        render()
      })
      return
    }

    wrap.innerHTML = `<div class="card">
      <div class="head"><b>🇻🇳 하노이 도착 견적</b><button data-act="close" aria-label="닫기">✕</button></div>
      ${renderBody()}${renderButtons()}
    </div>`

    wrap.querySelector('[data-act="close"]').addEventListener('click', () => {
      open = false
      render()
    })
    wrap.querySelectorAll('[data-track]').forEach((b) =>
      b.addEventListener('click', () => handlers.onTrackChange?.(b.dataset.track)),
    )
    wrap.querySelectorAll('[data-act="add"]').forEach((b) => b.addEventListener('click', () => handlers.onAdd?.()))
    wrap.querySelectorAll('[data-act="detail"]').forEach((b) =>
      b.addEventListener('click', () => {
        state.detailOpen = !state.detailOpen
        render()
      }),
    )
    wrap.querySelectorAll('[data-act="checkout"]').forEach((b) =>
      b.addEventListener('click', () => handlers.onCheckout?.()),
    )
  }

  return {
    mount(h) {
      handlers = h ?? {}
      render()
    },
    setState(next) {
      state = { ...state, ...next }
      render()
    },
    expand() {
      open = true
      render()
    },
    destroy() {
      host?.remove()
      host = null
    },
  }
})()

globalThis.KBPanel = KBPanel
