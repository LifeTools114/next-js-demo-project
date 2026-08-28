/**
 * 주문 저장소 파일 영속화
 *
 * 인메모리 Map 을 JSON 스냅샷으로 디스크에 남겨, 프로세스가 재시작해도
 * 주문·원장·상태가 살아남게 합니다. VPS·도커(볼륨)·PM2 환경을 가정합니다.
 *
 * ⚠️ 서버리스(Vercel 등)에서는 파일시스템이 인스턴스마다 분리되고
 *    배포 시 사라지므로 이 방식이 통하지 않습니다. 그 경우 store.js 의
 *    read/write 를 DB(Postgres 등)로 교체하세요 — 인터페이스는 그대로입니다.
 *
 * 쓰기는 임시 파일에 쓴 뒤 rename 하는 원자적 교체라, 쓰는 도중 프로세스가
 * 죽어도 직전 스냅샷은 온전합니다. 동기 쓰기라 응답 전에 디스크에 남습니다.
 * (주문 수백 건 규모에서 스냅샷 직렬화는 ms 단위 — 병목이 되면 그때가 DB 시점)
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE_NAME = 'orders.json'

function storeDir() {
  return process.env.ORDER_STORE_DIR || '.data'
}

/**
 * Node 테스트 러너(NODE_TEST_CONTEXT) 안에서는 기본적으로 끕니다.
 * 켠 채로 두면 테스트 주문이 .data/ 에 쌓이고, 다음 테스트가 그걸 복원해
 * 격리가 깨집니다. 영속화 자체를 검증하는 테스트는 ORDER_STORE_DIR 을
 * 명시해 다시 켭니다.
 */
function enabled() {
  if (process.env.ORDER_STORE_DISABLE === '1') return false
  if (process.env.NODE_TEST_CONTEXT && !process.env.ORDER_STORE_DIR) return false
  return true
}

/** 부팅 시 1회 호출 — 없거나 깨졌으면 null (깨진 파일은 보존 후 새로 시작) */
export function loadSnapshot() {
  if (!enabled()) return null
  const file = join(storeDir(), FILE_NAME)
  if (!existsSync(file)) return null
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(parsed?.orders)) throw new Error('스냅샷 형식이 아님')
    return { counter: Number(parsed.counter) || 0, orders: parsed.orders }
  } catch (e) {
    // 덮어쓰기 전에 원본을 남겨야 수동 복구라도 가능합니다.
    const backup = `${file}.corrupt-${Date.now()}`
    try { renameSync(file, backup) } catch { /* 백업 실패 시에도 기동은 계속 */ }
    console.error(`⚠️ 주문 스냅샷을 읽지 못해 ${backup} 으로 보존하고 빈 상태로 시작합니다:`, e.message)
    return null
  }
}

/**
 * 운영 로그 추가 기록 (jsonl) — 대조 실패한 입금, 알림 발송 이력 등.
 * 스토어와 같은 디렉터리·같은 on/off 규칙을 따릅니다.
 */
export function appendLog(fileName, record) {
  if (!enabled()) return
  const dir = storeDir()
  mkdirSync(dir, { recursive: true })
  appendFileSync(join(dir, fileName), `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`)
}

/* last N log records, newest first; missing or corrupt file yields [].
   NOTE: keep the comments around this function ASCII-only. Turbopack emits a
   "dynamic filesystem access" warning pointing here, and its code-frame
   highlighter panics on multibyte (Korean) chars at range boundaries
   (next-code-frame highlight.rs char-boundary bug, seen on Next 16.3.3). */
export function readLog(fileName, { limit = 50 } = {}) {
  if (!enabled()) return []
  const file = join(storeDir(), fileName)
  if (!existsSync(file)) return []
  try {
    return readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .slice(-limit)
      .map((line) => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean)
      .reverse()
  } catch {
    return []
  }
}

/* small named JSON state (fx rates etc.); same dir and on/off rules as the
   store. ASCII comments here too - see the readLog note above. */
export function readState(fileName) {
  if (!enabled()) return null
  const file = join(storeDir(), fileName)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/* atomic replace, like saveSnapshot */
export function writeState(fileName, obj) {
  if (!enabled()) return
  const dir = storeDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, fileName)
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify({ savedAt: new Date().toISOString(), ...obj }))
  renameSync(tmp, file)
}

/** 모든 변경 액션 끝에서 호출 — 전체 스냅샷 원자적 교체 */
export function saveSnapshot({ counter, orders }) {
  if (!enabled()) return
  const dir = storeDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, FILE_NAME)
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), counter, orders }))
  renameSync(tmp, file)
}
