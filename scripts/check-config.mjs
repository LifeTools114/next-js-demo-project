#!/usr/bin/env node
/**
 * 규정 값 점검 — 사장님이 확정한 숫자·규칙이 코드에 그대로 있는지 한 번에 봅니다 (26-09-13 「50개 점검」).
 *   npm run check:config
 * 값을 바꿨다면 여기 기대값도 같이 고치세요 — 이 스크립트는 "확정된 규정"의 사본입니다 (docs/SPEC.md §3).
 */
import { SHIPPING, ITEM_SURCHARGES, CONSOLIDATION } from '../config/shipping.js'
import { FEES } from '../config/fees.js'
import { LISTED_BLOCK_RULES } from '../config/eligibility.js'
import { WAREHOUSE, detailAddressFor } from '../config/warehouse.js'
import { BUSINESS, REQUIRED_CONSENTS, NOTICES } from '../config/legal.js'
import { CONTACT } from '../config/contact.js'
import { TRACKS } from '../config/tracks.js'
import { shopLink, SHOP_HOME } from '../config/partners.js'
import { ORDER_STATES, PROGRESS_ORDER } from '../lib/order/states.js'
import { toBillableKg, calculateShipping, usdToKrw } from '../lib/pricing/shipping.js'
import { checkEligibility } from '../lib/eligibility.js'
import { estimateItemWeight } from '../lib/weight/estimate.js'
import { parseProductUrl, fromShare } from '../lib/coupang-url.js'
import { sanitizeImageUrl } from '../lib/peek-result.js'

const rows = []
const check = (name, cond, note = '') => { rows.push({ name, ok: Boolean(cond), note }); console.log(`${cond ? '✓' : '✗'} ${name}${note ? ` — ${note}` : ''}`) }
const close = (a, b, tol = 0) => Math.abs(a - b) <= tol

// 요금
check('국제배송비 $8/kg · 최소 1kg', SHIPPING.ratePerKgUsd === 8 && SHIPPING.minBillableKg === 1)
check('청구무게 규칙 — 0.4→1, 1.3→1, 1.5→1, 1.6→2, 2.5→2, 2.6→3', [0.4, 1.3, 1.5, 1.6, 2.5, 2.6].map((k) => toBillableKg(k * 1000)).join(',') === '1,1,1,2,2,3', [0.4, 1.3, 1.5, 1.6, 2.5, 2.6].map((k) => toBillableKg(k * 1000)).join(','))
check('박스 250g · 상자당 30kg · 부피 ÷6000', SHIPPING.boxWeightG === 250 && SHIPPING.maxParcelKg === 30 && SHIPPING.volumetricDivisor === 6000)
const zones = Object.fromEntries(Object.entries(SHIPPING.zones).map(([k, z]) => [k, z.surchargeUsd]))
check('배송 지역 7곳 · 할증 하노이0 빈푹6 박닌8 박장8 흥옌8 하이즈엉20 하이퐁20', JSON.stringify(zones) === JSON.stringify({ hanoi: 0, vinhphuc: 6, bacninh: 8, bacgiang: 8, hungyen: 8, haiduong: 20, haiphong: 20 }), JSON.stringify(zones))
check('중부·남부 배송 불가 문구', /중부/.test(SHIPPING.serviceArea?.notServed ?? '') && /남부/.test(SHIPPING.serviceArea?.notServed ?? ''), SHIPPING.serviceArea?.notServed)
check('구매대행 수수료 — 기본 3,000원 · 10만원·5종까지 · 초과분 5% · 종당 1,000원 · 한도 100만원', FEES.agencyBaseKrw === 3000 && FEES.agencyBaseMaxGoodsKrw === 100_000 && FEES.agencyBaseMaxItems === 5 && FEES.agencyExcessRate === 0.05 && FEES.agencyPerExtraItemKrw === 1000 && FEES.agentMaxGoodsKrw === 1_000_000)
check('할증 — 전자기기 $40/대 · 파손 $2/개 · 대형(10kg↑) $5/건', ITEM_SURCHARGES.device.usd === 40 && ITEM_SURCHARGES.fragile.usd === 2 && ITEM_SURCHARGES.bulky.usd === 5 && ITEM_SURCHARGES.bulky.thresholdKg === 10)
check('합배송 무료 보관 30일', CONSOLIDATION.freeStorageDays === 30, String(CONSOLIDATION.freeStorageDays))
const f1 = calculateShipping(1000, { zone: 'hanoi' })
check('1kg 하노이 배송비 = $8 → 원화 환산이 양수', f1.totalUsd === 8 && f1.totalKrw > 0 && f1.totalKrw === usdToKrw(8), `${f1.totalKrw}원`)
const f5 = calculateShipping(5000, { zone: 'haiphong' })
check('5kg 하이퐁 = 5×$8 + $20 = $60', f5.totalUsd === 60, `$${f5.totalUsd}`)

