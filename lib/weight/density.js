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

  // ── 비화장품(식품·생활용품) 용기 ──
  'food-pouch': { label: '식품 봉지', tare: { base: 4, ratio: 0.05 }, box: { base: 60, mlFactor: 1.4 } },
  'food-box': { label: '종이 박스', tare: { base: 18, ratio: 0.08 }, box: { base: 90, mlFactor: 1.3 } },
  'instant-cup': { label: '컵라면 용기', tare: { base: 22, ratio: 0.06 }, box: { base: 150, mlFactor: 1.5 } },
  'can': { label: '캔', tare: { base: 14, ratio: 0.03 }, box: { base: 70, mlFactor: 1.3 } },
  'pet-bottle': { label: 'PET 보틀', tare: { base: 22, ratio: 0.05 }, box: { base: 100, mlFactor: 1.25 } },
  'detergent-jug': { label: '세제 용기', tare: { base: 60, ratio: 0.09 }, box: { base: 140, mlFactor: 1.3 } },
  'soft-pack': { label: '비닐 포장', tare: { base: 6, ratio: 0.03 }, box: { base: 80, mlFactor: 1.6 } },
  'bulky-pack': { label: '부피 큰 포장', tare: { base: 30, ratio: 0.05 }, box: { base: 800, mlFactor: 3.0 } },
  'formula-can': { label: '분유 캔', tare: { base: 110, ratio: 0.02 }, box: { base: 300, mlFactor: 1.4 } },
  'shoe-box': { label: '신발 박스', tare: { base: 130, ratio: 0.05 }, box: { base: 2000, mlFactor: 2.0 } },
  'diaper-pack': { label: '기저귀 압축팩', tare: { base: 35, ratio: 0.03 }, box: { base: 200, mlFactor: 2.0 } },
  'small-device': { label: '소형 기기 박스', tare: { base: 90, ratio: 0.45 }, box: { base: 500, mlFactor: 1.8 } },
  // 휴대폰·노트북 등 본체급 — 박스·충전기·설명서가 본체만큼 무겁습니다.
  'phone-box': { label: '휴대폰 패키지', tare: { base: 320, ratio: 0.0 }, box: { base: 1400, mlFactor: 0 } },
  'laptop-box': { label: '노트북 패키지', tare: { base: 900, ratio: 0.0 }, box: { base: 9000, mlFactor: 0 } },
  'tablet-box': { label: '태블릿 패키지', tare: { base: 420, ratio: 0.0 }, box: { base: 3000, mlFactor: 0 } },
}

/**
 * 제형 테이블 — 배열 순서대로 매칭하므로 "더 구체적인 제형"이 앞에 와야 합니다.
 * (예: '클렌징오일'이 '오일'보다, '선크림'이 '크림'보다 먼저)
 *
 * density: 내용물 밀도 (g/ml)
 * defaultMl / defaultG: 상품명에 용량이 없을 때 쓰는 카테고리 평균값
 */
