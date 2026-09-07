/**
 * 서버폰(대신 읽기 기기)용 확장 zip — 스토어용과 달리 운영자 전용 「대신 읽기」를 그대로 두고,
 * 기본 서버 주소만 naka 로 바꿉니다. 폰의 확장 지원 브라우저(Lemur 등)에 「zip 에서 설치」로 올립니다.
 *
 *   npm run pack:phone   →  dist/vietnam-helper-phone-<버전>.zip
 */
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const src = join(root, 'extension')
const stage = join(root, 'dist', 'phone')
const backend = String(process.env.STORE_BACKEND_URL || 'https://naka.1dollartool.com').replace(/\/$/, '')

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
cpSync(src, stage, { recursive: true, filter: (p) => !/\.DS_Store$|__MACOSX/.test(p) })

const swPath = join(stage, 'src', 'background', 'service-worker.js')
const sw = readFileSync(swPath, 'utf8').replace(/const DEFAULT_BACKEND = '[^']+'/, `const DEFAULT_BACKEND = '${backend}'`)
writeFileSync(swPath, sw)
const manifestPath = join(stage, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.host_permissions = (manifest.host_permissions ?? []).filter((h) => !/^http:\/\/localhost/.test(h))
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const out = join(root, 'dist', `vietnam-helper-phone-${manifest.version}.zip`)
rmSync(out, { force: true })
try {
  execFileSync('zip', ['-qr', out, '.'], { cwd: stage, stdio: 'inherit' })
} catch {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${stage}\\*' -DestinationPath '${out}' -Force`], { stdio: 'inherit' })
}
console.log(`✓ ${out}\n  서버 ${backend} · 대신 읽기 포함 · 폰의 확장 지원 브라우저에 「zip 에서 설치」`)
