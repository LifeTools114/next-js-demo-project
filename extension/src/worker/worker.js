/**
 * 대신 읽기 창 (운영자 전용) — 서버의 작업 줄(GET /api/worker/jobs)에서 상품 링크를 가져와
 * 뒤쪽 탭으로 열고, 상품 화면의 콘텐츠 스크립트(main.js)가 읽은 결과(workerResult)를 받아
 * 서버(POST /api/worker/jobs/:id)에 돌려준 뒤 탭을 닫습니다.
 *
 * 왜 창인가: 배경 서비스 워커는 30초면 잠들어 몇 초 간격의 확인을 못 합니다. 열어 둔 확장 페이지는 잠들지 않습니다.
 * 스토어 배포본에는 이 폴더가 들어가지 않습니다 (scripts/pack-store.mjs 가 뺍니다).
 */
const $ = (id) => document.getElementById(id)
const POLL_MS = 3000
const JOB_TIMEOUT_MS = 25000

let running = false
let timer = null
let backend = ''
let token = ''
const active = new Map()   // tabId → { jobId, url, startedAt, timeout }
const counts = { done: 0, failed: 0 }

const store = {
  get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (obj) => new Promise((r) => chrome.storage.local.set(obj, r)),
}

function log(text, bad = false) {
  const li = document.createElement('li')
  const t = new Date().toLocaleTimeString('ko-KR', { hour12: false })
  li.innerHTML = `<span class="k">${t}</span> ${bad ? '<span class="bad">' : '<b>'}${escapeHtml(text)}${bad ? '</span>' : '</b>'}`
  $('log').prepend(li)
  while ($('log').children.length > 40) $('log').lastChild.remove()
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function render() {
  $('dot').className = `dot${running ? ' on' : ''}`
  $('state').textContent = running ? '켜짐 — 3초마다 확인 중' : '꺼짐'
  $('toggle').textContent = running ? '대신 읽기 멈춤' : '대신 읽기 시작'
  $('toggle').className = running ? 'on' : ''
  $('backend').textContent = backend || '(팝업 [설정]에서 서버 주소를 넣어 주세요)'
  $('token').textContent = token ? '저장됨' : '(팝업 [운영]에서 토큰을 저장해 주세요)'
  $('done').textContent = counts.done
  $('failed').textContent = counts.failed
}

async function loadSettings() {
  const s = await store.get(['backend', 'adminToken', 'workerOn'])
  backend = String(s.backend ?? '').replace(/\/$/, '')
  token = String(s.adminToken ?? '')
  return Boolean(s.workerOn)
}

async function api(path, init = {}) {
  const res = await fetch(`${backend}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token, 'X-Admin-User': 'worker', ...(init.headers ?? {}) },
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

async function finish(tabId, jobId, result) {
  const job = active.get(tabId)
  if (job) { clearTimeout(job.timeout); active.delete(tabId) }
  try { await chrome.tabs.remove(tabId) } catch { /* 이미 닫힘 */ }
  const r = await api(`/api/worker/jobs/${encodeURIComponent(jobId)}`, { method: 'POST', body: JSON.stringify(result) })
  if (result.ok) { counts.done += 1; log(`읽음 ${result.productName?.slice(0, 40) ?? ''} · ${result.productPrice ?? '-'}원`) }
  else { counts.failed += 1; log(`실패 ${result.message ?? ''} (${jobId})`, true) }
  if (!r.ok) log(`서버에 결과를 못 보냈습니다 (${r.status})`, true)
  render()
}

async function openJob(job) {
  // 같은 작업을 두 번 열지 않습니다
  for (const v of active.values()) if (v.jobId === job.id) return
  const url = `${job.url}${job.url.includes('#') ? '&' : '#'}kbjob=${encodeURIComponent(job.id)}`
  let tab
  try { tab = await chrome.tabs.create({ url, active: false }) } catch (e) { log(`탭을 열지 못했습니다: ${e.message}`, true); return }
  const timeout = setTimeout(() => finish(tab.id, job.id, { ok: false, message: '시간 초과 — 상품 화면을 읽지 못했습니다' }), JOB_TIMEOUT_MS)
  active.set(tab.id, { jobId: job.id, url: job.url, startedAt: Date.now(), timeout })
  log(`여는 중 ${job.url.slice(0, 60)}`)
}

async function poll() {
  if (!running) return
  if (!backend || !token) { log('서버 주소와 운영자 토큰이 필요합니다', true); return }
  try {
    const r = await api(`/api/worker/jobs?limit=2`)
    if (!r.ok) { log(`서버 응답 ${r.status} — 토큰이 맞는지 확인하세요`, true); return }
    $('pending').textContent = r.data?.pending ?? 0
    for (const job of r.data?.jobs ?? []) await openJob(job)
  } catch (e) {
    log(`서버 연결 실패: ${e.message}`, true)
  }
}

// 상품 화면의 콘텐츠 스크립트가 보낸 결과 — 어느 탭에서 왔는지로 작업을 찾습니다
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'workerResult' || !sender?.tab?.id) return
  const job = active.get(sender.tab.id)
  if (!job) return
  const p = msg.payload ?? {}
  finish(sender.tab.id, job.jobId, p.ok
    ? { ok: true, productName: p.item?.productName, productPrice: p.item?.productPrice, spec: p.item?.specOverride ?? null,
        badges: p.item?.badges ?? [], categoryPath: p.item?.categoryPath ?? '', shippingText: p.item?.shippingText ?? '', blocked: p.blocked ?? null }
    : { ok: false, message: p.message ?? '읽기 실패' })
})

// 열었던 탭을 사람이 닫으면 실패로 마감
chrome.tabs.onRemoved.addListener((tabId) => {
  const job = active.get(tabId)
  if (!job) return
  clearTimeout(job.timeout); active.delete(tabId)
  api(`/api/worker/jobs/${encodeURIComponent(job.jobId)}`, { method: 'POST', body: JSON.stringify({ ok: false, message: '탭이 닫혔습니다' }) }).catch(() => {})
  counts.failed += 1; render()
})

async function setRunning(on) {
  running = on
  await store.set({ workerOn: on })
  clearInterval(timer); timer = null
  if (on) { timer = setInterval(poll, POLL_MS); poll() }
  render()
}

$('toggle').addEventListener('click', async () => { await loadSettings(); setRunning(!running) })
chrome.storage.onChanged.addListener(async (changes, area) => { if (area === 'local' && (changes.backend || changes.adminToken)) { await loadSettings(); render() } })

loadSettings().then((wasOn) => { render(); if (wasOn) setRunning(true) })
