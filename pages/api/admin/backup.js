/**
 * GET /api/admin/backup — 주문·고객 파일 한 번에 내려받기 (운영자)
 *
 * 디스크가 붙는 호스팅(Render·Railway)에는 cron 이 없어 scripts/backup-data.sh 를 못 돌립니다.
 * 대신 /admin 의 「백업 내려받기」로 일주일에 한 번 받아 구글드라이브에 두세요.
 * 내용: orders.json · customers.json · fx.json · 운영 로그(jsonl). 원가·마진이 든 운영 파일이므로
 * ADMIN_TOKEN 이 필요하고, 받은 파일은 사장님만 보관합니다.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { requireAdmin } from '../../../lib/auth.js'

export function collectBackup(dir) {
  if (!existsSync(dir)) return { files: {}, note: '저장 폴더가 아직 없습니다 (주문이 하나도 없음)' }
  const files = {}
  for (const name of readdirSync(dir)) {
    if (!/\.(json|jsonl)$/.test(name) || /\.tmp-|\.corrupt-/.test(name)) continue
    files[name] = readFileSync(join(dir, name), 'utf8')
  }
  return { files }
}

export default function handler(req, res) {
  try {
    requireAdmin(req)
  } catch (e) {
    return res.status(e.status ?? 401).json({ error: e.message })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' })
  }
  const dir = process.env.ORDER_STORE_DIR || '.data'
  const d = new Date(), p = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="backup-${stamp}.json"`)
  return res.status(200).send(JSON.stringify({ version: 1, savedAt: d.toISOString(), dir, ...collectBackup(dir) }))
}
