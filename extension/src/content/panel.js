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
.row-info { border: 0; background: #eef4fb; color: #3182f6; border-radius: 50%; width: 16px; height: 16px;
  font-size: 10.5px; line-height: 1; cursor: pointer; padding: 0; margin-left: 4px; vertical-align: 1px; }
.row-info:hover { background: #3182f6; color: #fff; }
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
/* 배송만 3단계 — "결제가 먼저" 를 순서로 보여줍니다 */
.steps { margin: 0; padding: 9px 10px 9px 28px; border-radius: 9px; background: #f2f6fb;
         font-size: 12px; color: #333d4b; line-height: 1.6; }
.steps li { margin: 2px 0; }
.steps li.done { color: #17916b; text-decoration: line-through; }
.steps li::marker { font-weight: 800; color: #3182f6; }
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
/* 선택된 행 — 파란 배경 + 흰 글씨 + ✓ 로 확실하게 */
.prow[aria-pressed="true"] { background: #3182f6; }
.prow[aria-pressed="true"] .pl b { color: #fff; }
.prow[aria-pressed="true"] .pl b::before { content: '✓ '; }
.prow[aria-pressed="true"] .pl small { color: #cfe0fc; }
.prow[aria-pressed="true"] .pk { color: #fff; }
.prow[aria-pressed="true"] .pv { color: #ffd9d9; }
.prow .pl b { font-size: 13.5px; font-weight: 800; color: #191f28; display: block; }
.prow .pl small { font-size: 10.5px; color: #8b95a1; }
.prow .pk { font-size: 18px; font-weight: 800; color: #3182f6; display: block; text-align: right;
  white-space: nowrap; font-variant-numeric: tabular-nums; }
.prow .pv { font-size: 11px; font-weight: 700; color: #f04452; white-space: nowrap; display: block; text-align: right; }
.wline { font-size: 11px; color: #8b95a1; margin-top: 6px; }
/* 바로가기 만들기 — 패널 맨 위 띠 */
.shortcut { display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box;
            padding: 10px 14px; border: 0; border-bottom: 1px solid #d0e2ff; cursor: pointer;
            background: linear-gradient(90deg, #eaf2ff, #f4f8ff); text-align: left; }
.shortcut b { font-size: 13px; color: #0b57d0; flex: 1; line-height: 1.4; }
.shortcut small { display: block; font-weight: 500; color: #4e5968; font-size: 11.5px; margin-top: 1px; }
.shortcut .chev { color: #0b57d0; font-size: 12px; }
.sc-how { padding: 11px 14px; background: #f8fbff; border-bottom: 1px solid #e5e8eb;
          font-size: 12.5px; color: #333d4b; line-height: 1.65; }
.sc-how ol { margin: 6px 0 0; padding-left: 18px; }
.sc-how li { margin-bottom: 3px; }
.sc-how .addr { display: block; margin-top: 7px; padding: 7px 9px; background: #fff;
                border: 1px solid #d7dbe0; border-radius: 7px; font-size: 12.5px;
                word-break: break-all; color: #0b57d0; font-weight: 700; }
.sc-act { display: flex; gap: 6px; margin-top: 9px; }
.sc-act button { flex: 1; padding: 9px 6px; border-radius: 8px; font-size: 12.5px;
                 font-weight: 700; cursor: pointer; border: 1px solid #d7dbe0; background: #fff; color: #4e5968; }
.sc-act button.go { background: #0b57d0; border-color: #0b57d0; color: #fff; }

/* 몇 개짜리 견적인지 — 금액 바로 위에 눈에 띄게 */
.qtyline { font-size: 12.5px; color: #0b57d0; background: #eef4ff; border-radius: 7px;
           padding: 6px 9px; margin: 6px 0 2px; font-weight: 600; }
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
    const code = w.code ?? 'YS-ECOM'
    return `<div class="note">🏠 쿠팡 배송지 입력법
      <br>· 이름: <b>${esc(code)}</b>
      <br>· 주소: <span style="user-select:all">${esc(addr)}</span>
      <br>· 상세주소: <b>${esc(code)} 본인이름</b>
      <br><small>결제 화면에서 주소 복사 버튼이 다시 안내됩니다. 결제하면 배송 신청서가 자동으로 열립니다.</small></div>`
  }

  /** 구매대행 1회 접수 한도 초과 — 신청이 거절되므로 항상 보이는 경고. */
  function agentLimitNote(q) {
    const al = q?.agentLimit
    if (!al?.exceeded) return ''
    return `<div class="note warn">🚫 대신 사드리는 건 한 번에 상품값 합계 <b>${esc(state.fmt.krw(al.maxGoodsKrw))}</b>까지
      접수합니다 — 나눠서 신청해 주세요.</div>`
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
    /**
     * 할증 줄 비용 안내 — ⓘ에 마우스를 올리면(title) 또는 누르면
     * 왜 붙는 비용인지 보여줍니다. key 가 없으면(서버 요약 응답) 라벨로 매칭.
     */
    const rowInfo = (r) => {
      const k = r.key ?? ''
      const l = r.label ?? ''
      if (k === 'surcharge-device' || l.includes('기기 취급')) {
        return '물류사 항공특송의 전자·가전 특수 취급비 — 기기당 $40, 대수만큼 부과됩니다. ' +
          '파손 위험 화물 검수·별도 포장 비용이며, 한국 기기는 베트남에서 A/S 가 어렵습니다.'
      }
      if (k === 'surcharge-fragile' || l.includes('파손주의')) return '유리·도자기 등 파손 위험 품목의 완충 보강 포장비 — 개당 $2.'
      if (k === 'surcharge-bulky' || l.includes('대형 화물')) return '청구무게 10kg 이상 대형 화물 취급비 — 건당 $5.'
      return null
    }
    const rows = q.breakdown
      .map((r) => {
        const info = rowInfo(r)
        const id = r.key ?? r.label
        const btn = info
          ? `<button class="row-info" data-act="rowinfo" data-key="${esc(id)}" title="${esc(info)}" aria-label="비용 안내">ⓘ</button>`
          : ''
        const note = info && state.rowInfoKey === id
          ? `<div class="note" style="margin:2px 0 6px">${esc(info)}</div>`
          : ''
        return `<div class="row"><span class="l">${esc(r.label)}${btn}</span><span class="v">${esc(state.fmt.krw(r.krw))}</span></div>${note}`
      })
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

    /**
     * 몇 개짜리 견적인지 숨기지 않습니다.
     *
     * 예전에는 화면에서 82개를 골라놔도 패널은 말없이 1개로만 계산했습니다.
     * 그대로 담으면 고객은 82개를 기대하는데 1개가 신청됩니다.
     */
    const qty = Number.isFinite(state.quantity) ? state.quantity : 1
    const qtyLine = state.quantityUncertain
      ? `<div class="note" style="color:#c92a2a">개수를 확실히 읽지 못해 <b>1개 기준</b>으로 계산했습니다.
           쿠팡 화면의 개수를 1로 두고 담은 뒤, 신청서에서 개수를 정해 주세요.</div>`
      : qty > 1
        ? `<div class="qtyline"><b>${qty}개</b> 기준 금액입니다</div>`
        : ''

    return `<div class="body">
      ${banner}${opHint}
      <p class="name">${esc(state.productName)}</p>
      ${qtyLine}
      <div class="pricebox">
        ${priceRow('forwarding', '📦 배송만', '배송비 · 쿠팡 결제는 내가', qs.forwarding ?? (state.track === 'forwarding' ? q : null))}
        ${priceRow('agent', '🛒 구매하고 배송까지', '총액 · 저희가 대신', qs.agent ?? (state.track === 'agent' ? q : null))}
      </div>
      <div class="wline">📦 실측 <b>${(q.weight.chargeableG / 1000).toFixed(1)}kg</b> → 청구 <b>${q.shipping.billableKg}kg</b> · ${esc(state.confidenceLabel)} · 도착 ${esc(sched.totalDays.min)}~${esc(sched.totalDays.max)}<b style="color:#d9480f">영업일</b></div>
      ${agentLimitNote(q)}${minOrderNote(q)}${surcharged}${warn}${overseasBlock}
      <button class="detail-toggle" data-act="detail">${state.detailOpen ? '자세한 내역 접기 ▴' : '자세한 내역 보기 ▾'}</button>
      ${state.detailOpen
        ? `<div style="margin-top:8px">${rows}</div>
           ${state.track === 'agent'
             ? `<div class="note">수수료: <b>기본 ${esc(state.fmt.krw(state.policy?.agencyBaseKrw ?? 0))}</b>(상품가 10만원·5종까지) — 대리 주문·검수·발주 실비. 초과분은 10만원 초과금액의 5% + 5종 초과 종류당 1,000원.</div>` +
               '<div class="note">와우회원가는 되도록 반영합니다. 쿠폰·신규가입 할인 등 개인 혜택은 사용할 수 없고, 타임세일·마감임박 등 기간 한정 할인가는 발주 시점에 끝나면 반영되지 않을 수 있습니다.</div>'
             : '<div class="note">본인 결제라 쿠폰·회원 할인을 모두 그대로 쓸 수 있습니다.</div>'}
           <div class="note">무게 기준: ${esc(state.ruleText ?? '')} · 입고 후 실측으로 정산합니다.</div>
           ${headroomNote(q)}${warehouseNote()}
           <div class="note">📦 쿠팡→한국창고 <b>${esc(sched.toWarehouseDays.min)}~${esc(sched.toWarehouseDays.max)}영업일</b> +
             한국창고→하노이 <b>${esc(sched.toHanoiDays.min)}~${esc(sched.toHanoiDays.max)}영업일</b>
             <br><b style="color:#d9480f">모두 영업일 기준(주말·공휴일 제외)</b> ·
             해외직구 상품은 창고 도착까지 <b style="color:#d9480f">+2~3영업일</b></div>
           <div class="note">💳 환불은 <b>영업일 3~7일</b> 내 지급 · 반품·변심 취소는 대신 사드린 수수료 제외 /
           배송만 $1 차감 후 돌려드립니다 · ↩️ 하노이 도착 후 교환·반품 반송비(하노이→한국,
           2kg까지 $20·이후 kg당 $11 · 대신 사드린 건은 처리비 5,000원 추가)는
           <b style="color:#c92a2a">전액 구매자 부담</b> —
           교환은 반송비+재배송비를 상품가와 비교하세요.
           <b style="color:#c92a2a">액체·배터리 내장 제품 등은 반송 불가(교환·반품 불가)</b>.</div>
           <div class="note">표시 금액은 상품명 기반 추정 무게로 계산한 예상 견적입니다.
           한국 창고 입고 후 실측하여 차액을 정산합니다.</div>`
        : ''}
    </div>`
  }

  function renderButtons() {
    if (state.view !== 'quote') return ''
    const label = state.track === 'forwarding' ? '담아두기' : '대신 사달라고 담아두기'

    /**
     * 배송만 — 담은 뒤 고객이 어차피 해야 하는 일이 "쿠팡에서 결제" 입니다.
     * 그 버튼 하나로 합쳤습니다 (운영자 지시 26-09-04: 별도 제휴 버튼은 화면에서 제외).
     *
     * ⚠️ 고지 한 줄은 뺄 수 없습니다.
     *    쿠팡 파트너스·크롬 웹스토어가 금지하는 것은 제휴 링크 자체가 아니라
     *    (1) 고지 없이 (2) 사용자 클릭 없이 (3) 몰래 URL 을 바꾸는 것입니다.
     *    버튼을 없애고 뒤에서 자동으로 붙이면 그 세 가지를 모두 어겨
     *    파트너스 계정 해지 + 확장 삭제 사유가 됩니다.
     *    구매하고 배송까지(구매대행)는 본인 구매라 어떤 경우에도 붙이지 않습니다.
     */
    /**
     * 배송만은 **쿠팡 결제가 먼저**입니다 (운영자 확정 26-09-04).
     *
     * 예전에는 담자마자 [주문서 바로 작성] 이 떠서, 고객이 쿠팡 결제도 하기
     * 전에 신청서부터 쓰게 됐습니다. 순서가 뒤집히면 쿠팡 주문번호가 없는
     * 신청서가 생기고, 결제 화면의 배송지 검사도 건너뛰게 됩니다.
     * 신청서는 결제가 끝난 **주문완료 화면**에서 새 탭으로 저절로 열립니다
     * (order-capture.js autoForward). 못 열면 [하노이 배송 신청] 카드가 대신
     * 뜹니다 — 그래서 여기서는 주문서 버튼을 아예 그리지 않습니다.
     */
    const fwdSteps = state.track === 'forwarding'
      ? `<ol class="steps">
          <li${state.added ? ' class="done"' : ''}>담아두기</li>
          <li>쿠팡에서 <b>직접 결제</b> — 아래 버튼을 누르면 새 창이 열립니다. 거기서 쿠팡 <b>[바로구매]</b>, 배송지는 저희 창고로 (결제 화면에서 도와드립니다)</li>
          <li>결제가 끝나면 배송 신청서가 <b>새 탭에 저절로 열립니다</b><br><small>안 열리면 화면 오른쪽 아래 [하노이 배송 신청] 을 누르세요</small></li>
        </ol>`
      : ''
    const notice = state.notice
      ? `<div class="note warn">${esc(state.notice)}</div>`
      : ''

    // 담기 전 — 담기 버튼 하나. 견적함에 이미 담긴 게 있으면 개수만 살짝.
    if (!state.added) {
      return `<div class="btns">
        ${fwdSteps}
        <button class="btn" data-act="add">${label}</button>
        ${state.cartCount > 0 ? `<div class="disc">🧺 견적함에 ${state.cartCount}개 담겨 있어요</div>` : ''}
        ${notice}
      </div>`
    }

    // 담은 후 · 배송만 — 다음 행동은 "쿠팡에서 결제" 하나뿐입니다.
    if (state.track === 'forwarding') {
      return `<div class="btns">
        <div class="note added">✓ 견적함에 담겼습니다 — 현재 ${state.cartCount ?? 1}개</div>
        ${fwdSteps}
        <button class="btn" data-act="affiliate">🛒 쿠팡에서 결제하기 → 새 창이 열립니다</button>
        <div class="disc">제휴 링크로 열립니다 · 고객님이 내시는 금액은 똑같습니다</div>
        <button class="btn ghost" data-act="add">같은 상품 1개 더 담기</button>
        ${notice}
        <div class="disc">담긴 상품은 브라우저 오른쪽 위 확장 아이콘(🇻🇳, 숫자 배지)에서 언제든 볼 수 있어요.</div>
      </div>`
    }

    // 담은 후 · 구매하고 배송까지 — 결제는 저희가 하므로 바로 신청서로.
    return `<div class="btns">
      <div class="note added">✓ 견적함에 담겼습니다 — 현재 ${state.cartCount ?? 1}개</div>
      <button class="btn" data-act="checkout">주문서 바로 작성 →</button>
      <button class="btn ghost" data-act="add">같은 상품 1개 더 담기</button>
      ${notice}
      <div class="disc">담긴 상품은 브라우저 오른쪽 위 확장 아이콘(🇻🇳, 숫자 배지)에서 언제든 볼 수 있어요.</div>
    </div>`
  }

  /**
   * 바로가기 만들기 — 패널 맨 위 띠.
   *
   * 왜 필요한가: 이 확장은 쿠팡 페이지에서만 뜹니다. 폰에서 쿠팡 앱을
   * 쓰거나 PC를 껐다 켜면 우리 서비스로 돌아올 길이 없습니다.
   * 바탕화면·홈 화면에 아이콘이 하나 있으면 그 길이 생깁니다.
   *
   * 한 번 "다음에"를 누르면 다시 조르지 않습니다 — 매번 뜨는 안내는
   * 도움이 아니라 방해입니다. (쿠팡 도메인 localStorage 에 기억)
   */
  const SC_KEY = 'kbShortcutDismissed'
  const scDismissed = () => {
    try { return localStorage.getItem(SC_KEY) === '1' } catch { return false }
  }
  const scDismiss = () => {
    try { localStorage.setItem(SC_KEY, '1') } catch { /* 사생활 보호 모드 등 */ }
  }

  function renderShortcut() {
    if (state.view !== 'quote' || scDismissed()) return ''
    const bar = `<button class="shortcut" data-act="sc-toggle">
      <span>🔖</span>
      <b>바로가기 만들기<small>앞으로는 배송 걱정 끝 — 한 번만 눌러두세요</small></b>
      <span class="chev">${state.shortcutOpen ? '▴' : '▾'}</span>
    </button>`
    if (!state.shortcutOpen) return bar

    const site = state.siteUrl ?? ''
    return bar + `<div class="sc-how">
      <b>💻 이 컴퓨터 (크롬)</b>
      <ol>
        <li>아래 <b>바로가기 열기</b>를 누르세요</li>
        <li>주소창 오른쪽 <b>⋮</b> → <b>저장 및 공유</b> → <b>바로가기 만들기</b></li>
        <li>바탕화면에 아이콘이 생깁니다</li>
      </ol>
      <b style="display:block;margin-top:9px">📱 휴대폰</b>
      <ol>
        <li>폰 브라우저에 아래 주소를 입력하세요</li>
        <li>안드로이드: <b>⋮</b> → <b>홈 화면에 추가</b> · 아이폰: <b>공유</b> → <b>홈 화면에 추가</b></li>
      </ol>
      ${site ? `<span class="addr">${esc(site)}</span>` : ''}
      <div class="sc-act">
        <button class="go" data-act="sc-open">바로가기 열기</button>
        <button data-act="sc-dismiss">다음에</button>
      </div>
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
      ${renderShortcut()}
      ${renderBody()}${renderButtons()}
    </div>`

    wrap.querySelector('[data-act="close"]').addEventListener('click', () => {
      open = false
      render()
    })
    wrap.querySelector('[data-act="sc-toggle"]')?.addEventListener('click', () => {
      state.shortcutOpen = !state.shortcutOpen
      handlers.onShortcutOpen?.()
      render()
    })
    wrap.querySelector('[data-act="sc-open"]')?.addEventListener('click', () => handlers.onOpenSite?.())
    wrap.querySelector('[data-act="sc-dismiss"]')?.addEventListener('click', () => {
      scDismiss()
      state.shortcutOpen = false
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
    wrap.querySelectorAll('[data-act="rowinfo"]').forEach((b) =>
      b.addEventListener('click', () => {
        state.rowInfoKey = state.rowInfoKey === b.dataset.key ? null : b.dataset.key
        render()
      }),
    )
    wrap.querySelectorAll('[data-act="checkout"]').forEach((b) =>
      b.addEventListener('click', () => handlers.onCheckout?.()),
    )
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
    /** 지금 상태 읽기 — 같은 값을 두 번 받아오지 않으려고 씁니다 */
    getState() {
      return state
    },
    destroy() {
      host?.remove()
      host = null
    },
  }
})()

globalThis.KBPanel = KBPanel
