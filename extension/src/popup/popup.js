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
    구매대행 수수료 <b>기본 ${(policy.agencyBaseKrw ?? 5000).toLocaleString('ko-KR')}원</b> (상품가 ${((policy.agencyBaseMaxGoodsKrw ?? 100000) / 10000)}만원·${policy.agencyBaseMaxItems ?? 5}종까지) · 관세·VAT 없음<br>
    환율 $1 = ${policy.usdToKrw.toLocaleString('ko-KR')}원 = ${Math.round(policy.usdToKrw * policy.krwToVnd).toLocaleString('en-US')}₫<br>
    합배송 무료 보관 ${policy.consolidation.freeStorageDays}일`
  $('disclosure').textContent = policy.affiliateDisclosure

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
        <p class="n">${esc(i.productName)}${i.track === 'agent' ? '<span class="tag">구매대행</span>' : ''}</p>
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
      `<div class="note">${track === 'agent' ? '구매대행' : '배송대행'} · 청구무게 ${q.shipping.billableKg}kg</div>` +
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

  // 최소 주문 금액 — 트랙이 섞여도 판정은 장바구니 상품가 합계 기준입니다 (서버와 동일).
  const goodsKrw = cart.reduce((s, i) => s + (Number(i.productPrice) || 0) * (Number(i.quantity) || 1), 0)
  const minOrderKrw = K.currentPolicy().minOrderGoodsKrw
  const belowMin = minOrderKrw > 0 && goodsKrw > 0 && goodsKrw < minOrderKrw
  if (belowMin) {
    parts.push(`<div class="note warn">🧺 최소 주문 금액은 상품가 합계 <b>${esc(K.krw(minOrderKrw))}</b> 입니다.
      <b>${esc(K.krw(minOrderKrw - goodsKrw))}</b> 더 담아주세요.</div>`)
  }

  $('cart-quote').innerHTML = parts.join('')
  $('btn-order').disabled = total === 0 || belowMin
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
              <input data-cap="no" data-i="${i}" placeholder="쿠팡 주문번호" inputmode="numeric">
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
        if (!no || !Number.isFinite(amt) || amt <= 0) return alert('쿠팡 주문번호와 실결제액을 입력하세요.')
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

$('btn-clear').addEventListener('click', async () => {
  cart = []
  await send('setCart', [])
  render()
})

$('btn-order').addEventListener('click', async () => {
  const payload = encodeURIComponent(JSON.stringify({ items: cart, zone: prefs.zone }))
  chrome.tabs.create({ url: `${backend}/checkout?cart=${payload}` })
})

$('zone').addEventListener('change', async (e) => {
  prefs.zone = e.target.value
  await send('setPreference', { zone: prefs.zone })
  render()
})
$('track').addEventListener('change', async (e) => {
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
