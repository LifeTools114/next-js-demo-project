/** 「쿠팡으로 가기」 버튼 주소 — 파트너스 링크는 환경변수로만, 고지 문구와 함께 (config/partners.js) */
import test from 'node:test'
import assert from 'node:assert/strict'
import { shopLink, SHOP_HOME, PARTNERS_NOTICE } from '../config/partners.js'

test('환경변수가 없으면 보통 쿠팡 주소, 있으면(쿠팡 도메인 https 만) 파트너스 링크', () => {
  assert.deepEqual(shopLink({}), { href: SHOP_HOME, isPartner: false })
  assert.deepEqual(shopLink({ COUPANG_PARTNERS_LINK: ' https://link.coupang.com/a/abc123 ' }), { href: 'https://link.coupang.com/a/abc123', isPartner: true })
  assert.deepEqual(shopLink({ COUPANG_PARTNERS_LINK: 'http://evil.example.com/x' }), { href: SHOP_HOME, isPartner: false })
  assert.deepEqual(shopLink({ COUPANG_PARTNERS_LINK: 'https://link.coupang.com/' }), { href: SHOP_HOME, isPartner: false })
})

test('고지 문구는 공정위 표시 의무 문장이다', () => {
  assert.match(PARTNERS_NOTICE, /쿠팡 파트너스 활동의 일환으로.*수수료를 제공받습니다/)
})
