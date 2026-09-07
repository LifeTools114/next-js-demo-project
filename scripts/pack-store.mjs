/**
 * 크롬 웹스토어용 zip 만들기 — 개발용 흔적을 걷어낸 배포본.
 *
 *   npm run pack:store                                   # 기본 서버 https://naka.1dollartool.com
 *   STORE_BACKEND_URL=https://다른.주소 npm run pack:store   # 다른 서버면
 *
 * 하는 일
 *   1. extension/ 을 dist/store/ 로 복사
 *   2. manifest.json 의 host_permissions 에서 http://localhost:3000/* 제거
 *   3. service-worker.js 의 DEFAULT_BACKEND 를 STORE_BACKEND_URL 로 교체
 *      (https 여야 하고, host_permissions 에 들어 있는 주소여야 합니다 — 아니면 중단)
 *   4. 운영자 전용 코드(대신 읽기 창 src/worker, kb-operator-only 블록) 제거 — 고객 배포본에 불필요
 *   5. 번들이 소스와 같은지(check:ext) 확인한 뒤 zip
 * 결과: dist/vietnam-helper-<버전>.zip  (윈도우는 PowerShell Compress-Archive, 그 밖에는 zip)
 */
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { stripOperatorBlocks, OPERATOR_MARKS } from './lib/operator-strip.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const src = join(root, 'extension')
const stage = join(root, 'dist', 'store')
const DEFAULT_STORE_BACKEND = 'https://naka.1dollartool.com'
const backend = String(process.env.STORE_BACKEND_URL || DEFAULT_STORE_BACKEND).replace(/\/$/, '')

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }
if (!/^https:\/\/[^/]+$/.test(backend)) fail(`STORE_BACKEND_URL 이 이상합니다: ${backend} — 예: https://naka.1dollartool.com (https, 경로 없이)`)

// 0. 번들이 소스와 같은지
try { execFileSync(process.execPath, [join(root, 'scripts', 'check-ext-fresh.mjs')], { stdio: 'inherit' }) } catch { fail('먼저 npm run build:ext 를 실행하세요') }

// 1. 복사
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
cpSync(src, stage, { recursive: true, filter: (p) => !/\.DS_Store$|__MACOSX/.test(p) && !/[\\/]src[\\/]worker([\\/]|$)/.test(p) })

// 운영자 전용 블록 제거 + 남은 흔적 검사 + 문법 확인
for (const rel of ['src/content/main.js', 'src/popup/popup.html', 'src/popup/popup.js', 'src/background/service-worker.js']) {
  const f = join(stage, rel)
  if (!existsSync(f)) continue
  const text = stripOperatorBlocks(readFileSync(f, 'utf8'))
  writeFileSync(f, text)
  for (const mark of OPERATOR_MARKS) if (text.includes(mark)) fail(`${rel} 에 운영자 전용 흔적이 남았습니다: ${mark}`)
  if (rel.endsWith('.js')) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' })
}
if (existsSync(join(stage, 'src', 'worker'))) fail('src/worker 가 배포본에 남았습니다')

// 2. manifest — 개발용 주소 제거, 배포 서버가 허용 목록에 있는지 확인
const manifestPath = join(stage, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.host_permissions = (manifest.host_permissions ?? []).filter((h) => !/^http:\/\/localhost/.test(h))
const host = new URL(backend).host
const allowed = manifest.host_permissions.some((pat) => {
  const m = pat.match(/^https:\/\/([^/]+)\//)
  if (!m) return false
  const p = m[1]
  return p.startsWith('*.') ? host === p.slice(2) || host.endsWith(p.slice(1)) : host === p
})
if (!allowed) fail(`${backend} 가 manifest host_permissions 에 없습니다. 먼저 manifest.json 에 https://${host}/* (또는 *.도메인) 을 넣으세요.`)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

// 3. 기본 서버 주소 교체
const swPath = join(stage, 'src', 'background', 'service-worker.js')
let sw = readFileSync(swPath, 'utf8')
const before = sw.match(/const DEFAULT_BACKEND = '([^']+)'/)
if (!before) fail('service-worker.js 에서 DEFAULT_BACKEND 를 찾지 못했습니다')
sw = sw.replace(/const DEFAULT_BACKEND = '[^']+'/, `const DEFAULT_BACKEND = '${backend}'`)
writeFileSync(swPath, sw)

// 4. zip
const out = join(root, 'dist', `vietnam-helper-${manifest.version}.zip`)
rmSync(out, { force: true })
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path "${stage}\\*" -DestinationPath "${out}" -Force`], { stdio: 'inherit' })
} else {
  execFileSync('zip', ['-qr', out, '.'], { cwd: stage, stdio: 'inherit' })
}
console.log(`✓ ${out}`)
console.log(`  이름 ${manifest.name} · 버전 ${manifest.version} · 서버 ${backend}`)
console.log(`  host_permissions: ${manifest.host_permissions.join(', ')}`)
console.log('  (localhost 제거됨 · DEFAULT_BACKEND 교체됨) → 크롬 웹스토어 대시보드에 이 zip 을 올리세요')
