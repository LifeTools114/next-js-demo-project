/**
 * 확장프로그램 스크립트 문법 검사
 *
 * content script·popup·service worker 는 esbuild 를 거치지 않고 원본이
 * 그대로 브라우저에 실려서, 문법 오류가 나면 **빌드는 성공하는데 확장만
 * 통째로 죽습니다**. 실제로 popup.js 가 한 줄 잘못 끼어 파싱조차 안 되는
 * 채 두 커밋을 지나친 적이 있어(2026-08), 빌드에서 막습니다.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// URL.pathname 은 Windows 에서 "/C:/..." 를 돌려줘 경로가 깨집니다.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.js')) yield p
  }
}

let failed = 0
const files = [...walk(join(ROOT, 'extension/src'))]
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  } catch (e) {
    failed++
    console.error(`✗ 문법 오류: ${file.replace(ROOT, '')}`)
    console.error(String(e.stderr))
  }
}

if (failed > 0) {
  console.error(`확장 스크립트 ${failed}개에 문법 오류가 있습니다. 빌드를 중단합니다.`)
  process.exit(1)
}
console.log(`✓ 확장 스크립트 문법 이상 없음 (${files.length}개 파일)`)
