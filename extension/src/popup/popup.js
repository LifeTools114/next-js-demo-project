/**
 * 팝업 — 견적함과 설정
 *
 * 견적 계산은 번들된 KBCalc 로 즉시 수행합니다. (백엔드 없이도 동작)
 * 주문 요청만 백엔드 체크아웃으로 넘깁니다.
 */

const K = globalThis.KBCalc
const send = (type, payload) =>
  new Promise((resolve) => chrome.runtime.sendMessage({ type, payload }, (r) => resolve(r ?? { ok: false })))

const $ = (id) => document.getElementById(id)

/**
 * 점검 배너.
 * 확장이 스스로 판정하므로 서버 연결 없이도 정확합니다.
 */
function renderMaintenance() {
  const el = $('maint-banner')
  const s = K.maintenanceStatus(new Date(), country)
  if (!s.notice) {
    el.hidden = true
    return
  }
  const kind = s.active ? 'active' : s.soon ? 'soon' : 'recovering'
  const icon = s.active ? '🌙' : s.soon ? '⏰' : '✅'
  el.className = kind
  el.innerHTML = `<b>${icon} ${esc(s.active ? s.label : s.soon ? '곧 점검 시작' : '점검 종료')}</b>${esc(s.notice)}<small>${esc(s.timezoneHint)}</small>`
  el.hidden = false
}
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

let cart = []
let prefs = { zone: 'hanoi', track: 'forwarding' }
let backend = 'http://localhost:3000'
let country = 'VN'

async function init() {
  const cfg = await send('getConfig')
  if (cfg?.config?.policy) K.applyConfig(cfg.config.policy)
  if (cfg?.config?.preferences) prefs = { ...prefs, ...cfg.config.preferences }
  if (cfg?.config?.destination?.country) country = cfg.config.destination.country
  if (cfg?.config?.maintenance) K.applyConfig({ maintenance: cfg.config.maintenance })
  renderMaintenance()

  $('src-badge').textContent = cfg?.offline ? '오프라인' : cfg?.stale ? '캐시' : '연결됨'
  $('src-badge').className = 'badge' + (cfg?.offline || cfg?.stale ? ' offline' : '')

  const { backend: saved } = await new Promise((r) => chrome.storage.local.get('backend', r))
  if (saved) backend = saved
  $('backend').value = backend

  const policy = K.currentPolicy()
  const zoneSel = $('zone')
  zoneSel.innerHTML = Object.entries(policy.zones)
    .map(([k, z]) => `<option value="${k}">${esc(z.label.split(' (')[0])}${z.surchargeUsd > 0 ? ` (+$${z.surchargeUsd})` : ''}</option>`)
    .join('')
  zoneSel.value = prefs.zone
  $('track').value = prefs.track

  $('policy').innerHTML = `
    국제배송 <b>$${policy.ratePerKgUsd}/kg</b> · 최소 ${policy.minBillableKg}kg<br>
    <span style="opacity:.75">청구무게 올림: ${esc(policy.roundingRuleText)}</span><br>
    대신 사드리는 수수료 <b>기본 ${(policy.agencyBaseKrw ?? 5000).toLocaleString('ko-KR')}원</b> (상품가 ${((policy.agencyBaseMaxGoodsKrw ?? 100000) / 10000)}만원·${policy.agencyBaseMaxItems ?? 5}종까지) · 관세·VAT 없음<br>
    환율 $1 = ${policy.usdToKrw.toLocaleString('ko-KR')}원 = ${Math.round(policy.usdToKrw * policy.krwToVnd).toLocaleString('en-US')}₫<br>
    합배송 무료 보관 ${policy.consolidation.freeStorageDays}일`

  const res = await send('getCart')
  cart = res?.cart ?? []
  render()
}

