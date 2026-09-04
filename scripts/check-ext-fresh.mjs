/**
 * 확장 번들이 소스보다 낡았는지 검사
 *
 * 왜 필요한가 — 실제로 손해를 봤습니다.
 *
 *   확장은 `extension/vendor/calc.js` 하나만 읽습니다. 이 파일은 lib/ 와
 *   config/ 를 esbuild 로 묶은 결과물인데, **소스를 고쳐도 자동으로
 *   다시 묶이지 않습니다.** `npm run build:ext` 를 돌려야 갱신됩니다.
 *
 *   2026-09-04, 전자기기 할증 $40 이 쿠팡 제목에서 통째로 사라지던 것을
 *   고쳤는데(2ea1516) 번들을 다시 만들지 않고 커밋했습니다. 그래서
 *   사장님 크롬에 깔린 확장은 계속 옛날 계산을 했습니다.
 *
 *     "애플 아이폰 15 Pro 256GB 자급제 + 정품 케이스 증정"
 *        낡은 번들 12,420원  ←  사장님이 실제로 보던 금액
 *        고친 소스 67,620원
 *        건당 55,200원 손해
 *
 *   테스트는 소스를 보고 통과했고, 빌드도 통과했고, 화면도 멀쩡했습니다.
 *   아무도 알려주지 않는 종류의 손해라 검사로 막습니다.
 *
 * 어떻게 검사하나
 *   지금 소스로 메모리에서 다시 묶어보고, 커밋된 번들과 한 글자라도
 *   다르면 실패시킵니다. (같은 입력·같은 esbuild 면 결과가 같습니다)
 *
 *   esbuild 를 새로 깔아 버전이 달라졌을 때도 다르게 나올 수 있는데,
 *   그때 할 일도 똑같이 "다시 빌드하고 커밋" 이라 문제되지 않습니다.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// URL.pathname 은 Windows 에서 "/C:/..." 를 돌려줘 경로가 깨집니다.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BUNDLE = new URL('../extension/vendor/calc.js', import.meta.url)

/**
 * package.json 의 build:ext 와 **같은 설정**이어야 합니다.
 * 한쪽만 고치면 이 검사가 늘 실패하거나(거짓 경보) 늘 통과합니다(무용지물).
 */
const OPTIONS = {
  absWorkingDir: ROOT,
  entryPoints: ['lib/extension-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'KBCalc',
  minify: true,
  target: 'chrome110',
}

/** 지금 소스로 다시 묶은 결과(문자열)를 돌려줍니다. 파일로 쓰지 않습니다. */
export async function rebuildBundle() {
  const r = await build({ ...OPTIONS, write: false })
  return r.outputFiles[0].text
}

/** 커밋된 번들이 소스와 같은가? */
export async function bundleIsFresh() {
  const committed = readFileSync(BUNDLE, 'utf8')
  const rebuilt = await rebuildBundle()
  return {
    fresh: committed === rebuilt,
    committed,
    rebuilt,
    committedBytes: committed.length,
    rebuiltBytes: rebuilt.length,
  }
}

// 직접 실행했을 때 (빌드 파이프라인)
if (process.argv[1]?.endsWith('check-ext-fresh.mjs')) {
  const r = await bundleIsFresh()
  if (r.fresh) {
    console.log(`✓ 확장 번들이 소스와 일치합니다 (${(r.committedBytes / 1024).toFixed(1)}KB)`)
  } else {
    console.error('\n✗ 확장 번들이 소스보다 낡았습니다.')
    console.error(`  커밋된 번들 ${r.committedBytes}바이트 ↔ 지금 소스로 묶으면 ${r.rebuiltBytes}바이트`)
    console.error('\n  사장님 크롬에 깔린 확장은 이 파일 하나만 읽습니다.')
    console.error('  이대로 두면 고친 계산이 확장에 반영되지 않아 금액이 틀립니다.')
    console.error('\n  고치는 법:  npm run build:ext   그리고 함께 커밋하세요.\n')
    process.exit(1)
  }
}
