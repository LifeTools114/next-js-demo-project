import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOrderText, looksLikeOrder } from '../lib/ocr-order-parse.js'

// 가짜 「주문완료」 화면을 tesseract 로 읽은 결과 그대로
const ORDER1 = `주문완료
주문이 완료되었습니다
주문번호 3102787036952
배송지
YS-**** / 010-****6031
07504 서울특별시 강서구 개화동로11길 5 개화동 YS-ECOM 홍길동
배송요청사항 문 앞
주문 상품 2개
로켓배송
남양 임페리얼 XO 3단계 분유, 3600, 2개
옵션: 360g, 2개
31,800원 ㆍ1개
로켓배송
토리든 다이브인 저분자 히알루론산 세럼 50701, 1
개
39,800원 ㆍ2개
결제 정보
상품금액                                                                                          71,600원
배송비                                                                                    0원
총 결제금액                                          71,600원
주문 상세보기                쇼핑 계속하기`
const ORDER2 = `… 주문상세
2026.09.07 주문 ㆍ주문번호 9122192858123
배송준비중
판매자로켓
OSA 콤플렉스-30000001 저자극 약산성 410ml AE
푸 대용량, 6개
88,560원 ㆍ‥1개
받는사람 정보
YS-ECOM / 010-4803-6031
서울특별시 강서구 개화동로11길 5 (07504) YS-ECOM $ #1 마이
결제 정보
총 결제금액                                          88,560원`
const ALIMTALK = `[쿠팡] 주문이 완료되었습니다.
주문번호: 3102787036952
상품명: 남양 임페리얼 XO 3단계 분유, 360g, 2개 외 1건
결제금액: 71,600원
배송지: 서울특별시 강서구 개화동로11길 5 YS-ECOM 홍길동`

test('주문완료 화면 — 주문번호·상품 2개(이름·옵션·가격·수량)·창고 배송지·총액', () => {
  const r = parseOrderText(ORDER1)
  assert.equal(r.orderNo, '3102787036952')
  assert.equal(r.items.length, 2)
  assert.deepEqual(r.items[0], { productName: '남양 임페리얼 XO 3단계 분유, 3600, 2개', option: '360g, 2개', quantity: 1, productPrice: 31800 })
  assert.equal(r.items[1].productName, '토리든 다이브인 저분자 히알루론산 세럼 50701, 1개')
  assert.equal(r.items[1].quantity, 2); assert.equal(r.items[1].productPrice, 39800)
  assert.deepEqual(r.warehouse, { found: true, name: '홍길동' })
  assert.equal(r.total, 71600)
  assert.ok(looksLikeOrder(ORDER1))
})

test('주문상세 화면 — 흐트러진 글자여도 용량·개수·가격·수량은 살아남습니다', () => {
  const r = parseOrderText(ORDER2)
  assert.equal(r.orderNo, '9122192858123')
  assert.equal(r.items.length, 1)
  assert.ok(r.items[0].productName.includes('410ml') && r.items[0].productName.includes('6개'))
  assert.equal(r.items[0].productPrice, 88560); assert.equal(r.items[0].quantity, 1)
  assert.equal(r.warehouse.found, true)
})

test('주문 알림 문자 — 주문번호와 첫 상품, 「외 1건」', () => {
  const r = parseOrderText(ALIMTALK)
  assert.equal(r.orderNo, '3102787036952')
  assert.equal(r.items[0].productName, '남양 임페리얼 XO 3단계 분유, 360g, 2개 외 1건')
  assert.equal(r.moreItems, 1)
  assert.ok(looksLikeOrder(ALIMTALK))
  assert.equal(looksLikeOrder('토리든 세럼 19,900원'), false)
})

test('상품 화면(주문 아님)은 주문으로 보지 않습니다', () => {
  assert.equal(looksLikeOrder('로켓배송\n분유 360g\n31,800원\n와우회원 할인가'), false)
})