function render() {
  const empty = cart.length === 0
  $('cart-empty').hidden = !empty
  $('cart-actions').hidden = empty
  $('cart-list').innerHTML = ''
  $('cart-quote').innerHTML = ''
  if (empty) return

  $('cart-list').innerHTML = cart
    .map(
      (i, idx) => `<div class="item"><div class="m">
        <p class="n">${esc(i.productName)}${i.track === 'agent' ? '<span class="tag">대신 구매</span>' : ''}</p>
        <div class="p">${esc(K.krw(i.productPrice * i.quantity))}</div>
        <div class="qty"><button data-i="${idx}" data-d="-1">−</button><span>${i.quantity}</span><button data-i="${idx}" data-d="1">＋</button></div>
      </div></div>`,
    )
    .join('')

  $('cart-list')
    .querySelectorAll('.qty button')
    .forEach((b) =>
      b.addEventListener('click', async () => {
        const i = Number(b.dataset.i)
        cart[i].quantity += Number(b.dataset.d)
        if (cart[i].quantity <= 0) cart.splice(i, 1)
        await send('setCart', cart)
        render()
      }),
    )

  // 트랙이 섞여 있으면 각각 계산해야 정확합니다.
  const groups = { forwarding: [], agent: [] }
  for (const i of cart) groups[i.track === 'agent' ? 'agent' : 'forwarding'].push(i)

  const parts = []
  let total = 0
  let totalVnd = 0
  for (const [track, items] of Object.entries(groups)) {
    if (items.length === 0) continue
    const q = K.quote(items, { track, zone: prefs.zone })

    if (!q.eligibility.shippable) {
      parts.push(
        `<div class="blocked">🚫 배송 불가 상품이 있습니다<br>${q.eligibility.blocked
          .map((b) => `· ${esc(b.productName)} — ${esc(b.label)}`)
          .join('<br>')}</div>`,
      )
      continue
    }

    total += q.total
    totalVnd += q.totalVnd
    parts.push(
      `<div class="note">${track === 'agent' ? '구매하고 배송까지' : '배송만'} · 청구무게 ${q.shipping.billableKg}kg</div>` +
        q.breakdown
          .map((r) => `<div class="row"><span class="l">${esc(r.label)}</span><span class="v">${esc(K.krw(r.krw))}</span></div>`)
          .join(''),
    )
  }

  if (total > 0) {
    parts.push(`<div class="row total"><span class="l">합계</span><span class="v">${esc(K.krw(total))}</span></div>
      <div class="vnd">${esc(K.vnd(totalVnd))}</div>`)
  }

  // 합배송 안내 — 주문이 여러 건이면 절감액을 보여줍니다.
  if (cart.length > 1) {
    const cmp = K.compareConsolidation(
      cart.map((i) => ({ items: [i] })),
      { zone: prefs.zone },
    )
    if (cmp.worthwhile) {
      parts.push(
        `<div class="note good">📦 합배송하면 <b>$${cmp.savingsUsd}</b> (${esc(K.krw(cmp.savingsKrw))}) 절약됩니다.
         개별 ${cmp.separate.billableKg}kg → 합배송 ${cmp.consolidated.billableKg}kg</div>`,
      )
    }
  }

  // 최소 주문 금액 — 두 방식은 따로 접수되므로 방식별로 판정합니다 (서버가 받는 묶음과 동일).
  const minOrderKrw = K.currentPolicy().minOrderGoodsKrw
  const goodsByTrack = {}
  for (const i of cart) {
    const t = i.track === 'agent' ? 'agent' : 'forwarding'
    goodsByTrack[t] = (goodsByTrack[t] ?? 0) + (Number(i.productPrice) || 0) * (Number(i.quantity) || 1)
  }
  const short = Object.entries(goodsByTrack).filter(([, g]) => minOrderKrw > 0 && g > 0 && g < minOrderKrw)
  for (const [t, g] of short) {
    parts.push(`<div class="note warn">🧺 ${t === 'agent' ? '구매하고 배송까지' : '배송만'} 상품은 최소 주문 금액이 상품가 합계
      <b>${esc(K.krw(minOrderKrw))}</b> 입니다. <b>${esc(K.krw(minOrderKrw - g))}</b> 더 담아주세요.</div>`)
  }
  // 버튼이 여는 것은 구매하고 배송까지 묶음이므로 그 묶음의 미달만 버튼을 막습니다.
  const belowMin = short.some(([t]) => t === 'agent')

  $('cart-quote').innerHTML = parts.join('')
  $('btn-order').disabled = total === 0 || belowMin
  // 버튼 이름은 담긴 상품에 맞게 — "주문 요청하기" 는 배송만 손님에게 "지금 신청서를 쓰라" 로 읽힙니다.
  const hasAgent = cart.some((i) => i.track === 'agent')
  const hasForwarding = cart.some((i) => i.track !== 'agent')
  const onlyForwarding = cart.length > 0 && !hasAgent
  $('btn-order').textContent = onlyForwarding
    ? '쇼핑몰에서 먼저 결제하세요 — 순서 보기'
    : hasForwarding ? '주문 요청하기 — 순서 보기' : '주문 요청하기'
  // 배송만 상품이 없을 때만 안내를 접습니다 (있으면 펼친 채로 두어 읽을 수 있게).
  if (!hasForwarding) $('order-note').hidden = true
}

document.querySelectorAll('.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    for (const tab of ['cart', 'ops', 'settings']) $(`tab-${tab}`).hidden = b.dataset.tab !== tab
    if (b.dataset.tab === 'ops') renderOps()
  }),
)

