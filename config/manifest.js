/**
 * 하노이행 적하목록(매니페스트) 양식
 *
 * 물류사가 요구하는 엑셀 양식이 확정되면 **이 컬럼 배열만** 바꾸면 됩니다.
 * key 는 lib/manifest.js 가 만드는 행 데이터의 필드명입니다.
 * 사용 가능한 key: no, orderNo, recipient, phone, address, zone,
 *   items, quantity, weightKg, declaredUsd, coupangOrderNo, track, memo
 */

export const MANIFEST = {
  filePrefix: 'hanoi-manifest',
  columns: [
    { key: 'no', label: 'No' },
    { key: 'orderNo', label: '주문번호' },
    { key: 'recipient', label: '수령인' },
    { key: 'phone', label: '연락처' },
    { key: 'address', label: '배송주소(하노이)' },
    { key: 'items', label: '품목' },
    { key: 'quantity', label: '총수량' },
    { key: 'weightKg', label: '실측무게(kg)' },
    { key: 'declaredUsd', label: '신고가치(USD)' },
    { key: 'track', label: '유형' },
  ],
}
