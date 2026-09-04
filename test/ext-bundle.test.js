/**
 * 확장 번들이 소스와 같은지 — 테스트에서 지킵니다
 *
 * 이 검사가 없어서 놓친 적이 있습니다(2026-09-04). 전자기기 할증이
 * 사라지던 계산 오류를 고치고 테스트도 통과했는데, 확장에 실리는
 * `extension/vendor/calc.js` 를 다시 만들지 않고 커밋해서 **사장님이
 * 쓰는 확장만 옛날 계산을 계속했습니다.** 건당 55,200원 차이였습니다.
 *
 * 테스트는 lib/ 소스를 직접 부르기 때문에 절대 눈치채지 못합니다.
 * 그래서 여기서 번들 자체를 봅니다.
 *
 *   실패하면:  npm run build:ext  그리고 번들을 함께 커밋하세요.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { bundleIsFresh } from '../scripts/check-ext-fresh.mjs'

test('확장 번들이 지금 소스와 일치한다 (낡은 번들 커밋 방지)', async () => {
  const r = await bundleIsFresh()
  assert.ok(
    r.fresh,
    `extension/vendor/calc.js 가 소스보다 낡았습니다 (${r.committedBytes}바이트 ↔ ${r.rebuiltBytes}바이트).\n` +
      '      확장은 이 파일만 읽으므로, 고친 계산이 사장님 화면에 반영되지 않습니다.\n' +
      '      npm run build:ext 를 돌리고 번들을 함께 커밋하세요.',
  )
})

/**
 * 번들이 "최신"이어도 실제로 계산이 맞는지는 별개입니다.
 * 확장이 브라우저에서 하듯 번들을 그대로 실행해서, 돈이 걸린 계산 몇 개를
 * 확인합니다. 번들이 깨졌거나 export 가 빠지면 여기서 걸립니다.
 */
test('번들을 브라우저처럼 실행해도 금액이 소스와 같다', async () => {
  const code = readFileSync(new URL('../extension/vendor/calc.js', import.meta.url), 'utf8')
  const ctx = vm.createContext({ console })
  vm.runInContext(code, ctx)
  const KB = ctx.KBCalc
  assert.ok(KB && typeof KB.quote === 'function', '번들이 KBCalc.quote 를 내놓아야 합니다')

  const { quote } = await import('../lib/pricing/landed.js')

  const cases = [
    // 액세서리 단어가 붙은 전자기기 — 할증이 사라지던 바로 그 형태
    [{ productName: '애플 아이폰 15 Pro 256GB 자급제 + 정품 케이스 증정', productPrice: 1_290_000, quantity: 1 }],
    [{ productName: '다이슨 V15 무선청소기 + 여분 먼지통 포함', productPrice: 990_000, quantity: 1 }],
    // 평범한 화장품 — 할증 없는 쪽도 같아야 합니다
    [{ productName: '토리든 다이브인 세럼 50ml', productPrice: 18_000, quantity: 3 }],
  ]
  for (const items of cases) {
    const fromBundle = KB.quote(items, { track: 'forwarding' })
    const fromSource = quote(items, { track: 'forwarding' })
    assert.equal(
      fromBundle.total,
      fromSource.total,
      `"${items[0].productName}" — 번들 ${fromBundle.total.toLocaleString()}원, 소스 ${fromSource.total.toLocaleString()}원`,
    )
  }
})