export const FORMS = [
  /**
   * ── 비화장품 소형 잡화 (범용 키워드보다 먼저) ──
   * '패드'·'쿠션' 같은 범용 화장품 키워드가 수선패드·깔창 같은 잡화를
   * 화장품 용기(단지 150ml)로 오인하면 무게가 수 배로 부풀어
   * 배송비가 완전히 틀립니다. 가벼운 비닐 포장 기본값으로 잡습니다.
   */
  { id: 'small-goods', label: '소형 잡화', keywords: ['수선패드', '깔창', '인솔', '발패드', '뒷꿈치', '뒤꿈치패드', '패치', '스티커', '수선밴드', '키링', '노즈패드', '면도날', '수세미', '고무장갑'], exclude: ['기저귀', '팬티형'], container: 'soft-pack', density: 1.0, defaultG: 30 },

  // --- 마스크/패드 ---
  { id: 'zipper-bag', label: '지퍼백', keywords: ['지퍼백', '롤백', '냉동백'], container: 'soft-pack', density: 0.5, perSheetG: 2.5, defaultG: 100 },
  { id: 'thin-glove', label: '위생장갑', keywords: ['위생장갑', '비닐장갑'], container: 'soft-pack', density: 0.4, perSheetG: 1.0, defaultG: 60 },
  { id: 'medical-sheet', label: '밴드·파스', keywords: ['쿨링시트', '흉터밴드', '습윤밴드', '방수밴드', '파스', '이지덤'], container: 'soft-pack', density: 0.6, perSheetG: 5, defaultG: 60 },
  { id: 'sheet-mask', label: '시트마스크', keywords: ['시트마스크', '마스크시트', '마스크팩', '마스크 팩', '마스크'], exclude: ['kf94', 'kf80', '덴탈', '방역', '비말', '수면', '슬리핑', '헤어마스크', '마스크스트랩'], container: 'sachet', density: 1.0, perSheetTotalG: 25, defaultSheets: 10 },
  { id: 'toner-pad', label: '토너패드', keywords: ['토너패드', '필링패드', '패드'], exclude: ['수선', '운동화', '신발', '마우스', '매트', '방석', '의자', '침대', '충전', '전기', '냉각', '포스트잇', '메모', '노트', '브레이크', '아이패드', '갤럭시탭', '태블릿', '키패드', '무선'], container: 'plastic-jar', density: 1.0, defaultMl: 150 },

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
  { id: 'cushion', label: '쿠션', keywords: ['쿠션'], exclude: ['방석', '소파', '베개', '목쿠션', '바닥', '의자', '수선', '깔창', '운동화', '신발'], container: 'cushion-case', density: 1.05, defaultG: 15 },
  { id: 'foundation', label: '파운데이션', keywords: ['파운데이션', '파데', 'BB크림', 'CC크림', 'BB 크림'], container: 'glass-bottle', density: 1.1, defaultMl: 30 },
  { id: 'concealer', label: '컨실러', keywords: ['컨실러'], container: 'small-tube', density: 1.08, defaultMl: 6 },
  { id: 'primer', label: '프라이머', keywords: ['프라이머', '메이크업베이스', '픽서'], container: 'plastic-pump', density: 1.0, defaultMl: 30 },
  { id: 'powder', label: '파우더/팩트', keywords: ['팩트', '파우더'], container: 'compact', density: 0.55, defaultG: 12 },

  // --- 립 ---
  { id: 'lip-balm', label: '립밤', keywords: ['립밤', '립케어', '립슬리핑'], container: 'lipstick-case', density: 0.92, defaultG: 4 },
  { id: 'lip-tint', label: '립틴트/글로스', keywords: ['틴트', '립글로스', '립글로우', '립오일'], container: 'lipgloss-case', density: 1.02, defaultG: 4 },
  { id: 'lipstick', label: '립스틱', keywords: ['립스틱', '립라이너'], container: 'lipstick-case', density: 0.95, defaultG: 3.5 },

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
  { id: 'ampoule', label: '앰플/세럼', keywords: ['앰플', '세럼', '에센스', '부스터', '갈색병', '나이트리페어'], container: 'plastic-pump', density: 1.03, defaultMl: 50 },
  { id: 'ice-cream', label: '아이스크림', keywords: ['아이스크림', '파인트', '아이스바', '빙과'], container: 'food-box', density: 0.85, defaultMl: 474 },
  { id: 'sleeping-mask', label: '수면팩', keywords: ['슬리핑마스크', '수면팩', '슬리핑팩', '나이트마스크'], container: 'plastic-jar', density: 1.0, defaultMl: 80 },
  { id: 'cream', label: '크림', keywords: ['수분크림', '아이크림', '나이트크림', '영양크림', '크림'], container: 'glass-jar', largeContainer: 'lotion-pump', largeThresholdG: 200, density: 0.97, defaultMl: 50 },
  { id: 'lotion', label: '로션/에멀전', keywords: ['에멀전', '에멀젼', '로션'], container: 'lotion-pump', density: 0.99, defaultMl: 130 },
  { id: 'mist', label: '미스트', keywords: ['미스트'], container: 'plastic-bottle', density: 1.0, defaultMl: 100 },
  { id: 'toner', label: '토너/스킨', keywords: ['토너', '스킨', '화장수'], container: 'plastic-bottle', density: 1.0, defaultMl: 200 },

  // ── 식품 ──
  // 쿠팡 전체 품목을 다루므로 화장품 외 제형도 필요합니다.
  // 상세 페이지의 고시정보(내용물의 용량 또는 중량)를 읽으면 이 기본값 대신 실제 값을 씁니다.
  // 스틱·믹스는 "100개입 = 스틱 100개(한 상자)"라 낱개 곱셈 대신 스틱 수 × 12g 로 계산합니다.
  { id: 'stick-food', label: '스틱·믹스', keywords: ['커피믹스', '믹스커피', '스틱커피', '카페믹스', '프렌치카페', '모카골드', '맥심', '카누', '티백'], container: 'food-pouch', density: 1.0, defaultG: 12 },
  { id: 'cup-noodle', label: '컵라면', keywords: ['컵라면', '라면컵', '큰사발', '사발면', '컵밥'], container: 'instant-cup', density: 1.0, defaultG: 110 },
  { id: 'ramen', label: '봉지라면', keywords: ['라면', '짜파게티', '너구리', '진라면', '불닭볶음면', '국수', '당면', '파스타면'], container: 'soft-pack', density: 1.0, defaultG: 120 },
  // perPieceG: '12개입'처럼 개수가 크면 낱봉지 12개가 아니라 한 상자 안 낱개 12개입니다.
  { id: 'snack', label: '과자·스낵', keywords: ['과자', '스낵', '칩', '쿠키', '비스킷', '크래커', '초콜릿', '초코파이', '사탕', '젤리', '캔디', '빼빼로'], container: 'food-pouch', density: 0.35, defaultG: 80, perPieceG: 45 },
  { id: 'seaweed', label: '김·건어물', keywords: ['조미김', '김자반', '건어물', '멸치', '다시마', '미역'], container: 'food-pouch', density: 0.15, defaultG: 30 },
  { id: 'cooking-oil', label: '식용유', keywords: ['식용유', '카놀라유', '포도씨유', '해바라기유', '올리브유', '참기름', '들기름', '아보카도오일'], container: 'pet-bottle', density: 0.92, defaultMl: 900 },
  { id: 'sauce', label: '장류·소스', keywords: ['고추장', '된장', '간장', '쌈장', '소스', '드레싱', '식초'], container: 'pet-bottle', density: 1.15, defaultMl: 500 },
  { id: 'powder-food', label: '분말 식품', keywords: ['미숫가루', '선식', '분말', '가루', '조미료', '다시다', '설탕', '소금'], container: 'food-pouch', density: 0.6, defaultG: 500 },
  { id: 'canned', label: '통조림', keywords: ['통조림', '참치캔', '캔', '옥수수캔'], exclude: ['분유', '캔들', '캔버스'], container: 'can', density: 1.0, defaultG: 150 },
  { id: 'beverage', label: '음료', keywords: ['음료', '주스', '탄산', '생수', '이온음료', '녹차', '홍차'], container: 'pet-bottle', density: 1.0, defaultMl: 500 },
  { id: 'instant-rice', label: '즉석밥·간편식', keywords: ['즉석밥', '햇반', '간편식', '레토르트', '카레', '짜장'], exclude: ['생면', '칼국수', '우동면', '냉면', '짜장면'], container: 'food-box', density: 1.0, defaultG: 210 },
  { id: 'grain', label: '곡물·견과', keywords: ['쌀', '현미', '잡곡', '견과', '아몬드', '호두', '땅콩'], container: 'food-pouch', density: 0.8, defaultG: 500 },

  // ── 생활용품 ──
  { id: 'dishwasher-tab', label: '식기세척기 세제', keywords: ['식기세척기', '세척기전용', '태블릿세제'], container: 'detergent-jug', density: 1.2, perTabletG: 18, defaultG: 900 },
  { id: 'detergent', label: '세제·세정제', keywords: ['세탁세제', '주방세제', '섬유유연제', '표백제', '세정제', '락스'], exclude: ['시트'], container: 'detergent-jug', density: 1.05, defaultMl: 1000 },
  // 물티슈는 젖어 있어 무겁습니다 — 마른 지류(부피 중심)와 분리합니다.
  { id: 'wet-wipes', label: '물티슈', keywords: ['물티슈'], container: 'soft-pack', density: 0.9, defaultG: 700 },
  // 롤 단위(30롤) · 매 단위(200매) · 팩 단위(46매 4팩)가 모두 달라 나눕니다.
  { id: 'roll-paper', label: '두루마리 화장지', keywords: ['화장지', '두루마리', '롤휴지', '롤티슈'], exclude: ['물티슈', '각티슈', '미용티슈'], container: 'bulky-pack', density: 0.12, defaultG: 120 },
  { id: 'kitchen-towel', label: '키친타월', keywords: ['키친타월', '키친타올', '키친페이퍼'], container: 'bulky-pack', density: 0.12, defaultG: 250 },
  { id: 'tissue-box', label: '각티슈', keywords: ['각티슈', '미용티슈', '티슈'], exclude: ['물티슈', '롤티슈', '화장지'], container: 'food-box', density: 0.15, perSheetG: 1.2, defaultG: 300 },
  { id: 'diaper', label: '기저귀', keywords: ['기저귀', '팬티형기저귀'], container: 'diaper-pack', density: 0.25, defaultG: 1800 },
  { id: 'paper', label: '지류', keywords: ['휴지', '생리대'], container: 'bulky-pack', density: 0.12, defaultG: 400 },
  { id: 'copy-paper', label: '복사용지', keywords: ['복사용지', 'a4용지', '인쇄용지', '프린터용지'], container: 'food-box', density: 0.7, perSheetG: 5.0, defaultG: 2500 },
  { id: 'haircare', label: '헤어·바디', keywords: ['샴푸', '헤어린스', '컨디셔너', '트리트먼트', '바디워시', '바디로션', '핸드워시'], container: 'plastic-bottle', density: 1.03, defaultMl: 500 },
  { id: 'supplement', label: '건강식품', keywords: ['비타민', '오메가3', '유산균', '프로바이오틱스', '콜라겐', '루테인', '영양제', '캡슐', '정제'], container: 'plastic-jar', density: 0.6, defaultG: 60 },

  // ── 소형 전자·잡화 ──
  // 본체급 기기 — 액세서리보다 먼저 매칭되어야 합니다.
  // 무게는 상품명에서 거의 알 수 없어 기종별 평균 실중량을 기본값으로 씁니다.
  { id: 'laptop', label: '노트북', keywords: ['노트북', '랩탑', '맥북', '그램', '갤럭시북', '아이맥', '데스크탑'], exclude: ['케이스', '파우치', '가방', '거치대', '받침', '필름'], container: 'laptop-box', density: 1.0, defaultG: 1500 },
  { id: 'tablet', label: '태블릿', keywords: ['태블릿', '아이패드', '갤럭시탭'], exclude: ['케이스', '파우치', '거치대', '필름'], container: 'tablet-box', density: 1.0, defaultG: 500 },
  { id: 'phone', label: '스마트폰', keywords: ['스마트폰', '휴대폰', '핸드폰', '자급제', '아이폰', '갤럭시s', '갤럭시z', '갤럭시a', '픽셀폰'], exclude: ['케이스', '거치대', '필름', '보호', '스트랩', '링'], container: 'phone-box', density: 1.0, defaultG: 200 },
  { id: 'wearable', label: '워치·웨어러블', keywords: ['스마트워치', '갤럭시워치', '애플워치', '스마트밴드'], container: 'small-device', density: 1.0, defaultG: 50 },
  { id: 'monitor', label: '모니터', keywords: ['모니터', '디스플레이'], exclude: ['거치대', '받침', '암', '스탠드'], container: 'bulky-pack', density: 1.0, defaultG: 4000 },

  { id: 'memory-card', label: '메모리카드', keywords: ['마이크로sd', 'sd카드', 'usb메모리', '메모리카드', 'microsd'], container: 'soft-pack', density: 0.5, defaultG: 15 },
  { id: 'small-electronics', label: '소형 전자', keywords: ['이어폰', '헤드폰', '에어팟', '버즈', '충전기', '케이블', '마우스', '키보드', '거치대', '보조배터리', '파워뱅크', '스피커', '외장하드', 'ssd', '메모리카드', '마이크로sd', '어댑터', '공유기'], container: 'small-device', density: 1.0, defaultG: 150 },
  // ── 가전 (본체 vs 소모품 구분: 필터·브러시는 액세서리로 남깁니다) ──
  { id: 'appliance-large', label: '대형 가전', keywords: ['청소기', '밥솥', '전자레인지', '에어프라이어', '공기청정기', '정수기', '세탁기', '냉장고', '건조기', '식기세척기', '선풍기', '히터', '제습기', '가습기', '인덕션', '오븐', '스타일러', '의류관리기', '식기건조기'], exclude: ['필터', '먼지통', '브러시', '노즐', '커버', '거치대', '전용백', '세제', '태블릿', '냄비', '프라이팬', '전골', '받침'], container: 'bulky-pack', density: 0.35, defaultG: 4500 },
  // 에어랩·스타일러는 액세서리와 케이스가 함께 와 소형가전 평균보다 무겁습니다.
  { id: 'hair-styler', label: '헤어 스타일러', keywords: ['에어랩', '에어스타일러', '멀티스타일러', '스타일러기'], exclude: ['브러시', '전용백', '케이스'], container: 'small-device', density: 0.5, defaultG: 1300 },
  { id: 'appliance-small', label: '소형 가전', keywords: ['드라이기', '헤어드라이어', '고데기', '에어랩', '면도기', '전동칫솔', '커피머신', '토스터', '블렌더', '믹서기', '전기포트', '전기주전자', '다리미', '제모기', '마사지건', '안마기', '전기밥솥', '핸디청소기'], exclude: ['필터', '브러시', '헤드', '전용백', '거치대', '케이스', '전용날', '칼날', '교체날', '리필'], container: 'small-device', density: 0.5, defaultG: 600 },
  { id: 'lamp', label: '조명', keywords: ['스탠드조명', 'led스탠드', '조명', '램프', '무드등', '전구'], exclude: ['거치대', '차량'], container: 'small-device', density: 0.4, defaultG: 700 },
  { id: 'battery', label: '건전지', keywords: ['건전지', '알카라인', 'aa배터리', 'aaa배터리'], exclude: ['보조배터리', '충전식', '노트북'], container: 'soft-pack', density: 2.0, defaultG: 24 },
  { id: 'toothbrush', label: '칫솔', keywords: ['칫솔'], exclude: ['전동', '칫솔모', '칫솔살균'], container: 'soft-pack', density: 0.4, defaultG: 18 },
  { id: 'light-shoes', label: '샌들·슬리퍼', keywords: ['크록스', '클로그', '슬리퍼', '슬라이드', '쪼리', '삼선슬리퍼', '샌들'], container: 'shoe-box', density: 0.2, defaultG: 400 },
  { id: 'shoes', label: '신발', keywords: ['운동화', '스니커즈', '러닝화', '구두', '부츠', '워커', '축구화', '농구화', '로퍼'], exclude: ['깔창', '인솔', '끈', '세탁', '건조'], container: 'shoe-box', density: 0.25, defaultG: 800 },
  { id: 'pants', label: '바지', keywords: ['팬츠', '바지', '청바지', '슬랙스', '조거', '트랙팬츠', '레깅스'], exclude: ['커버'], container: 'soft-pack', density: 0.3, defaultG: 400 },
  { id: 'socks', label: '양말', keywords: ['양말', '덧신', '스타킹', '레깅스'], container: 'soft-pack', density: 0.3, defaultG: 55 },
  { id: 'towel', label: '수건', keywords: ['수건', '타월', '타올'], exclude: ['키친', '물티슈', '페이퍼'], container: 'soft-pack', density: 0.3, perSheetG: 125, defaultG: 130 },
  { id: 'duvet', label: '이불·이불커버', keywords: ['이불커버', '차렵이불', '침구세트', '이불세트', '요커버'], container: 'soft-pack', density: 0.25, defaultG: 1100 },
  { id: 'bedding', label: '베개커버', keywords: ['베개커버', '베갯잇', '매트커버'], container: 'soft-pack', density: 0.3, defaultG: 180 },
  { id: 'stationery', label: '문구', keywords: ['포스트잇', '볼펜', '형광펜', '만년필', '샤프', '지우개', '컬러펜', '사인펜', '색연필', '유성매직', '매직펜'], exclude: ['노트북'], container: 'soft-pack', density: 0.5, defaultG: 12 },
  { id: 'outerwear', label: '아우터', keywords: ['패딩', '코트', '점퍼', '자켓', '재킷', '야상', '무스탕', '플리스'], exclude: ['케이스', '커버'], container: 'soft-pack', density: 0.25, defaultG: 550 },
  { id: 'brush-head', label: '칫솔모·브러시헤드', keywords: ['칫솔모', '브러시헤드', '전동칫솔모', '칫솔헤드'], container: 'soft-pack', density: 0.4, defaultG: 12 },
  { id: 'blade-refill', label: '면도날·교체날', keywords: ['전용날', '교체날', '칼날'], exclude: ['커터', '주방'], container: 'soft-pack', density: 0.5, defaultG: 20 },
  { id: 'kitchen-misc', label: '주방 소품', keywords: ['집게', '주걱', '국자', '뒤집개', '계량컵', '거품기', '채칼', '도마'], container: 'soft-pack', density: 0.6, defaultG: 120 },
  { id: 'cookware', label: '조리도구', keywords: ['프라이팬', '후라이팬', '냄비', '웍', '压력솥', '压력밥솥', '전골', '주전자', '찜기'], exclude: ['전기', '무선'], container: 'bulky-pack', density: 0.5, defaultG: 1000 },
  { id: 'glass-container', label: '유리 밀폐용기', keywords: ['글라스락', '유리용기', '내열유리', '유리밀폐'], container: 'bulky-pack', density: 1.0, defaultG: 700 },
  { id: 'food-container', label: '밀폐용기', keywords: ['밀폐용기', '보관용기', '반찬통', '락앤락', '텀블러', '물병', '보온병'], container: 'bulky-pack', density: 0.4, defaultG: 400 },
  { id: 'luggage', label: '여행가방', keywords: ['캐리어', '여행가방', '트렁크', '기내용'], exclude: ['커버', '벨트', '네임택'], container: 'bulky-pack', density: 0.25, defaultG: 3500 },
  { id: 'hanger', label: '옷걸이', keywords: ['옷걸이', '행거'], exclude: ['스탠드행거', '이동식'], container: 'soft-pack', density: 0.4, defaultG: 45 },
  { id: 'tape', label: '테이프', keywords: ['테이프', '마스킹테이프', '박스테이프'], exclude: ['측정', '줄자'], container: 'soft-pack', density: 0.6, defaultG: 35 },
  { id: 'detergent-sheet', label: '세제 시트', keywords: ['세제시트', '세탁시트', '시트세제'], container: 'soft-pack', density: 0.4, perSheetG: 3, defaultG: 120 },
  { id: 'cat-litter', label: '고양이 모래', keywords: ['고양이모래', '캣샌드', '벤토나이트', '두부모래'], container: 'soft-pack', density: 0.85, defaultG: 6000 },
  { id: 'formula-milk', label: '분유', keywords: ['분유', '조제분유', '산양분유'], exclude: ['젖병', '보관'], container: 'formula-can', density: 0.55, defaultG: 800 },
  { id: 'fresh-noodle', label: '생면·간편면', keywords: ['생면', '칼국수', '짜장면', '우동면', '냉면'], container: 'soft-pack', density: 0.9, defaultG: 550 },
  { id: 'brick-toy', label: '블록 완구', keywords: ['레고', '듀플로', '브릭박스', '옥스포드블록'], container: 'food-box', density: 0.3, defaultG: 1400 },
  { id: 'toy', label: '완구', keywords: ['레고', '블록', '인형', '미니카', '완구', '피규어', '보드게임', '퍼즐'], exclude: ['블록체인'], container: 'food-box', density: 0.25, defaultG: 700 },
  { id: 'rug', label: '러그·카펫', keywords: ['러그', '카펫', '거실매트', '주방매트', '현관매트'], container: 'bulky-pack', density: 0.35, defaultG: 4000 },
  { id: 'pillow', label: '베개', keywords: ['베개', '메모리폼베개', '경추베개', '바디필로우'], exclude: ['커버', '베갯잇'], container: 'bulky-pack', density: 0.2, defaultG: 900 },
  { id: 'furniture', label: '가구', keywords: ['선반', '책상', '의자', '수납장', '서랍장', '옷장', '테이블', '스탠드행거'], exclude: ['커버', '매트'], container: 'bulky-pack', density: 0.5, defaultG: 8000 },
  { id: 'notebook', label: '노트·다이어리', keywords: ['스프링노트', '다이어리', '연습장', '수첩', '노트'], exclude: ['노트북'], container: 'soft-pack', density: 0.7, defaultG: 180 },
  // 텀블러·물병의 'ml' 는 담는 용량이지 내용물이 아닙니다 — 그대로 쓰면 빈 컵이 710g 이 됩니다.
  { id: 'tumbler', label: '텀블러·물병', keywords: ['텀블러', '콜드컵', '머그', '보온병', '물병', '워터보틀'], container: 'bulky-pack', density: 0.4, ignoreVolume: true, defaultG: 350 },
  { id: 'accessory', label: '액세서리·소모품', keywords: ['휴대폰케이스', '태블릿케이스', '보호필름', '정수기필터'], container: 'soft-pack', density: 0.5, defaultG: 150 },
  { id: 'umbrella', label: '우산', keywords: ['우산', '양산'], container: 'soft-pack', density: 1.0, defaultG: 380 },
  /**
   * 옷은 리터로 팔지 않습니다 — ignoreVolume 로 못을 박습니다.
   * 상품명의 "S-5L" 같은 치수를 용량으로 읽으면 티셔츠 한 장이 5kg 이 됩니다
   * (26-09-06 사장님 화면). parse.js 에서 한 번 걸러내고, 여기서 한 번 더 막습니다.
   */
  { id: 'apparel', label: '의류', keywords: ['티셔츠', '맨투맨', '후드', '니트', '자켓', '재킷', '패딩', '코트', '점퍼', '조끼', '바지', '팬츠', '조거', '슬랙스', '청바지', '원피스', '치마', '스커트', '양말', '속옷', '드로즈', '셔츠', '트레이닝', '반팔', '긴팔', '카라티', '유니폼', '민소매', '가디건', '레깅스', '블라우스'], exclude: ['보관함', '수납', '정리함', '커버', '옷걸이'], container: 'soft-pack', density: 0.3, ignoreVolume: true, defaultG: 250 },
]

