import { SHIPPING } from '../config/shipping'

/**
 * 배송 가능 지역 공지 — 신청서 맨 위·첫 화면·요금 페이지에 같은 모양으로.
 *
 * 운영자 확정 26-09-06: "배송지 목록에 나와 있는 도시 외에는 배송이 안 된다.
 * 북부 외 중부·남부는 현재 안 된다 — 눈에 띄게." 도시 목록은 config/shipping.js
 * 의 zones 에서 읽으므로, 지역을 추가하면 여기 글도 함께 바뀝니다.
 */
export const serviceAreaText = () => {
  const cities = Object.values(SHIPPING.zones).map((z) => z.label).join(' · ')
  const { regionLabel, notServed } = SHIPPING.serviceArea
  return { cities, regionLabel, notServed }
}

export default function ServiceAreaNotice({ compact = false }) {
  const { cities, regionLabel, notServed } = serviceAreaText()
  return (
    <div role="note" style={{
      padding: compact ? '9px 11px' : '11px 13px',
      borderRadius: 10,
      background: '#fff3e8',
      border: '1.5px solid #ff9a1f',
      color: '#7a3500',
      fontSize: compact ? 12.5 : 13.5,
      lineHeight: 1.6,
      marginBottom: 12,
    }}>
      <b style={{ color: '#d94a00' }}>🚚 배송 가능 지역: {cities}</b> ({regionLabel})
      <br />
      <b>{notServed}는 현재 배송하지 않습니다.</b> 목록에 없는 도시로는 보내드릴 수 없습니다.
    </div>
  )
}
