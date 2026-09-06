/** 고객 주문 화면에서 견적서를 열 수 있어야 합니다 (운영자 26-09-06: "견적서 출력 부분이 빠진 것 같다"). */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

test('주문 화면에 임시·최종 견적서 링크가 있고, 인쇄 화면과 API 가 살아 있다', () => {
  const page = readFileSync(new URL('../pages/orders/[id].js', import.meta.url), 'utf8')
  assert.ok(page.includes('/quote/${order.orderNo}?kind=provisional'), '임시 견적서 링크')
  assert.ok(page.includes('/quote/${order.orderNo}?kind=final'), '최종 견적서 링크')
  assert.ok(page.includes("['SETTLEMENT_DUE', 'SETTLED', 'SHIPPED', 'DELIVERED']"), '최종본은 실측 뒤에만')
  for (const f of ['pages/quote/[id].js', 'pages/api/orders/[id]/quote-doc.js', 'lib/quote-doc.js']) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} 가 있어야 합니다`)
  }
  const print = readFileSync(new URL('../pages/quote/[id].js', import.meta.url), 'utf8')
  assert.ok(print.includes('window.print()'), '인쇄 / PDF 저장 버튼')
})