// 배송 가능 여부 (운영자 확정 26-09-12)
const elig = (n) => checkEligibility({ productName: n, quantity: 1 })
check('향수 100ml 는 가능', elig('샤넬 넘버5 오드퍼퓸 100ml').shippable)
check('매니큐어·헤어스프레이(상온 생활용품) 가능', elig('오피 네일 매니큐어 15ml').shippable && elig('미쟝센 헤어 스프레이 300ml').shippable)
check('소주·담배 차단', !elig('참이슬 소주 360ml 20병').shippable && !elig('말보로 담배 1보루').shippable)
check('부탄가스·폭죽 차단', !elig('맥선 부탄가스 4개입').shippable && !elig('불꽃놀이 폭죽 세트').shippable)
check('냉동·정육·생선·계란 차단', !elig('비비고 냉동 왕교자 1kg').shippable && !elig('한우 등심 냉장 500g').shippable && !elig('제주 은갈치 생선').shippable && !elig('무항생제 계란 30구').shippable)
const bat = elig('샤오미 보조배터리 20000mAh')
check('보조배터리는 안내만(접수 가능)', bat.shippable, JSON.stringify({ shippable: bat.shippable, label: bat.label ?? null }))
check('차단 목록 id — dangerous·alcohol-tobacco·cold-chain·quarantine-animal·oversize', ['dangerous', 'alcohol-tobacco', 'cold-chain', 'quarantine-animal', 'oversize'].every((id) => LISTED_BLOCK_RULES.some((r) => r.id === id)), LISTED_BLOCK_RULES.map((r) => r.id).join(','))

// 무게 추정
const w = (n) => estimateItemWeight({ productName: n }, 1).actualG
check('무게 — 세럼 50ml 100~250g · 분유 800g ≥ 800g · 마스크팩 10매 150~500g', w('토리든 다이브인 세럼 50ml') >= 100 && w('토리든 다이브인 세럼 50ml') <= 250 && w('아이엠마더 분유 800g') >= 800 && w('메디힐 마스크팩 10매') >= 150 && w('메디힐 마스크팩 10매') <= 500, `${w('토리든 다이브인 세럼 50ml')}g / ${w('아이엠마더 분유 800g')}g / ${w('메디힐 마스크팩 10매')}g`)
check('무게 — 이름만 「상품 1234」면 기본 무게로(신뢰 낮음) 1kg 청구', toBillableKg(estimateItemWeight({ productName: '상품 1234567' }, 1).actualG + 250) === 1)