/**
 * ─────────────── 운영자 모드 ───────────────
 * 발주 대기(PAID)·매입 중(PURCHASING)인 구매대행 주문을 보여주고,
 * 상품 탭 일괄 열기 → 쿠팡 결제 → 주문번호 자동/수동 기록까지 잇습니다.
 * 토큰과 요청은 전부 백그라운드가 처리하고, 팝업은 화면만 그립니다.
 */

const OPS_STATE_LABEL = { PAID: '발주 대기', PURCHASING: '매입 중 — 결제 후 자동 기록됩니다' }

async function renderOps() {
  const st = await send('getAdminState')
  $('ops-token-state').textContent = st.hasToken ? '· 저장됨' : ''
  // 지우는 길을 버튼으로 — 「빈 칸으로 저장」은 알기 어려웠습니다 (운영자 26-09-06).
  $('ops-token-clear').hidden = !st.hasToken
  $('ops-token-note').hidden = !st.hasToken
  const list = $('ops-list')
  if (!st.hasToken) {
    $('ops-empty').hidden = false
    list.innerHTML = ''
    return
  }
  $('ops-empty').hidden = true
  list.innerHTML = '<p class="note">불러오는 중…</p>'

  const res = await send('adminFetch', { path: '/api/orders' })
  if (!res.ok) {
    list.innerHTML = `<div class="blocked">${esc(res.data?.error || res.error || '주문을 불러오지 못했습니다.')}</div>`
    return
  }
  const orders = (res.data?.orders ?? []).filter(
    (o) => o.track === 'agent' && ['PAID', 'PURCHASING'].includes(o.state),
  )
  if (orders.length === 0) {
    list.innerHTML = '<p class="note">발주할 구매대행 주문이 없습니다.</p>'
    return
  }

  list.innerHTML = orders
    .map((o, i) => {
      const items = (o.items ?? [])
        .map((it) => `<div class="ops-item">· ${esc(it.productName)} <b>× ${it.quantity}</b></div>`)
        .join('')
      const capture =
        o.state === 'PURCHASING'
          ? `<div class="ops-capture">
              <input data-cap="no" data-i="${i}" placeholder="쇼핑몰 주문번호" inputmode="numeric">
              <input data-cap="amt" data-i="${i}" placeholder="실결제액(원)" inputmode="numeric">
              <button class="btn ghost" data-act="record" data-i="${i}">매입 기록</button>
            </div>`
          : `<button class="btn ghost" data-act="start" data-i="${i}">발주 착수</button>`
      return `<div class="ops-card" data-order="${esc(o.id)}">
        <div class="ops-head"><b>${esc(o.orderNo)}</b><span>${OPS_STATE_LABEL[o.state]}</span></div>
        ${items}
        <div class="ops-actions">
          <button class="btn ghost" data-act="tabs" data-i="${i}">상품 탭 열기</button>
          ${capture}
        </div>
      </div>`
    })
    .join('')

  const action = async (o, action, payload = {}) => {
    const r = await send('adminFetch', {
      path: `/api/orders/${o.id}/action`, method: 'POST', body: { action, payload },
    })
    if (!r.ok) alert(r.data?.error || r.error || '요청이 실패했습니다.')
    renderOps()
  }

  list.querySelectorAll('button[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      const o = orders[Number(b.dataset.i)]
      if (b.dataset.act === 'start') return action(o, 'startPurchase')
      if (b.dataset.act === 'tabs') {
        const urls = (o.items ?? [])
          .map((it) => it.productUrl || (it.productId ? `https://www.coupang.com/vp/products/${it.productId}` : null))
          .filter(Boolean)
        return send('openTabs', { urls })
      }
      if (b.dataset.act === 'record') {
        const no = list.querySelector(`input[data-cap="no"][data-i="${b.dataset.i}"]`)?.value.trim()
        const amt = Number(list.querySelector(`input[data-cap="amt"][data-i="${b.dataset.i}"]`)?.value.replace(/,/g, ''))
        if (!no || !Number.isFinite(amt) || amt <= 0) return alert('쇼핑몰 주문번호와 실결제액을 입력하세요.')
        return action(o, 'recordPurchase', { coupangOrderNo: no, amountKrw: amt })
      }
    }),
  )
}

$('ops-token-save').addEventListener('click', async () => {
  await send('setAdminToken', { token: $('ops-token').value })
  $('ops-token').value = ''
  renderOps()
})

$('ops-token-clear').addEventListener('click', async () => {
  await send('setAdminToken', { token: '' })
  $('ops-token').value = ''
  renderOps()
})

$('btn-clear').addEventListener('click', async () => {
  cart = []
  await send('setCart', [])
  render()
})

