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
let prefs = { zone: 'hanoi-inner', track: 'forwarding' }
let backend = 'http://localhost:3000'
let country = 'VN'

async function init()
setInterval(renderMaintenance, 60_000) {
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
    국제배송 <b>$${policy.ratePerKgUsd}/kg</b> · 최소 ${policy.minBillableKg}kg · ${policy.roundingStepKg}kg 단위 올림<br>
    구매대행 수수료 <b>${Math.round(policy.agencyRate * 100)}%</b> · VAT ${Math.round(policy.vatRate * 100)}% · 관세 품목별<br>
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

  $('cart-quote').innerHTML = parts.join('')
  $('btn-order').disabled = total === 0
}

document.querySelectorAll('.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    $('tab-cart').hidden = b.dataset.tab !== 'cart'
    $('tab-settings').hidden = b.dataset.tab !== 'settings'
  }),
)

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
  chrome.storage.local.set({ backend })
})

init()
setInterval(renderMaintenance, 60_000)
