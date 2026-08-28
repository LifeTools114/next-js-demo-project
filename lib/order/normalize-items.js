/**
 * 주문 상품 입력 정규화 (서버 공용)
 *
 * 확장은 쿠팡 페이지에서 읽은 정보를 함께 보냅니다.
 *   specOverride  고시정보의 용량·중량 — 상품명보다 정확한 무게 근거
 *   badges        로켓직구·해외직구 배지 — 조달 경로 판별
 *   shippingText  배송 안내 문구 — 해외배송 여부
 *   categoryPath  브레드크럼 — 관세 품목군·화장품 문맥 판별
 *
 * 이 필드들을 버리면 서버 견적이 확장 패널과 달라집니다.
 * (실제로 quote/orders API 가 4개 필드만 남겨 고시정보 무게와
 *  해외직구 판별이 서버에서 통째로 사라지는 버그가 있었습니다)
 *
 * 다만 클라이언트 입력이므로 **금액과 수량은 그대로 믿지 않고** 범위를 강제하고,
 * 문자열은 길이를 제한합니다. 판별용 문자열은 로직에만 쓰이고
 * 그대로 렌더링되지 않지만, 길이 폭탄을 막기 위해 잘라냅니다.
 */

const MAX_BADGES = 12
const str = (v, max) => String(v ?? '').slice(0, max)

export function normalizeOrderItem(input) {
  return {
    productId: str(input?.productId, 64),
    productName: str(input?.productName, 300),
    productPrice: Math.max(0, Math.min(Number(input?.productPrice) || 0, 100_000_000)),
    quantity: Math.max(1, Math.min(Number.parseInt(input?.quantity, 10) || 1, 999)),

    // 무게·세금·조달 판별에 쓰이는 근거 (없으면 상품명으로 폴백)
    specOverride: input?.specOverride ? str(input.specOverride, 120) : null,
    categoryPath: str(input?.categoryPath, 200),
    shippingText: str(input?.shippingText, 300),
    badges: Array.isArray(input?.badges)
      ? input.badges.slice(0, MAX_BADGES).map((b) => str(b, 40)).filter(Boolean)
      : [],

    productUrl: str(input?.productUrl, 500),
  }
}

export const normalizeOrderItems = (items = []) => items.map(normalizeOrderItem)