// 「모두 지우기」 — 고객 상태로 처음부터 다시 시험할 때 (운영자 26-09-06). 서버 주소는 남습니다.
$('btn-reset').addEventListener('click', async () => {
  if (!confirm('견적함·설정·운영자 토큰을 모두 지우고 처음 설치한 상태로 돌아갑니다. 서버 주소는 남습니다.')) return
  const res = await send('resetAll')
  if (!res?.ok) { alert(res?.error ?? '지우지 못했습니다.'); return }
  location.reload()
})

/**
 * [주문 요청하기]
 *   판단은 **견적함에 실제로 담긴 상품의 방식**으로 합니다. 설정의 "기본 이용
 *   방식"(prefs.track)은 상품 화면의 첫 선택값일 뿐이라, 그걸로 가르면
 *   구매하고 배송까지 상품만 담은 분이 "쿠팡 결제가 먼저" 안내에 막히고
 *   (검토 26-09-04), 반대로 배송만 상품이 구매대행으로 둔갑합니다.
 *
 *   구매하고 배송까지 상품 → 그 상품들만 골라 신청서로 (결제는 저희가 하므로 바로)
 *   배송만 상품          → 쿠팡 결제가 먼저입니다. 신청서는 결제가 끝난
 *                         주문완료 화면에서 저절로 열립니다 (운영자 확정 26-09-04).
 *                         결제를 마쳤는데 그 화면을 놓친 분은 쿠팡 주문번호를
 *                         적고 여는 길을 남깁니다 — 번호가 있어야 결제 후라는
 *                         뜻이고, 같은 번호는 두 번 접수되지 않습니다.
 *
 * 백그라운드에는 골라낸 상품을 그대로 실어 보냅니다. items 없이 보내면
 * 백그라운드가 견적함 대신 최근 결제창 초안을 집어 다른 상품이 열릴 수 있고,
 * track:'agent' 는 실린 상품을 통째로 구매대행으로 바꿔 열기 때문입니다.
 */
const agentItemsInCart = () => cart.filter((i) => i.track === 'agent')
const hasForwardingInCart = () => cart.some((i) => i.track !== 'agent')

const openAgentForm = async () => {
  const items = agentItemsInCart()
  if (items.length === 0) return
  const res = await send('openCheckout', { track: 'agent', items })
  if (!res?.ok) alert(res?.error ?? '신청서를 열지 못했습니다.')
}

$('btn-order').addEventListener('click', async () => {
  /**
   * 배송만 상품이 섞여 있으면 **같은 클릭에서 탭을 열지 않습니다.**
   * 새 탭이 열리는 순간 크롬이 팝업을 닫아 버려, 펼친 안내를 아무도 못 읽었습니다
   * (검토 26-09-04, 실제 크롬에서 0.25초 만에 닫힘). 첫 클릭은 안내만 펼치고,
   * 구매하고 배송까지 상품은 안내 안의 버튼으로 따로 엽니다.
   */
  if (hasForwardingInCart() && $('order-note').hidden) {
    $('order-note').hidden = false
    $('order-agent').hidden = agentItemsInCart().length === 0
    return
  }
  await openAgentForm()
})
$('order-agent').addEventListener('click', openAgentForm)
$('order-late').addEventListener('click', async () => {
  // 결제 후에만 열립니다 — 쿠팡 주문번호가 그 증거입니다 (주문완료 화면과 같은 9자리 이상).
  const coupangOrderNo = $('late-no').value.replace(/\D/g, '')
  if (coupangOrderNo.length < 9) {
    alert('주문번호를 적어주세요. (쇼핑몰 앱 > 마이페이지 > 주문목록에서 볼 수 있습니다)')
    return
  }
  // 팝업이 보여준 배송만 상품을 그대로 싣습니다 — 안 실으면 백그라운드가 최근
  // 결제창 초안(다른 상품일 수 있음)을 집어 주문번호에 엉뚱한 물건이 붙습니다.
  const items = cart.filter((i) => i.track !== 'agent')
  const res = await send('openCheckout', { track: 'forwarding', coupangOrderNo, items })
  if (!res?.ok) alert(res?.error ?? '신청서를 열지 못했습니다.')
})

$('zone').addEventListener('change', async (e) => {
  prefs.zone = e.target.value
  await send('setPreference', { zone: prefs.zone })
  render()
})
$('track').addEventListener('change', async (e) => {
  $('order-note').hidden = true
  prefs.track = e.target.value
  await send('setPreference', { track: prefs.track })
})
$('backend').addEventListener('change', (e) => {
  backend = e.target.value.replace(/\/$/, '')
  // 설정 캐시(6시간)도 함께 비웁니다 — 서버를 바꿨는데 옛 서버의 요율·창고
  // 주소로 계속 계산하면 그게 더 위험합니다.
  chrome.storage.local.set({ backend, configAt: 0 })
})

init()
setInterval(renderMaintenance, 60_000)
