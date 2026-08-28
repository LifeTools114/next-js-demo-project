/**
 * 화장품 제형별 물성 테이블
 *
 * 무게 = 내용물(순중량) + 용기(공차) + 포장재
 * 이며, 상품명에는 보통 "내용물 용량(ml)"만 적혀 있습니다.
 * 따라서 아래 3개 테이블이 필요합니다.
 *   1) FORMS      : 제형 판별 + 밀도(g/ml) + 기본 용량
 *   2) CONTAINERS : 용기 종류별 공차(tare) + 포장 부피
 *   3) 매칭 로직   : 상품명 → 제형 → 용기
 *
 * 공차 모델: tareG = baseG + ratio × netG
 *   (뚜껑·펌프처럼 고정된 부분 + 용기 두께처럼 용량에 비례하는 부분)
 *
 * 부피 모델: boxCm3 = baseCm3 + mlFactor × nominalMl
 *   항공 부피무게 = boxCm3 / 6000 (kg)
 */

/**
 * 용기별 공차 및 외박스 부피.
 * 실측 기반 근사치이며, 운영 중 실측 데이터가 쌓이면 이 값을 보정하세요.
 */
export const CONTAINERS = {
  tube: { label: '튜브', tare: { base: 10, ratio: 0.22 }, box: { base: 70, mlFactor: 2.2 } },
  'small-tube': { label: '소형 튜브', tare: { base: 8, ratio: 0.35 }, box: { base: 40, mlFactor: 2.5 } },
  // 소용량(30~50ml) 세럼·앰플용 두꺼운 아크릴/유리 펌프 — 용량 대비 매우 무거움
  'plastic-pump': { label: '아크릴 펌프용기', tare: { base: 32, ratio: 0.7 }, box: { base: 110, mlFactor: 3.0 } },
  // 중대용량(100~300ml) 로션·클렌징용 얇은 HDPE 펌프 — 용량이 커도 용기는 가벼움
  'lotion-pump': { label: '플라스틱 펌프용기', tare: { base: 26, ratio: 0.17 }, box: { base: 120, mlFactor: 2.4 } },
  'plastic-bottle': { label: '플라스틱 보틀', tare: { base: 24, ratio: 0.1 }, box: { base: 110, mlFactor: 2.2 } },
  'plastic-jar': { label: '플라스틱 단지', tare: { base: 45, ratio: 0.45 }, box: { base: 150, mlFactor: 3.2 } },
  'glass-jar': { label: '유리 단지', tare: { base: 85, ratio: 1.1 }, box: { base: 180, mlFactor: 4.0 } },
  'glass-bottle': { label: '유리 보틀', tare: { base: 70, ratio: 0.6 }, box: { base: 150, mlFactor: 3.5 } },
  'glass-dropper': { label: '유리 스포이드', tare: { base: 55, ratio: 0.9 }, box: { base: 130, mlFactor: 4.0 } },
  'perfume-glass': { label: '향수 유리병', tare: { base: 130, ratio: 1.6 }, box: { base: 250, mlFactor: 5.0 } },
  'nail-bottle': { label: '네일 브러시병', tare: { base: 38, ratio: 2.2 }, box: { base: 90, mlFactor: 8.0 } },
  'lipstick-case': { label: '립스틱 케이스', tare: { base: 28, ratio: 1.5 }, box: { base: 60, mlFactor: 14 } },
  'lipgloss-case': { label: '립글로스 케이스', tare: { base: 22, ratio: 1.3 }, box: { base: 55, mlFactor: 11 } },
  'mascara-case': { label: '마스카라 케이스', tare: { base: 26, ratio: 1.6 }, box: { base: 70, mlFactor: 9 } },
  'pen-case': { label: '펜슬 타입', tare: { base: 9, ratio: 1.2 }, box: { base: 35, mlFactor: 20 } },
  'palette-case': { label: '팔레트 케이스', tare: { base: 95, ratio: 3.0 }, box: { base: 200, mlFactor: 12 } },
  compact: { label: '컴팩트', tare: { base: 55, ratio: 1.0 }, box: { base: 150, mlFactor: 8 } },
  'cushion-case': { label: '쿠션 케이스', tare: { base: 78, ratio: 1.2 }, box: { base: 170, mlFactor: 8 } },
  'stick-case': { label: '스틱 케이스', tare: { base: 24, ratio: 1.3 }, box: { base: 60, mlFactor: 10 } },
  sachet: { label: '낱장 파우치', tare: { base: 2, ratio: 0.1 }, box: { base: 20, mlFactor: 1.6 } },
}

