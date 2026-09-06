/**
 * 고시정보 표에 무게가 없을 때 옵션 상자에서 읽기 (26-09-06).
 *
 * 사장님 화면: 아이엠마더 분유 — 고시정보엔 「총 수량: 1개」뿐이고 무게는 옵션 상자
 * 「개당 중량 × 개당 수량 × 수량 / 360g × 1개입 × 1개」에만 있었습니다. 못 읽으면
 * 분유 평균 800g 으로 잡혀 2개가 2.1kg(청구 2kg)이 됩니다. 실제는 0.9kg → 청구 1kg.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

await import('../extension/src/content/extract.js')
const E = globalThis.KBExtract

const leaf = (textContent) => ({ textContent, children: [], closest: () => null })
const withLeaves = (leaves) => {
  globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { querySelectorAll: () => leaves },
  }
}

test('옵션 상자의 「360g × 1개입 × 1개」를 읽는다 — 개입 수까지', () => {
  withLeaves([leaf('개당 중량 × 개당 수량 × 수량'), leaf('360g × 1개입 × 1개'), leaf('총 수량: 1개')])
  assert.deepEqual(E.extractOptionSpec(), { label: '옵션', value: '360g × 1개입' })
})

test('「내용량 500ml」 같은 짧은 표기도 읽고, 우리 카드 안의 글은 건너뛴다', () => {
  const ours = { textContent: '실측 2.1kg → 청구 2kg', children: [], closest: (sel) => (sel.includes('data-kb-ui') ? {} : null) }
  withLeaves([ours, leaf('내용량 500ml'), leaf('배송비 무료')])
  assert.deepEqual(E.extractOptionSpec(), { label: '옵션', value: '500ml' })
})

test('무게 표기가 없으면 null — 그때만 평균값으로 떨어진다', () => {
  withLeaves([leaf('분유 종류: 일반'), leaf('총 수량: 1개'), leaf('12개월 이상')])
  assert.equal(E.extractOptionSpec(), null)
})
