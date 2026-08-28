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
  background: #ef4a76; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.22); }
.fab[data-state="blocked"] { background: #c53030; }
.fab[data-state="error"] { background: #766b80; }
.card { background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(27,18,32,.2);
  overflow: hidden; border: 1px solid #ece7ef; max-height: 76vh; display: flex; flex-direction: column; }
.head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #fff1f5; border-bottom: 1px solid #ece7ef; }
.head b { font-size: 13.5px; color: #1b1220; flex: 1; }
.head button { background: none; border: 0; font-size: 18px; cursor: pointer; color: #766b80; line-height: 1; padding: 4px; }
.body { padding: 12px 14px; overflow-y: auto; }
.row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; font-size: 13px; }
.row + .row { border-top: 1px dashed #ece7ef; }
.row .l { color: #453b4d; flex: 1; min-width: 0; }
.row .v { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.total { border-top: 2px solid #1b1220; margin-top: 8px; padding-top: 10px; font-size: 14px; }
.total .v { font-size: 17px; }
.vnd { text-align: right; color: #d92e5c; font-weight: 800; font-size: 15px; margin-top: 2px; }
.name { font-size: 12.5px; line-height: 1.45; color: #453b4d; margin: 0 0 10px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tag { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 3px 7px; border-radius: 6px; margin-right: 4px; }
.tag.ok { background: #e6f6f0; color: #17916b; }
.tag.warn { background: #fff4e6; color: #b7791f; }
.tag.info { background: #eef4ff; color: #3b5bdb; }
.blocked { background: #fff0f0; border: 1px solid #ffd5d5; border-radius: 10px; padding: 12px; }
.blocked h4 { margin: 0 0 6px; font-size: 13.5px; color: #9b2c2c; }
.blocked p { margin: 0; font-size: 12.5px; color: #742a2a; line-height: 1.5; }
.note { background: #faf7fb; border-radius: 8px; padding: 9px 10px; font-size: 11.5px; color: #766b80; line-height: 1.5; margin-top: 10px; }
.note.warn { background: #fff8ef; color: #8a5a10; }
.btns { padding: 0 14px 14px; display: grid; gap: 8px; }
.btn { min-height: 42px; border: 0; border-radius: 10px; font-weight: 700; font-size: 13.5px; cursor: pointer;
  background: #ef4a76; color: #fff; display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn.ghost { background: #fff; color: #453b4d; border: 1px solid #ece7ef; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.disc { font-size: 10.5px; color: #766b80; line-height: 1.45; text-align: center; margin-top: -2px; }
.track { display: flex; gap: 6px; margin-bottom: 10px; }
.track button { flex: 1; min-height: 36px; border: 1px solid #ece7ef; background: #fff; border-radius: 8px;
  font-size: 12px; font-weight: 700; color: #766b80; cursor: pointer; }
.track button[aria-pressed="true"] { background: #ef4a76; border-color: #ef4a76; color: #fff; }
.err { font-size: 12.5px; color: #b7791f; background: #fff8ef; border-radius: 8px; padding: 10px; line-height: 1.5; }
.maint { background: #f2f0f7; border: 1px solid #ddd8e6; border-radius: 10px; padding: 14px; text-align: center; }
.maint .icon { font-size: 28px; display: block; margin-bottom: 8px; }
.maint h4 { margin: 0 0 6px; font-size: 14px; color: #3b3350; }
.maint p { margin: 0 0 10px; font-size: 12.5px; color: #5b5470; line-height: 1.55; }
.maint .when { font-size: 12px; font-weight: 700; color: #453b4d; background: #fff; border-radius: 8px; padding: 8px 10px; }
.maint .countdown { font-size: 20px; font-weight: 800; color: #ef4a76; margin: 6px 0 2px; font-variant-numeric: tabular-nums; }
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

    const goodsNote =
      state.track === 'forwarding'
        ? `<div class="note">상품가 ${esc(state.fmt.krw(q.goods))}는 고객님이 쿠팡에 직접 결제하십니다. (관세 과세표준에는 포함)</div>`
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

    return `<div class="body">
      ${banner}
      <p class="name">${esc(state.productName)}</p>
      <div class="track">
        <button data-track="forwarding" aria-pressed="${state.track === 'forwarding'}">배송대행</button>
        <button data-track="agent" aria-pressed="${state.track === 'agent'}">구매대행</button>
      </div>
      <div>
        <span class="tag info">청구무게 ${q.shipping.billableKg}kg</span>
        <span class="tag ${state.confidenceClass}">${esc(state.confidenceLabel)}</span>
      </div>
      <div style="margin-top:8px">${rows}</div>
      <div class="row total"><span class="l">하노이 도착 총액</span><span class="v">${esc(state.fmt.krw(q.total))}</span></div>
      <div class="vnd">${esc(state.fmt.vnd(q.totalVnd))}</div>
      ${goodsNote}${surcharged}${warn}
      ${overseasBlock}
      <div class="note">📦 하노이 도착 예상 <b>${esc(sched.totalDays.min)}~${esc(sched.totalDays.max)}영업일</b><br>
        <small>쿠팡→한국창고 ${esc(sched.toWarehouseDays.min)}~${esc(sched.toWarehouseDays.max)}일 +
        한국창고→하노이 ${esc(sched.toHanoiDays.min)}~${esc(sched.toHanoiDays.max)}일</small></div>
      <div class="note">표시 금액은 상품명 기반 추정 무게로 계산한 예상 견적입니다.
      한국 창고 입고 후 실측하여 차액을 정산합니다.</div>
    </div>`
  }

  function renderButtons() {
    if (state.view !== 'quote') return ''
    if (state.track === 'forwarding') {
      return `<div class="btns">
        <button class="btn" data-act="add">견적함에 담기</button>
        <button class="btn ghost" data-act="affiliate">쿠팡에서 주문하기 ↗</button>
        <div class="disc">${esc(state.affiliateWarn ? state.affiliateWarn + ' · ' + state.disclosureShort : state.disclosureShort)}</div>
      </div>`
    }
    return `<div class="btns"><button class="btn" data-act="add">구매대행 견적함에 담기</button></div>`
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
    wrap.querySelectorAll('[data-act="affiliate"]').forEach((b) =>
      b.addEventListener('click', () => handlers.onAffiliate?.()),
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
