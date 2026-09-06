import test from 'node:test'
import assert from 'node:assert/strict'
import { parseShotText } from '../lib/ocr-parse.js'

// 앱 화면과 비슷한 가짜 캡처 3장을 실제 tesseract(kor+eng) 로 읽은 결과 그대로
const SHOT1 = `찾고 싶은 상품을 검색해보세요!                    때
상품 이미지
A 로켓배송
토리든 다이브인 저분자 히알루론산 세럼 50701, 1
개
KK KKK 12,3457] 상품평
25,0002
20% 19,9002]
와우회원 할인가 ㆍ100원당 1『 적립
옵션: 50701 ㆍ1개
내일(화) 도착 보장ㆍ판매자 쿠팡
장바구니 담기`
const SHOT2 = `찾고 싶은 상품을 검색해보세요!
ㄷㄷ
상품 이미지
4 로켓배송
남양 임페리얼 XO 3단계 분유, 3600, 2개
Kk WK Kw 12,345개 상품평
31,8002
와우회원 할인가 ㆍ100원당 1『 적립
옵션: 3600, 2개
무료배송ㆍ판매자 쿠팡
장바구니 담기`
const SHOT3 = `ㄴ 찾고 싶은 상품을 검색해보세요!
상품 이미지
》 ZAMS
오뚜기 옛날 잡채 소불고기 5인분, 1개
ㅎㅎㅎ 12,345개 상품평
9980-2
14% 8,4702]
와우회원 할인가 - 100A St 1P 적립
옵션: 1개
로켓배송ㆍ판매자 쿠팡
장바구니 담기`

test('할인 % 줄의 가격을 고르고, 상품평 개수·정가·적립은 무시합니다', () => {
  assert.equal(parseShotText(SHOT1).productPrice, 19900)
  assert.equal(parseShotText(SHOT3).productPrice, 8470)
})

test('할인이 없으면 상품명 뒤 첫 가격', () => {
  assert.equal(parseShotText(SHOT2).productPrice, 31800)
})

test('상품명은 배지와 상품평 사이의 긴 한글 줄, 잘린 꼬리는 이어 붙임', () => {
  assert.equal(parseShotText(SHOT1).productName, '토리든 다이브인 저분자 히알루론산 세럼 50701, 1개')
  assert.equal(parseShotText(SHOT2).productName, '남양 임페리얼 XO 3단계 분유, 3600, 2개')
  assert.equal(parseShotText(SHOT3).productName, '오뚜기 옛날 잡채 소불고기 5인분, 1개')
})

test('옵션 줄과 빈 입력', () => {
  assert.equal(parseShotText(SHOT2).option, '3600, 2개')
  assert.deepEqual(parseShotText(''), { productName: '', productPrice: null, option: null, lineCount: 0 })
  assert.equal(parseShotText('아무 글자\n또 글자').productPrice, null)
})
