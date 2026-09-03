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
import { COUPANG_PATTERNS, PATTERN_LABELS, HEALTH_KIND_LABELS } from '../../../config/coupang-patterns.js'
import { notifyOperator } from '../../../lib/notify.js'

/**
 * HMR·재요청에도 살아남게 전역 하나로 둡니다 (주문 저장소와 같은 방식).
 *
 * 칸을 하나씩 채우는 이유: 코드를 고쳐 새 칸이 생겨도, 이미 떠 있는 서버가
 * 들고 있던 옛 객체에는 그 칸이 없습니다. 통째로 `??=` 하면 옛 객체가 그대로
 * 살아남아 새 칸이 undefined 인 채 터집니다 (실제로 겪은 오류입니다).
 */
const bucket = (globalThis.__kbHealth ??= {})
bucket.entries ??= new Map()
bucket.window ??= { at: 0, n: 0 }
bucket.alertWindow ??= { at: 0, n: 0 }

const MAX_ENTRIES = 300
/** 폭주 방지 — 한 시간에 이만큼만 받습니다 (공개 엔드포인트) */
const MAX_PER_HOUR = 2000

/**
 * ─────────────── 알림 규칙 ───────────────
 *
 * 쿠팡이 화면을 바꾸면 **지금** 알아야 합니다 — 관리자 화면을 열어볼 때까지
 * 기다리면 그 사이 고객이 막힙니다. 그래서 첫 보고에 바로 알립니다.
 *
 * 다만 화면 하나가 바뀌면 고객 수만큼 같은 보고가 들어옵니다. 그대로
 * 보내면 폰이 울리기만 하고 정작 내용을 못 봅니다. 그래서:
 *   · 같은 증상: 처음 즉시, 그 뒤로는 계속되는 동안 1시간에 한 번 (누적 횟수 포함)
 *   · 전체로도 시간당 6건까지 — 여러 화면이 한꺼번에 바뀌어도 폰이 안 잠깁니다
 */
const ALERT_QUIET_MS = 60 * 60 * 1000
const ALERT_MAX_PER_HOUR = 6

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

  const entry = bucket.entries.get(sig)
  const alerted = maybeAlert(entry, now)
  return { ok: true, first: !prev, alerted }
}

/** 알림을 보낼 때인가 — 보냈으면 true */
function maybeAlert(entry, now) {
  // 처음 보는 증상이면 alertedAt 이 없어 그 자리에서 통과합니다.
  if (now - (entry.alertedAt ?? 0) < ALERT_QUIET_MS) return false
  if (now - bucket.alertWindow.at > 3600_000) bucket.alertWindow = { at: now, n: 0 }
  if (bucket.alertWindow.n >= ALERT_MAX_PER_HOUR) return false

  bucket.alertWindow.n += 1
  entry.alertedAt = now
  notifyOperator({ tag: 'coupang-health', ...alertText(entry) })
  return true
}

/** 알림 문구 — 폰에서 이것만 보고도 무엇을 고칠지 알 수 있어야 합니다. */
function alertText(entry) {
  const what = HEALTH_KIND_LABELS[entry.kind] ?? HEALTH_KIND_LABELS.unknown
  const missing = entry.missing.map((k) => PATTERN_LABELS[k] ?? k).join(', ') || '일부 문구'
  const base = (process.env.BASE_URL || '').replace(/\/$/, '')
  return {
    title: `🚨 쿠팡 화면 변경 의심 — ${what}`,
    message: [
      `못 찾은 것: ${missing}`,
      `위치: ${entry.host}${entry.path} · 확장 v${entry.ext || '?'} · 문구 설정 v${entry.pat}`,
      entry.count > 1
        ? `누적 ${entry.count}회 — 계속되고 있습니다 (처음 ${new Date(entry.firstAt).toLocaleString('ko-KR')})`
        : `방금 처음 발생 (${new Date(entry.firstAt).toLocaleString('ko-KR')})`,
      '',
      `고치는 법: config/coupang-patterns.js 의 ${entry.missing.join(', ') || '해당 항목'} 에`,
      '새 문구를 추가하고 version 을 올린 뒤 서버 재시작 — 확장 재배포는 필요 없습니다.',
      base ? `관리자 화면: ${base}/admin` : '관리자 화면: /admin 의 「🩺 쿠팡 화면 점검」',
    ].join('\n'),
  }
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
  bucket.alertWindow = { at: 0, n: 0 }
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