// 링크 해석
const p1 = parseProductUrl('https://www.coupang.com/vp/products/7994415309?itemId=25288351825&vendorItemId=92283838499&sourceType=srp_product_ads&clickEventId=x&traceId=y')
check('링크 — 광고 꼬리표 제거, itemId·vendorItemId 유지', p1?.productId === '7994415309' && p1.itemId === '25288351825' && p1.vendorItemId === '92283838499' && !/traceId|clickEventId/.test(p1.url))
check('링크 — itemId 만 있는 기본 링크', parseProductUrl('https://www.coupang.com/vp/products/7994415309?itemId=22231876024')?.itemId === '22231876024')
check('링크 — 모바일(m.)·상품 번호만', parseProductUrl('https://m.coupang.com/vm/products/777')?.productId === '777' && parseProductUrl('https://www.coupang.com/vp/products/9658595100')?.productId === '9658595100')
check('링크 — 남의 사이트·글자만은 거절', !parseProductUrl('https://example.com/vp/products/1') && !parseProductUrl('그냥 글자'))
check('링크 — 브랜드관(shop.coupang.com)은 상품 번호 없이 인식(대신 읽기가 찾음)', (() => { const p = parseProductUrl('https://shop.coupang.com/A00126071/518181?source=x'); return p === null || !p.productId })())
check('공유 글에서 이름·링크 — 제목+링크, [쿠팡] 제목 링크', fromShare({ title: '토리든 세럼 50ml', text: 'https://www.coupang.com/vp/products/555' }).productName?.includes('토리든') && fromShare({ text: '[쿠팡] 분유 360g https://m.coupang.com/vm/products/777' }).link?.productId === '777')

// 사진·상호·파트너스
check('사진 주소 — coupangcdn https 만', sanitizeImageUrl('https://thumbnail6.coupangcdn.com/thumbnails/remote/492x492ex/image/a.jpg') && !sanitizeImageUrl('https://evil.com/a.jpg') && !sanitizeImageUrl('http://thumbnail6.coupangcdn.com/a.jpg'))
check('쿠팡으로 가기 — 파트너스 링크 없으면 보통 주소, link.coupang.com 만 파트너스로', shopLink({}).href === SHOP_HOME && !shopLink({}).isPartner && shopLink({ COUPANG_PARTNERS_LINK: 'https://link.coupang.com/a/abc' }).isPartner && !shopLink({ COUPANG_PARTNERS_LINK: 'https://evil.com/a' }).isPartner)

// 창고·사업자·문의·상태·동의
check('창고 — YS-ECOM · 07504 · 개화동로 · 010-4803-6031 · 상세주소 「YS-ECOM 이름」', WAREHOUSE.code === 'YS-ECOM' && WAREHOUSE.zip === '07504' && /개화동로/.test(WAREHOUSE.address1) && WAREHOUSE.phone === '010-4803-6031' && detailAddressFor('홍길동') === 'YS-ECOM 홍길동')
check('사업자 — 전세계무역 · 김영서 · 360-14-03304 · 2025-인천서구-2986', BUSINESS.name === '전세계무역' && BUSINESS.ceo === '김영서' && BUSINESS.bizNo === '360-14-03304' && BUSINESS.mailOrderNo === '2025-인천서구-2986')
check('문의 — 카카오톡 vietnam911 · 오픈채팅 https', CONTACT.kakaoId === 'vietnam911' && /^https:\/\/open\.kakao\.com\//.test(CONTACT.kakaoOpenChat))
check('두 가지 방법 — 배송만 / 구매하고 배송까지 (정식: 배송대행/구매대행)', TRACKS.forwarding.name === '배송만' && TRACKS.agent.name === '구매하고 배송까지' && TRACKS.forwarding.formal === '배송대행' && TRACKS.agent.formal === '구매대행')
check('주문 상태 11개 · 진행 순서에 REQUESTED→DELIVERED', Object.keys(ORDER_STATES).length === 11 && PROGRESS_ORDER[0] === 'REQUESTED' && PROGRESS_ORDER.at(-1) === 'DELIVERED', `${Object.keys(ORDER_STATES).length}개`)
check('필수 동의 ≥5 · 공지 17개', REQUIRED_CONSENTS.length >= 5 && NOTICES.length === 17, `${REQUIRED_CONSENTS.length} / ${NOTICES.length}`)

const fails = rows.filter((r) => !r.ok)
console.log(`\n${rows.length - fails.length}/${rows.length} 통과`)
if (fails.length) process.exit(1)