/**
 * 제형 테이블 — 배열 순서대로 매칭하므로 "더 구체적인 제형"이 앞에 와야 합니다.
 * (예: '클렌징오일'이 '오일'보다, '선크림'이 '크림'보다 먼저)
 *
 * density: 내용물 밀도 (g/ml)
 * defaultMl / defaultG: 상품명에 용량이 없을 때 쓰는 카테고리 평균값
 */
export const FORMS = [
  // --- 마스크/패드 ---
  { id: 'sheet-mask', label: '시트마스크', keywords: ['시트마스크', '마스크시트', '마스크팩', '마스크 팩'], container: 'sachet', density: 1.0, perSheetTotalG: 25, defaultSheets: 10 },
  { id: 'toner-pad', label: '토너패드', keywords: ['토너패드', '필링패드', '패드'], container: 'plastic-jar', density: 1.0, defaultMl: 150 },

  // --- 클렌징 (구체적인 것 우선) ---
  { id: 'cleansing-oil', label: '클렌징오일', keywords: ['클렌징오일', '클렌징 오일'], container: 'lotion-pump', density: 0.9, defaultMl: 200 },
  { id: 'cleansing-water', label: '클렌징워터', keywords: ['클렌징워터', '클렌징 워터', '미셀라'], container: 'plastic-bottle', density: 1.0, defaultMl: 300 },
  { id: 'cleansing-balm', label: '클렌징밤', keywords: ['클렌징밤', '클렌징 밤'], container: 'plastic-jar', density: 0.92, defaultMl: 100 },
  { id: 'cleansing-foam', label: '클렌징폼', keywords: ['폼클렌징', '클렌징폼', '페이셜폼', '클렌저', '클렌징'], container: 'tube', density: 1.05, defaultMl: 150 },
  { id: 'scrub', label: '스크럽/필링', keywords: ['스크럽', '필링젤', '각질'], container: 'tube', density: 1.08, defaultMl: 100 },

  // --- 선케어 (크림보다 먼저) ---
  { id: 'sun-stick', label: '선스틱', keywords: ['선스틱', '썬스틱'], container: 'stick-case', density: 0.95, defaultG: 22 },
  { id: 'sun-cushion', label: '선쿠션', keywords: ['선쿠션', '썬쿠션'], container: 'cushion-case', density: 1.02, defaultG: 15 },
  { id: 'sunscreen', label: '선크림', keywords: ['선크림', '썬크림', '선세럼', '자외선차단', '톤업크림', '선블록'], container: 'tube', density: 1.02, defaultMl: 50 },

  // --- 베이스 메이크업 ---
  { id: 'cushion', label: '쿠션', keywords: ['쿠션'], container: 'cushion-case', density: 1.05, defaultG: 15 },
  { id: 'foundation', label: '파운데이션', keywords: ['파운데이션', '파데', 'BB크림', 'CC크림', 'BB 크림'], container: 'glass-bottle', density: 1.1, defaultMl: 30 },
  { id: 'concealer', label: '컨실러', keywords: ['컨실러'], container: 'small-tube', density: 1.08, defaultMl: 6 },
  { id: 'primer', label: '프라이머', keywords: ['프라이머', '메이크업베이스', '픽서'], container: 'plastic-pump', density: 1.0, defaultMl: 30 },
  { id: 'powder', label: '파우더/팩트', keywords: ['팩트', '파우더'], container: 'compact', density: 0.55, defaultG: 12 },

  // --- 립 ---
  { id: 'lip-balm', label: '립밤', keywords: ['립밤', '립케어', '립슬리핑'], container: 'lipstick-case', density: 0.92, defaultG: 4 },
  { id: 'lip-tint', label: '립틴트/글로스', keywords: ['틴트', '립글로스', '립글로우', '립오일'], container: 'lipgloss-case', density: 1.02, defaultG: 4 },
  { id: 'lipstick', label: '립스틱', keywords: ['립스틱', '립라이너', '립'], container: 'lipstick-case', density: 0.95, defaultG: 3.5 },

  // --- 아이 ---
  { id: 'mascara', label: '마스카라', keywords: ['마스카라'], container: 'mascara-case', density: 1.0, defaultMl: 9 },
  { id: 'eyeliner', label: '아이라이너', keywords: ['아이라이너', '젤라이너'], container: 'pen-case', density: 1.0, defaultG: 0.5 },
  { id: 'eyebrow', label: '아이브로우', keywords: ['아이브로우', '눈썹'], container: 'pen-case', density: 1.0, defaultG: 0.3 },
  { id: 'eyeshadow', label: '아이섀도우', keywords: ['아이섀도', '아이쉐도', '섀도우', '쉐도우', '팔레트', '아이팔레트'], container: 'palette-case', density: 0.6, defaultG: 8 },

  // --- 네일 ---
  { id: 'nail-polish', label: '네일', keywords: ['네일', '매니큐어', '탑코트', '베이스코트'], container: 'nail-bottle', density: 1.05, defaultMl: 10 },

  // --- 향수 ---
  { id: 'perfume', label: '향수', keywords: ['향수', '퍼퓸', '오드', 'EDP', 'EDT', '코롱', '쇼와'], container: 'perfume-glass', density: 0.87, defaultMl: 50 },
  { id: 'body-mist', label: '바디미스트', keywords: ['바디미스트', '헤어퍼퓸', '헤어미스트'], container: 'plastic-bottle', density: 0.95, defaultMl: 100 },

  // --- 스킨케어 (일반적인 것일수록 뒤로) ---
  { id: 'facial-oil', label: '페이셜오일', keywords: ['페이스오일', '페이셜오일', '오일세럼'], container: 'glass-dropper', density: 0.9, defaultMl: 30 },
  { id: 'ampoule', label: '앰플/세럼', keywords: ['앰플', '세럼', '에센스', '부스터'], container: 'plastic-pump', density: 1.03, defaultMl: 50 },
  { id: 'cream', label: '크림', keywords: ['수분크림', '아이크림', '나이트크림', '영양크림', '크림'], container: 'glass-jar', density: 0.97, defaultMl: 50 },
  { id: 'lotion', label: '로션/에멀전', keywords: ['에멀전', '에멀젼', '로션'], container: 'lotion-pump', density: 0.99, defaultMl: 130 },
  { id: 'mist', label: '미스트', keywords: ['미스트'], container: 'plastic-bottle', density: 1.0, defaultMl: 100 },
  { id: 'toner', label: '토너/스킨', keywords: ['토너', '스킨', '화장수'], container: 'plastic-bottle', density: 1.0, defaultMl: 200 },
]

/** 제형을 판별하지 못했을 때의 기본값 */
export const FALLBACK_FORM = {
  id: 'unknown',
  label: '기타 화장품',
  keywords: [],
  container: 'plastic-bottle',
  density: 1.0,
  defaultMl: 80,
}

/**
 * 상품명(+카테고리명)으로 제형을 판별합니다.
 * @param {string} text
 * @returns {{form: object, matchedKeyword: string|null}}
 */
export function detectForm(text) {
  const haystack = String(text || '').toLowerCase().replace(/\s+/g, '')
  for (const form of FORMS) {
    for (const keyword of form.keywords) {
      if (haystack.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
        return { form, matchedKeyword: keyword }
      }
    }
  }
  return { form: FALLBACK_FORM, matchedKeyword: null }
}

/** 용기 공차 계산 */
export function tareWeight(containerId, netG) {
  const container = CONTAINERS[containerId] || CONTAINERS['plastic-bottle']
  return container.tare.base + container.tare.ratio * netG
}

/** 개별 상품 외박스 부피(cm³) 계산 */
export function boxVolume(containerId, nominalMl) {
  const container = CONTAINERS[containerId] || CONTAINERS['plastic-bottle']
  return container.box.base + container.box.mlFactor * nominalMl
}
