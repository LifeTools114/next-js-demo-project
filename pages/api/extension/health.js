/**
 * 쿠팡 화면 자가진단 수집
 *
 * POST — 확장이 "필요한 문구를 못 찾았다"고 알릴 때 (누구나 호출 가능)
 *   쿠팡이 화면 문구를 바꾸면 자동입력이 조용히 멈춥니다. 고객 연락으로
 *   알게 되면 이미 매출이 멈춘 뒤라, 확장이 먼저 스스로 알리게 했습니다.
 *   운영자는 /admin 의 「쿠팡 화면 점검」에서 보고 config/coupang-patterns.js
 *   에 문구를 추가하면 됩니다 — 확장 재배포 없이 몇 분이면 복구됩니다.
 *
 * GET — 운영자만 (요약 조회)
 *
 * ⚠️ 개인정보는 받지 않습니다. 들어오는 값은 문구 키·개수·경로·버전뿐이며,
 *    화이트리스트 밖의 필드는 여기서 버립니다. 본문 크기도 제한합니다.
 */

import { isAdminRequest } from '../../../lib/auth.js'
import { appendLog } from '../../../lib/order/persist.js'
import { COUPANG_PATTERNS } from '../../../config/coupang-patterns.js'

/** HMR·재요청에도 살아남게 전역 하나로 둡니다 (주문 저장소와 같은 방식) */
const bucket = (globalThis.__kbHealth ??= { entries: new Map(), window: { at: 0, n: 0 } })

const MAX_ENTRIES = 300
/** 폭주 방지 — 한 시간에 이만큼만 받습니다 (공개 엔드포인트) */
const MAX_PER_HOUR = 2000

const str = (v, max) => String(v ?? '').slice(0, max)
const KEY_RE = /^[a-zA-Z]{1,24}$/

/** 확장이 보낸 보고를 좁혀 받습니다 — 모르는 필드는 버립니다. */
function sanitize(body) {
  const missing = (Array.isArray(body?.missing) ? body.missing : [])
    .map((x) => str(x, 24)).filter((x) => KEY_RE.test(x)).slice(0, 8)
  const found = {}
  for (const [k, v] of Object.entries(body?.found ?? {}).slice(0, 8)) {
    if (KEY_RE.test(k)) found[str(k, 24)] = Math.max(0, Math.min(Number(v) || 0, 9999))
  }
  return {
    kind: ['checkout', 'addrAutofill', 'price', 'product'].includes(body?.kind) ? body.kind : 'unknown',
    missing,
    found,
    host: str(body?.host, 40).replace(/[^a-z0-9.\-]/gi, ''),
    path: str(body?.path, 80).replace(/[^a-z0-9/_\-.]/gi, ''),
    ext: str(body?.ext, 16).replace(/[^0-9.]/g, ''),
    pat: Math.max(-1, Math.min(Number(body?.pat) || 0, 99999)),
    patSource: body?.patSource === 'server' ? 'server' : 'bundled',
    stage: str(body?.stage, 24).replace(/[^a-z]/gi, ''),
    rejected: (Array.isArray(body?.rejected) ? body.rejected : [])
      .map((x) => str(x, 40)).slice(0, 8),
  }
}

/** 같은 증상은 한 줄로 모읍니다 — 운영자가 볼 때 100건의 같은 소음이 아니라 "N회"로 */
function record(report) {
  const now = Date.now()
  if (now - bucket.window.at > 3600_000) bucket.window = { at: now, n: 0 }
  bucket.window.n += 1
  if (bucket.window.n > MAX_PER_HOUR) return { ok: false, throttled: true }

  const sig = `${report.kind}|${report.missing.join(',')}|${report.host}|${report.pat}`
  const prev = bucket.entries.get(sig)
  if (prev) {
    prev.count += 1
    prev.lastAt = now
    prev.found = report.found
  } else {
    bucket.entries.set(sig, { sig, ...report, count: 1, firstAt: now, lastAt: now })
    // 오래된 것부터 버립니다 — Map 은 삽입 순서를 지킵니다.
    while (bucket.entries.size > MAX_ENTRIES) {
      bucket.entries.delete(bucket.entries.keys().next().value)
    }
  }
  // 재시작해도 남게 파일에도 한 줄 — 개인정보가 없어 그대로 보관해도 안전합니다.
  appendLog('coupang-health.jsonl', { at: new Date(now).toISOString(), ...report })
  return { ok: true, first: !prev }
}

/** 운영자 화면용 요약 — 최근 것이 위로 */
export function healthSummary({ hours = 72 } = {}) {
  const since = Date.now() - hours * 3600_000
  const items = [...bucket.entries.values()]
    .filter((e) => e.lastAt >= since)
    .sort((a, b) => b.lastAt - a.lastAt)
  return {
    patternVersion: COUPANG_PATTERNS.version,
    total: items.reduce((s, e) => s + e.count, 0),
    /** 자동 등록이 끝내 실패한 건 — 가장 급한 신호 */
    autofillFailures: items.filter((e) => e.kind === 'addrAutofill').reduce((s, e) => s + e.count, 0),
    /** 서버 문구가 아직 반영되지 않은 확장이 있는지 */
    staleExtensions: [...new Set(items.filter((e) => e.pat < COUPANG_PATTERNS.version).map((e) => e.ext))].filter(Boolean),
    items: items.slice(0, 50).map((e) => ({
      kind: e.kind, missing: e.missing, found: e.found, host: e.host, path: e.path,
      ext: e.ext, pat: e.pat, patSource: e.patSource, stage: e.stage, rejected: e.rejected,
      count: e.count,
      firstAt: new Date(e.firstAt).toISOString(),
      lastAt: new Date(e.lastAt).toISOString(),
    })),
  }
}

/** 테스트·운영 초기화용 */
export function resetHealth() {
  bucket.entries.clear()
  bucket.window = { at: 0, n: 0 }
}

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

export default function handler(req, res) {
  if (req.method === 'POST') {
    // 확장은 쿠팡 도메인에서 부르므로 CORS 를 열어둡니다 (개인정보 없는 익명 보고).
    res.setHeader('Access-Control-Allow-Origin', '*')
    const report = sanitize(req.body ?? {})
    if (report.kind === 'unknown' && report.missing.length === 0) {
      return res.status(400).json({ error: '보고 내용이 비어 있습니다.' })
    }
    const out = record(report)
    return res.status(202).json(out)
  }

  if (req.method === 'GET') {
    // 요약에는 어떤 문구가 깨졌는지가 담깁니다 — 운영 정보라 토큰을 요구합니다.
    if (!isAdminRequest(req)) return res.status(401).json({ error: '운영자 인증이 필요합니다.' })
    return res.status(200).json(healthSummary({ hours: Number(req.query.hours) || 72 }))
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'GET 또는 POST 만 지원합니다.' })
}