/**
 * 카테고리 → 제형 기본값.
 * 상품명에 아는 단어가 하나도 없을 때(브랜드명만 있는 경우 등) 화장품
 * 80ml 로 떨어지면 가전·가구가 0.12kg 으로 잡혀 배송비를 크게 밑돕니다.
 * 쿠팡은 항상 카테고리를 함께 주므로 이를 안전망으로 씁니다.
 */
export const CATEGORY_FORMS = [
  [/가구|홈데코/, 'furniture'],
  [/액세서리|부품|소모품|주변기기/, 'accessory'],
  [/대형가전|생활가전/, 'appliance-large'],
  [/가전/, 'appliance-small'],
  [/디지털|컴퓨터|노트북주변/, 'small-electronics'],
  [/완구|장난감/, 'toy'],
  [/신발|슈즈/, 'shoes'],
  [/의류|패션|속옷|유아의류/, 'apparel'],
  [/침구|이불/, 'duvet'],
  [/아이스크림|빙과/, 'ice-cream'],
  [/주방|조리/, 'kitchen-misc'],
  [/문구|사무/, 'stationery'],
  [/구강|의약외품|위생/, 'small-goods'],
  [/청소|생활/, 'small-goods'],
  [/스킨케어|에센스|세럼/, 'ampoule'],
  [/여행|가방/, 'luggage'],
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
    // '패드'·'쿠션' 같은 범용 키워드의 오인 방지 — 제외어가 있으면 이 제형이 아닙니다.
    if (form.exclude?.some((word) => haystack.includes(word.toLowerCase().replace(/\s+/g, '')))) continue
    for (const keyword of form.keywords) {
      if (haystack.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
        return { form, matchedKeyword: keyword }
      }
    }
  }
  return { form: FALLBACK_FORM, matchedKeyword: null }
}

/** 카테고리명으로 제형을 고릅니다 (상품명 판별 실패 시의 안전망) */
export function formByCategory(categoryName) {
  const text = String(categoryName || '').replace(/\s+/g, '')
  if (!text) return null
  for (const [re, id] of CATEGORY_FORMS) {
    if (re.test(text)) return FORMS.find((f) => f.id === id) ?? null
  }
  return null
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
