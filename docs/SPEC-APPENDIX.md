# 베트남 직구 — 규정 부록 (설정 원본 전체)

> `npm run spec:appendix` 로 만든 자동 문서 (2026-09-12). 요약은 docs/SPEC.md, 운영 절차는 docs/OPERATIONS.md.
> 1부는 실제 계산에 쓰이는 값(JSON), 2부는 설정 파일 원문(주석·키워드·고지 문장 전부)입니다. 원가 파일이 포함되므로 저장소 밖으로 내보내지 마세요.


## 1부. 실제 값 (JSON)


### config/tracks.js — 두 가지 방식의 이름·문구


**TRACKS**

```json
{
  "forwarding": {
    "id": "forwarding",
    "emoji": "📦",
    "name": "배송만",
    "line": "쇼핑몰 결제는 직접 · 배송만 맡기기",
    "who": "한국 카드·계좌로 쇼핑몰 결제가 되는 분",
    "steps": [
      "쇼핑몰에서 직접 결제",
      "배송지는 한국 창고 (자동 입력)",
      "배송비만 결제"
    ],
    "formal": "배송대행"
  },
  "agent": {
    "id": "agent",
    "emoji": "🛒",
    "name": "구매하고 배송까지",
    "line": "저희가 대신 사드려요",
    "who": "한국 결제수단이 없는 분",
    "steps": [
      "상품과 수량만 알려주기",
      "상품값 + 배송비 한 번에 결제",
      "나머지는 저희가"
    ],
    "formal": "구매대행"
  }
}
```

### config/shipping.js — 국제배송비·지역·할증·합배송·반송


**SHIPPING**

```json
{
  "origin": "대한민국 (인천)",
  "destination": "베트남 하노이",
  "ratePerKgUsd": 8,
  "minBillableKg": 1,
  "volumetricDivisor": 6000,
  "maxParcelKg": 30,
  "boxWeightG": 250,
  "packingPerItemG": 12,
  "zones": {
    "hanoi": {
      "label": "하노이 시내",
      "surchargeUsd": 0
    },
    "vinhphuc": {
      "label": "빈푹",
      "surchargeUsd": 6
    },
    "bacninh": {
      "label": "박닌",
      "surchargeUsd": 8
    },
    "bacgiang": {
      "label": "박장",
      "surchargeUsd": 8
    },
    "hungyen": {
      "label": "흥옌",
      "surchargeUsd": 8
    },
    "haiduong": {
      "label": "하이즈엉",
      "surchargeUsd": 20
    },
    "haiphong": {
      "label": "하이퐁",
      "surchargeUsd": 20
    }
  },
  "defaultZone": "hanoi",
  "serviceAreaNotice": "배송 가능 지역은 위 목록(하노이 시내·빈푹·박닌·박장·흥옌·하이즈엉·하이퐁)뿐입니다. 하노이 밖은 지역 할증이 붙습니다.",
  "serviceArea": {
    "regionLabel": "베트남 북부",
    "notServed": "중부(다낭·후에 등)·남부(호치민 등)"
  },
  "leadTimeDays": {
    "min": 2,
    "max": 3
  }
}
```

**ITEM_SURCHARGES**

```json
{
  "device": {
    "label": "전자·가전 기기 취급",
    "usd": 40,
    "description": "IT기기(휴대폰·태블릿·노트북·PC·모니터)와 가전(청소기·드라이기 등) 기기당",
    "perUnit": true,
    "keywords": [
      "스마트폰",
      "휴대폰",
      "핸드폰",
      "자급제",
      "아이폰",
      "갤럭시s",
      "갤럭시z",
      "갤럭시탭",
      "갤럭시북",
      "아이패드",
      "태블릿",
      "노트북",
      "랩탑",
      "맥북",
      "아이맥",
      "데스크탑",
      "pc본체",
      "모니터",
      "에어랩",
      "스타일러",
      "드라이기",
      "고데기",
      "헤어드라이어",
      "공기청정기",
      "가습기",
      "전기포트",
      "전동칫솔",
      "전기면도기",
      "전동면도기",
      "청소기",
      "스팀다리미",
      "다리미",
      "전기요",
      "전기장판",
      "에어프라이어",
      "커피머신",
      "블루투스스피커",
      "살균기",
      "소독기",
      "선풍기",
      "서큘레이터",
      "제습기",
      "안마기",
      "마사지기",
      "믹서기",
      "블렌더"
    ],
    "exclude": [
      "케이스",
      "파우치",
      "거치대",
      "필름",
      "보호",
      "충전",
      "가방",
      "받침",
      "스트랩",
      "링",
      "수리",
      "액정",
      "필터",
      "먼지통",
      "브러시",
      "칫솔모",
      "면도날",
      "리필",
      "교체용",
      "전용백"
    ]
  },
  "fragile": {
    "label": "파손주의 취급",
    "usd": 2,
    "description": "도자기·유리 식기 등 완충 보강 포장이 필요한 품목 (개당)",
    "perUnit": true,
    "keywords": [
      "도자기",
      "세라믹",
      "사기그릇",
      "국그릇",
      "밥그릇",
      "그릇세트",
      "식기세트",
      "접시세트",
      "찻잔",
      "머그컵",
      "머그잔",
      "유리컵",
      "와인잔",
      "맥주잔",
      "소주잔",
      "위스키잔",
      "샴페인잔",
      "유리병",
      "꽃병",
      "화병",
      "거울",
      "탁상거울",
      "손거울",
      "액자",
      "크리스탈",
      "어항",
      "유리용기",
      "티팟"
    ]
  },
  "bulky": {
    "label": "대형 화물 취급",
    "usd": 5,
    "description": "한 품목의 청구무게가 10kg 이상인 경우 (건당)",
    "perUnit": false,
    "thresholdKg": 10
  }
}
```

**CONSOLIDATION**

```json
{
  "enabled": true,
  "freeStorageDays": 30,
  "storageFeePerDayUsd": 0.5,
  "maxOrdersPerParcel": 20,
  "handlingFeeUsd": 2
}
```

**RETURN_SHIPPING**

```json
{
  "assumed": false,
  "baseUsd": 20,
  "baseKg": 2,
  "perKgUsd": 11,
  "agentHandlingKrw": 5000,
  "blockedNote": "액체(스킨·세럼·원액 등)·배터리 내장 제품·현금·신용카드·대량 화물은 하노이→한국 반송 불가",
  "customsNote": "반송은 사전 접수 필수 · $150 이상 신고 시 한국 관부가세 발생 가능",
  "leadTime": {
    "pickupToKoreaDays": {
      "min": 1,
      "max": 2
    },
    "koreaDomesticDays": {
      "min": 1,
      "max": 2
    }
  }
}
```

### config/fees.js — 구매대행 수수료·최소 주문·정산 안내


**FEES**

```json
{
  "agencyBaseKrw": 3000,
  "agencyBaseMaxGoodsKrw": 100000,
  "agencyExcessRate": 0.05,
  "agencyBaseMaxItems": 5,
  "agencyPerExtraItemKrw": 1000,
  "agentMaxGoodsKrw": 1000000,
  "paymentRate": 0,
  "domesticShip": {
    "agentOnly": true,
    "fallbackKrw": 0,
    "maxKrw": 50000
  }
}
```

**ORDER_MIN**

```json
{
  "goodsKrw": 0
}
```

**SETTLEMENT**

```json
{
  "notice": "표시 금액은 상품명 기반 추정 무게로 계산한 예상 견적입니다. 한국 창고 입고 후 실측하여 차액이 발생하면 추가 청구 또는 환불로 정산합니다."
}
```

### config/taxes.js — 세금·관세 품목군


**TAXES**

```json
{
  "collect": false,
  "deMinimisVnd": 0,
  "defaultDutyRate": 0.1,
  "vatRate": 0.1,
  "insuranceRate": 0,
  "freightApportion": "value",
  "personalUse": {
    "maxSameItemQty": 5,
    "warnTotalVnd": 5000000,
    "message": "개인 사용 목적을 벗어난 수량은 상업적 반입으로 간주되어 통관이 보류될 수 있습니다. 동일 상품은 5개 이하를 권장합니다."
  }
}
```

**DUTY_CATEGORIES**

```json
[
  {
    "id": "footwear",
    "label": "신발",
    "dutyRate": 0.3,
    "keywords": [
      "운동화",
      "스니커즈",
      "구두",
      "샌들",
      "슬리퍼",
      "부츠",
      "로퍼",
      "워커",
      "축구화",
      "등산화",
      "실내화"
    ]
  },
  {
    "id": "bag",
    "label": "가방·패션잡화",
    "dutyRate": 0.25,
    "keywords": [
      "핸드백",
      "백팩",
      "크로스백",
      "숄더백",
      "토트백",
      "지갑",
      "캐리어",
      "여행가방",
      "벨트",
      "선글라스",
      "손목시계"
    ]
  },
  {
    "id": "apparel",
    "label": "의류",
    "dutyRate": 0.2,
    "keywords": [
      "티셔츠",
      "맨투맨",
      "후드티",
      "니트",
      "가디건",
      "자켓",
      "코트",
      "패딩",
      "청바지",
      "슬랙스",
      "원피스",
      "블라우스",
      "스커트",
      "레깅스",
      "속옷",
      "브라",
      "팬티",
      "양말",
      "잠옷",
      "수영복"
    ]
  },
  {
    "id": "cosmetics",
    "label": "화장품",
    "dutyRate": 0.2,
    "keywords": [
      "스킨케어",
      "토너",
      "에센스",
      "세럼",
      "앰플",
      "수분크림",
      "아이크림",
      "선크림",
      "선스틱",
      "쿠션",
      "파운데이션",
      "컨실러",
      "립스틱",
      "립틴트",
      "마스카라",
      "아이섀도",
      "마스크팩",
      "클렌징",
      "메이크업"
    ]
  },
  {
    "id": "food",
    "label": "가공식품",
    "dutyRate": 0.2,
    "keywords": [
      "라면",
      "과자",
      "스낵",
      "초콜릿",
      "사탕",
      "젤리",
      "음료",
      "커피",
      "차",
      "김",
      "조미료",
      "고추장",
      "된장",
      "간장",
      "소스",
      "즉석밥",
      "컵밥",
      "시리얼"
    ]
  },
  {
    "id": "supplement",
    "label": "건강기능식품",
    "dutyRate": 0.15,
    "keywords": [
      "비타민",
      "오메가3",
      "유산균",
      "프로바이오틱스",
      "콜라겐",
      "루테인",
      "밀크씨슬",
      "홍삼",
      "단백질보충제",
      "영양제"
    ]
  },
  {
    "id": "kitchen",
    "label": "주방·생활용품",
    "dutyRate": 0.15,
    "keywords": [
      "프라이팬",
      "냄비",
      "식기",
      "컵",
      "텀블러",
      "보온병",
      "수저",
      "도마",
      "밀폐용기",
      "주방세제",
      "세탁세제",
      "섬유유연제",
      "휴지",
      "물티슈"
    ]
  },
  {
    "id": "baby",
    "label": "유아용품",
    "dutyRate": 0.1,
    "keywords": [
      "기저귀",
      "분유통",
      "젖병",
      "유모차",
      "카시트",
      "아기물티슈",
      "이유식",
      "아기로션",
      "유아세제"
    ]
  },
  {
    "id": "device",
    "label": "휴대폰·컴퓨터",
    "dutyRate": 0.1,
    "keywords": [
      "스마트폰",
      "휴대폰",
      "핸드폰",
      "자급제",
      "갤럭시",
      "아이폰",
      "갤럭시s",
      "갤럭시z",
      "픽셀",
      "노트북",
      "랩탑",
      "그램",
      "맥북",
      "아이맥",
      "데스크탑",
      "태블릿",
      "아이패드",
      "갤럭시탭",
      "스마트워치",
      "갤럭시워치",
      "애플워치",
      "모니터",
      "그래픽카드",
      "메인보드"
    ]
  },
  {
    "id": "electronics",
    "label": "전자 액세서리",
    "dutyRate": 0.1,
    "keywords": [
      "이어폰",
      "헤드폰",
      "에어팟",
      "버즈",
      "스피커",
      "마우스",
      "키보드",
      "충전기",
      "케이블",
      "거치대",
      "공기청정기",
      "가습기",
      "전기포트",
      "드라이기",
      "고데기"
    ]
  },
  {
    "id": "book",
    "label": "도서·문구",
    "dutyRate": 0.05,
    "keywords": [
      "도서",
      "문제집",
      "참고서",
      "소설",
      "만화책",
      "노트북받침",
      "볼펜",
      "연필",
      "스티커",
      "다이어리",
      "스프링노트",
      "연습장"
    ]
  }
]
```

**TAX_LABELS**

```json
{
  "cif": "CIF (상품가 + 국제운임)",
  "duty": "수입관세",
  "vat": "부가가치세 (VAT)"
}
```

### config/eligibility.js — 배송 가능 여부 규칙 전체


**DESTINATION**

```json
{
  "country": "VN",
  "label": "베트남",
  "city": "하노이"
}
```

**SAFE_TERMS**

```json
[
  "세럼",
  "앰플",
  "하이라이터",
  "글로우",
  "릴리즈",
  "무기자차",
  "무기질",
  "시어버터",
  "소주잔",
  "맥주잔",
  "맥주효모",
  "와인잔",
  "와인오프너",
  "와인색",
  "와인랙",
  "위스키잔",
  "우유거품기",
  "우유병",
  "계란찜기",
  "계란말이",
  "달걀거품기",
  "생선구이",
  "재떨이",
  "피넛버터",
  "땅콩버터",
  "버터플라이",
  "치즈맛",
  "치즈향",
  "냉장고정리",
  "냉장고커버",
  "냉장고탈취",
  "냉장고청소",
  "세탁기청소",
  "세탁기커버",
  "건조기시트",
  "침대커버",
  "침대시트",
  "침대패드",
  "소파커버",
  "매트리스커버",
  "가구시트",
  "가구필름",
  "자전거헬멧",
  "자전거장갑",
  "자전거자물쇠",
  "자전거라이트",
  "오토바이헬멧",
  "오토바이장갑",
  "오토바이커버",
  "회사",
  "회복",
  "기회",
  "회전",
  "회의",
  "사회",
  "생물학",
  "미생물",
  "생화학",
  "햄버거",
  "햄스터",
  "햄프",
  "햄토리",
  "스팸메일",
  "스팸차단",
  "스팸필터",
  "현금영수증",
  "중고등",
  "중고생",
  "방탄소년단",
  "대마도",
  "청주시",
  "흙침대",
  "시너지",
  "총알배송"
]
```

**CONTEXT_MARKERS**

```json
{
  "shelfStable": [
    "상온",
    "실온",
    "상온보관",
    "실온보관",
    "멸균",
    "레토르트",
    "통조림",
    "캔",
    "병조림",
    "진공포장",
    "쌀/잡곡",
    "과자/간식",
    "과자",
    "간식",
    "라면/즉석식품",
    "라면",
    "즉석식품",
    "즉석밥",
    "컵밥",
    "컵라면",
    "장/소스/드레싱",
    "소스",
    "드레싱",
    "양념",
    "조미료",
    "커피/음료",
    "커피",
    "차/음료",
    "음료",
    "건강식품",
    "건강기능식품",
    "영양제",
    "분유/이유식",
    "이유식",
    "시리얼",
    "그래놀라",
    "견과",
    "건과일",
    "건어물",
    "김/해조류",
    "면류",
    "국수",
    "파스타",
    "누룽지",
    "떡/한과",
    "한과",
    "초콜릿",
    "사탕",
    "젤리",
    "쿠키",
    "비스킷",
    "빵",
    "건조",
    "말린",
    "분말",
    "가루",
    "스틱",
    "파우치",
    "즉석",
    "인스턴트",
    "프로틴",
    "단백질보충제"
  ],
  "cosmetic": [
    "뷰티",
    "화장품",
    "스킨케어",
    "메이크업",
    "색조",
    "기초화장",
    "세럼",
    "앰플",
    "에센스",
    "토너",
    "스킨로션",
    "미스트",
    "마스크팩",
    "시트마스크",
    "마스크시트",
    "마스크",
    "쿠션",
    "파운데이션",
    "컨실러",
    "립밤",
    "립스틱",
    "틴트",
    "아이섀도",
    "마스카라",
    "클렌징",
    "세안",
    "필링",
    "선크림",
    "자외선차단",
    "재생크림",
    "수분크림",
    "영양크림",
    "아이크림",
    "핸드크림",
    "나이트크림",
    "데이크림",
    "자음생크림",
    "진생크림",
    "탄력크림",
    "보습크림",
    "페이스크림"
  ]
}
```

**BLOCK_RULES**

```json
[
  {
    "id": "dangerous",
    "label": "항공 위험물",
    "reason": "가스·폭죽·성냥은 항공기에 실을 수 없습니다. 향수·스프레이 같은 상온 생활용품은 문제 없음",
    "keywords": [
      "가스라이터",
      "지포라이터",
      "토치라이터",
      "부탄가스",
      "휴대용가스",
      "가스토치",
      "캠핑가스",
      "이소부탄",
      "성냥",
      "폭죽",
      "불꽃놀이",
      "페인트시너"
    ]
  },
  {
    "id": "alcohol-tobacco",
    "label": "주류·담배",
    "reason": "베트남 특별소비세 대상이며 수입 허가가 필요해 개인 반입이 불가합니다.",
    "excludeIfAny": [
      "식초",
      "비니거",
      "비네거",
      "발사믹",
      "미림",
      "맛술",
      "요리술",
      "조미술",
      "와인잔",
      "와인글라스",
      "와인오프너",
      "와인셀러",
      "와인랙",
      "와인쿨러",
      "와인병따개"
    ],
    "keywords": [
      "주류",
      "소주",
      "맥주",
      "와인",
      "위스키",
      "사케",
      "청주",
      "막걸리",
      "고량주",
      "보드카",
      "럼주",
      "바카디",
      "리큐르",
      "브랜디",
      "데킬라",
      "진토닉",
      "하이볼",
      "담배",
      "전자담배",
      "궐련",
      "니코틴",
      "전자담배액상",
      "니코틴액상",
      "연초잎",
      "시가담배",
      "쿠바시가",
      "아이코스",
      "전자연초"
    ]
  },
  {
    "id": "cold-chain",
    "label": "냉장·냉동 식품",
    "reason": "항공 배송 중에는 냉장·냉동을 유지할 수 없어 상할 수 있습니다. 상온으로 파는 식품은 문제 없음",
    "exemptIfContext": [
      "cosmetic"
    ],
    "excludeIfAny": [
      "냉장고",
      "냉동고",
      "냉동실",
      "냉장실",
      "보관용기",
      "밀폐용기",
      "지퍼백",
      "보관백",
      "정리함",
      "트레이",
      "칸막이",
      "수납",
      "아이스팩",
      "보냉",
      "온도계",
      "라벨"
    ],
    "keywords": [
      "냉동",
      "냉장",
      "아이스크림",
      "급속냉각"
    ]
  },
  {
    "id": "quarantine-animal",
    "label": "축산물·검역 대상",
    "reason": "생고기·냉장 유제품·회는 상할 수 있습니다. 상온으로 파는 식품은 문제 없음",
    "exemptIfContext": [
      "cosmetic",
      "shelfStable"
    ],
    "excludeIfAny": [
      "곱창김",
      "김선물세트",
      "조미김",
      "재래김",
      "파래김",
      "돌김",
      "마른김",
      "전장김",
      "도시락김",
      "김자반",
      "캔김",
      "김밥김",
      "들기름김",
      "김스낵",
      "건어물",
      "멸균우유",
      "두유",
      "분유",
      "연유"
    ],
    "keywords": [
      "육류",
      "소고기",
      "돼지고기",
      "닭고기",
      "오리고기",
      "양고기",
      "한우",
      "삼겹살",
      "목살",
      "항정살",
      "생고기",
      "소시지",
      "베이컨",
      "살라미",
      "순대",
      "족발",
      "곱창",
      "막창",
      "대창",
      "만두소",
      "델리미트",
      "슬라이스햄",
      "훈제햄",
      "불고기",
      "닭갈비",
      "우유",
      "생우유",
      "치즈",
      "버터",
      "생크림",
      "요거트",
      "계란",
      "달걀",
      "메추리알",
      "생선",
      "활어",
      "생선회",
      "모둠회",
      "연어회",
      "냉동수산"
    ]
  },
  {
    "id": "restricted-goods",
    "listed": false,
    "label": "통관 금지 품목",
    "reason": "베트남 수입 금지 품목입니다.",
    "keywords": [
      "권총",
      "소총",
      "엽총",
      "장난감총",
      "모의총기",
      "bb탄",
      "도검",
      "무기류",
      "흉기",
      "전기충격기",
      "삼단봉",
      "너클",
      "음란",
      "성인용품",
      "도박",
      "마약",
      "대마초",
      "마리화나",
      "중고품",
      "리퍼브",
      "리퍼비시",
      "반품상품",
      "짝퉁",
      "이미테이션",
      "레플리카",
      "가품",
      "중고폰",
      "중고휴대폰",
      "중고노트북",
      "s급중고",
      "a급중고",
      "개봉중고",
      "전시상품",
      "드론",
      "무전기",
      "군복",
      "군용",
      "방탄복",
      "방탄조끼",
      "현금다발",
      "상품권",
      "기프트카드",
      "유가증권"
    ]
  },
  {
    "id": "oversize",
    "label": "대형 가전·가구",
    "reason": "항공특송으로 보낼 수 없는 대형 품목이라 취급하지 않습니다.",
    "excludeIfAny": [
      "세제",
      "세정제",
      "캡슐",
      "태블릿",
      "린스",
      "전용액",
      "클리너",
      "탈취",
      "필터",
      "먼지통",
      "노즐",
      "브러시",
      "거치대",
      "커버",
      "받침",
      "매트",
      "부품",
      "소모품",
      "리필",
      "교체"
    ],
    "keywords": [
      "냉장고",
      "김치냉장고",
      "세탁기",
      "건조기",
      "식기세척기",
      "침대프레임",
      "소파",
      "매트리스",
      "옷장",
      "책상",
      "피아노",
      "러닝머신",
      "자전거",
      "킥보드",
      "전동휠",
      "전동킥보드"
    ]
  }
]
```

**MANUAL_QUOTE_RULES**

```json
[
  {
    "id": "overweight",
    "listed": true,
    "label": "중량 초과",
    "reason": "단일 상품 30kg 을 초과할 경우 상담 요청해주세요.",
    "notice": "접수 후 물류사와 확인해 요금을 안내드립니다.",
    "maxItemKg": 30
  },
  {
    "id": "oversize",
    "label": "장척·특수 화물",
    "reason": "골프채·캐리어처럼 길거나 큰 화물은 항공 특수 취급이라 물류사 견적이 필요합니다.",
    "notice": "접수 후 정확한 배송 요금을 안내드립니다.",
    "keywords": [
      "골프채",
      "골프클럽",
      "골프백",
      "스키",
      "스노보드",
      "낚싯대",
      "서핑보드",
      "전신거울",
      "캐리어",
      "여행가방"
    ]
  },
  {
    "id": "high-value",
    "label": "고액 상품",
    "reason": "파손·분실 시 손해가 커 보험 가입 여부를 확인해야 합니다.",
    "notice": "보험료가 별도로 안내됩니다.",
    "thresholdKrw": 1000000
  }
]
```

**CAUTION_RULES**

```json
[
  {
    "id": "shelf-stable-animal",
    "context": "shelfStable",
    "keywords": [
      "스팸",
      "리챔",
      "런천미트",
      "캔햄",
      "통조림햄",
      "햄통조림",
      "통조림",
      "햄세트",
      "육포",
      "비프저키",
      "육개장",
      "설렁탕",
      "삼계탕",
      "갈비탕",
      "장조림",
      "분유",
      "연유",
      "멸균우유"
    ],
    "silent": true,
    "message": "고기·유제품이 든 상온 식품입니다."
  },
  {
    "id": "battery-caution",
    "keywords": [
      "보조배터리",
      "파워뱅크",
      "리튬배터리",
      "리튬이온배터리",
      "배터리팩",
      "네오디뮴",
      "강력자석"
    ],
    "message": "보조배터리·리튬배터리는 항공 규정에 따라 물류사가 반려할 수 있어 접수 후 확인해 드립니다."
  },
  {
    "id": "pharma-caution",
    "keywords": [
      "의약품",
      "처방약",
      "전문의약품",
      "일반의약품",
      "항생제",
      "수면제",
      "진통제",
      "해열제",
      "소염제",
      "한약재",
      "스테로이드",
      "호르몬제",
      "피임약",
      "발기부전",
      "탈모약",
      "연고제"
    ],
    "message": "의약품은 베트남 통관에서 보류될 수 있습니다. 본인 사용분 소량만 보내주세요."
  },
  {
    "id": "plant-caution",
    "keywords": [
      "씨앗",
      "종자",
      "묘목",
      "화분",
      "배양토",
      "구근",
      "생화",
      "모종",
      "분갈이흙"
    ],
    "message": "씨앗·묘목·흙은 베트남 식물 검역 대상이라 통관에서 보류될 수 있습니다."
  }
]
```

**WARN_RULES**

```json
{
  "highValueKrw": 1500000,
  "maxSameItemQty": 5,
  "maxParcelKg": 30
}
```

### config/payment.js — 결제·환불·정산·수익 인식


**PAYMENT**

```json
{
  "model": "prepaid",
  "invoiceValidHours": 48,
  "lockFxAtOrder": true,
  "segregateCustomerFunds": true
}
```

**REFUND_DAYS**

```json
{
  "min": 3,
  "max": 7
}
```

**RETURN_POLICY**

```json
{
  "customerPaysReturnShipping": true,
  "exchangeRebillsFull": true,
  "agentRetainsAgencyFee": true,
  "forwardingRefundFeeUsd": 1
}
```

**SETTLEMENT_RULES**

```json
{
  "toleranceByConfidence": {
    "high": 10000,
    "medium": 6000,
    "low": 3000
  },
  "toleranceKrw": 3000,
  "maxAutoAdditionalRate": 0.3,
  "refundFeeKrw": 0,
  "labels": {
    "additional": "추가 청구",
    "refund": "환불",
    "none": "정산 불필요"
  }
}
```

**REVENUE_RECOGNITION**

```json
{
  "mode": "agent",
  "note": "구매대행은 대리인 거래이므로 상품가·관세·VAT는 예수금으로 처리하고, 대행수수료와 배송마진만 매출로 인식합니다."
}
```

### config/quote.js — 견적서


**QUOTE**

```json
{
  "issuer": {
    "brand": "YS-ECOM 베트남 직구",
    "name": "전세계무역 (JEONSEGYE TRADING)",
    "address": "412, 4F, Bldg 1, 10 Cheongnahannae-ro 100beon-gil, Seo-gu, Incheon, Republic of Korea",
    "pic": "KIM YOUNG SEO"
  },
  "validDays": 7,
  "labels": {
    "provisional": {
      "ko": "임시 견적서",
      "en": "PROVISIONAL QUOTATION"
    },
    "final": {
      "ko": "최종 견적서",
      "en": "FINAL QUOTATION"
    }
  }
}
```

### config/sourcing.js — 상품 출처(국내·로켓직구·해외판매자)


**SOURCING**

```json
{
  "domestic": {
    "id": "domestic",
    "label": "국내 배송 상품",
    "toWarehouseDays": {
      "min": 1,
      "max": 3
    },
    "warnings": []
  },
  "rocketGlobal": {
    "id": "rocket-global",
    "label": "로켓직구",
    "toWarehouseDays": {
      "min": 3,
      "max": 6
    },
    "warnings": [
      "해외직구(로켓직구) 상품입니다 — 한국 창고 도착까지 +2~3영업일이 더 걸립니다.",
      "해외직구 상품은 쿠팡에서 반품·교환이 제한될 수 있습니다."
    ]
  },
  "overseasSeller": {
    "id": "overseas-seller",
    "label": "판매자 해외배송",
    "toWarehouseDays": {
      "min": 7,
      "max": 21
    },
    "warnings": [
      "판매자가 해외에서 직접 발송하는 상품입니다. 한국 창고 도착이 최대 3주까지 걸릴 수 있습니다.",
      "도착일이 확정되지 않아 전체 일정이 지연될 수 있습니다.",
      "해외 판매자 상품은 반품·A/S 가 사실상 불가능합니다.",
      "한국 창고 주소로 배송이 거부되는 경우가 있어, 주문 전 확인이 필요합니다."
    ],
    "excludeFromConsolidation": true
  }
}
```

**SOURCING_SIGNALS**

```json
{
  "rocketGlobal": [
    "로켓직구",
    "로켓 직구",
    "rocket global",
    "직구특가"
  ],
  "overseasSeller": [
    "해외직구",
    "해외 직구",
    "해외배송",
    "해외 배송",
    "구매대행",
    "해외판매자",
    "글로벌셀러",
    "직배송",
    "통관번호",
    "개인통관고유부호"
  ]
}
```

**OVERSEAS_NOTICE**

```json
{
  "title": "해외직구 상품입니다",
  "body": "이 상품은 한국이 아닌 해외에서 발송되어 한국 창고에 도착합니다. 도착 후 하노이로 재발송되므로 전체 소요 기간이 길어지고, 도착일이 확정되지 않습니다.",
  "costNote": "쿠팡 결제 시 관·부가세가 별도 부과될 수 있으며, 이는 저희 견적에 포함되지 않습니다. 한국 창고 입고 후 실제 무게와 비용을 다시 확인해 최종 금액을 안내합니다."
}
```

### config/maintenance.js — 쇼핑몰 점검 시간


**MAINTENANCE**

```json
{
  "enabled": true,
  "appliesTo": [
    "VN"
  ],
  "timezone": {
    "id": "KST",
    "label": "한국시간",
    "utcOffsetMinutes": 540
  },
  "startMinuteOfDay": 180,
  "durationMinutes": 30,
  "noticeLeadMinutes": 15,
  "graceMinutes": 10,
  "label": "쇼핑몰 점검 시간",
  "shortLabel": "점검 중",
  "reason": "쇼핑몰 시스템 점검 시간대와 겹쳐 가격·재고 정보가 정확하지 않을 수 있습니다. 잘못된 견적을 드리지 않기 위해 잠시 멈춥니다."
}
```

**MAINTENANCE_POLICY**

```json
{
  "readProductPage": "block",
  "purchase": "block",
  "addToCart": "allow",
  "createOrder": "allow",
  "confirmPayment": "allow",
  "warehouse": "allow",
  "settlement": "allow"
}
```

**MAINTENANCE_EXCEPTIONS**

```json
{
  "allowOperatorOverride": true,
  "allowInFlight": true,
  "exemptOrderNos": [],
  "temporarilyDisabled": false
}
```

### config/fx.js — 환율 기본값


**FX**

```json
{
  "krwToVnd": 18.5,
  "usdToKrw": 1380,
  "spread": 0.015,
  "vndRoundTo": 1000,
  "updatedAt": null
}
```

### config/warehouse.js — 한국 창고 주소 (환경변수 없을 때 기본값)


**WAREHOUSE**

```json
{
  "name": "",
  "zip": "07504",
  "address1": "서울특별시 강서구 개화동로 11길 5",
  "address2": "",
  "code": "YS-ECOM",
  "phone": "010-4803-6031",
  "configured": true
}
```

### config/legal.js — 법적 고지·동의 문장


**BUSINESS**

```json
{
  "name": "전세계무역",
  "nameEn": "JEONSEGYE TRADING",
  "ceo": "김영서",
  "address": "인천광역시 서구 청라한내로100번길 10, 1차동 4층 412호 (청라동, 청라큐브시그니처1차오피스텔)",
  "bizNo": "360-14-03304",
  "mailOrderNo": "2025-인천서구-2986",
  "bizType": "도매 및 소매업 / 전자상거래 소매업 · 기타 통신판매업 · SNS마켓 · 해외직구대행업",
  "tel": "",
  "email": "",
  "disputeVenue": "대한민국 법원"
}
```

**NOTICES**

```json
[
  {
    "id": "role",
    "category": "서비스의 성격",
    "severity": "critical",
    "title": "저희는 판매자가 아니라 구매·배송을 대행합니다",
    "body": [
      "배송대행은 고객님이 직접 쇼핑몰에서 결제한 상품을 한국 창고에서 받아 하노이로 보내드리는 운송 서비스입니다.",
      "구매대행은 고객님을 대신해 상품을 주문·결제해 드리는 대리 구매 서비스입니다.",
      "어느 경우든 상품의 판매자는 쇼핑몰 입점 판매자이며, 당사는 통신판매의 당사자가 아닙니다.",
      "따라서 상품 자체의 하자·오배송·품질 문제는 판매자 책임이며, 당사는 반품·교환 절차를 도와드립니다."
    ]
  },
  {
    "id": "inspection",
    "category": "서비스의 성격",
    "severity": "important",
    "title": "검수는 겉포장 확인 수준입니다",
    "body": [
      "창고에서는 상자 수량·외관 파손·무게만 확인합니다.",
      "상자를 열어 내용물의 정품 여부·작동 여부·유통기한을 검사하지 않습니다.",
      "개봉 검수가 필요하면 접수 시 미리 요청해 주세요(추가 비용이 발생할 수 있습니다)."
    ]
  },
  {
    "id": "volumetric",
    "category": "요금",
    "severity": "critical",
    "title": "항공 운임은 실무게와 부피무게 중 큰 값으로 청구됩니다",
    "body": [
      "가볍지만 부피가 큰 물건(휴지·기저귀·과자 등)은 실제 무게보다 비싸게 청구됩니다.",
      "부피무게 = 가로×세로×높이(cm) ÷ 6000 (항공 표준).",
      "접수 화면의 금액은 상품명으로 추정한 값이며, 실제 무게는 창고 실측으로 확정됩니다."
    ]
  },
  {
    "id": "reweigh",
    "category": "요금",
    "severity": "critical",
    "title": "실측 후 차액이 크면 추가 청구 또는 환불합니다",
    "body": [
      "한국 창고 실측 무게로 다시 계산해 최종 견적서를 보내드립니다.",
      "차액이 기준 금액 이상이면 추가 청구 또는 환불하고, 그 미만이면 임시 견적서 금액 그대로 확정합니다.",
      "기준 금액은 3,000~10,000원 ≈ 56,000₫~188,000₫이며(무게 추정이 정확한 상품일수록 넉넉히 흡수합니다), 주문마다 정확한 금액을 견적서에 원화·동화로 적어 드립니다.",
      "추가 청구액을 내지 않으면 출고가 보류되며, 보관 기간이 지나면 반송·폐기 규정을 따릅니다."
    ]
  },
  {
    "id": "fx",
    "category": "요금",
    "severity": "info",
    "title": "환율은 접수 시점으로 고정됩니다",
    "body": [
      "주문 접수 시점의 환율로 원화·동화 금액을 함께 확정합니다.",
      "이후 환율이 변해도 이미 접수된 주문 금액은 바뀌지 않습니다."
    ]
  },
  {
    "id": "duty",
    "category": "통관·세금",
    "severity": "critical",
    "title": "베트남 관세·부가세는 수하인(고객) 부담입니다",
    "body": [
      "통관 과정에서 세금이 부과되면 납세 의무자는 수하인인 고객님입니다.",
      "세액은 베트남 세관이 결정하며 당사가 정하거나 조정할 수 없습니다.",
      "세금 미납으로 통관이 보류·반송되면 그 비용도 고객님 부담입니다."
    ]
  },
  {
    "id": "personal-use",
    "category": "통관·세금",
    "severity": "important",
    "title": "자가 사용 목적만 접수합니다 (재판매 금지)",
    "body": [
      "판매 목적의 대량 반입은 상업 통관 대상이라 접수하지 않습니다.",
      "같은 품목을 반복·대량으로 보내면 세관이 상업 화물로 볼 수 있고, 그 책임은 고객님께 있습니다."
    ]
  },
  {
    "id": "recipient-info",
    "category": "통관·세금",
    "severity": "important",
    "title": "수취인 정보는 실제와 정확히 일치해야 합니다",
    "body": [
      "이름·연락처·주소가 실제와 다르면 통관이 지연되거나 반송됩니다.",
      "타인 명의로 보내는 경우 발생하는 문제의 책임은 신청인에게 있습니다."
    ]
  },
  {
    "id": "prohibited",
    "category": "금지 품목",
    "severity": "critical",
    "title": "항공 위험물과 수입 금지 품목은 보낼 수 없습니다",
    "body": [
      "부탄가스·라이터·폭죽 같은 항공 위험물은 보낼 수 없습니다. 보조배터리·리튬배터리는 항공 규정에 따라 물류사가 반려할 수 있어 접수 후 확인합니다. 향수·매니큐어·스프레이 같은 상온 생활용품은 보낼 수 있습니다.",
      "냉장·냉동 식품은 보낼 수 없습니다 — 항공 배송 중 냉기를 유지할 수 없어 상하거나 폐기됩니다. 상온으로 파는 식품은 보낼 수 있습니다.",
      "생고기·회·냉장 유제품·계란 등 축산물과 종자·식물은 베트남 검역 대상이라 반입이 금지됩니다. 고기·유제품이 든 상온 가공식품(캔햄·육포·레토르트)은 보낼 수 있으나 검역에서 확인을 요구할 수 있습니다.",
      "위조품·지식재산권 침해 물품은 어떤 경우에도 취급하지 않습니다.",
      "중국 등 해외에서 발송되는 직구 상품(로켓직구 등)은 접수하지 않습니다.",
      "접수 후 금지 품목이 발견되면 폐기 또는 반송되며, 그 비용은 고객님 부담입니다."
    ]
  },
  {
    "id": "cancel",
    "category": "취소·환불",
    "severity": "critical",
    "title": "취소 시점에 따라 환불 금액이 달라집니다",
    "body": [
      "입금 전 또는 발주 전: 전액 취소·환불이 가능합니다.",
      "구매대행 발주 후: 상품은 판매자 반품 절차를 따르고, 구매대행 수수료는 환불되지 않습니다.",
      "배송대행 접수 후 취소: 실비 1달러를 차감하고 환불합니다.",
      "당사 사유(발주 실패·서비스 오류)로 취소되면 전액 환불합니다.",
      "환불은 확정 후 영업일 3~7일 내에 지급됩니다."
    ]
  },
  {
    "id": "return-cost",
    "category": "취소·환불",
    "severity": "critical",
    "title": "하노이 도착 후 반품·교환 비용은 전액 고객 부담입니다",
    "body": [
      "하노이 → 한국 반송비는 2kg까지 20달러, 이후 1kg당 11달러입니다.",
      "구매대행은 반품 처리비 5,000원이 추가됩니다.",
      "교환은 반송비와 재배송비가 모두 발생하므로, 상품가와 비교해 판단하시기 바랍니다.",
      "액체·배터리 내장 제품·대량 화물은 반송 자체가 불가능해 교환·반품이 되지 않습니다."
    ]
  },
  {
    "id": "damage",
    "category": "사고·지연",
    "severity": "important",
    "title": "파손·분실 배상에는 한도와 면책이 있습니다",
    "body": [
      "배상은 물류사 운송 약관의 한도 내에서 이루어지며, 상품가 전액이 보장되지 않을 수 있습니다.",
      "판매자의 포장이 부실했거나 파손되기 쉬운 물건(유리·도자기 등)은 배상에서 제외될 수 있습니다.",
      "사고 확인을 위해 수령 즉시 개봉 영상 또는 사진이 필요합니다. 수령 후 3일이 지나면 접수가 어렵습니다."
    ]
  },
  {
    "id": "delay",
    "category": "사고·지연",
    "severity": "info",
    "title": "통관·기상·항공 사정에 따른 지연은 면책입니다",
    "body": [
      "안내드리는 소요 기간은 영업일 기준 예상이며 보장 기간이 아닙니다.",
      "세관 검사, 명절·연휴, 기상 악화, 항공편 결항으로 인한 지연은 배상 대상이 아닙니다."
    ]
  },
  {
    "id": "storage",
    "category": "사고·지연",
    "severity": "important",
    "title": "창고 보관 기간이 지나면 반송 또는 폐기됩니다",
    "body": [
      "한국 창고 무료 보관은 입고일로부터 30일입니다.",
      "기간이 지나거나 추가 청구액이 미납되면 반송 또는 폐기될 수 있으며, 그 비용은 고객님 부담입니다."
    ]
  },
  {
    "id": "privacy",
    "category": "개인정보",
    "severity": "critical",
    "title": "배송에 필요한 정보를 수집하고 국외로 전달합니다",
    "body": [
      "수집 항목: 이름, 연락처, 배송지 주소, 주문 정보.",
      "이용 목적: 상품 접수·운송·통관·배송 안내·정산.",
      "제3자 제공: 물류사(운송·통관 대행), 항공사, 현지 배송사. 제공 항목은 배송에 필요한 최소한입니다.",
      "국외 이전: 한국 → 베트남 (배송·통관 목적). 동의하지 않으면 서비스를 이용할 수 없습니다.",
      "보유 기간: 배송 완료 후 5년 (전자상거래 관련 기록 보존 의무).",
      "만 14세 미만은 법정대리인의 동의가 있어야 이용할 수 있습니다."
    ]
  },
  {
    "id": "payment",
    "category": "결제",
    "severity": "important",
    "title": "본인 명의로 결제해 주세요",
    "body": [
      "타인 명의 계좌·카드로 결제해 발생하는 문제(분쟁·지급정지)의 책임은 신청인에게 있습니다.",
      "계좌 이체 시 메모에 주문번호를 넣어야 입금 확인이 됩니다.",
      "카드 결제 취소는 카드사 처리 기간에 따라 영업일 3~7일이 걸립니다."
    ]
  },
  {
    "id": "dispute",
    "category": "분쟁",
    "severity": "info",
    "title": "분쟁은 협의로 해결하며, 준거법은 대한민국 법입니다",
    "body": [
      "문제가 생기면 먼저 카카오톡으로 알려주세요. 대부분 협의로 해결됩니다.",
      "협의가 되지 않는 경우 대한민국 법을 준거법으로 하며, 관할은 민사소송법에 따릅니다."
    ]
  }
]
```

**REQUIRED_CONSENTS**

```json
[
  {
    "id": "service",
    "label": "당사는 판매자가 아닌 구매·배송 대행자임을 확인했습니다",
    "noticeIds": [
      "role",
      "inspection"
    ]
  },
  {
    "id": "fees",
    "label": "부피무게 청구와 실측 후 차액 정산(3,000~10,000원 ≈ 56,000₫~188,000₫ 기준)에 동의합니다",
    "noticeIds": [
      "volumetric",
      "reweigh",
      "fx"
    ]
  },
  {
    "id": "customs",
    "label": "베트남 관세·부가세는 제가 부담하며, 자가 사용 목적임을 확인합니다",
    "noticeIds": [
      "duty",
      "personal-use",
      "recipient-info"
    ]
  },
  {
    "id": "prohibited",
    "label": "금지 품목(배터리·액체·축산물·위조품 등)이 없음을 확인했습니다",
    "noticeIds": [
      "prohibited"
    ]
  },
  {
    "id": "privacy",
    "label": "개인정보 수집·제3자 제공·국외이전(한국→베트남)에 동의합니다",
    "noticeIds": [
      "privacy"
    ]
  },
  {
    "id": "refund",
    "label": "취소·반품 비용 부담 규정을 확인했습니다",
    "noticeIds": [
      "cancel",
      "return-cost",
      "damage",
      "storage"
    ]
  }
]
```

**OPTIONAL_CONSENTS**

```json
[
  {
    "id": "marketing",
    "label": "새 상품·할인 소식을 카카오톡/Zalo·이메일로 받겠습니다 (선택 · 언제든 철회할 수 있습니다)"
  }
]
```

**SETTLEMENT_TOLERANCE_TEXT**

```json
"3,000~10,000원 ≈ 56,000₫~188,000₫"
```

### config/words.js — 쉬운 말 사전


**WORDS**

```json
{
  "pay": {
    "action": "보내기",
    "actionFull": "배송비 보내기",
    "waiting": "보내주시면 시작해요",
    "done": "받았습니다",
    "formal": "입금"
  },
  "refund": {
    "action": "돌려드리기",
    "done": "돌려드렸습니다",
    "formal": "환불"
  },
  "amount": {
    "due": "내실 금액",
    "estimate": "예상 금액",
    "final": "확정 금액",
    "formalInvoice": "청구서",
    "formalQuote": "견적서"
  },
  "order": {
    "action": "신청하기",
    "done": "신청 완료",
    "formal": "접수",
    "noun": "신청",
    "numberLabel": "신청번호"
  },
  "ship": {
    "warehouse": "한국 창고",
    "inWarehouse": "한국 창고 도착",
    "flying": "하노이로 가는 중",
    "arrived": "하노이 도착",
    "delivered": "받으셨습니다"
  },
  "adjust": {
    "more": "조금 더 내실 금액",
    "less": "돌려드릴 금액",
    "same": "처음 안내한 금액 그대로",
    "formal": "정산"
  }
}
```

### config/contact.js — 문의 채널


**CONTACT**

```json
{
  "kakaoId": "vietnam911",
  "kakaoOpenChat": "https://open.kakao.com/o/simlWALi",
  "label": "카카오톡",
  "qrPath": "/kakao-openchat-qr.png"
}
```

### config/partners.js — 쿠팡으로 가기 버튼


**SHOP_HOME**

```json
"https://www.coupang.com/"
```

**PARTNERS_NOTICE**

```json
"이 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
```

### config/catalog.js — 상품 카탈로그(있는 export 전부)


**BRAND_SAFELIST**

```json
[
  "포맨트",
  "포멘트",
  "맨디",
  "옴므아이"
]
```

**CATALOG_SEARCH_TERMS**

```json
[
  {
    "term": "토너",
    "subcategoryId": "skincare"
  },
  {
    "term": "에센스",
    "subcategoryId": "skincare"
  },
  {
    "term": "세럼",
    "subcategoryId": "skincare"
  },
  {
    "term": "수분크림",
    "subcategoryId": "skincare"
  },
  {
    "term": "아이크림",
    "subcategoryId": "skincare"
  },
  {
    "term": "앰플",
    "subcategoryId": "skincare"
  },
  {
    "term": "클렌징오일",
    "subcategoryId": "cleansing"
  },
  {
    "term": "폼클렌징",
    "subcategoryId": "cleansing"
  },
  {
    "term": "클렌징밤",
    "subcategoryId": "cleansing"
  },
  {
    "term": "립앤아이리무버",
    "subcategoryId": "cleansing"
  },
  {
    "term": "시트마스크",
    "subcategoryId": "mask"
  },
  {
    "term": "토너패드",
    "subcategoryId": "mask"
  },
  {
    "term": "슬리핑팩",
    "subcategoryId": "mask"
  },
  {
    "term": "선크림",
    "subcategoryId": "suncare"
  },
  {
    "term": "선스틱",
    "subcategoryId": "suncare"
  },
  {
    "term": "톤업선크림",
    "subcategoryId": "suncare"
  },
  {
    "term": "쿠션팩트",
    "subcategoryId": "base"
  },
  {
    "term": "파운데이션",
    "subcategoryId": "base"
  },
  {
    "term": "컨실러",
    "subcategoryId": "base"
  },
  {
    "term": "메이크업프라이머",
    "subcategoryId": "base"
  },
  {
    "term": "아이섀도우팔레트",
    "subcategoryId": "eye"
  },
  {
    "term": "마스카라",
    "subcategoryId": "eye"
  },
  {
    "term": "아이라이너",
    "subcategoryId": "eye"
  },
  {
    "term": "아이브로우",
    "subcategoryId": "eye"
  },
  {
    "term": "립틴트",
    "subcategoryId": "lip"
  },
  {
    "term": "립스틱",
    "subcategoryId": "lip"
  },
  {
    "term": "립밤",
    "subcategoryId": "lip"
  },
  {
    "term": "립글로스",
    "subcategoryId": "lip"
  },
  {
    "term": "네일스티커",
    "subcategoryId": "nail"
  },
  {
    "term": "젤네일",
    "subcategoryId": "nail"
  },
  {
    "term": "여성향수",
    "subcategoryId": "perfume"
  },
  {
    "term": "바디미스트",
    "subcategoryId": "perfume"
  }
]
```

**COUPANG_BEAUTY_CATEGORY_ID**

```json
1001
```

**MALE_KEYWORDS**

```json
[
  "남성",
  "남자",
  "맨즈",
  "멘즈",
  "men's",
  "mens",
  "for men",
  "포맨",
  "4men",
  "옴므",
  "homme",
  "pour homme",
  "쉐이빙",
  "셰이빙",
  "shaving",
  "애프터쉐이브",
  "면도",
  "수염",
  "스킨로션세트 남성"
]
```

**NON_COSMETIC_KEYWORDS**

```json
[
  "드라이기",
  "고데기",
  "헤어아이론",
  "에어랩",
  "미용기기",
  "LED마스크",
  "갈바닉",
  "제모기",
  "면도기",
  "이발기",
  "눈썹칼",
  "족집게",
  "거울",
  "파우치",
  "화장솜통",
  "브러시세트",
  "퍼프",
  "스펀지",
  "뷰러",
  "네일아트기기",
  "샴푸",
  "린스",
  "트리트먼트",
  "헤어에센스",
  "헤어오일",
  "염색약",
  "탈모",
  "바디워시",
  "바디로션",
  "바디크림",
  "바디스크럽",
  "핸드워시",
  "풋크림",
  "생리대",
  "탐폰",
  "칫솔",
  "치약",
  "구강청결제",
  "데오드란트",
  "제모크림",
  "영양제",
  "콜라겐",
  "유산균",
  "다이어트",
  "리필용기",
  "공병",
  "샘플증정",
  "미용실",
  "체험단"
]
```

**SUBCATEGORIES**

```json
[
  {
    "id": "skincare",
    "matchPriority": 90,
    "label": "스킨케어",
    "emoji": "💧",
    "keywords": [
      "스킨",
      "토너",
      "로션",
      "에멀전",
      "에센스",
      "세럼",
      "앰플",
      "크림",
      "아이크림",
      "미스트",
      "오일",
      "수분크림",
      "나이트크림"
    ],
    "searchTerms": [
      "토너",
      "에센스",
      "세럼",
      "수분크림",
      "아이크림",
      "앰플"
    ]
  },
  {
    "id": "cleansing",
    "matchPriority": 20,
    "label": "클렌징",
    "emoji": "🫧",
    "keywords": [
      "클렌징",
      "클렌저",
      "폼클렌징",
      "클렌징오일",
      "클렌징워터",
      "클렌징밤",
      "리무버",
      "필링",
      "스크럽",
      "각질"
    ],
    "searchTerms": [
      "클렌징오일",
      "폼클렌징",
      "클렌징밤",
      "립앤아이리무버"
    ]
  },
  {
    "id": "mask",
    "matchPriority": 30,
    "label": "마스크팩",
    "emoji": "🧖",
    "keywords": [
      "마스크팩",
      "마스크시트",
      "시트마스크",
      "워시오프팩",
      "슬리핑팩",
      "수면팩",
      "모델링팩",
      "필오프팩",
      "토너패드",
      "필링패드",
      "패드"
    ],
    "searchTerms": [
      "시트마스크",
      "토너패드",
      "슬리핑팩"
    ]
  },
  {
    "id": "suncare",
    "matchPriority": 10,
    "label": "선케어",
    "emoji": "☀️",
    "keywords": [
      "선크림",
      "썬크림",
      "선스틱",
      "선쿠션",
      "선세럼",
      "선블록",
      "자외선차단",
      "톤업크림"
    ],
    "searchTerms": [
      "선크림",
      "선스틱",
      "톤업선크림"
    ]
  },
  {
    "id": "base",
    "matchPriority": 50,
    "label": "베이스메이크업",
    "emoji": "🎨",
    "keywords": [
      "쿠션",
      "파운데이션",
      "파데",
      "컨실러",
      "프라이머",
      "베이스",
      "팩트",
      "파우더",
      "메이크업픽서",
      "BB크림",
      "CC크림"
    ],
    "searchTerms": [
      "쿠션팩트",
      "파운데이션",
      "컨실러",
      "메이크업프라이머"
    ]
  },
  {
    "id": "eye",
    "matchPriority": 60,
    "label": "아이메이크업",
    "emoji": "👁️",
    "keywords": [
      "아이섀도",
      "아이쉐도우",
      "섀도우",
      "쉐도우",
      "아이팔레트",
      "섀도우팔레트",
      "팔레트",
      "마스카라",
      "아이라이너",
      "아이브로우",
      "눈썹",
      "속눈썹"
    ],
    "searchTerms": [
      "아이섀도우팔레트",
      "마스카라",
      "아이라이너",
      "아이브로우"
    ]
  },
  {
    "id": "lip",
    "matchPriority": 55,
    "label": "립메이크업",
    "emoji": "💄",
    "keywords": [
      "립스틱",
      "립틴트",
      "틴트",
      "립글로스",
      "립밤",
      "립라이너",
      "립케어",
      "립팔레트",
      "립"
    ],
    "searchTerms": [
      "립틴트",
      "립스틱",
      "립밤",
      "립글로스"
    ]
  },
  {
    "id": "nail",
    "matchPriority": 70,
    "label": "네일",
    "emoji": "💅",
    "keywords": [
      "네일",
      "매니큐어",
      "젤네일",
      "네일스티커",
      "탑코트",
      "베이스코트"
    ],
    "searchTerms": [
      "네일스티커",
      "젤네일"
    ]
  },
  {
    "id": "perfume",
    "matchPriority": 40,
    "label": "향수",
    "emoji": "🌸",
    "keywords": [
      "향수",
      "퍼퓸",
      "오드퍼퓸",
      "오드뚜왈렛",
      "EDP",
      "EDT",
      "코롱",
      "바디미스트",
      "헤어퍼퓸"
    ],
    "searchTerms": [
      "여성향수",
      "바디미스트"
    ]
  }
]
```

### config/coupang-patterns.js — 쿠팡 화면 문구·셀렉터(원격 설정)


**COUPANG_PATTERNS**

```json
{
  "version": 2,
  "updatedAt": "2026-09-06",
  "text": {
    "openAddr": {
      "source": "배송지변경|배송지선택|배송지수정",
      "maxLen": 12
    },
    "addAddr": {
      "source": "배송지추가|신규배송지|새배송지|주소추가",
      "maxLen": 12
    },
    "zipSearch": {
      "source": "우편번호찾기|우편번호검색|주소찾기|주소검색",
      "maxLen": 16
    },
    "pick": {
      "source": "^선택(하기)?$",
      "maxLen": 8
    },
    "payButton": {
      "source": "결제하기$",
      "maxLen": 20
    },
    "zipSubmit": {
      "source": "검색",
      "maxLen": 10
    },
    "save": {
      "source": "^저장(하기)?$",
      "maxLen": 8
    },
    "noteOpen": {
      "source": "배송요청사항|요청사항변경",
      "maxLen": 12
    },
    "noteChange": {
      "source": "^변경(하기)?$",
      "maxLen": 6
    },
    "noteDoor": {
      "source": "^문앞$",
      "maxLen": 6
    },
    "noteNoCode": {
      "source": "비밀번호없이출입가능해요|비밀번호없이출입|출입번호없음|비밀번호없음",
      "maxLen": 20
    },
    "noteSave": {
      "source": "동의하고저장하기|동의하고저장|^저장하기$",
      "maxLen": 14
    }
  },
  "fields": {
    "name": "input[name*=\"name\" i], input[placeholder*=\"받는\"], input[placeholder*=\"이름\"]",
    "phone": "input[type=\"tel\"], input[name*=\"phone\" i], input[placeholder*=\"휴대폰\"], input[placeholder*=\"전화\"]",
    "detail": "input[name*=\"detail\" i], input[name*=\"addr2\" i], input[placeholder*=\"상세\"]"
  },
  "health": {
    "checkoutMarks": {
      "source": "결제하기|최종결제금액|주문결제",
      "maxLen": 0
    },
    "checkoutRequire": [
      "openAddr",
      "payButton"
    ],
    "addrFormRequire": [
      "zipSearch"
    ]
  }
}
```

### config/costs.server.js — ⚠️ 운영자 전용 원가


**COSTS**

```json
{
  "shippingPerKgUsd": 7,
  "consolidationHandlingUsd": 0,
  "surcharge": {
    "fragile": 0,
    "bulky": 0
  },
  "zoneUsd": {
    "hanoi": 0,
    "vinhphuc": 5,
    "bacninh": 7,
    "bacgiang": 7,
    "hungyen": 7,
    "haiduong": 17,
    "haiphong": 17
  },
  "paymentRate": 0.029
}
```

**COST_MARKUP**

```json
1.2
```

### lib/order/states.js — 주문 상태


**ORDER_STATES**

```json
{
  "REQUESTED": {
    "label": "주문 접수",
    "track": "customer",
    "description": "주문이 접수되었습니다. 청구서를 발행합니다."
  },
  "AWAITING_PAYMENT": {
    "label": "입금 대기",
    "track": "customer",
    "description": "안내된 계좌로 입금해 주세요. 입금 확인 후 매입을 시작합니다."
  },
  "PAID": {
    "label": "결제 완료",
    "track": "customer",
    "description": "입금이 확인되었습니다. 곧 한국에서 상품을 구매합니다."
  },
  "PURCHASING": {
    "label": "한국 구매 중",
    "track": "procurement",
    "description": "고객님을 대신해 쿠팡에서 상품을 구매하고 있습니다."
  },
  "PURCHASED": {
    "label": "구매 완료",
    "track": "procurement",
    "description": "구매가 완료되어 한국 물류창고로 배송 중입니다."
  },
  "IN_WAREHOUSE": {
    "label": "창고 입고·실측",
    "track": "procurement",
    "description": "한국 창고에 입고되어 실제 무게를 측정했습니다."
  },
  "SETTLEMENT_DUE": {
    "label": "차액 정산 대기",
    "track": "customer",
    "description": "실측 무게에 따른 차액을 정산합니다."
  },
  "SETTLED": {
    "label": "정산 완료",
    "track": "customer",
    "description": "최종 금액이 확정되었습니다."
  },
  "SHIPPED": {
    "label": "국제배송 중",
    "track": "procurement",
    "description": "하노이로 발송되었습니다."
  },
  "DELIVERED": {
    "label": "배송 완료",
    "track": "procurement",
    "description": "배송이 완료되었습니다."
  },
  "CANCELLED": {
    "label": "취소",
    "track": "customer",
    "description": "주문이 취소되었습니다."
  }
}
```

## 2부. 설정 파일 원문 (주석 포함)


### config/tracks.js

```js
/**
 * 두 가지 이용 방법 — 고객에게 보이는 "말"
 *
 * '배송대행'·'구매대행'은 업계 용어입니다. 처음 오신 분은 둘 다 무슨 말인지 모릅니다.
 * 운영자 지시(26-09-04): "구매대행이라는 말도 어렵다면 **구매하고 배송까지**,
 * 배송대행은 **배송만**. 고객이 최대한 쉽게 쉽게 쉽게."
 *
 * 그래서 화면에는 쉬운 말을 크게 쓰고, 정식 용어(formal)는 견적서·약관처럼
 * 정확해야 하는 곳에만 작게 병기합니다.
 *
 * ⚠️ 코드 안의 id('forwarding'/'agent')는 절대 바꾸지 않습니다.
 *    저장된 주문 수백 건이 이 값을 물고 있어서, 말이 바뀔 때마다 데이터가
 *    깨지면 안 됩니다. **바뀌는 것은 이 파일의 문구뿐입니다.**
 */

export const TRACKS = {
  /** 고객이 쿠팡에서 직접 결제 → 한국 창고 → 하노이 */
  forwarding: {
    id: 'forwarding',
    emoji: '📦',
    /** 버튼·제목에 쓰는 짧은 말 */
    name: '배송만',
    /** 이름 옆/아래 한 줄 — 이것만 읽어도 뭘 하는지 알아야 합니다 */
    line: '쇼핑몰 결제는 직접 · 배송만 맡기기',
    /** 누구에게 맞는가 — 고객이 자기를 고르게 해주는 문장 */
    who: '한국 카드·계좌로 쇼핑몰 결제가 되는 분',
    /** 고객이 할 일 (1·2·3) */
    steps: ['쇼핑몰에서 직접 결제', '배송지는 한국 창고 (자동 입력)', '배송비만 결제'],
    /** 정식 용어 — 견적서·약관·공지 등 정확해야 하는 문서에만 */
    formal: '배송대행',
  },

  /** 우리가 대신 결제 → 한국 창고 → 하노이 */
  agent: {
    id: 'agent',
    emoji: '🛒',
    name: '구매하고 배송까지',
    line: '저희가 대신 사드려요',
    who: '한국 결제수단이 없는 분',
    steps: ['상품과 수량만 알려주기', '상품값 + 배송비 한 번에 결제', '나머지는 저희가'],
    formal: '구매대행',
  },
}

/** 모르는 값이 와도 화면이 깨지지 않게 — 기본은 '배송만' */
const of = (id) => TRACKS[id] ?? TRACKS.forwarding

/** 화면에 크게 쓰는 쉬운 이름 */
export const trackName = (id) => of(id).name
/** 이름 아래 한 줄 설명 */
export const trackLine = (id) => of(id).line
/** 정식 용어 (문서용) */
export const trackFormal = (id) => of(id).formal
/**
 * 문서용 표기 — 쉬운 말을 앞에, 정식 용어를 괄호로.
 * 견적서는 거래 문서라 정식 용어가 빠지면 곤란해질 수 있습니다.
 */
export const trackDocLabel = (id) => `${of(id).name} (${of(id).formal})`
/** 이모지 + 이름 — 버튼용 */
export const trackButton = (id) => `${of(id).emoji} ${of(id).name}`

```

### config/shipping.js

```js
/**
 * 국제배송(한국 → 베트남 하노이) 요율 정책
 *
 * 배송비 = 1kg당 요율(USD) × 청구무게
 * 청구무게 = max(실무게, 부피무게) 를 0.5kg 단위로 올림
 *
 * 요율은 USD 기준이고 고객 청구는 VND, 내부 원장은 KRW 이므로
 * 환산은 config/fx.js 의 고정 환율을 씁니다.
 */

export const SHIPPING = {
  origin: '대한민국 (인천)',
  destination: '베트남 하노이',

  /**
   * 고객 청구 요율 — 1kg당 USD, 구간 없는 정액. 두 트랙 공통입니다.
   * 운영자 확정 26-09-04: $9 → **$8** (원가 $7 이므로 마진 $2 → $1).
   * 같은 날 구매대행 수수료도 5,000 → 3,000원 으로 내렸습니다.
   */
  ratePerKgUsd: 8,

  // 원가는 config/costs.server.js 에 있습니다.
  // 이 파일은 확장프로그램 번들에 포함되므로 원가를 두면 그대로 노출됩니다.

  /**
   * 최소 청구무게 — 이보다 가벼워도 이 무게로 청구합니다.
   * 1kg 이하는 모두 1kg 으로 청구합니다.
   */
  minBillableKg: 1,

  /**
   * 청구무게 올림 규칙 — 구간마다 올림 단위가 다릅니다.
   *
   *   ~2kg  : 1kg 단위   (1kg, 2kg)
   *   2kg~  : 0.5kg 단위 (2.5kg, 3kg, 3.5kg …)
   *
   * 경량 주문은 1kg 단위로 최소 매출을 지키고,
   * 2kg 이상에서는 0.5kg 단위로 잘게 쪼개 과다 청구를 줄입니다.
   * (1kg 단위만 쓰면 2.1kg 주문에 3kg 을 청구하게 되어 경쟁사 대비 불리합니다)
   */
  /**
   * 청구무게 규칙 — 운영자 확정(26.08.29, 업체 S1 과 동일 기준):
   * 정수 kg 청구. 소수 부분이 0.5 이하면 버림, 0.5 초과면 올림.
   * 예) 0.4→1kg(최소) · 1.3→1kg · 1.5→1kg · 1.6→2kg · 2.5→2kg · 2.6→3kg
   * 원가(업체 청구)와 같은 단위라 청구 kg 마다 마진 $1 이 보장됩니다.
   * 로직은 lib/pricing/shipping.js · toBillableKg 에 있습니다.
   */

  /** 항공 부피무게 환산 계수: (가로×세로×높이 cm) / 6000 = kg */
  volumetricDivisor: 6000,

  /** 박스 1개당 최대 무게 — 초과 시 분할 배송 */
  maxParcelKg: 30,

  /** 포장 박스 자체 무게 (배송 건당 1회 가산, g) */
  boxWeightG: 250,

  /** 상품 1개당 완충재 무게 (g) */
  packingPerItemG: 12,

  /**
   * 배송 지역 (USD 할증).
   *
   * 현재 물류사가 하노이만 연결되어 있어 **하노이 시내 단일 지역, 할증 $0** 으로
   * 운영합니다. 커버리지가 넓어지면 여기에 지역을 추가하기만 하면
   * 주문서·요금 페이지·확장 팝업에 자동으로 나타납니다.
   */
  zones: {
    /**
     * 운영자 확정 26-09-06: "배송 가능한 지역은 내가 과금표에 적은 지역만."
     * 과금표 = config/assumptions.js `zone-surcharges` (S1 견적 26.08.28).
     * 고객 할증(USD)은 원가 × 1.2 에서 소수점 아래를 버린 값 (운영자 규칙 26.08.29,
     * "뒤에 .4불은 모두 빼주세요" 26-09-06) — 원가 자체는
     * config/costs.server.js 에만 있고 이 파일은 확장 번들에 실리므로 적지 않습니다.
     * 여기 없는 도시(중부·남부 전부)는 배송하지 않습니다 — 화면 공지가 이 목록을 읽습니다.
     */
    hanoi: { label: '하노이 시내', surchargeUsd: 0 },
    vinhphuc: { label: '빈푹', surchargeUsd: 6 },
    bacninh: { label: '박닌', surchargeUsd: 8 },
    bacgiang: { label: '박장', surchargeUsd: 8 },
    hungyen: { label: '흥옌', surchargeUsd: 8 },
    haiduong: { label: '하이즈엉', surchargeUsd: 20 },
    haiphong: { label: '하이퐁', surchargeUsd: 20 },
  },
  defaultZone: 'hanoi',

  /**
   * 서비스 지역 안내 — 신청서 맨 위·요금 페이지·확장 패널에 **굵게** 나갑니다.
   * 운영자 확정 26-09-06: "배송지 목록에 나와 있는 도시 외에는 배송이 안 된다.
   * 북부 지역 외 중부·남부는 현재 안 된다." 도시 목록은 위 zones 에서 읽으므로
   * 지역을 추가하면 안내도 따라 바뀝니다. 여기 문장만 고치면 모든 화면이 바뀝니다.
   */
  serviceAreaNotice:
    '배송 가능 지역은 위 목록(하노이 시내·빈푹·박닌·박장·흥옌·하이즈엉·하이퐁)뿐입니다. 하노이 밖은 지역 할증이 붙습니다.',
  serviceArea: {
    regionLabel: '베트남 북부',
    notServed: '중부(다낭·후에 등)·남부(호치민 등)',
  },

  /** 한국창고 → 하노이 (영업일) — 운영자 확정 (26-08-30): 2~3영업일 */
  leadTimeDays: { min: 2, max: 3 },
}

/**
 * 상품 할증 — 품목 특성에 따른 취급 수수료 (USD)
 *
 * "배송 불가"까지는 아니지만 일반 포장으로는 보낼 수 없는 품목에 붙습니다.
 * 물류사 요율표를 받으면 계약 조건으로 이 값을 교체하세요.
 *
 * ⚠️ 키워드는 eligibility 와 같은 substring 오탐 문제를 겪으므로
 *    복합어 위주로 작성합니다. ('그릇' 대신 '국그릇'·'그릇세트')
 *    일반 화장품 유리용기(크림 단지 등)는 업계 표준 포장이라 할증하지 않습니다.
 */
export const ITEM_SURCHARGES = {
  /**
   * 전자기기 취급 — 운영자 확정 (26-08-30): 고객 $40/EA.
   * (S1 원가 $30/EA — config/costs.server.js) 스마트폰·태블릿·노트북·
   * PC·모니터 본체가 대상이고, 케이스·거치대 등 액세서리는 제외합니다.
   */
  device: {
    label: '전자·가전 기기 취급',
    usd: 40,
    description: 'IT기기(휴대폰·태블릿·노트북·PC·모니터)와 가전(청소기·드라이기 등) 기기당',
    perUnit: true,
    keywords: [
      // IT 기기 (S1 견적서 26.08.28 명시 품목)
      '스마트폰', '휴대폰', '핸드폰', '자급제', '아이폰', '갤럭시s', '갤럭시z',
      '갤럭시탭', '갤럭시북', '아이패드', '태블릿', '노트북', '랩탑', '맥북',
      '아이맥', '데스크탑', 'pc본체', '모니터',
      // 가전·전열 기기 — 견적 문의 대신 같은 규정으로 할증 (운영자 확정 26-08-30)
      '에어랩', '스타일러', '드라이기', '고데기', '헤어드라이어', '공기청정기', '가습기',
      '전기포트', '전동칫솔', '전기면도기', '전동면도기', '청소기', '스팀다리미', '다리미',
      '전기요', '전기장판', '에어프라이어', '커피머신', '블루투스스피커', '살균기', '소독기',
      '선풍기', '서큘레이터', '제습기', '안마기', '마사지기', '믹서기', '블렌더',
    ],
    exclude: [
      '케이스', '파우치', '거치대', '필름', '보호', '충전', '가방', '받침', '스트랩', '링', '수리', '액정',
      // 가전 소모품 — 기기 본체가 아니므로 할증 제외
      '필터', '먼지통', '브러시', '칫솔모', '면도날', '리필', '교체용', '전용백',
    ],
  },
  fragile: {
    label: '파손주의 취급',
    usd: 2,
    description: '도자기·유리 식기 등 완충 보강 포장이 필요한 품목 (개당)',
    perUnit: true,
    keywords: [
      '도자기', '세라믹', '사기그릇', '국그릇', '밥그릇', '그릇세트', '식기세트', '접시세트',
      '찻잔', '머그컵', '머그잔', '유리컵', '와인잔', '맥주잔', '소주잔', '위스키잔', '샴페인잔',
      '유리병', '꽃병', '화병', '거울', '탁상거울', '손거울', '액자', '크리스탈', '어항', '유리용기', '티팟',
    ],
  },
  bulky: {
    label: '대형 화물 취급',
    usd: 5,
    description: '한 품목의 청구무게가 10kg 이상인 경우 (건당)',
    perUnit: false,
    thresholdKg: 10,
  },
}

/**
 * 합배송(consolidation) 정책
 *
 * 쿠팡 주문이 한국 창고에 따로따로 도착하면, 묶어서 한 박스로 보냅니다.
 * 절감 효과는 세 곳에서 나옵니다.
 *   1) 박스 무게 250g 을 건당이 아니라 1회만 가산
 *   2) 최소 청구무게 0.5kg 를 1회만 적용
 *   3) 0.5kg 올림 손실이 건별이 아니라 1회만 발생  ← 보통 이게 가장 큼
 */
export const CONSOLIDATION = {
  enabled: true,
  /** 무료 보관 기간 (일). 초과 시 일할 보관료 */
  freeStorageDays: 30,
  storageFeePerDayUsd: 0.5,
  /** 한 번에 묶을 수 있는 최대 주문 수 */
  maxOrdersPerParcel: 20,
  /** 합배송 취급 수수료 (USD) — 고객 청구 */
  handlingFeeUsd: 2,
}

/**
 * 하노이→한국 반송 요율 — 교환·반품 실익 안내용.
 *
 * S1 EXPRESS 견적서 수정본 26.08.31 「하노이 > 인천 (Outbound)」 확정값:
 *   기본(2kg 이하) 하노이 $18 · 박닌/박장/빈푹 $23
 *               · 타이응우옌/하이즈엉 $28 · 하이퐁/하남/푸터/닌빈 $33
 *   (베트남 행정구역 개편 예정 참고 — 하이즈엉+하이퐁→하이퐁 직할시,
 *    하남+닌빈+남딘→닌빈성, 빈푹+호아빈+푸터→푸터성, 타이응우옌+박깐→타이응우옌성)
 *   2kg 초과분 +$9/kg · 특이건·대량은 사전 협의, 접수 필수
 *   비고: 개인통관부호 필수 · $150 이상 신고 시 관부가세 발생
 *   불가 품목(베→한): 액체 · 현금 · 신용카드 · 대량물품 · 배터리 제품
 * 고객 안내는 실비 그대로 전가합니다(마진 0) — "반품 비용은 전액 구매자 몫".
 * 저렴한 상품은 반송비가 상품가를 넘으므로 보내기 전에 미리 보여줍니다.
 */
export const RETURN_SHIPPING = {
  assumed: false,
  /**
   * 아래는 고객 안내가 — 운영자 확정 26-08-31: 원가의 모든 금액에 +$2
   * (하노이 기본 $18→$20, 초과 kg당 $9→$11). 반송에도 최소 마진을 남깁니다.
   */
  /** 하노이 픽업 기준: baseKg 까지 baseUsd (고객가) */
  baseUsd: 20,
  baseKg: 2,
  /** 이후 kg 당 (올림, 고객가) */
  perKgUsd: 11,
  /** 구매대행 반품·교환 처리 기본 수수료 (원) — 반송 접수·확인을 대행하는 실비 */
  agentHandlingKrw: 5_000,
  /** 반송 자체가 불가한 품목 — 교환·반품이 성립하지 않습니다 */
  blockedNote: '액체(스킨·세럼·원액 등)·배터리 내장 제품·현금·신용카드·대량 화물은 하노이→한국 반송 불가',
  /** 통관·접수 조건 */
  customsNote: '반송은 사전 접수 필수 · $150 이상 신고 시 한국 관부가세 발생 가능',
  /** 반송 리드타임 (운영자 확인 26-08-31): 당일 픽업 시 한국 도착 1~2일 + 한국 내 배송 1~2일 */
  leadTime: { pickupToKoreaDays: { min: 1, max: 2 }, koreaDomesticDays: { min: 1, max: 2 } },
}

/** 반송비 추정 (USD) — 교환은 여기에 재배송비(정방향 국제배송비)가 더해집니다. */
export function estimateReturnShippingUsd(billableKg = 1) {
  const kg = Number(billableKg) > 0 ? Number(billableKg) : 1
  const extra = Math.max(0, Math.ceil(kg - RETURN_SHIPPING.baseKg))
  return RETURN_SHIPPING.baseUsd + extra * RETURN_SHIPPING.perKgUsd
}

```

### config/fees.js

```js
/**
 * 구매대행 수수료 정책
 *
 * 사업 모델: 고객 주문 → 당사가 쿠팡에서 대신 구매 → 하노이로 배송.
 * 상품 소유권은 고객에게 있고, 당사는 대행 수수료를 받습니다.
 */

export const FEES = {
  /**
   * 구매대행 수수료 — "기본료 + 넘는 만큼만".
   * 기본료는 운영자 확정 26-09-04 로 5,000 → **3,000원** 입니다.
   *
   *   수수료 = 기본 3,000원 (상품가 합계 10만원·5종류까지)
   *          + 상품가 10만원 초과분 × 5%   ← 취소·반품 위험은 가격에 비례
   *          + 5종류 초과 시 종류당 1,000원 ← 발주·검수 노동은 종류 수에 비례
   *
   * 무게에는 걸지 않습니다 — 무게 수익은 배송비(kg당 $1 마진)가 담당.
   * 예: 45,000원 1종 → 3,000 · 250,000원 2종 → 10,500 · 80,000원 8종 → 6,000
   *
   * ⚠️ 배송만(배송대행)에는 수수료가 없습니다 — 배송비만 받습니다.
   */
  agencyBaseKrw: 3000,
  agencyBaseMaxGoodsKrw: 100_000,
  agencyExcessRate: 0.05,
  agencyBaseMaxItems: 5,
  agencyPerExtraItemKrw: 1000,

  /**
   * 구매대행 1회 접수 한도 — 상품가 합계 (원). 0 이면 무제한.
   * 발주 후 취소·반품 불가 손실과 개인통관(무증빙) 고액 화물의 통관 보류
   * 위험을 묶는 상한입니다. 넘으면 신청을 받지 않고 나눠서 신청하도록
   * 안내합니다. (개당 100만원 이상은 별도의 수동견적 게이트가 이미 있음)
   */
  agentMaxGoodsKrw: 1_000_000,

  /**
   * 결제대행(PG) 수수료율 — 최종 결제금액 기준.
   * 운영자 확정 (26-08-29): 수금이 계좌이체(원화·동화)뿐이라 0.
   * 카드·PG 등 다른 결제수단을 붙이면 그 수단의 요율로 되살리세요.
   */
  paymentRate: 0,

  /**
   * 국내 배송비 (쿠팡 판매자 → 한국 창고) — 규정은 lib/pricing/domestic.js
   *
   * 구매대행은 저희가 쿠팡에 결제하므로 마켓플레이스 상품의 국내 배송비도
   * 저희 돈입니다. 배송만은 고객이 직접 내므로 걷지 않습니다.
   * (운영자 확정 26-09-06 — "규정 넣어주세요")
   */
  domesticShip: {
    /** 구매대행에서만 청구 */
    agentOnly: true,
    /**
     * 화면에서 못 읽었을 때 쓸 값. **0 = 청구하지 않음.**
     * 짐작으로 걷으면 무료배송 상품에도 붙어 고객이 모르는 돈을 냅니다.
     */
    fallbackKrw: 0,
    /** 잘못 읽은 큰 값 방어 — 국내 택배가 이보다 비쌀 일은 없습니다 */
    maxKrw: 50_000,
  },

  // 금액별 면제·상한은 두지 않습니다 (2026-08 폐지).
  // 50만원 면제는 경계에서 총액 역전을 만들었고, 고액 주문은 어차피
  // MANUAL_QUOTE_RULES(100만원 이상)로 수동 견적에 빠지므로 필요 없습니다.
}

/**
 * 주문 접수 하한 — 장바구니 상품가 합계(KRW) 기준, 두 트랙 공통.
 *
 * 소액 주문도 검수·재포장·통관 서류 수고는 그대로 들어 역마진이 나기 쉽습니다.
 * 최소 청구무게(1kg = $8)만으로는 그 수고를 못 덮는 구간을 막는 값입니다.
 * 0 이면 비활성화. ⚠️ 기본값은 제안값입니다 — config/assumptions.js · min-order
 */
export const ORDER_MIN = {
  /**
   * 최소 주문 금액 (상품가 합계, 원) — 운영자 확정 (26-08-29): 폐지 (0 = 제한 없음).
   * 되살리려면 금액만 넣으세요. 패널 안내·주문 API 거절이 함께 살아납니다.
   */
  goodsKrw: 0,
}

/**
 * 견적 정확도 안내 문구 (UI 표시 전용)
 *
 * 무게는 상품명 기반 "추정치"이므로 결제 시점 금액은 확정이 아닙니다.
 * 실제 정산 규칙은 config/payment.js 의 SETTLEMENT_RULES 를 보세요.
 */
export const SETTLEMENT = {
  /** 실측 정산 규칙은 config/payment.js 의 SETTLEMENT_RULES 에 있습니다. */
  notice:
    '표시 금액은 상품명 기반 추정 무게로 계산한 예상 견적입니다. 한국 창고 입고 후 실측하여 차액이 발생하면 추가 청구 또는 환불로 정산합니다.',
}

```

### config/taxes.js

```js
/**
 * 베트남 수입 세금 정책
 *
 * ⚠️ 소액 면세 폐지
 * Decision 01/2025/QD-TTg 로 Decision 78/2010 이 전면 폐지되어
 * 2025-02-18 부터 금액과 무관하게 모든 수입 건에 관세·VAT 가 부과됩니다.
 *
 * ⚠️ 아래 세율은 **설정 가능한 추정값**입니다.
 *    실제 세율은 HS 코드·원산지증명(VKFTA/AKFTA) 적용 여부·세관 판단에 따라 달라집니다.
 *    운영 전 반드시 관세사 검토를 거쳐 확정하고, 실납부액으로 정산하세요.
 */

export const TAXES = {
  /**
   * 수입세(관세·VAT) 징수 여부 — 운영자 확정 (26-08-29).
   *
   * 개인통관·영수증 무증빙 채널로 나가고(S1 $7/kg 올인에 통관 포함),
   * 관세·VAT 를 별도로 걷지 않습니다. 고객 견적에서 두 줄이 사라집니다.
   * 정책이 바뀌면 true 로 되돌리세요 — 아래 세율표는 참고용으로 보존합니다.
   */
  collect: false,

  /** 저가 화물 면세 한도 (VND). 2025-02-18 폐지되어 0. */
  deMinimisVnd: 0,

  /** 품목군을 판별하지 못했을 때의 기본 관세율 */
  defaultDutyRate: 0.10,

  /** 부가가치세 — 과세표준은 CIF + 관세 */
  vatRate: 0.10,

  /** 보험료율 (CIF 산정용) */
  insuranceRate: 0,

  /**
   * 국제운임을 품목별 과세표준에 배분하는 기준.
   * 세관은 통상 가액 비례로 배분하므로 'value' 를 씁니다.
   * ('weight' 로 바꾸면 무게 비례 배분 — 우리 무게 엔진이 있어 가능하지만 세관 관행과 다릅니다)
   */
  freightApportion: 'value',

  /** 개인 직구 통관 가이드 */
  personalUse: {
    maxSameItemQty: 5,
    warnTotalVnd: 5_000_000,
    message:
      '개인 사용 목적을 벗어난 수량은 상업적 반입으로 간주되어 통관이 보류될 수 있습니다. 동일 상품은 5개 이하를 권장합니다.',
  },
}

/**
 * 품목군별 관세율 — "세금이 더 붙는 품목"을 여기서 잡아냅니다.
 *
 * 배열 순서대로 매칭하므로 구체적인 품목군을 앞에 둡니다.
 * 키워드는 config/eligibility.js 와 같은 substring 오탐 문제를 겪으므로
 * 충분히 구체적으로 작성하고, 판별 실패 시에는 기본 세율을 씁니다.
 */
export const DUTY_CATEGORIES = [
  {
    id: 'footwear', label: '신발', dutyRate: 0.30,
    keywords: ['운동화', '스니커즈', '구두', '샌들', '슬리퍼', '부츠', '로퍼', '워커', '축구화', '등산화', '실내화'],
  },
  {
    id: 'bag', label: '가방·패션잡화', dutyRate: 0.25,
    keywords: ['핸드백', '백팩', '크로스백', '숄더백', '토트백', '지갑', '캐리어', '여행가방', '벨트', '선글라스', '손목시계'],
  },
  {
    id: 'apparel', label: '의류', dutyRate: 0.20,
    keywords: ['티셔츠', '맨투맨', '후드티', '니트', '가디건', '자켓', '코트', '패딩', '청바지', '슬랙스', '원피스', '블라우스', '스커트', '레깅스', '속옷', '브라', '팬티', '양말', '잠옷', '수영복'],
  },
  {
    id: 'cosmetics', label: '화장품', dutyRate: 0.20,
    keywords: ['스킨케어', '토너', '에센스', '세럼', '앰플', '수분크림', '아이크림', '선크림', '선스틱', '쿠션', '파운데이션', '컨실러', '립스틱', '립틴트', '마스카라', '아이섀도', '마스크팩', '클렌징', '메이크업'],
  },
  {
    id: 'food', label: '가공식품', dutyRate: 0.20,
    keywords: ['라면', '과자', '스낵', '초콜릿', '사탕', '젤리', '음료', '커피', '차', '김', '조미료', '고추장', '된장', '간장', '소스', '즉석밥', '컵밥', '시리얼'],
  },
  {
    id: 'supplement', label: '건강기능식품', dutyRate: 0.15,
    keywords: ['비타민', '오메가3', '유산균', '프로바이오틱스', '콜라겐', '루테인', '밀크씨슬', '홍삼', '단백질보충제', '영양제'],
  },
  {
    id: 'kitchen', label: '주방·생활용품', dutyRate: 0.15,
    keywords: ['프라이팬', '냄비', '식기', '컵', '텀블러', '보온병', '수저', '도마', '밀폐용기', '주방세제', '세탁세제', '섬유유연제', '휴지', '물티슈'],
  },
  {
    id: 'baby', label: '유아용품', dutyRate: 0.10,
    keywords: ['기저귀', '분유통', '젖병', '유모차', '카시트', '아기물티슈', '이유식', '아기로션', '유아세제'],
  },
  {
    id: 'device', label: '휴대폰·컴퓨터', dutyRate: 0.10,
    // 본체급 고가 전자기기 — 액세서리보다 먼저 매칭되어야 합니다.
    keywords: [
      '스마트폰', '휴대폰', '핸드폰', '자급제', '갤럭시', '아이폰', '갤럭시s', '갤럭시z', '픽셀',
      '노트북', '랩탑', '그램', '맥북', '아이맥', '데스크탑', '태블릿', '아이패드', '갤럭시탭',
      '스마트워치', '갤럭시워치', '애플워치', '모니터', '그래픽카드', '메인보드',
    ],
  },
  {
    id: 'electronics', label: '전자 액세서리', dutyRate: 0.10,
    keywords: ['이어폰', '헤드폰', '에어팟', '버즈', '스피커', '마우스', '키보드', '충전기', '케이블', '거치대', '공기청정기', '가습기', '전기포트', '드라이기', '고데기'],
  },
  {
    id: 'book', label: '도서·문구', dutyRate: 0.05,
    // '노트' 는 '노트북' 에 걸려 노트북이 도서(5%)로 분류되던 오탐의 원인이었습니다.
    keywords: ['도서', '문제집', '참고서', '소설', '만화책', '노트북받침', '볼펜', '연필', '스티커', '다이어리', '스프링노트', '연습장'],
  },
]

export const TAX_LABELS = {
  cif: 'CIF (상품가 + 국제운임)',
  duty: '수입관세',
  vat: '부가가치세 (VAT)',
}

```

### config/eligibility.js

```js
/**
 * 배송 가능 여부 정책 (한국 → 베트남 항공특송)
 *
 * 설계 원칙: 세금이 특별히 붙거나 통관에 문제가 되는 품목은
 * 복잡한 예외 계산 없이 **아예 배송 불가**로 처리합니다.
 * 고객이 결제한 뒤 창고에서 반송되는 것이 가장 큰 손실이기 때문입니다.
 *
 * ⚠️ 한국어에는 단어 경계가 없어 짧은 키워드가 무관한 단어에 우연히 포함됩니다.
 *    예) '럼'(주류) ⊂ 세럼 / '무기' ⊂ 무기자차 / '회'(생선회) ⊂ 회복·기회
 *        '릴' ⊂ 릴리즈 / '글로' ⊂ 글로우 / '라이터' ⊂ 하이라이터
 *    그래서 두 겹으로 막습니다.
 *      1) 키워드를 substring 오탐이 나지 않을 만큼 구체적으로 작성
 *      2) SAFE_TERMS 를 먼저 제거한 뒤 매칭 (불가피한 충돌 대응)
 *    키워드를 추가할 때는 반드시 test/eligibility.test.js 의 정상 상품 코퍼스를 통과시키세요.
 */

export const DESTINATION = { country: 'VN', label: '베트남', city: '하노이' }

/**
 * 오탐 방지 — 차단 키워드를 부분 문자열로 포함하지만 실제로는 정상인 표현.
 * 매칭 전에 이 표현들을 먼저 제거합니다.
 */
export const SAFE_TERMS = [
  // 화장품
  '세럼', '앰플', '하이라이터', '글로우', '릴리즈', '무기자차', '무기질', '시어버터',
  // 주방·생활
  '소주잔', '맥주잔', '맥주효모', '와인잔', '와인오프너', '와인색', '와인랙', '위스키잔',
  '우유거품기', '우유병', '계란찜기', '계란말이', '달걀거품기', '생선구이', '재떨이',
  '피넛버터', '땅콩버터', '버터플라이', '치즈맛', '치즈향',
  // 가전·가구 부속 (본체가 아닌 액세서리)
  '냉장고정리', '냉장고커버', '냉장고탈취', '냉장고청소', '세탁기청소', '세탁기커버',
  '건조기시트', '침대커버', '침대시트', '침대패드', '소파커버', '매트리스커버',
  '가구시트', '가구필름', '자전거헬멧', '자전거장갑', '자전거자물쇠', '자전거라이트',
  '오토바이헬멧', '오토바이장갑', '오토바이커버',
  // 일반 표현
  '회사', '회복', '기회', '회전', '회의', '사회', '생물학', '미생물', '생화학',
  '햄버거', '햄스터', '햄프', '햄토리', '스팸메일', '스팸차단', '스팸필터', '현금영수증', '중고등', '중고생',
  '방탄소년단', '대마도', '청주시', '흙침대', '시너지', '총알배송',
]

/**
 * 문맥 마커 — 상품이 어느 영역에 속하는지 알려주는 신호.
 *
 * 한국 화장품에는 유제품 이름이 흔합니다.
 *   설화수 자음생**크림** / 미샤 재생**크림** / 스킨푸드 **요거트** 마스크팩 /
 *   토니모리 **계란** 클렌징폼 / 더페이스샵 **우유**크림 세안제
 * 이들을 축산물 검역으로 차단하면 정상 상품 대부분이 막힙니다.
 * (실제로 화장품 16건 중 10건이 오차단됐습니다)
 *
 * 키워드를 하나씩 세이프리스트에 넣는 방식은 끝이 없으므로,
 * "화장품 문맥이면 축산물·식물 검역 규칙을 적용하지 않는다"로 처리합니다.
 * 브레드크럼(categoryPath)이 있으면 그게 가장 강한 신호입니다.
 */
export const CONTEXT_MARKERS = {
  /**
   * 상온 식품 문맥 — 운영자 확정 26-09-06: "상온에서 판매되는 상품 중 먹는 상품은 모두 가능합니다."
   * 이 문맥이면 축산물 검역 규칙을 적용하지 않습니다. 냉장·냉동은 별도 규칙이 그대로 막습니다
   * (그 규칙은 이 문맥을 보지 않습니다). 보관 조건·쇼핑몰 카테고리·가공 형태로 알아봅니다.
   */
  shelfStable: [
    '상온', '실온', '상온보관', '실온보관', '멸균', '레토르트', '통조림', '캔', '병조림', '진공포장',
    '쌀/잡곡', '과자/간식', '과자', '간식', '라면/즉석식품', '라면', '즉석식품', '즉석밥', '컵밥', '컵라면',
    '장/소스/드레싱', '소스', '드레싱', '양념', '조미료', '커피/음료', '커피', '차/음료', '음료',
    '건강식품', '건강기능식품', '영양제', '분유/이유식', '이유식', '시리얼', '그래놀라', '견과', '건과일',
    '건어물', '김/해조류', '면류', '국수', '파스타', '누룽지', '떡/한과', '한과', '초콜릿', '사탕', '젤리',
    '쿠키', '비스킷', '빵', '건조', '말린', '분말', '가루', '스틱', '파우치', '즉석', '인스턴트', '프로틴', '단백질보충제',
  ],
  cosmetic: [
    // 카테고리 경로 (확장이 브레드크럼에서 읽어옵니다 — 가장 신뢰도 높음)
    '뷰티', '화장품', '스킨케어', '메이크업', '색조', '기초화장',
    // 제형·용도 (단독 '크림'은 크림치즈 등과 충돌하므로 제외)
    '세럼', '앰플', '에센스', '토너', '스킨로션', '미스트', '마스크팩', '시트마스크', '마스크시트', '마스크',
    '쿠션', '파운데이션', '컨실러', '립밤', '립스틱', '틴트', '아이섀도', '마스카라',
    '클렌징', '세안', '필링', '선크림', '자외선차단',
    '재생크림', '수분크림', '영양크림', '아이크림', '핸드크림', '나이트크림', '데이크림',
    '자음생크림', '진생크림', '탄력크림', '보습크림', '페이스크림',
  ],
}

/**
 * 배송 불가 — 운영자 최종 확정 26-09-12:
 *   "담배·술·흉기·냉동식품·정육·생선·계란 같은 건 안 되지만, 상온으로 국내에서 배송 중인 건 모두 된다.
 *    특히 향수 같은 건 베트남에서 해외직구가 모두 가능하다."
 * (26-09-06 목록에 있던 「인화성(향수·매니큐어·스프레이)」과 「배터리·강자성」 차단은 이 날 풀었습니다.
 *  향수·매니큐어·스프레이·손소독제는 이제 아무 안내 없이 됩니다. 배터리는 안내만(CAUTION_RULES).)
 * 남는 키워드 차단은 아래 다섯입니다 — 항공기가 싣지 않는 진짜 위험물(가스·폭죽·성냥)만은 상온이라도
 * 막습니다 (해외직구는 배지로 판별하므로 lib/eligibility.js 에). 명백한 불법 반입품(총기·마약·짝퉁·중고폰
 * — restricted-goods)은 목록에 없이 계속 막습니다. 의약품·씨앗은 막지 않고 안내만 붙입니다. 30kg 초과는
 * 차단이 아니라 상담(MANUAL_QUOTE_RULES) 입니다.
 */
export const BLOCK_RULES = [
  {
    id: 'dangerous',
    label: '항공 위험물',
    reason: '가스·폭죽·성냥은 항공기에 실을 수 없습니다. 향수·스프레이 같은 상온 생활용품은 문제 없음',
    keywords: [
      '가스라이터', '지포라이터', '토치라이터', '부탄가스', '휴대용가스', '가스토치', '캠핑가스', '이소부탄',
      '성냥', '폭죽', '불꽃놀이', '페인트시너',
    ],
  },
  {
    id: 'alcohol-tobacco',
    label: '주류·담배',
    reason: '베트남 특별소비세 대상이며 수입 허가가 필요해 개인 반입이 불가합니다.',
    /**
     * '와인'이 들어간다고 다 술이 아닙니다 — 운영자 확정 26-09-06:
     * 「식품 > 장/소스/드레싱/식초 > 식초/미림 > 와인식초」는 문제없음.
     * (사장님 화면: 카사베르디 유기농 레드와인 비니거 3개 500ml 가 주류로 막혔습니다)
     * 식초·조미술(미림·맛술)과 와인잔 같은 용품은 이 규칙을 건너뜁니다.
     * 카테고리 경로도 같이 보므로 「식초/미림」 안의 상품은 이름과 무관하게 통과합니다.
     */
    excludeIfAny: [
      '식초', '비니거', '비네거', '발사믹', '미림', '맛술', '요리술', '조미술',
      '와인잔', '와인글라스', '와인오프너', '와인셀러', '와인랙', '와인쿨러', '와인병따개',
    ],
    keywords: [
      '주류', '소주', '맥주', '와인', '위스키', '사케', '청주', '막걸리', '고량주', '보드카',
      '럼주', '바카디', '리큐르', '브랜디', '데킬라', '진토닉', '하이볼',
      '담배', '전자담배', '궐련', '니코틴', '전자담배액상', '니코틴액상', '연초잎',
      '시가담배', '쿠바시가', '아이코스', '전자연초',
    ],
  },
  /**
   * 냉장·냉동 식품 — 항공 화물은 냉기를 유지하지 못합니다.
   *
   * 운영자 확정 26-09-06: **"냉동제품만 제외, 상온으로 파는 식품은 배송 가능."**
   * 그래서 온도가 기준입니다 — 상하거나 검역에서 폐기되는 것은 냉장·냉동이지,
   * 식품이라는 사실 자체가 아닙니다.
   *
   * 'oversize' 규칙보다 **뒤에 두면 안 됩니다**? 아니요 — 앞에 두되 가전은
   * 제외어로 걸러냅니다. '냉장고'·'냉동고'가 '냉장'·'냉동'을 품고 있어서,
   * 제외하지 않으면 냉장고가 "냉장 식품"으로 잡힙니다.
   */
  {
    id: 'cold-chain',
    label: '냉장·냉동 식품',
    reason: '항공 배송 중에는 냉장·냉동을 유지할 수 없어 상할 수 있습니다. 상온으로 파는 식품은 문제 없음',
    exemptIfContext: ['cosmetic'],
    // 가전·주방용품이 '냉장/냉동'을 품고 있습니다 — 식품이 아닌 것들.
    excludeIfAny: [
      '냉장고', '냉동고', '냉동실', '냉장실', '보관용기', '밀폐용기', '지퍼백', '보관백',
      '정리함', '트레이', '칸막이', '수납', '아이스팩', '보냉', '온도계', '라벨',
    ],
    keywords: ['냉동', '냉장', '아이스크림', '급속냉각'],
  },
  {
    id: 'quarantine-animal',
    label: '축산물·검역 대상',
    /**
     * 상온 가공식품(캔햄·육포·레토르트탕·분유)은 운영자 확정 26-09-06 으로
     * **배송 가능**해졌습니다 — CAUTION_RULES 의 안내만 붙습니다.
     * 여기 남는 것은 냉장·냉동이 필요하거나 날것인 축·수산물입니다.
     */
    reason: '생고기·냉장 유제품·회는 상할 수 있습니다. 상온으로 파는 식품은 문제 없음',
    /**
     * 적용하지 않는 두 문맥
     *   cosmetic    한국 화장품에는 유제품 이름이 흔합니다 (자음생크림·요거트팩)
     *   shelfStable 상온 가공식품 — 카테고리 경로에 「돼지고기」가 들어가도
     *               통조림 햄은 상온이라 보낼 수 있습니다 (운영자 확정 26-09-06:
     *               "식품>…>돼지고기 양념/가공>햄통조림 — 가능. 상온이면 가능함")
     */
    exemptIfContext: ['cosmetic', 'shelfStable'],
    /**
     * 김은 해조류입니다 — **곱창김**·돌김·파래김의 '곱창'에 걸려 김 선물세트가
     * 통째로 막혔습니다 (26-09-06 사장님 화면: 대천김 곱창 캔김 4p).
     * 상온 유제품(멸균우유·분유·연유)도 아래 안내 대상일 뿐 차단 대상이 아닙니다.
     */
    excludeIfAny: [
      '곱창김', '김선물세트', '조미김', '재래김', '파래김', '돌김', '마른김', '전장김',
      '도시락김', '김자반', '캔김', '김밥김', '들기름김', '김스낵', '건어물',
      '멸균우유', '두유', '분유', '연유',
    ],
    keywords: [
      '육류', '소고기', '돼지고기', '닭고기', '오리고기', '양고기', '한우', '삼겹살', '목살', '항정살',
      '생고기', '소시지', '베이컨', '살라미', '순대', '족발', '곱창', '막창', '대창', '만두소',
      '델리미트', '슬라이스햄', '훈제햄', '불고기', '닭갈비',
      '우유', '생우유', '치즈', '버터', '생크림', '요거트',
      '계란', '달걀', '메추리알', '생선', '활어', '생선회', '모둠회', '연어회', '냉동수산',
    ],
  },
  {
    id: 'restricted-goods',
    listed: false, // 고객 목록(/rates·첫 화면)에서는 숨김 — 운영자 26-09-06 목록에 없음. 차단은 유지합니다.
    label: '통관 금지 품목',
    reason: '베트남 수입 금지 품목입니다.',
    keywords: [
      '권총', '소총', '엽총', '장난감총', '모의총기', 'bb탄', '도검', '무기류', '흉기',
      '전기충격기', '삼단봉', '너클', '음란', '성인용품', '도박', '마약', '대마초', '마리화나',
      '중고품', '리퍼브', '리퍼비시', '반품상품', '짝퉁', '이미테이션', '레플리카', '가품',
      // 베트남은 2015-12 부터 중고 휴대폰·노트북 수입을 금지합니다.
      '중고폰', '중고휴대폰', '중고노트북', 's급중고', 'a급중고', '개봉중고', '전시상품',
      '드론', '무전기', '군복', '군용', '방탄복', '방탄조끼',
      '현금다발', '상품권', '기프트카드', '유가증권',
    ],
  },
  {
    id: 'oversize',
    label: '대형 가전·가구',
    reason: '항공특송으로 보낼 수 없는 대형 품목이라 취급하지 않습니다.',
    /**
     * 소모품 오차단 방지 — "식기세척기 세제", "세탁기 청소용 태블릿" 처럼
     * 기기 이름이 들어간 소모품이 대형 가전으로 막히면 안 됩니다.
     * (실제 사고: 식기세척기 캡슐 세제가 접수 거절됐습니다)
     */
    excludeIfAny: [
      '세제', '세정제', '캡슐', '태블릿', '린스', '전용액', '클리너', '탈취',
      '필터', '먼지통', '노즐', '브러시', '거치대', '커버', '받침', '매트',
      '부품', '소모품', '리필', '교체',
    ],
    keywords: [
      '냉장고', '김치냉장고', '세탁기', '건조기', '식기세척기', '침대프레임', '소파', '매트리스',
      '옷장', '책상', '피아노', '러닝머신', '자전거', '킥보드', '전동휠', '전동킥보드',
    ],
  },
]

/**
 * 업체 견적 문의 대상.
 *
 * 배송은 가능하지만 **자동 견적을 내지 않는** 품목입니다.
 * 무게·파손 취급·보험 조건이 상품마다 달라 추정으로 청구하면 반드시 어긋나므로,
 * 물류사 견적을 받아 운영자가 직접 입력합니다.
 *
 * 차단(BLOCK_RULES)이 우선입니다 — 수입 금지 품목은 견적 문의로 넘어가지 않습니다.
 */
export const MANUAL_QUOTE_RULES = [
  /**
   * 30kg 초과 — 막지 않고 상담으로 (운영자 확정 26-09-06: "30kg 을 초과할 경우 상담 요청",
   * 배송 불가 목록에도 중량 초과는 없음). 물류사와 확인한 뒤 운영자가 요금을 넣습니다.
   */
  {
    id: 'overweight',
    listed: true,
    label: '중량 초과',
    reason: '단일 상품 30kg 을 초과할 경우 상담 요청해주세요.',
    notice: '접수 후 물류사와 확인해 요금을 안내드립니다.',
    /** 이 무게를 넘으면(초과) 상담 — 청구무게 기준 */
    maxItemKg: 30,
  },
  {
    id: 'oversize',
    label: '장척·특수 화물',
    reason: '골프채·캐리어처럼 길거나 큰 화물은 항공 특수 취급이라 물류사 견적이 필요합니다.',
    notice: '접수 후 정확한 배송 요금을 안내드립니다.',
    keywords: ['골프채', '골프클럽', '골프백', '스키', '스노보드', '낚싯대', '서핑보드', '전신거울', '캐리어', '여행가방'],
  },
  /**
   * 가전·전열 기기는 견적 문의에서 제외 (운영자 확정 26-08-30) —
   * IT 기기와 같은 규정으로 기기당 취급비를 할증해 자동 견적합니다.
   * (키워드는 config/shipping.js ITEM_SURCHARGES.device 로 이동)
   * 고액(100만원↑)은 아래 규칙이 계속 잡습니다. 중량 15~30kg 견적 문의는 운영자 확정
   * 26-09-06("찹쌀 20kg 문제없다")으로 폐지 — 30kg 초과만 차단, 그 아래는 자동 견적.
   */
  {
    id: 'high-value',
    label: '고액 상품',
    reason: '파손·분실 시 손해가 커 보험 가입 여부를 확인해야 합니다.',
    notice: '보험료가 별도로 안내됩니다.',
    /** 이 금액을 넘으면 품목과 무관하게 견적 문의 (원) */
    thresholdKrw: 1_000_000,
  },
]

/** 경고 (차단은 아님) */
/**
 * 안내만 하고 **막지는 않는** 품목 — 상온 축산가공식품.
 *
 * 운영자 확정 26-09-06: 항공으로 상온 식품은 보낼 수 있습니다. 다만 고기·유제품이
 * 든 상온 식품은 베트남 검역에서 확인을 요구할 수 있어, 막지 않되 미리 알립니다.
 * (모르고 결제한 뒤 창고에서 반송되는 것이 이 서비스에서 가장 큰 손실입니다)
 */
export const CAUTION_RULES = [
  {
    id: 'shelf-stable-animal',
    context: 'shelfStable',
    keywords: [
      '스팸', '리챔', '런천미트', '캔햄', '통조림햄', '햄통조림', '통조림', '햄세트',
      '육포', '비프저키', '육개장', '설렁탕', '삼계탕', '갈비탕', '장조림',
      '분유', '연유', '멸균우유',
    ],
    /**
     * 안내를 붙이지 않습니다 — 운영자 확정 26-09-06: "가공된 상온 제품, 먹는 식품도 모두 가능."
     * 이 규칙은 위 키워드로 상온 문맥을 잡는 용도로만 남습니다.
     */
    silent: true,
    message: '고기·유제품이 든 상온 식품입니다.',
  },
  /**
   * 보조배터리·리튬배터리 — 막지 않습니다 (운영자 확정 26-09-12: 상온으로 국내 배송되는 것은 모두 됨).
   * 다만 항공 규정상 물류사가 반려하는 일이 있어 한 줄만 알립니다. 다시 막으려면 BLOCK_RULES 로 옮기면 됩니다.
   */
  {
    id: 'battery-caution',
    keywords: ['보조배터리', '파워뱅크', '리튬배터리', '리튬이온배터리', '배터리팩', '네오디뮴', '강력자석'],
    message: '보조배터리·리튬배터리는 항공 규정에 따라 물류사가 반려할 수 있어 접수 후 확인해 드립니다.',
  },
  /**
   * 의약품·씨앗 — 막지 않습니다 (운영자 확정 26-09-06: 위 일곱 가지 빼고는 모두 됨).
   * 다만 통관에서 보류되는 일이 실제로 있어 한 줄만 알립니다.
   */
  {
    id: 'pharma-caution',
    keywords: [
      '의약품', '처방약', '전문의약품', '일반의약품', '항생제', '수면제', '진통제', '해열제', '소염제',
      '한약재', '스테로이드', '호르몬제', '피임약', '발기부전', '탈모약', '연고제',
    ],
    message: '의약품은 베트남 통관에서 보류될 수 있습니다. 본인 사용분 소량만 보내주세요.',
  },
  {
    id: 'plant-caution',
    keywords: ['씨앗', '종자', '묘목', '화분', '배양토', '구근', '생화', '모종', '분갈이흙'],
    message: '씨앗·묘목·흙은 베트남 식물 검역 대상이라 통관에서 보류될 수 있습니다.',
  },
]

export const WARN_RULES = {
  highValueKrw: 1_500_000,
  maxSameItemQty: 5,
  maxParcelKg: 30,
}

/** 고객 화면에 보여주는 차단 유형 — 숨긴 규칙(listed: false)은 차단만 하고 목록에는 없습니다 */
export const LISTED_BLOCK_RULES = BLOCK_RULES.filter((r) => r.listed !== false)
/** 고객 화면에 「상담」으로 보여주는 유형 — 막지 않고 물류사 확인 뒤 요금을 넣는 것 */
export const LISTED_CONSULT_RULES = MANUAL_QUOTE_RULES.filter((r) => r.listed)

```

### config/payment.js

```js
/**
 * 결제·정산 정책 (구매대행 · 선결제 후 정산)
 *
 * 결제는 두 개의 별개 거래입니다.
 *   [거래 A] 고객 → 당사 : VND, 랜딩코스트 전액 (선결제)
 *   [거래 B] 당사 → 쿠팡 : KRW, 상품가만 (고객 돈으로 대신 지불)
 *
 * 두 거래를 하나로 합치면 회계가 무너집니다.
 * 상품가·관세·VAT는 고객 돈을 대신 지불하는 "예수금"이지 당사 매출이 아닙니다.
 * 당사 매출은 대행수수료 + 배송마진 + 환스프레드, 즉 순액입니다.
 */

export const PAYMENT = {
  /** 결제 방식: 고객이 먼저 결제해야 매입을 진행합니다. */
  model: 'prepaid',

  /** 청구서 유효 시간 (시간). 지나면 주문이 만료되고 환율 고정도 풀립니다. */
  invoiceValidHours: 48,

  /**
   * 환율 고정.
   * VND로 받아 KRW로 지출하므로, 결제 시점 환율을 주문에 박아둡니다.
   * 이후 환율이 움직여도 그 주문은 고정 환율로 정산합니다.
   */
  lockFxAtOrder: true,

  /**
   * 고객 예수금 계좌 분리 권고.
   * 고객 돈과 운영 자금을 같은 계좌에서 섞으면 환불·분쟁 대응이 불가능합니다.
   */
  segregateCustomerFunds: true,
}

/**
 * 환불 처리 기간 (영업일) — 취소 환불·차액 환불 공통 안내.
 * 계좌이체 입금·카드결제 취소 모두 이 기간으로 고지합니다 (운영자 확정 26-08-30).
 */
export const REFUND_DAYS = { min: 3, max: 7 }

/**
 * 교환·반품·변심 취소 정책 (운영자 확정 26-08-30)
 *
 *   반송·반품 비용      하노이→한국 반송비, 쿠팡 반품배송비 — 전액 구매자 부담
 *   교환               재발송이므로 국제배송비(구매대행은 수수료 포함) 동일 재청구
 *   구매대행 환불       대행수수료만 제외하고 나머지 환불
 *   배송대행 환불       처리 수수료 $1 차감 — 배송비만 받는 트랙이라 환불 시
 *                      남는 마진이 없어, 이체·환전 실비 명목의 최소 취급비
 *   당사 사유 취소      품절·가격 인상·마감 등 — 약속대로 전액 환불 (차감 없음)
 */
export const RETURN_POLICY = {
  customerPaysReturnShipping: true,
  exchangeRebillsFull: true,
  /** 구매대행 변심 취소·반품 환불에서 제외(비환불)하는 항목: 대행수수료 */
  agentRetainsAgencyFee: true,
  /** 배송대행 환불 처리 수수료 (USD/건) */
  forwardingRefundFeeUsd: 1,
}

/**
 * 실측 정산 규칙.
 *
 * 결제 시점의 무게는 상품명 기반 추정치이므로 최종 금액이 아닙니다.
 * 한국 창고 입고 후 실측하여 차액을 정산합니다.
 */
export const SETTLEMENT_RULES = {
  /**
   * 무게 신뢰도별 허용오차 (원).
   * 이 금액 미만의 차액은 정산하지 않고 당사 손익으로 흡수합니다.
   *
   * 관세·VAT 미징수(26-08-29) 이후 무게에 따른 차액은 국제배송비뿐이라
   * 정확히 kg 단위(1kg × $8 ≈ 11,040원)로만 발생합니다. 그래서:
   *   같은 청구 kg  → 차액 0원, 정산 없음 (반내림 구간이 ±0.5kg 흡수)
   *   한 칸(1kg) 차이 → 11,040원 — 어떤 신뢰도에서도 한도를 넘어 항상 정산
   * 한 칸을 흡수하면 다른 주문 ~4.5kg 어치 마진($2/kg)이 날아가므로
   * 한도는 반드시 한 칸(≈11,040원)보다 낮아야 합니다.
   * (세금을 다시 걷게 되면 소액 차액이 생기니 그때 재조정하세요)
   */
  toleranceByConfidence: { high: 10_000, medium: 6_000, low: 3_000 },

  /** 이 금액 미만의 차액은 신뢰도와 무관하게 정산하지 않습니다 (송금 수수료가 더 큼). */
  toleranceKrw: 3000,

  /**
   * 추가 청구 상한 — 예상액 대비 이 비율을 넘는 추가 청구는
   * 자동 청구하지 않고 운영자 확인을 거칩니다. (추정 오류 가능성)
   */
  maxAutoAdditionalRate: 0.3,

  /** 환불 수수료 (송금 수수료 실비, 원) */
  refundFeeKrw: 0,

  labels: {
    additional: '추가 청구',
    refund: '환불',
    none: '정산 불필요',
  },
}

/**
 * 매출 인식 방식.
 *
 * agent(대리인) — 매출 = 수수료 등 순액. 구매대행의 일반적 처리.
 * principal(본인) — 매출 = 총액. 재고를 사입해 되파는 경우.
 *
 * ⚠️ 베트남 세무당국의 실제 적용은 현지 회계사 확인이 필요합니다.
 *    회계 원칙(대리인 vs 본인)은 국제 기준이지만 적용은 나라마다 다릅니다.
 */
export const REVENUE_RECOGNITION = {
  mode: 'agent',
  note:
    '구매대행은 대리인 거래이므로 상품가·관세·VAT는 예수금으로 처리하고, 대행수수료와 배송마진만 매출로 인식합니다.',
}

```

### config/quote.js

```js
/**
 * 견적서 설정 — 발행 주체(당사) 정보와 무게 차이 처리 규칙.
 *
 * 흐름 (운영자 확정 26-09-01):
 *   ① 접수 → **임시 견적서**를 고객에게 전달 (상품명 기반 추정 무게)
 *   ② 물류사 청구서(DEBIT NOTE) 도착 → 실측 무게를 입력
 *   ③ 그 무게로 **최종 견적서** 발행
 *        차액 ≥ 기준 금액 → 추가청구/환불 대상 (결정은 운영자)
 *        차액 < 기준 금액 → 임시 견적서 금액 그대로
 *
 *   기준 금액은 여기가 아니라 config/payment.js 의
 *   SETTLEMENT_RULES.toleranceByConfidence(3,000~10,000원) 한 곳에만 있습니다.
 *   (운영자 확정 26-09-04 — 견적서와 장부가 같은 기준을 쓰도록 통일)
 *
 * ⚠️ 물류사 청구서의 단가·금액은 우리 **원가**입니다.
 *    최종 견적서에는 실측 무게와 운송 정보만 옮기고 원가는 절대 넣지 않습니다.
 *    (config/costs.server.js 와 같은 취급 — 고객 화면 노출 금지)
 */

export const QUOTE = {
  /**
   * 발행 주체 — 고객에게 보이는 당사 정보 (env 로 교체 가능).
   * 고객 배송지는 견적서에 싣지 않습니다 — 견적서는 금액 문서이고
   * 배송지는 주문 화면·배송 안내로 전달합니다 (운영자 지시 26-09-01).
   */
  issuer: {
    /** 고객이 먼저 보는 브랜드명 */
    brand: process.env.COMPANY_BRAND || 'YS-ECOM 베트남 직구',
    /** 사업자 상호 — 견적서 머리글에 함께 표기 */
    /**
     * 사업자등록증상 상호는 '전세계무역'(개인사업자, 대표 김영서)입니다.
     * 견적서는 거래 문서라 등록 상호와 다르게 적으면 곤란해질 수 있어
     * 등록 상호를 먼저 쓰고 로마자 표기를 함께 답니다.
     * (영문 상호는 서류에 없어 로마자 표기 — 공식 영문명이 생기면 교체)
     */
    name: process.env.COMPANY_NAME || '전세계무역 (JEONSEGYE TRADING)',
    address: process.env.COMPANY_ADDRESS
      || '412, 4F, Bldg 1, 10 Cheongnahannae-ro 100beon-gil, Seo-gu, Incheon, Republic of Korea',
    pic: process.env.COMPANY_PIC || 'KIM YOUNG SEO',
  },

  /**
   * ⚠️ 조정 기준 금액(adjustThresholdVnd)은 여기 없습니다.
   *
   * 예전에는 견적서만 20,000동이라는 별도 기준을 들고 있어, 같은 주문을 두고
   * 문서는 "조정 대상"이라 적고 장부는 아무것도 하지 않는 일이 생길 수
   * 있었습니다. 이제 기준은 config/payment.js 한 곳에 있고, 견적서와 장부
   * 모두 lib/order/settlement.js 의 settlementToleranceKrw() 로 가져옵니다.
   * 주문마다 값이 달라(무게 추정 신뢰도별 3,000~10,000원) 견적서에는 그
   * 주문의 실제 기준 금액이 원화·동화로 찍힙니다.
   */

  /** 견적서 유효기간 (일) */
  validDays: 7,

  labels: {
    provisional: { ko: '임시 견적서', en: 'PROVISIONAL QUOTATION' },
    final: { ko: '최종 견적서', en: 'FINAL QUOTATION' },
  },
}

```

### config/sourcing.js

```js
/**
 * 상품 조달 경로 (sourcing) 정책
 *
 * 쿠팡에는 국내 배송 상품과 **해외직구 상품**이 섞여 있습니다.
 * 해외직구 상품은 한국 창고에 도착하기까지 오래 걸리고 변수가 많아,
 * 국내 상품과 같은 일정·조건으로 안내하면 실제와 크게 어긋납니다.
 *
 * 전체 소요 = (쿠팡 → 한국 창고) + (한국 창고 → 하노이)
 * 지금까지는 뒤 구간만 안내했는데, 앞 구간이 해외직구에서는 3주까지 걸립니다.
 */

export const SOURCING = {
  domestic: {
    id: 'domestic',
    label: '국내 배송 상품',
    /** 쿠팡 → 한국 창고 (영업일) */
    toWarehouseDays: { min: 1, max: 3 },
    warnings: [],
  },

  rocketGlobal: {
    id: 'rocket-global',
    label: '로켓직구',
    /** 쿠팡이 해외에서 직접 수입 — 국내 상품보다 +2~3영업일 (운영자 확정) */
    toWarehouseDays: { min: 3, max: 6 },
    warnings: [
      '해외직구(로켓직구) 상품입니다 — 한국 창고 도착까지 +2~3영업일이 더 걸립니다.',
      '해외직구 상품은 쿠팡에서 반품·교환이 제한될 수 있습니다.',
    ],
  },

  overseasSeller: {
    id: 'overseas-seller',
    label: '판매자 해외배송',
    /** 판매자가 해외에서 직접 발송 — 지연이 잦고 편차가 큽니다 */
    toWarehouseDays: { min: 7, max: 21 },
    warnings: [
      '판매자가 해외에서 직접 발송하는 상품입니다. 한국 창고 도착이 최대 3주까지 걸릴 수 있습니다.',
      '도착일이 확정되지 않아 전체 일정이 지연될 수 있습니다.',
      '해외 판매자 상품은 반품·A/S 가 사실상 불가능합니다.',
      '한국 창고 주소로 배송이 거부되는 경우가 있어, 주문 전 확인이 필요합니다.',
    ],
    /** 합배송 대기에 묶으면 다른 주문까지 지연됩니다 */
    excludeFromConsolidation: true,
  },
}

/**
 * 쿠팡 페이지에서 조달 경로를 판별하는 신호.
 * 확장이 배지·배송 문구·상품명에서 읽어옵니다.
 */
export const SOURCING_SIGNALS = {
  rocketGlobal: ['로켓직구', '로켓 직구', 'rocket global', '직구특가'],
  overseasSeller: [
    '해외직구', '해외 직구', '해외배송', '해외 배송', '구매대행',
    '해외판매자', '글로벌셀러', '직배송', '통관번호', '개인통관고유부호',
  ],
}

/** 해외직구 상품 공통 안내 */
export const OVERSEAS_NOTICE = {
  title: '해외직구 상품입니다',
  body:
    '이 상품은 한국이 아닌 해외에서 발송되어 한국 창고에 도착합니다. ' +
    '도착 후 하노이로 재발송되므로 전체 소요 기간이 길어지고, 도착일이 확정되지 않습니다.',
  costNote:
    '쿠팡 결제 시 관·부가세가 별도 부과될 수 있으며, 이는 저희 견적에 포함되지 않습니다. ' +
    '한국 창고 입고 후 실제 무게와 비용을 다시 확인해 최종 금액을 안내합니다.',
}

```

### config/maintenance.js

```js
/**
 * 점검 시간대(쉬는시간) 정책
 *
 * 매일 새벽 03:00~03:30 **한국시간(KST)** 동안 쿠팡에 의존하는 작업을 멈춥니다.
 * 쿠팡 점검 시간대와 겹치면 가격을 못 읽거나 잘못 읽고, 매입 결제가 실패할 수 있습니다.
 *
 * ⚠️ 쿠팡은 공개된 정기 점검 시각을 명시하지 않습니다.
 *    아래 값은 운영 관찰에 따라 조정하는 **설정값**이며,
 *    고객에게 "쿠팡 공식 점검 시간"이라고 단정해서는 안 됩니다.
 *
 * ⚠️ 기준 시간대는 KST 하나뿐입니다.
 *    서버는 UTC, 확장은 고객 로컬(하노이면 ICT)에서 돌지만
 *    판정은 언제나 KST 기준으로 하고 표시할 때만 로컬로 환산합니다.
 *
 *    03:00 KST = 01:00 ICT — 같은 날 새벽이라 안내가 자연스럽습니다.
 *    (01:00 KST 로 잡으면 하노이에서는 전날 23:00 이 되어 날짜가 넘어갑니다)
 */

export const MAINTENANCE = {
  enabled: true,

  /**
   * 적용 대상 국가 (ISO 2자리).
   * 베트남만 우선 적용하고, 다른 국가를 열 때 여기에 추가합니다.
   * 빈 배열이면 전체 적용.
   */
  appliesTo: ['VN'],

  /** 기준 시간대 — KST 는 서머타임이 없어 오프셋이 항상 +9시간 */
  timezone: { id: 'KST', label: '한국시간', utcOffsetMinutes: 9 * 60 },

  /** 창 시작 (KST 자정 기준 분). 180 = 03:00 */
  startMinuteOfDay: 180,

  /** 창 길이 (분) */
  durationMinutes: 30,

  /** 이 시간 전부터 "곧 점검" 예고 (분) */
  noticeLeadMinutes: 15,

  /** 창 종료 후 복구 확인 구간 (분) */
  graceMinutes: 10,

  label: '쇼핑몰 점검 시간',
  shortLabel: '점검 중',
  reason:
    '쇼핑몰 시스템 점검 시간대와 겹쳐 가격·재고 정보가 정확하지 않을 수 있습니다. 잘못된 견적을 드리지 않기 위해 잠시 멈춥니다.',
}

/**
 * 동작별 정책.
 *   block — 점검 중 금지 (쿠팡에 직접 의존)
 *   warn  — 수행하되 경고 (값이 부정확할 수 있음)
 *   allow — 제한 없음 (쿠팡과 무관)
 *
 * 과잉 차단은 그 자체로 비용입니다. 쿠팡에 실제로 의존하지 않는 동작은 막지 않습니다.
 */
export const MAINTENANCE_POLICY = {
  readProductPage: 'block', // 확장이 쇼핑몰 페이지를 읽어 견적 계산 — 점검 페이지를 읽으면 값이 틀림
  purchase: 'block', // 쇼핑몰에서 실제 매입 — 결제 실패 위험
  addToCart: 'allow', // 이미 읽어둔 값
  createOrder: 'allow', // 당사 시스템 내부
  confirmPayment: 'allow', // 쇼핑몰과 무관
  warehouse: 'allow',
  settlement: 'allow',
}

/**
 * 예외 사항.
 *
 * 점검 창이라고 무조건 막으면 오히려 손해인 경우가 있습니다.
 * 각 예외는 사유를 남기고, 운영자 강제 실행은 감사 로그에 기록됩니다.
 */
export const MAINTENANCE_EXCEPTIONS = {
  /**
   * 운영자 강제 실행.
   * 쿠팡이 실제로는 멀쩡한데 우리 설정이 틀렸을 수 있으므로 탈출구가 필요합니다.
   */
  allowOperatorOverride: true,

  /**
   * 이미 시작된 작업은 중단하지 않습니다.
   * 매입 착수(PURCHASING) 후 점검이 시작됐다고 중단하면
   * 쿠팡에는 결제가 됐는데 우리 기록은 없는 최악의 상태가 됩니다.
   */
  allowInFlight: true,

  /**
   * 긴급 예외 주문번호.
   * 특정 주문만 점검 중에도 처리해야 할 때 여기에 추가합니다. (예: 배송 마감 임박)
   */
  exemptOrderNos: [],

  /**
   * 점검 창 자체를 임시로 끄는 스위치.
   * 쿠팡 점검 일정이 바뀌었는데 배포가 늦을 때 씁니다.
   * 환경변수 MAINTENANCE_DISABLED=1 로도 끌 수 있습니다.
   */
  temporarilyDisabled: false,
}

/** 고객 안내 문구 */
export const MAINTENANCE_NOTICE = {
  soon: (minutes) => `${minutes}분 뒤 쇼핑몰 점검 시간이 시작됩니다. 그 전에 주문을 마쳐주세요.`,
  active: '지금은 쇼핑몰 점검 시간입니다. 가격 정보가 정확하지 않을 수 있어 견적을 잠시 멈췄습니다.',
  recovering: '점검이 끝났습니다. 쇼핑몰이 아직 복구 중일 수 있으니 값이 이상하면 잠시 뒤 새로고침해 주세요.',
  purchaseBlocked: '점검 시간에는 쇼핑몰 매입을 진행하지 않습니다. 점검 종료 후 자동으로 이어집니다.',
  overrideUsed: '점검 시간이지만 운영자 확인 하에 강제로 진행했습니다.',
  /** 안내에 항상 붙이는 꼬리말 — 기준 시간대를 명확히 합니다 */
  timezoneHint: (kstWindow, localWindow) =>
    `점검 시간 ${kstWindow} (한국시간) · 현지 기준 ${localWindow}`,
}

```

### config/fx.js

```js
/**
 * 환율 정책 (KRW → VND)
 *
 * 하노이 고객에게는 VND로 표시하고, 내부 계산은 전부 KRW로 수행합니다.
 * (쿠팡 가격이 KRW이고 배송 요율도 KRW이므로 반올림 오차를 줄이기 위함)
 */

/** Node(백엔드)와 브라우저(확장) 양쪽에서 안전하게 환경변수를 읽습니다. */
const env = (key) =>
  (typeof process !== 'undefined' && process?.env ? process.env[key] : undefined)

const parseRate = (value, fallback) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const FX = {
  /** 1 KRW = ? VND — 환경변수로 덮어쓸 수 있습니다. */
  krwToVnd: parseRate(env('NEXT_PUBLIC_KRW_TO_VND'), 18.5),

  /**
   * 1 USD = ? KRW — 배송 요율이 USD 기준이라 필요합니다.
   * 상품가는 KRW, 운임은 USD, 고객 결제는 VND 라 통화가 셋입니다.
   * 내부 계산은 전부 KRW 로 통일하고 표시할 때만 환산합니다.
   */
  usdToKrw: parseRate(env('NEXT_PUBLIC_USD_TO_KRW'), 1380),

  /** 환전 스프레드 (고객 표시가에 반영되는 마진) */
  spread: parseRate(env('NEXT_PUBLIC_FX_SPREAD'), 0.015),

  /** VND 표시 반올림 단위 */
  vndRoundTo: 1000,

  /** 환율 기준일 표기용 */
  updatedAt: env('NEXT_PUBLIC_FX_UPDATED_AT') || null,
}

```

### config/warehouse.js

```js
/**
 * 한국 물류창고 (입고지) — 물류 파트너 확정 (2026-08)
 *
 * 쿠팡 배송지 입력 규칙 (파트너 요구사항 — 운영자 실입력 기준):
 *   이름(받는 사람) : YS-ECOM
 *   주소            : 서울특별시 강서구 개화동로 11길 5 (07504)
 *   상세주소        : "YS-ECOM 주문자명"  ← 파트너가 이 코드+이름으로
 *                     입고를 접수하므로 반드시 들어가야 합니다.
 *
 * 입고 매칭은 연결된 쿠팡 주문번호·운송장, 그리고 라벨의 이름
 * (상세주소 안의 이름 — findByInbound 의 이름 폴백)으로 이뤄집니다.
 * 형식(괄호·공백·하이픈)은 상관없습니다 — 이름만 들어 있으면 찾습니다.
 *
 * 파트너 변경에 대비해 모든 값은 env 로 덮어쓸 수 있습니다.
 */

const env = (key) => process.env[key] || ''

const address1 = env('KR_WAREHOUSE_ADDR1') || '서울특별시 강서구 개화동로 11길 5'

export const WAREHOUSE = {
  name: env('KR_WAREHOUSE_NAME'),
  zip: env('KR_WAREHOUSE_ZIP') || '07504',
  address1,
  /** 파트너 요구 외 추가 상세(층·호 등)가 생기면 env 로 */
  address2: env('KR_WAREHOUSE_ADDR2'),
  /** 세부주소 코드의 접두사 — "YS-ECOM 이름" 의 YS-ECOM 부분 */
  code: env('KR_WAREHOUSE_CODE') || 'YS-ECOM',
  /** 배송지 연락처 — 고객이 쇼핑몰 배송지의 휴대폰 칸에 넣는 번호 (운영자 확정 26-09-06) */
  phone: env('KR_WAREHOUSE_PHONE') || '010-4803-6031',
  configured: Boolean(address1),
}

/** 쿠팡 배송지의 "세부주소(상세주소)" 칸에 그대로 들어갈 문자열 */
export const detailAddressFor = (customerName) =>
  `${WAREHOUSE.code} ${String(customerName ?? '').trim() || '주문자명'}`

```

### config/legal.js

```js
import { SETTLEMENT_RULES } from './payment.js'
import { vnd, toVnd } from '../lib/format.js'

/**
 * 실측 후 차액 정산 기준 — 값은 config/payment.js 한 곳에서 읽고, 화면에는
 * 원화와 동화를 함께 적습니다 (운영자 26-09-06: "한국돈도 표기").
 */
const TOL = Object.values(SETTLEMENT_RULES.toleranceByConfidence ?? {})
const TOL_MIN = Math.min(...TOL), TOL_MAX = Math.max(...TOL)
export const SETTLEMENT_TOLERANCE_TEXT =
  `${TOL_MIN.toLocaleString('ko-KR')}~${TOL_MAX.toLocaleString('ko-KR')}원 ≈ ${vnd(toVnd(TOL_MIN))}~${vnd(toVnd(TOL_MAX))}`

/**
 * 공지사항·이용조건 — 구매대행/배송대행에서 생길 수 있는 분쟁을 미리 막습니다.
 *
 * 각 항목은 "이런 일이 실제로 생긴다 → 그래서 이렇게 정한다"의 쌍입니다.
 * 사고가 난 뒤 설명하면 늦으므로, 접수 화면에서 요약을 보여주고 필수
 * 항목은 체크를 받아 주문에 기록합니다(REQUIRED_CONSENTS).
 *
 * ⚠️ 이 문서는 운영 기준이자 고객 고지문이며, 법률 자문이 아닙니다.
 *    한국 전자상거래법·개인정보보호법과 베트남 수입 규정에 맞는지는
 *    영업 개시 전에 변호사·관세사 검토를 받으세요. 특히 사업자 등록번호,
 *    통신판매업 신고번호, 개인정보 보유기간은 실제 값으로 채워야 합니다.
 */

/**
 * 사업자 정보 — 전자상거래법 제10조 표시사항.
 * 사업자등록증·통신판매업신고증(2024-08-28 발급) 원본 기준입니다.
 * 전화번호·이메일은 공개 채널이 정해지면 env 로 채우세요.
 */
export const BUSINESS = {
  name: process.env.BIZ_NAME || '전세계무역',
  /** 서류에 영문 상호가 없어 로마자 표기입니다 — 공식 영문명이 생기면 교체 */
  nameEn: process.env.BIZ_NAME_EN || 'JEONSEGYE TRADING',
  ceo: process.env.BIZ_CEO || '김영서',
  address: process.env.BIZ_ADDRESS
    || '인천광역시 서구 청라한내로100번길 10, 1차동 4층 412호 (청라동, 청라큐브시그니처1차오피스텔)',
  bizNo: process.env.BIZ_REG_NO || '360-14-03304',
  mailOrderNo: process.env.MAIL_ORDER_NO || '2025-인천서구-2986',
  /** 사업자등록증상 업종 — 해외직구대행업 */
  bizType: process.env.BIZ_TYPE
    || '도매 및 소매업 / 전자상거래 소매업 · 기타 통신판매업 · SNS마켓 · 해외직구대행업',
  tel: process.env.BIZ_TEL || '',
  email: process.env.BIZ_EMAIL || '',
  disputeVenue: process.env.DISPUTE_VENUE || '대한민국 법원',
}

/**
 * 공지 항목.
 * severity: 'critical' 사고 시 금전 손실 · 'important' 자주 문의 · 'info'
 */
export const NOTICES = [
  // ── 사업자 지위와 책임 범위 ──
  {
    id: 'role',
    category: '서비스의 성격',
    severity: 'critical',
    title: '저희는 판매자가 아니라 구매·배송을 대행합니다',
    body: [
      '배송대행은 고객님이 직접 쇼핑몰에서 결제한 상품을 한국 창고에서 받아 하노이로 보내드리는 운송 서비스입니다.',
      '구매대행은 고객님을 대신해 상품을 주문·결제해 드리는 대리 구매 서비스입니다.',
      '어느 경우든 상품의 판매자는 쇼핑몰 입점 판매자이며, 당사는 통신판매의 당사자가 아닙니다.',
      '따라서 상품 자체의 하자·오배송·품질 문제는 판매자 책임이며, 당사는 반품·교환 절차를 도와드립니다.',
    ],
  },
  {
    id: 'inspection',
    category: '서비스의 성격',
    severity: 'important',
    title: '검수는 겉포장 확인 수준입니다',
    body: [
      '창고에서는 상자 수량·외관 파손·무게만 확인합니다.',
      '상자를 열어 내용물의 정품 여부·작동 여부·유통기한을 검사하지 않습니다.',
      '개봉 검수가 필요하면 접수 시 미리 요청해 주세요(추가 비용이 발생할 수 있습니다).',
    ],
  },

  // ── 요금 ──
  {
    id: 'volumetric',
    category: '요금',
    severity: 'critical',
    title: '항공 운임은 실무게와 부피무게 중 큰 값으로 청구됩니다',
    body: [
      '가볍지만 부피가 큰 물건(휴지·기저귀·과자 등)은 실제 무게보다 비싸게 청구됩니다.',
      '부피무게 = 가로×세로×높이(cm) ÷ 6000 (항공 표준).',
      '접수 화면의 금액은 상품명으로 추정한 값이며, 실제 무게는 창고 실측으로 확정됩니다.',
    ],
  },
  {
    id: 'reweigh',
    category: '요금',
    severity: 'critical',
    title: '실측 후 차액이 크면 추가 청구 또는 환불합니다',
    body: [
      '한국 창고 실측 무게로 다시 계산해 최종 견적서를 보내드립니다.',
      '차액이 기준 금액 이상이면 추가 청구 또는 환불하고, 그 미만이면 임시 견적서 금액 그대로 확정합니다.',
      `기준 금액은 ${SETTLEMENT_TOLERANCE_TEXT}이며(무게 추정이 정확한 상품일수록 넉넉히 흡수합니다), 주문마다 정확한 금액을 견적서에 원화·동화로 적어 드립니다.`,
      '추가 청구액을 내지 않으면 출고가 보류되며, 보관 기간이 지나면 반송·폐기 규정을 따릅니다.',
    ],
  },
  {
    id: 'fx',
    category: '요금',
    severity: 'info',
    title: '환율은 접수 시점으로 고정됩니다',
    body: [
      '주문 접수 시점의 환율로 원화·동화 금액을 함께 확정합니다.',
      '이후 환율이 변해도 이미 접수된 주문 금액은 바뀌지 않습니다.',
    ],
  },

  // ── 통관·세금 ──
  {
    id: 'duty',
    category: '통관·세금',
    severity: 'critical',
    title: '베트남 관세·부가세는 수하인(고객) 부담입니다',
    body: [
      '통관 과정에서 세금이 부과되면 납세 의무자는 수하인인 고객님입니다.',
      '세액은 베트남 세관이 결정하며 당사가 정하거나 조정할 수 없습니다.',
      '세금 미납으로 통관이 보류·반송되면 그 비용도 고객님 부담입니다.',
    ],
  },
  {
    id: 'personal-use',
    category: '통관·세금',
    severity: 'important',
    title: '자가 사용 목적만 접수합니다 (재판매 금지)',
    body: [
      '판매 목적의 대량 반입은 상업 통관 대상이라 접수하지 않습니다.',
      '같은 품목을 반복·대량으로 보내면 세관이 상업 화물로 볼 수 있고, 그 책임은 고객님께 있습니다.',
    ],
  },
  {
    id: 'recipient-info',
    category: '통관·세금',
    severity: 'important',
    title: '수취인 정보는 실제와 정확히 일치해야 합니다',
    body: [
      '이름·연락처·주소가 실제와 다르면 통관이 지연되거나 반송됩니다.',
      '타인 명의로 보내는 경우 발생하는 문제의 책임은 신청인에게 있습니다.',
    ],
  },

  // ── 금지 품목 ──
  {
    id: 'prohibited',
    category: '금지 품목',
    severity: 'critical',
    title: '항공 위험물과 수입 금지 품목은 보낼 수 없습니다',
    body: [
      '부탄가스·라이터·폭죽 같은 항공 위험물은 보낼 수 없습니다. 보조배터리·리튬배터리는 항공 규정에 따라 물류사가 반려할 수 있어 접수 후 확인합니다. 향수·매니큐어·스프레이 같은 상온 생활용품은 보낼 수 있습니다.',
      '냉장·냉동 식품은 보낼 수 없습니다 — 항공 배송 중 냉기를 유지할 수 없어 상하거나 폐기됩니다. 상온으로 파는 식품은 보낼 수 있습니다.',
      '생고기·회·냉장 유제품·계란 등 축산물과 종자·식물은 베트남 검역 대상이라 반입이 금지됩니다. 고기·유제품이 든 상온 가공식품(캔햄·육포·레토르트)은 보낼 수 있으나 검역에서 확인을 요구할 수 있습니다.',
      '위조품·지식재산권 침해 물품은 어떤 경우에도 취급하지 않습니다.',
      '중국 등 해외에서 발송되는 직구 상품(로켓직구 등)은 접수하지 않습니다.',
      '접수 후 금지 품목이 발견되면 폐기 또는 반송되며, 그 비용은 고객님 부담입니다.',
    ],
  },

  // ── 취소·환불 ──
  {
    id: 'cancel',
    category: '취소·환불',
    severity: 'critical',
    title: '취소 시점에 따라 환불 금액이 달라집니다',
    body: [
      '입금 전 또는 발주 전: 전액 취소·환불이 가능합니다.',
      '구매대행 발주 후: 상품은 판매자 반품 절차를 따르고, 구매대행 수수료는 환불되지 않습니다.',
      '배송대행 접수 후 취소: 실비 1달러를 차감하고 환불합니다.',
      '당사 사유(발주 실패·서비스 오류)로 취소되면 전액 환불합니다.',
      '환불은 확정 후 영업일 3~7일 내에 지급됩니다.',
    ],
  },
  {
    id: 'return-cost',
    category: '취소·환불',
    severity: 'critical',
    title: '하노이 도착 후 반품·교환 비용은 전액 고객 부담입니다',
    body: [
      '하노이 → 한국 반송비는 2kg까지 20달러, 이후 1kg당 11달러입니다.',
      '구매대행은 반품 처리비 5,000원이 추가됩니다.',
      '교환은 반송비와 재배송비가 모두 발생하므로, 상품가와 비교해 판단하시기 바랍니다.',
      '액체·배터리 내장 제품·대량 화물은 반송 자체가 불가능해 교환·반품이 되지 않습니다.',
    ],
  },

  // ── 사고·지연 ──
  {
    id: 'damage',
    category: '사고·지연',
    severity: 'important',
    title: '파손·분실 배상에는 한도와 면책이 있습니다',
    body: [
      '배상은 물류사 운송 약관의 한도 내에서 이루어지며, 상품가 전액이 보장되지 않을 수 있습니다.',
      '판매자의 포장이 부실했거나 파손되기 쉬운 물건(유리·도자기 등)은 배상에서 제외될 수 있습니다.',
      '사고 확인을 위해 수령 즉시 개봉 영상 또는 사진이 필요합니다. 수령 후 3일이 지나면 접수가 어렵습니다.',
    ],
  },
  {
    id: 'delay',
    category: '사고·지연',
    severity: 'info',
    title: '통관·기상·항공 사정에 따른 지연은 면책입니다',
    body: [
      '안내드리는 소요 기간은 영업일 기준 예상이며 보장 기간이 아닙니다.',
      '세관 검사, 명절·연휴, 기상 악화, 항공편 결항으로 인한 지연은 배상 대상이 아닙니다.',
    ],
  },
  {
    id: 'storage',
    category: '사고·지연',
    severity: 'important',
    title: '창고 보관 기간이 지나면 반송 또는 폐기됩니다',
    body: [
      '한국 창고 무료 보관은 입고일로부터 30일입니다.',
      '기간이 지나거나 추가 청구액이 미납되면 반송 또는 폐기될 수 있으며, 그 비용은 고객님 부담입니다.',
    ],
  },

  // ── 개인정보 ──
  {
    id: 'privacy',
    category: '개인정보',
    severity: 'critical',
    title: '배송에 필요한 정보를 수집하고 국외로 전달합니다',
    body: [
      '수집 항목: 이름, 연락처, 배송지 주소, 주문 정보.',
      '이용 목적: 상품 접수·운송·통관·배송 안내·정산.',
      '제3자 제공: 물류사(운송·통관 대행), 항공사, 현지 배송사. 제공 항목은 배송에 필요한 최소한입니다.',
      '국외 이전: 한국 → 베트남 (배송·통관 목적). 동의하지 않으면 서비스를 이용할 수 없습니다.',
      '보유 기간: 배송 완료 후 5년 (전자상거래 관련 기록 보존 의무).',
      '만 14세 미만은 법정대리인의 동의가 있어야 이용할 수 있습니다.',
    ],
  },

  // ── 결제·분쟁 ──
  {
    id: 'payment',
    category: '결제',
    severity: 'important',
    title: '본인 명의로 결제해 주세요',
    body: [
      '타인 명의 계좌·카드로 결제해 발생하는 문제(분쟁·지급정지)의 책임은 신청인에게 있습니다.',
      '계좌 이체 시 메모에 주문번호를 넣어야 입금 확인이 됩니다.',
      '카드 결제 취소는 카드사 처리 기간에 따라 영업일 3~7일이 걸립니다.',
    ],
  },
  {
    id: 'dispute',
    category: '분쟁',
    severity: 'info',
    title: '분쟁은 협의로 해결하며, 준거법은 대한민국 법입니다',
    body: [
      '문제가 생기면 먼저 카카오톡으로 알려주세요. 대부분 협의로 해결됩니다.',
      '협의가 되지 않는 경우 대한민국 법을 준거법으로 하며, 관할은 민사소송법에 따릅니다.',
    ],
  },
]

/**
 * 접수 시 반드시 받아야 하는 동의.
 * 체크가 없으면 서버가 주문을 거절하고, 받은 동의는 주문에 기록합니다
 * (분쟁 시 "고지했다"의 증빙).
 */
export const REQUIRED_CONSENTS = [
  {
    id: 'service',
    label: '당사는 판매자가 아닌 구매·배송 대행자임을 확인했습니다',
    noticeIds: ['role', 'inspection'],
  },
  {
    id: 'fees',
    label: `부피무게 청구와 실측 후 차액 정산(${SETTLEMENT_TOLERANCE_TEXT} 기준)에 동의합니다`,
    noticeIds: ['volumetric', 'reweigh', 'fx'],
  },
  {
    id: 'customs',
    label: '베트남 관세·부가세는 제가 부담하며, 자가 사용 목적임을 확인합니다',
    noticeIds: ['duty', 'personal-use', 'recipient-info'],
  },
  {
    id: 'prohibited',
    label: '금지 품목(배터리·액체·축산물·위조품 등)이 없음을 확인했습니다',
    noticeIds: ['prohibited'],
  },
  {
    id: 'privacy',
    label: '개인정보 수집·제3자 제공·국외이전(한국→베트남)에 동의합니다',
    noticeIds: ['privacy'],
  },
  {
    id: 'refund',
    label: '취소·반품 비용 부담 규정을 확인했습니다',
    noticeIds: ['cancel', 'return-cost', 'damage', 'storage'],
  },
]

/** 공지를 카테고리별로 묶어 돌려줍니다 (공지 페이지용) */
export function noticesByCategory() {
  const map = new Map()
  for (const n of NOTICES) {
    if (!map.has(n.category)) map.set(n.category, [])
    map.get(n.category).push(n)
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }))
}

/** 동의 검증 — 빠진 항목의 라벨을 돌려줍니다 (없으면 빈 배열) */
export function missingConsents(consents) {
  const given = new Set(
    Array.isArray(consents) ? consents : Object.entries(consents ?? {}).filter(([, v]) => v).map(([k]) => k),
  )
  return REQUIRED_CONSENTS.filter((c) => !given.has(c.id)).map((c) => c.label)
}

/**
 * 선택 동의 — 필수 동의와 **분리**되어 있고 안 해도 접수됩니다 (운영자 26-09-06: 고객 풀).
 * 동의·철회 시각과 경로는 고객 기록(lib/customer/store.js)에 남습니다.
 */
export const OPTIONAL_CONSENTS = [
  {
    id: 'marketing',
    label: '새 상품·할인 소식을 카카오톡/Zalo·이메일로 받겠습니다 (선택 · 언제든 철회할 수 있습니다)',
  },
]

```

### config/words.js

```js
/**
 * 고객 화면에서 쓰는 "쉬운 말" 사전
 *
 * 운영자 지시(26-09-04): "토스뱅크처럼 입금·출금 같은 단어도 좋지만
 * **보내기·받기**같이 쉽게 읽고 구분할 수 있도록."
 *
 * 원칙 세 가지
 *   1. 화면에는 **동작**을 씁니다. '입금'(명사·업계말) 대신 '보내기'(내가 할 일).
 *   2. 한자어보다 우리말. '접수' → '신청', '청구액' → '낼 금액'.
 *   3. 정확해야 하는 문서(견적서·약관·공지)에는 정식 용어를 그대로 둡니다.
 *      법적 분쟁에서 "쉬운 말로 썼더니 뜻이 달라졌다"가 되면 안 되니까요.
 *      그런 자리에서는 쉬운 말 뒤에 괄호로 정식 용어를 답니다.
 *
 * ⚠️ 저장되는 값(주문 상태 코드 등)은 절대 바꾸지 않습니다. 바뀌는 것은 문구뿐입니다.
 */

export const WORDS = {
  /** 돈이 우리에게 오는 것 — 고객 입장의 동작 */
  pay: {
    /** 고객이 할 일 */
    action: '보내기',
    /** 무엇을 보내는가까지 붙인 말 */
    actionFull: '배송비 보내기',
    /** 기다리는 상태 */
    waiting: '보내주시면 시작해요',
    /** 확인된 상태 */
    done: '받았습니다',
    /** 정식 용어 (문서용) */
    formal: '입금',
  },

  /** 돈이 고객에게 돌아가는 것 */
  refund: {
    action: '돌려드리기',
    done: '돌려드렸습니다',
    formal: '환불',
  },

  /** 금액 안내 */
  amount: {
    /** 고객이 낼 금액 */
    due: '내실 금액',
    /** 미리 계산해 본 금액 */
    estimate: '예상 금액',
    /** 확정된 금액 */
    final: '확정 금액',
    formalInvoice: '청구서',
    formalQuote: '견적서',
  },

  /** 주문을 만드는 일 */
  order: {
    action: '신청하기',
    done: '신청 완료',
    formal: '접수',
    /** 주문을 가리키는 말 */
    noun: '신청',
    numberLabel: '신청번호',
  },

  /** 배송 */
  ship: {
    warehouse: '한국 창고',
    inWarehouse: '한국 창고 도착',
    flying: '하노이로 가는 중',
    arrived: '하노이 도착',
    delivered: '받으셨습니다',
  },

  /** 무게 실측 후 금액이 달라지는 일 */
  adjust: {
    more: '조금 더 내실 금액',
    less: '돌려드릴 금액',
    same: '처음 안내한 금액 그대로',
    formal: '정산',
  },
}

/**
 * 쉬운 말 + 정식 용어 병기 — 문서·법적 고지에서 씁니다.
 * 예: paired('보내기', '입금') → "보내기(입금)"
 */
export const paired = (plain, formal) => (formal ? `${plain}(${formal})` : plain)

```

### config/contact.js

```js
/**
 * 고객 문의 채널
 *
 * 카카오톡으로 받습니다 (운영자 지시 26-09-01).
 * 견적서·사이트 하단에서 모두 이 한 곳을 참조하므로, 채널이 바뀌면
 * 여기만 고치면 됩니다. env 로도 교체 가능합니다.
 *
 * 오픈채팅 주소는 비워둘 수 있습니다 — 그러면 견적서·사이트에서 오픈채팅
 * 줄과 QR 이 함께 사라지고 카카오톡 ID 안내만 남습니다. 새 방을 열면
 * 주소를 넣고 QR(public/kakao-openchat-qr.png)만 그 주소로 다시 만드세요.
 */
/** 공백만 넣어 비활성화할 수 있게 — 값이 비면 그 줄은 화면에서 사라집니다. */
const env = (key, fallback) => (process.env[key] ?? fallback ?? '').trim()

export const CONTACT = {
  /** 카카오톡 아이디로 검색해 1:1 문의도 가능합니다 */
  kakaoId: env('KAKAO_ID', 'vietnam911'),
  kakaoOpenChat: env('KAKAO_OPEN_CHAT', 'https://open.kakao.com/o/simlWALi'),
  label: '카카오톡',
  /**
   * 인쇄된 견적서에서는 링크를 누를 수 없는 경우가 있어 QR 이미지를 함께
   * 싣습니다. public/ 에 파일을 넣으면 자동으로 표시됩니다. (없으면 생략)
   */
  qrPath: env('KAKAO_QR_PATH', '/kakao-openchat-qr.png'),
}

```

### config/partners.js

```js
/**
 * 「쿠팡으로 가기」 버튼의 주소 — 폰 화면 전용 (운영자 26-09-12: "쿠팡 사이트로 이동하기 버튼을 간단하게, 쿠팡 수수료도 받을 수 있게").
 *
 * 서버 .env.local 에 COUPANG_PARTNERS_LINK (쿠팡 파트너스 사이트에서 만든 https://link.coupang.com/… 링크)가 있으면
 * 그 링크를, 없으면 보통 쿠팡 주소를 씁니다. 파트너스 링크가 있는 화면에는 아래 고지를 반드시 함께 보입니다 (공정위 표시 의무).
 *
 * ⚠️ 쓰지 않는 곳
 *   · 구매대행 발주(운영자가 직접 사는 것) — 파트너스 약관상 본인 구매는 수수료 대상이 아니며 제재 사유입니다.
 *   · 확장(스토어 배포본)과 PC 너비 화면 — 데스크탑 쪽에는 제휴 코드도, 남의 상호도 넣지 않습니다.
 *   · 값은 서버 환경변수에서만 읽습니다. 링크 자체는 비밀이 아니지만 저장소에는 넣지 않습니다.
 */
export const SHOP_HOME = 'https://www.coupang.com/'
export const PARTNERS_NOTICE = '이 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'

/** 버튼 주소 — { href, isPartner }. 파트너스 링크는 쿠팡 도메인의 https 주소일 때만 인정합니다 */
export function shopLink(env = process.env) {
  const v = String(env.COUPANG_PARTNERS_LINK ?? '').trim()
  const isPartner = /^https:\/\/(link\.coupang\.com|www\.coupang\.com)\/\S+$/.test(v)
  return { href: isPartner ? v.slice(0, 300) : SHOP_HOME, isPartner }
}

```

### config/catalog.js

```js
/**
 * 취급 품목 정책 — "뷰티 카테고리 중 여성 화장품만"
 *
 * 쿠팡 뷰티 카테고리(categoryId 1001)에는 남성용품·헤어·바디·미용기기가
 * 모두 섞여 있으므로, 아래 3단 필터로 여성 화장품만 남깁니다.
 *   1) 서브카테고리 화이트리스트에 분류되는가
 *   2) 남성용 키워드가 없는가
 *   3) 비(非)화장품(기기·위생용품) 키워드가 없는가
 *
 * 자동 분류만으로 100%를 걸러낼 수는 없으므로,
 * 운영자 검수(승인 큐)와 함께 사용하는 것을 전제로 합니다.
 */

/** 노출 대상 서브카테고리 — 순서가 곧 UI 노출 순서입니다. */
export const SUBCATEGORIES = [
  {
    id: 'skincare',
    matchPriority: 90,
    label: '스킨케어',
    emoji: '💧',
    keywords: ['스킨', '토너', '로션', '에멀전', '에센스', '세럼', '앰플', '크림', '아이크림', '미스트', '오일', '수분크림', '나이트크림'],
    searchTerms: ['토너', '에센스', '세럼', '수분크림', '아이크림', '앰플'],
  },
  {
    id: 'cleansing',
    matchPriority: 20,
    label: '클렌징',
    emoji: '🫧',
    keywords: ['클렌징', '클렌저', '폼클렌징', '클렌징오일', '클렌징워터', '클렌징밤', '리무버', '필링', '스크럽', '각질'],
    searchTerms: ['클렌징오일', '폼클렌징', '클렌징밤', '립앤아이리무버'],
  },
  {
    id: 'mask',
    matchPriority: 30,
    label: '마스크팩',
    emoji: '🧖',
    keywords: ['마스크팩', '마스크시트', '시트마스크', '워시오프팩', '슬리핑팩', '수면팩', '모델링팩', '필오프팩', '토너패드', '필링패드', '패드'],
    searchTerms: ['시트마스크', '토너패드', '슬리핑팩'],
  },
  {
    id: 'suncare',
    matchPriority: 10,
    label: '선케어',
    emoji: '☀️',
    keywords: ['선크림', '썬크림', '선스틱', '선쿠션', '선세럼', '선블록', '자외선차단', '톤업크림'],
    searchTerms: ['선크림', '선스틱', '톤업선크림'],
  },
  {
    id: 'base',
    matchPriority: 50,
    label: '베이스메이크업',
    emoji: '🎨',
    keywords: ['쿠션', '파운데이션', '파데', '컨실러', '프라이머', '베이스', '팩트', '파우더', '메이크업픽서', 'BB크림', 'CC크림'],
    searchTerms: ['쿠션팩트', '파운데이션', '컨실러', '메이크업프라이머'],
  },
  {
    id: 'eye',
    matchPriority: 60,
    label: '아이메이크업',
    emoji: '👁️',
    keywords: ['아이섀도', '아이쉐도우', '섀도우', '쉐도우', '아이팔레트', '섀도우팔레트', '팔레트', '마스카라', '아이라이너', '아이브로우', '눈썹', '속눈썹'],
    searchTerms: ['아이섀도우팔레트', '마스카라', '아이라이너', '아이브로우'],
  },
  {
    id: 'lip',
    matchPriority: 55,
    label: '립메이크업',
    emoji: '💄',
    keywords: ['립스틱', '립틴트', '틴트', '립글로스', '립밤', '립라이너', '립케어', '립팔레트', '립'],
    searchTerms: ['립틴트', '립스틱', '립밤', '립글로스'],
  },
  {
    id: 'nail',
    matchPriority: 70,
    label: '네일',
    emoji: '💅',
    keywords: ['네일', '매니큐어', '젤네일', '네일스티커', '탑코트', '베이스코트'],
    searchTerms: ['네일스티커', '젤네일'],
  },
  {
    id: 'perfume',
    matchPriority: 40,
    label: '향수',
    emoji: '🌸',
    keywords: ['향수', '퍼퓸', '오드퍼퓸', '오드뚜왈렛', 'EDP', 'EDT', '코롱', '바디미스트', '헤어퍼퓸'],
    searchTerms: ['여성향수', '바디미스트'],
  },
]

/**
 * 오탐 방지 브랜드 세이프리스트.
 *
 * 제외 키워드가 브랜드명의 일부로 들어있어 잘못 걸러지는 경우를 막습니다.
 * (예: 여성 브랜드 '포맨트'가 남성 키워드 '포맨'에 걸림)
 * 운영 중 오탐을 발견하면 여기에 브랜드명을 추가하세요.
 */
export const BRAND_SAFELIST = ['포맨트', '포멘트', '맨디', '옴므아이']

/** 남성용 제품 제외 키워드 */
export const MALE_KEYWORDS = [
  '남성', '남자', '맨즈', '멘즈', "men's", 'mens', 'for men', '포맨', '4men',
  '옴므', 'homme', 'pour homme', '쉐이빙', '셰이빙', 'shaving', '애프터쉐이브',
  '면도', '수염', '스킨로션세트 남성',
]

/**
 * 비(非)화장품 제외 키워드 — 뷰티 카테고리에 섞여 들어오는 항목들.
 * 헤어/바디 제품 취급 여부는 정책 선택입니다.
 * (현재 정책: "여자 화장품 = 스킨케어 + 메이크업 + 향수"로 한정)
 */
export const NON_COSMETIC_KEYWORDS = [
  // 미용 기기·소품
  '드라이기', '고데기', '헤어아이론', '에어랩', '미용기기', 'LED마스크', '갈바닉',
  '제모기', '면도기', '이발기', '눈썹칼', '족집게', '거울', '파우치', '화장솜통',
  '브러시세트', '퍼프', '스펀지', '뷰러', '네일아트기기',
  // 헤어·바디 (정책상 제외)
  '샴푸', '린스', '트리트먼트', '헤어에센스', '헤어오일', '염색약', '탈모',
  '바디워시', '바디로션', '바디크림', '바디스크럽', '핸드워시', '풋크림',
  // 위생·의약외품
  '생리대', '탐폰', '칫솔', '치약', '구강청결제', '데오드란트', '제모크림',
  '영양제', '콜라겐', '유산균', '다이어트',
  // 기타
  '리필용기', '공병', '샘플증정', '미용실', '체험단',
]

/** 뷰티 카테고리 ID (내부 분류용) */
export const COUPANG_BEAUTY_CATEGORY_ID = 1001

/** 카탈로그 수집 시 사용할 검색어 (서브카테고리 searchTerms 를 펼친 것) */
export const CATALOG_SEARCH_TERMS = SUBCATEGORIES.flatMap((s) =>
  s.searchTerms.map((term) => ({ term, subcategoryId: s.id })),
)

export const getSubcategory = (id) => SUBCATEGORIES.find((s) => s.id === id) || null

```

### config/coupang-patterns.js

```js
/**
 * 쿠팡 화면 문구·셀렉터 — 재배포 없이 고칠 수 있는 "대응 설정"
 *
 * 왜 여기 있나
 *   확장은 쿠팡 화면에서 [배송지 변경] 같은 **문구**를 보고 버튼을 찾습니다.
 *   쿠팡이 문구를 바꾸면(예: "배송지 변경" → "받는 곳 변경") 자동입력이
 *   멈추는데, 확장을 고쳐 배포하면 고객이 확장을 새로고침할 때까지
 *   하루가 걸립니다. 이 파일은 서버에서 내려보내는 값이라,
 *   **여기 한 줄 고치고 서버만 올리면 몇 분 안에 전 고객에게 반영**됩니다.
 *
 * 안전 규칙 (확장 쪽 patterns.js 에서 강제)
 *   1. 서버 문구는 **추가**만 됩니다 — 확장에 번들된 기본 문구는 그대로
 *      남아 함께 시도합니다. 서버 설정이 잘못돼도 오늘 되던 건 계속 됩니다.
 *   2. 서버가 죽어 있으면 번들 기본값으로 동작합니다.
 *   3. 코드가 아니라 값만 내려갑니다 (MV3 원격 코드 실행 금지 준수).
 *      정규식은 문자열로 내려가고 확장이 RegExp 로 컴파일하며,
 *      길이·컴파일·속도(ReDoS) 검사를 통과하지 못하면 무시합니다.
 *
 * 고치는 법 (운영자)
 *   ① 고객이 [🩺 진단 정보 복사]로 보낸 내용에서 실제 문구를 확인
 *   ② 아래 해당 항목의 `|` 뒤에 새 문구를 띄어쓰기 없이 추가
 *   ③ `version` 을 1 올리고 서버 재시작 → 확장은 6시간 캐시가 만료되기 전에도
 *      다음 결제 화면에서 새 설정을 받아옵니다 (확장 🔄 하면 즉시).
 *
 * ⚠️ 문구는 **공백을 지운 상태**로 비교합니다. "배송지 변경" → `배송지변경`.
 */

export const COUPANG_PATTERNS = {
  /** 값이 바뀔 때마다 1씩 올립니다 — 확장·관리자 화면이 이 번호로 반영 여부를 확인합니다. */
  version: 2,
  updatedAt: '2026-09-06',

  /**
   * 클릭 대상을 찾는 문구 (정규식 source). maxLen 은 "이 길이 이하의 요소만
   * 후보로 본다"는 뜻입니다 — 문구가 든 큰 컨테이너를 잘못 누르지 않게 합니다.
   */
  text: {
    /** 배송지 목록 창 열기 */
    openAddr: { source: '배송지변경|배송지선택|배송지수정', maxLen: 12 },
    /** 목록에서 새 주소 입력폼 열기 */
    addAddr: { source: '배송지추가|신규배송지|새배송지|주소추가', maxLen: 12 },
    /** 우편번호(다음 주소) 검색창 열기 */
    zipSearch: { source: '우편번호찾기|우편번호검색|주소찾기|주소검색', maxLen: 16 },
    /** 주소록 행의 [선택] */
    pick: { source: '^선택(하기)?$', maxLen: 8 },
    /** 결제 전 경고를 걸 [결제하기] */
    payButton: { source: '결제하기$', maxLen: 20 },
    /** 다음 우편번호 프레임의 검색 실행 버튼 */
    zipSubmit: { source: '검색', maxLen: 10 },
    /** 배송지 입력폼의 [저장] — 자동입력이 끝난 뒤 짚어줍니다 (누르는 건 고객) */
    save: { source: '^저장(하기)?$', maxLen: 8 },
    /** 배송 요청사항 열기 — 창고는 이 두 가지가 맞아야 소포를 받습니다 */
    noteOpen: { source: '배송요청사항|요청사항변경', maxLen: 12 },
    /** 배송 요청사항 옆 [변경] — 제목 글자가 아니라 이 버튼을 눌러야 창이 열립니다 */
    noteChange: { source: '^변경(하기)?$', maxLen: 6 },
    /** ① 문 앞 */
    noteDoor: { source: '^문앞$', maxLen: 6 },
    /** ② 비밀번호 없이 출입 — 창고 공동현관은 출입번호가 없습니다 */
    noteNoCode: { source: '비밀번호없이출입가능해요|비밀번호없이출입|출입번호없음|비밀번호없음', maxLen: 20 },
    /** 배송 요청사항 저장 */
    noteSave: { source: '동의하고저장하기|동의하고저장|^저장하기$', maxLen: 14 },

  },

  /** 배송지 입력폼의 칸 — CSS 셀렉터 (쉼표로 여러 개) */
  fields: {
    name: 'input[name*="name" i], input[placeholder*="받는"], input[placeholder*="이름"]',
    phone: 'input[type="tel"], input[name*="phone" i], input[placeholder*="휴대폰"], input[placeholder*="전화"]',
    detail: 'input[name*="detail" i], input[name*="addr2" i], input[placeholder*="상세"]',
  },

  /**
   * 자가진단 — 이 문구가 보이면 "결제 화면"으로 보고, 그때 필요한 앵커가
   * 하나도 안 잡히면 화면 구조가 바뀐 것으로 판단해 운영자에게 알립니다.
   * (개인정보는 보내지 않습니다 — 어떤 앵커가 몇 개 잡혔는지만)
   */
  health: {
    /** 이 문구들이 본문에 있어야 결제 화면으로 간주 */
    checkoutMarks: { source: '결제하기|최종결제금액|주문결제', maxLen: 0 },
    /** 결제 화면에서 최소한 하나는 잡혀야 하는 문구 키 */
    checkoutRequire: ['openAddr', 'payButton'],
    /** 배송지 입력폼에서 최소한 하나는 잡혀야 하는 문구 키 */
    addrFormRequire: ['zipSearch'],
  },
}

/**
 * 사람이 읽을 이름 — 관리자 화면과 알림 문구가 같은 말을 쓰도록 한 곳에 둡니다.
 * ("openAddr 없음" 이 아니라 "[배송지 변경] 문구를 못 찾음" 으로 보여야 합니다)
 */
export const PATTERN_LABELS = {
  openAddr: '배송지 변경', addAddr: '배송지 추가', zipSearch: '우편번호 찾기',
  pick: '선택', payButton: '결제하기', zipSubmit: '주소 검색', save: '저장',
  noteOpen: '배송 요청사항', noteChange: '요청사항 [변경]', noteDoor: '문 앞', noteNoCode: '비밀번호 없이 출입', noteSave: '동의하고 저장하기',
  items: '상품·금액 표기',
}

/** 자가진단 종류 → 사람이 읽을 이름 */
export const HEALTH_KIND_LABELS = {
  addrAutofill: '⚡ 배송지 자동등록 실패',
  checkout: '🖥 결제 화면 문구 없음',
  price: '💰 결제 화면 금액을 못 읽음',
  product: '📦 상품 화면 인식 실패',
  unknown: '❓ 알 수 없는 이상',
}

/** API 로 내보낼 형태 — 확장이 그대로 쓰는 값만 담습니다. */
export function coupangPatternPayload() {
  return {
    version: COUPANG_PATTERNS.version,
    updatedAt: COUPANG_PATTERNS.updatedAt,
    text: COUPANG_PATTERNS.text,
    fields: COUPANG_PATTERNS.fields,
    health: COUPANG_PATTERNS.health,
  }
}

```

### config/assumptions.js

```js
/**
 * 정책 값 출처 관리
 *
 * 베트남 직구 사업이 아직 확정되지 않아, 현재 설정값의 상당수는
 * 공개 자료와 업계 관행에 근거한 **추정값**입니다.
 * 통관업체·물류사 제안이 들어오면 그 값으로 교체해야 합니다.
 *
 * 어느 값이 확정이고 어느 값이 추정인지 코드 안에서 구분되지 않으면
 * 추정값을 확정값처럼 고객에게 안내하게 됩니다. 그래서 여기 모읍니다.
 *
 * status:
 *   confirmed — 업체·기관 확인 완료
 *   assumed   — 추정값. 확인 전까지 고객 안내에 "예상"임을 밝혀야 함
 *   blocked   — 확인이 필요한데 아직 물어보지 못함
 */

export const ASSUMPTIONS = [
  {
    id: 'shipping-rate',
    label: '국제배송 요율 $8/kg (원가 $7 = S1 기본 $6 + 유류 임시조정 $1) — 마진 $1/kg',
    where: 'config/shipping.js · ratePerKgUsd / config/costs.server.js',
    status: 'confirmed',
    source: '고객가: 운영자 제시 · 원가: S1 EXPRESS 견적서 26.08.28 (FSC·VN통관료 포함 ALL IN)',
    risk: '유류 임시조정(+$1)은 월별 변동 가능 — $6 복귀 시 마진 +$1/kg, 추가 인상 시 고객가 재검토.',
  },
  {
    id: 'zone-surcharges',
    label: '베트남 현지운송비 — 하노이 $0 확정 (빈푹 $5 · 박닌/박장/흥옌 $7 · 하이즈엉/하이퐁 $17)',
    where: 'config/shipping.js · zones (7개 지역 활성 26-09-06 — 고객가 = 원가 × 1.2 소수점 버림: $6 · $8 · $20) / config/costs.server.js · zoneUsd',
    status: 'confirmed',
    source: 'S1 EXPRESS 견적서 26.08.28 — 확장 시 zones 에 위 원가로 추가하면 됨',
  },
  {
    id: 'device-rate',
    label: '전자·가전 기기 취급비 — 고객 $40/EA (원가 S1 $30/EA, IT기기 기준)',
    where: 'config/shipping.js · ITEM_SURCHARGES.device',
    status: 'confirmed',
    source: '고객가: 운영자 확정 26-08-30 (가전도 동일 규정으로 자동 견적+할증 — 견적 문의 폐지) · 원가: S1 EXPRESS 견적서 26.08.28. 고액(100만원↑)·중량(15kg↑)은 기존 게이트 유지',
    risk: 'S1 원가 $30/EA 는 스마트폰~모니터 IT기기 명시 — 가전(청소기·드라이기 등)도 같은 원가인지 미확인. 다르면 기기당 마진($10)이 달라집니다.',
    askBroker: '가전·전열 기기(청소기·드라이기·에어랩 등)도 IT기기와 같은 $30/EA 인지, 별도 요율인지',
  },
  {
    id: 'volumetric-divisor',
    label: '부피무게 계수 ÷6000',
    where: 'config/shipping.js · volumetricDivisor',
    status: 'confirmed',
    source: 'S1 EXPRESS 견적서 26.08.28 — "가로*세로*높이 / 6000" 명시',
  },
  {
    id: 'billing-increment',
    label: '청구무게: 최소 1kg · 1kg 부터 0.5kg 단위 올림 (고객 청구 기준)',
    where: 'config/shipping.js · roundingTiers / minBillableKg',
    status: 'confirmed',
    source: '운영자 확정 26.08.29',
    risk: 'S1 의 원가 청구 단위는 미확인 — 우리보다 굵게(예: 1kg) 청구하면 구간별로 원가가 마진을 초과할 수 있음.',
    askBroker: 'S1 이정은 과장: 원가 청구무게 올림 단위(0.1/0.5/1kg)와 최소 청구무게',
  },
  {
    id: 'tax-collect',
    label: '관세·VAT 미징수 — 개인통관·영수증 무증빙 채널',
    where: 'config/taxes.js · collect = false',
    status: 'confirmed',
    source: '운영자 확정 (26-08-29) — S1 $7/kg 올인에 통관 포함, 세금 별도 고지 없음',
    risk: '통관 방식이 정식(수입신고) 채널로 바뀌면 관세·VAT 를 다시 걷어야 합니다 (collect: true 로 복원, 세율표는 보존됨).',
  },
  {
    id: 'import-duty',
    label: '(보존) 품목군별 관세율 — 현재 미사용',
    where: 'config/taxes.js · DUTY_CATEGORIES',
    status: 'confirmed',
    source: '관세 미징수 정책으로 계산에서 제외 — 세율표는 정책 변경 대비 보존',
  },
  {
    id: 'de-minimis',
    label: '소액 면세 폐지 (전 건 과세)',
    where: 'config/taxes.js · deMinimisVnd = 0',
    status: 'confirmed',
    source: 'Decision 01/2025/QD-TTg (2025-02-18 시행)',
  },
  {
    id: 'blocked-items',
    label: '배송 금지 품목 9개 유형',
    where: 'config/eligibility.js · BLOCK_RULES',
    status: 'assumed',
    source: '베트남 수입 규정 + 항공 위험물 규정 공개 자료',
    risk: '업체 금지 목록이 더 넓으면 통관에서 반송됩니다.',
    askBroker: '업체가 취급하지 않는 품목 전체 목록',
  },
  {
    id: 'item-surcharge',
    label: '상품 할증 (파손주의 $2/개, 대형 $5/건)',
    where: 'config/shipping.js · ITEM_SURCHARGES',
    status: 'assumed',
    source: '임시 설정값',
    askBroker: '파손주의·대형 화물 취급 수수료',
  },
  {
    id: 'lead-time',
    label: '리드타임 — 창고→하노이 2~3영업일 · 국내 쿠팡→창고 1~3영업일 · 해외직구 +2~3영업일',
    where: 'config/shipping.js · leadTimeDays / config/sourcing.js',
    status: 'confirmed',
    source: '운영자 확정 (26-08-30) — 모두 영업일 기준(주말·공휴일 제외)',
  },
  {
    id: 'return-shipping',
    label: '하노이→한국 반송 고객가 — 2kg까지 $20 + 초과 kg당 $11 (원가+$2, 구매대행 처리 5,000원 추가)',
    where: 'config/shipping.js · RETURN_SHIPPING',
    status: 'confirmed',
    source: 'S1 EXPRESS 견적서 수정본 26.08.31 — 박닌/박장/빈푹 $23 · 타이응우옌/하이즈엉 $28 · 하이퐁/하남/푸터/닌빈 $33, 한국 내 택배 전달 1~10kg $7 / 11~20kg $14. 베트남 행정구역 개편 예정(하이퐁 직할시·닌빈성·푸터성·타이응우옌성 통합) 참고.',
    risk: '액체·배터리·현금·신용카드·대량물품은 베→한 발송 불가 (화장품 액체류는 반품 자체가 불가). $150 이상 신고 시 관부가세.',
  },
  {
    id: 'return-leadtime',
    label: '반송 리드타임 — 당일 픽업 시 한국 도착 1~2일 + 한국 내 배송 1~2일',
    where: 'config/shipping.js · RETURN_SHIPPING.leadTime',
    status: 'confirmed',
    source: '운영자 확인 26-08-31 (S1)',
  },
  {
    id: 'overseas-sourcing-block',
    label: '해외직구(중국 등 타국 발송) 상품 접수 중단',
    where: 'lib/eligibility.js · overseas-sourced 차단 + lib/order/store.js 서버 거절',
    status: 'confirmed',
    source: '운영자 확정 26-08-31 — 한국 내 발송 상품만 접수. 로켓직구·판매자 해외배송 배지로 판별',
    risk: '판별은 배지·배송문구 기반 — 배지가 없는 해외 발송 상품은 창고 입고 시 확인 후 반송 처리 필요.',
  },
  {
    id: 'refund-policy',
    label: '환불 영업일 3~7일 · 변심 취소: 구매대행 수수료 제외 / 배송대행 $1 차감 · 반품 비용 전액 구매자 부담',
    where: 'config/payment.js · REFUND_DAYS / RETURN_POLICY',
    status: 'confirmed',
    source: '운영자 확정 (26-08-30) — 당사 사유(품절·가격 인상) 취소는 전액 환불 유지',
  },
  {
    id: 'maintenance-window',
    label: '점검 시간 03:00~03:30 KST',
    where: 'config/maintenance.js',
    status: 'assumed',
    source: '운영자 지정 (쿠팡은 공개 점검 시각을 명시하지 않음)',
    askBroker: null,
  },
  {
    id: 'insurance',
    label: '고액 상품 보험',
    where: '미구현',
    status: 'blocked',
    source: '-',
    risk: '200만원대 상품 분실 시 배송 마진 수십 건이 날아갑니다.',
    askBroker: '보험 가입 가능 여부, 요율, 보상 한도',
  },
  {
    id: 'device-handling',
    label: '전자기기(리튬배터리 내장) 취급',
    where: 'config/eligibility.js · MANUAL_QUOTE_RULES',
    status: 'blocked',
    source: '-',
    risk: '항공사별로 취급 조건이 달라 자동 견적이 불가합니다.',
    askBroker: '휴대폰·노트북 취급 가능 여부, 수량 제한, 별도 요율',
  },
  {
    id: 'min-order',
    label: '최소 주문 금액 — 없음 (폐지)',
    where: 'config/fees.js · ORDER_MIN.goodsKrw = 0',
    status: 'confirmed',
    source: '운영자 확정 (26-08-29) — 진입장벽 제거 우선. 금액을 넣으면 안내·거절이 다시 살아납니다.',
    risk: '소액 주문은 최소 청구 1kg(11,040원) 배송비가 상품가보다 클 수 있으나, 그 금액 자체에 마진이 있어 역마진은 아닙니다.',
  },
]

export const assumptionsByStatus = () => ({
  confirmed: ASSUMPTIONS.filter((a) => a.status === 'confirmed'),
  assumed: ASSUMPTIONS.filter((a) => a.status === 'assumed'),
  blocked: ASSUMPTIONS.filter((a) => a.status === 'blocked'),
})

/** 통관업체에 물어볼 항목만 추립니다. */
export const brokerQuestions = () =>
  ASSUMPTIONS.filter((a) => a.askBroker).map((a) => ({
    id: a.id,
    label: a.label,
    question: a.askBroker,
    risk: a.risk ?? null,
    status: a.status,
  }))

```

### config/manifest.js

```js
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

```

### config/telegram.js

```js
/**
 * 텔레그램 연동 설정 — 물류 파트너·운영자 채널
 *
 * 파트너와의 소통이 텔레그램이므로 봇 하나로 양방향을 잇습니다:
 *   수신: 파트너 방 메시지(입고 무게·현황·배달완료) → 주문 자동 처리
 *   발신: 일괄 발송 시 적하목록 CSV 전송, 운영자 알림
 *
 * 준비 (docs/OPERATIONS.md 텔레그램 절 참조):
 *   1. @BotFather 로 봇 생성 → TELEGRAM_BOT_TOKEN
 *   2. 봇을 파트너 방에 초대, 방 ID 확인 → TELEGRAM_PARTNER_CHAT_ID
 *   3. 웹훅 등록: npm run telegram:webhook (BASE_URL 필요)
 *
 * 토큰이 없으면 연동 전체가 조용히 꺼집니다 — 다른 기능에 영향 없음.
 */

const env = (key) => process.env[key] || ''

export const TELEGRAM = {
  botToken: env('TELEGRAM_BOT_TOKEN'),
  /** 웹훅 위조 방지 — setWebhook 의 secret_token 과 같아야 합니다 */
  webhookSecret: env('TELEGRAM_WEBHOOK_SECRET'),
  /** 물류 파트너 방 — 여기서 온 메시지만 주문 처리로 이어집니다 */
  partnerChatId: env('TELEGRAM_PARTNER_CHAT_ID'),
  /** 운영자 방(선택) — 상태 전이 알림을 받습니다 */
  operatorChatId: env('TELEGRAM_OPERATOR_CHAT_ID'),
}

export const telegramEnabled = () => Boolean(TELEGRAM.botToken)

```

### config/costs.server.js

```js
/**
 * ⚠️ 서버 전용 원가 설정 — 절대 확장프로그램 번들에 포함되면 안 됩니다.
 *
 * 파일명에 `.server` 를 붙인 이유:
 *   lib/extension-entry.js(번들 진입점)가 이 파일을 import 하지 않으면
 *   esbuild 가 번들에 넣지 않습니다. config/shipping.js 에 두었을 때는
 *   그 파일 전체가 번들되면서 `costPerKgUsd:7` 이 확장 파일에 그대로 박혔습니다.
 *   확장은 사용자가 파일을 열어볼 수 있으므로 실질적인 누출이었습니다.
 *
 * 원가가 드러나면 협상력을 잃고, 고객이 마진을 역산할 수 있습니다.
 * npm run check:leak 이 번들 누출을 검사합니다.
 */

/**
 * 업체(물류사) 청구 추가비용의 고객 견적 배수 — 운영자 확정(26.08.29):
 * "다른 추가비용이 있다면 업체 비용보다 20% 인상된 견적으로".
 * 적용 대상: 특이건 할증(전자전자기기 원가 $30/EA → 고객가 $40/EA (운영자 확정 26-08-30, ITEM_SURCHARGES.device)
 * (빈푹 $5→$6 · 박닌/박장/흥옌 $7→$8 · 하이퐁 $17→$20 — 소수점 아래 버림, 운영자 26-09-06), 검사·포장·보관 실비.
 * 관세·VAT 같은 세금은 마진 없이 실비 그대로 전달합니다.
 */
export const COST_MARKUP = 1.2

export const COSTS = {
  /** 물류사 원가 — 1kg당 USD (판매가 $8, 마진 $1/kg — 26-09-04 인하) */
  /**
   * S1 EXPRESS 견적서(26.08.28) 확정: 기본 $6/kg + 유류 임시조정 $1 = $7.
   * 임시조정이라 월별로 변동 가능 — $6 복귀 시 마진 +$1, 인상 시 재검토.
   * FSC·베트남 통관료 포함(ALL IN), 부피중량 ÷6000, 하노이 현지운송 $0.
   */
  shippingPerKgUsd: 7,

  /** 합배송 재포장 원가 (USD) — 아직 미확인 */
  consolidationHandlingUsd: 0,

  /** 상품 할증 원가 (USD) — 업체 확인 전까지 0 */
  surcharge: { fragile: 0, bulky: 0 },

  /**
   * 지역 할증 원가 (USD) — S1 EXPRESS 견적서 26.08.28 베트남 현지운송비.
   * 고객가는 config/shipping.js zones (원가 × COST_MARKUP, 소수점 버림). 키는 zones 와 같아야 합니다.
   */
  zoneUsd: { hanoi: 0, vinhphuc: 5, bacninh: 7, bacgiang: 7, hungyen: 7, haiduong: 17, haiphong: 17 },

  /** 결제대행(PG) 실비율 — 고객 청구율과 다를 수 있습니다 */
  paymentRate: 0.029,
}

```

### lib/order/states.js

```js
/**
 * 주문 상태 머신 (선결제 후 정산)
 *
 *   REQUESTED ─▶ AWAITING_PAYMENT ─▶ PAID ─▶ PURCHASING ─▶ PURCHASED
 *                                                              │
 *        DELIVERED ◀─ SHIPPED ◀─ SETTLED ◀─ SETTLEMENT_DUE ◀─ IN_WAREHOUSE
 *                                    ▲                            │
 *                                    └──── 차액이 허용오차 이내 ────┘
 *
 * 각 상태가 두 거래 중 어느 쪽에 속하는지(track)를 함께 표시합니다.
 * 고객 화면과 운영자 화면이 서로 다른 track 을 봐야 하기 때문입니다.
 */

export const ORDER_STATES = {
  REQUESTED: {
    label: '주문 접수',
    track: 'customer',
    description: '주문이 접수되었습니다. 청구서를 발행합니다.',
  },
  AWAITING_PAYMENT: {
    label: '입금 대기',
    track: 'customer',
    description: '안내된 계좌로 입금해 주세요. 입금 확인 후 매입을 시작합니다.',
  },
  PAID: {
    label: '결제 완료',
    track: 'customer',
    description: '입금이 확인되었습니다. 곧 한국에서 상품을 구매합니다.',
  },
  PURCHASING: {
    label: '한국 구매 중',
    track: 'procurement',
    description: '고객님을 대신해 쿠팡에서 상품을 구매하고 있습니다.',
  },
  PURCHASED: {
    label: '구매 완료',
    track: 'procurement',
    description: '구매가 완료되어 한국 물류창고로 배송 중입니다.',
  },
  IN_WAREHOUSE: {
    label: '창고 입고·실측',
    track: 'procurement',
    description: '한국 창고에 입고되어 실제 무게를 측정했습니다.',
  },
  SETTLEMENT_DUE: {
    label: '차액 정산 대기',
    track: 'customer',
    description: '실측 무게에 따른 차액을 정산합니다.',
  },
  SETTLED: {
    label: '정산 완료',
    track: 'customer',
    description: '최종 금액이 확정되었습니다.',
  },
  SHIPPED: {
    label: '국제배송 중',
    track: 'procurement',
    description: '하노이로 발송되었습니다.',
  },
  DELIVERED: {
    label: '배송 완료',
    track: 'procurement',
    description: '배송이 완료되었습니다.',
  },
  CANCELLED: {
    label: '취소',
    track: 'customer',
    description: '주문이 취소되었습니다.',
  },
}

/** 허용된 상태 전이 */
export const TRANSITIONS = {
  REQUESTED: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  // 매입 전까지는 전액 환불 취소가 가능합니다.
  PAID: ['PURCHASING', 'CANCELLED'],
  // 매입을 시작한 뒤에는 쿠팡 반품 절차가 필요하므로 자동 취소를 막습니다.
  PURCHASING: ['PURCHASED'],
  PURCHASED: ['IN_WAREHOUSE'],
  // 실측 결과에 따라 정산이 필요하면 SETTLEMENT_DUE, 아니면 바로 SETTLED
  IN_WAREHOUSE: ['SETTLEMENT_DUE', 'SETTLED'],
  SETTLEMENT_DUE: ['SETTLED'],
  SETTLED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

/** 고객이 결제해야 하는 상태 */
export const PAYABLE_STATES = ['AWAITING_PAYMENT', 'SETTLEMENT_DUE']

/** 더 이상 변하지 않는 상태 */
export const TERMINAL_STATES = ['DELIVERED', 'CANCELLED']

export class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`'${ORDER_STATES[from]?.label ?? from}' 상태에서 '${ORDER_STATES[to]?.label ?? to}' (으)로 변경할 수 없습니다.`)
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to))
}

export function assertTransition(from, to) {
  if (!ORDER_STATES[to]) throw new Error(`알 수 없는 상태입니다: ${to}`)
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

/** 진행률 (고객 화면 표시용) — 취소는 제외 */
const PROGRESS_ORDER = [
  'REQUESTED', 'AWAITING_PAYMENT', 'PAID', 'PURCHASING', 'PURCHASED',
  'IN_WAREHOUSE', 'SETTLEMENT_DUE', 'SETTLED', 'SHIPPED', 'DELIVERED',
]

export function progressOf(state) {
  const i = PROGRESS_ORDER.indexOf(state)
  if (i < 0) return 0
  return Math.round(((i + 1) / PROGRESS_ORDER.length) * 100)
}

export { PROGRESS_ORDER }

```

### lib/pricing/shipping.js

```js
/**
 * 국제배송비 계산 — "1kg당 $8 × 청구무게"
 *
 * 청구무게(billable weight) 산정 — 운영자 확정(26.08.29, 업체와 동일 기준)
 *   1. 청구 대상 무게 = max(실무게, 부피무게)
 *   2. 최소 청구무게 1kg
 *   3. 정수 kg 청구: 소수 0.5 이하 버림·초과 올림 — 1.5→1kg, 1.6→2kg
 *
 * 요율은 USD 기준이고 내부 원장은 KRW 이므로 두 통화를 함께 반환합니다.
 */

import { SHIPPING } from '../../config/shipping.js'
import { FX } from '../../config/fx.js'

export const usdToKrw = (usd) => Math.round((Number(usd) || 0) * FX.usdToKrw)

/**
 * 청구무게 산정 — 정수 kg, 소수 0.5 이하 버림 / 초과 올림 (업체와 동일).
 * g 정수 연산이라 부동소수 오차가 없습니다.
 *   999g→1 · 1500g→1 · 1501g→2 · 2500g→2 · 2501g→3
 */
export function toBillableKg(chargeableG) {
  const g = Math.max(Math.round(Number(chargeableG) || 0), 0)
  const wholeKg = Math.floor(g / 1000)
  const fractionG = g - wholeKg * 1000
  const billable = fractionG <= 500 ? wholeKg : wholeKg + 1
  return Math.max(billable, SHIPPING.minBillableKg)
}

/** 청구무게 규칙을 사람이 읽는 문장으로 (UI 표시용) */
export function roundingRuleText() {
  return `${SHIPPING.minBillableKg}kg까지 기본요금 · 이후 kg 단위 (0.5 이하 버림·초과 올림)`
}

/**
 * 배송비를 계산합니다.
 *
 * @param {number} chargeableG 청구 대상 무게(g)
 * @param {{zone?:string, extraUsd?:number}} options extraUsd 는 합배송 취급비 등
 */
export function calculateShipping(chargeableG, options = {}) {
  const { zone = SHIPPING.defaultZone, extraUsd = 0 } = options

  const billableKg = toBillableKg(chargeableG)
  const ratePerKgUsd = SHIPPING.ratePerKgUsd
  const freightUsd = Math.round(billableKg * ratePerKgUsd * 100) / 100

  const zoneInfo = SHIPPING.zones[zone] ?? SHIPPING.zones[SHIPPING.defaultZone]
  const zoneSurchargeUsd = zoneInfo.surchargeUsd
  const extra = Math.round((Number(extraUsd) || 0) * 100) / 100

  const totalUsd = Math.round((freightUsd + zoneSurchargeUsd + extra) * 100) / 100

  // 같은 배송비로 더 담을 수 있는 여유(g).
  // 청구 kg 는 소수 0.5 까지 버림이므로 (청구무게 + 0.5kg) 직전까지 요금이 같습니다.
  // 부피무게가 지배하는 상품은 실제 여유가 이보다 클 수 있어 보수적 하한입니다.
  const headroomG = Math.max(
    Math.round(billableKg * 1000 + 500 - Math.max(Number(chargeableG) || 0, 0)),
    0
  )

  return {
    billableKg,
    headroomG,
    ratePerKgUsd,
    freightUsd,
    zone,
    zoneLabel: zoneInfo.label,
    zoneSurchargeUsd,
    extraUsd: extra,
    totalUsd,

    // 내부 원장·세금 계산용 원화 환산
    freightKrw: usdToKrw(freightUsd),
    zoneSurchargeKrw: usdToKrw(zoneSurchargeUsd),
    extraKrw: usdToKrw(extra),
    totalKrw: usdToKrw(totalUsd),

    exceedsMaxParcel: billableKg > SHIPPING.maxParcelKg,
    leadTimeDays: SHIPPING.leadTimeDays,
  }
}

/** 요금 안내용 예시표 */
export function getRateTable() {
  return [1, 2, 3, 5, 10, 20].map((kg) => ({
    kg,
    usd: Math.round(kg * SHIPPING.ratePerKgUsd * 100) / 100,
    krw: usdToKrw(kg * SHIPPING.ratePerKgUsd),
  }))
}

```

### lib/pricing/surcharges.js

```js
/**
 * 상품 할증 판정
 *
 * "배송 불가"(eligibility)까지는 아니지만 추가 취급비가 붙는 품목을 찾습니다.
 *   fragile — 도자기·유리 식기 등 (키워드, 개당)
 *   bulky   — 한 품목 청구무게 10kg 이상 (무게 엔진 결과, 건당)
 *
 * 일반 화장품 유리용기(크림 단지·세럼 스포이드)는 업계 표준 포장이라
 * 할증하지 않습니다 — 가장 흔한 품목에 $2 씩 붙이면 견적만 부풀립니다.
 */

import { ITEM_SURCHARGES } from '../../config/shipping.js'
import { usdToKrw } from './shipping.js'

const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, '')
const round2 = (n) => Math.round(n * 100) / 100

/**
 * 액세서리 값의 상한 — 이 값을 넘으면 본체로 봅니다.
 * 케이스·필터·먼지통 같은 소모품은 몇 만원, 기기 본체는 수십만~수백만 원이라
 * 자릿수가 다릅니다.
 */
const ACCESSORY_MAX_KRW = 100_000

/** 구성품·증정을 알리는 표기 — 이 뒤에 나오는 액세서리는 '딸려 오는 것'입니다 */
const BUNDLE_MARK = /[+(\[/]|증정|포함|구성|사은품|세트/

/**
 * exclude(액세서리 오탐 방지)를 이 상품에 적용할 것인가.
 *
 * exclude 는 '휴대폰 케이스'처럼 **액세서리가 주 상품**일 때 기기 할증을
 * 빼려고 만든 목록입니다. 그런데 제목 전체에서 찾다 보니 실제 쿠팡 제목에
 * 흔한 구성품·규격 표기에도 걸렸습니다:
 *   '아이폰 15 프로 자급제 + 정품 케이스 증정'  → '케이스' 때문에 할증이 사라짐
 *   '다이슨 V15 무선청소기 0.77L 먼지통'        → '먼지통' 때문에 할증이 사라짐
 * 기기 1대당 $40(≈55,200원)을 못 받으면서 원가 $30 은 그대로 나갑니다.
 * 실제 쿠팡 제목 7종이 전부 이 함정에 걸렸습니다.
 *
 * 판정은 **값**으로 합니다. 제목만으로는 '휴대폰 케이스'와
 * '휴대폰(케이스 증정)'을 가르기 어렵지만 값은 자릿수가 다릅니다.
 * 값을 모를 때(요금 계산기처럼 가격 없이 부르는 경우)는 구성품 표기로 판단합니다.
 */
function accessoryIsMainProduct({ price, haystack, excludeAt }) {
  if (price > 0) return price <= ACCESSORY_MAX_KRW
  // 값을 모를 때: 구성품·증정 표기 뒤에 나오면 딸려 오는 것으로 봅니다.
  const before = haystack.slice(0, excludeAt)
  return !BUNDLE_MARK.test(before)
}

/**
 * @param {Array<{productName:string, categoryPath?:string, quantity?:number}>} items
 * @param {Array<{chargeableG:number}>} weightLines estimateShipmentWeight().lines (items 와 같은 순서)
 */
export function detectItemSurcharges(items = [], weightLines = []) {
  const hits = []

  items.forEach((item, i) => {
    const haystack = norm(`${item.productName || ''} ${item.categoryPath || ''}`)
    const qty = Math.max(1, Number(item.quantity) || 1)

    // 키워드 기반 할증(전자기기·파손주의 …)을 일괄 판정합니다.
    // exclude 는 액세서리 오탐 방지 — '휴대폰 케이스'에 기기 할증이 붙으면 안 됩니다.
    for (const [id, rule] of Object.entries(ITEM_SURCHARGES)) {
      if (!Array.isArray(rule?.keywords)) continue
      const excludeHit = rule.exclude?.find((kw) => haystack.includes(norm(kw)))
      if (excludeHit && accessoryIsMainProduct({
        price: Math.max(0, Number(item.productPrice) || 0),
        haystack,
        excludeAt: haystack.indexOf(norm(excludeHit)),
      })) continue
      const hit = rule.keywords.find((kw) => haystack.includes(norm(kw)))
      if (!hit) continue
      hits.push({
        id,
        label: rule.label,
        usd: round2(rule.usd * (rule.perUnit ? qty : 1)),
        count: rule.perUnit ? qty : 1,
        productName: item.productName,
        matchedKeyword: hit,
      })
    }

    const bulky = ITEM_SURCHARGES.bulky
    const perItemKg = (weightLines[i]?.chargeableG ?? 0) / 1000
    if (bulky && perItemKg >= bulky.thresholdKg) {
      hits.push({
        id: 'bulky',
        label: bulky.label,
        usd: bulky.usd,
        count: 1,
        productName: item.productName,
        matchedKeyword: `${perItemKg.toFixed(1)}kg`,
      })
    }
  })

  // 유형별 합산 (견적 명세에는 유형당 한 줄)
  const byId = {}
  for (const h of hits) {
    byId[h.id] ??= { id: h.id, label: h.label, usd: 0, count: 0, items: [] }
    byId[h.id].usd = round2(byId[h.id].usd + h.usd)
    byId[h.id].count += h.count
    byId[h.id].items.push(h.productName)
  }
  const rows = Object.values(byId).map((r) => ({ ...r, krw: usdToKrw(r.usd) }))

  return {
    rows,
    hits,
    totalUsd: round2(rows.reduce((s, r) => s + r.usd, 0)),
    totalKrw: rows.reduce((s, r) => s + r.krw, 0),
  }
}

```

### lib/pricing/domestic.js

```js
/**
 * 국내 배송비 (쿠팡 판매자 → 한국 창고)
 *
 * 왜 걷는가
 *   구매대행은 **저희가 쿠팡에 결제**합니다. 마켓플레이스 상품에는 국내
 *   배송비가 따로 붙는데(예: 3,000원), 지금까지 견적에 넣지 않아 주문마다
 *   그만큼이 빠졌습니다 (26-09-06 사장님 화면: 카라티 배송비 3,000원).
 *   배송만(배송대행)에는 걷지 않습니다 — 고객이 쿠팡에 직접 내니까요.
 *
 * 규정 (운영자 확정 26-09-06)
 *   ① 구매대행에서만 청구한다.
 *   ② **판매자마다 한 번**만 붙는다. 같은 판매자 상품을 여러 개 담아도
 *      배송비는 한 번입니다 — 개수만큼 곱하면 과다청구입니다.
 *   ③ "같은 판매자 상품 N원 이상 무료" 조건은 **그 판매자 상품 합계**로
 *      판정한다. 조건을 넘으면 0원.
 *   ④ 화면에서 못 읽었으면 **청구하지 않는다.** 모르면 안 받습니다 —
 *      우리가 조금 손해 보는 쪽이, 고객이 모르는 돈을 내는 쪽보다 낫습니다.
 *   ⑤ 판매자를 모르면 그 줄은 따로 센다 (묶어서 깎아주면 우리 손해).
 *
 * 값의 출처는 쿠팡 화면입니다. 확장이 상품 화면에서 읽어 상품 정보에
 * 실어 보내고(domesticShipKrw · freeShipOverKrw · seller), 서버는 그 값으로
 * 같은 계산을 합니다 — 패널 금액과 신청서 금액이 어긋나지 않게.
 */

import { FEES } from '../../config/fees.js'

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const money = (v) => Math.max(0, Math.min(num(v), FEES.domesticShip.maxKrw))

/**
 * @param {Array<{productPrice:number, quantity:number, domesticShipKrw?:number,
 *                freeShipOverKrw?:number, seller?:string}>} items
 * @param {string} track
 * @returns {{krw:number, rows:Array, waived:Array, known:boolean}}
 */
export function domesticShipping(items = [], track = 'forwarding') {
  const empty = { krw: 0, rows: [], waived: [], known: false }
  if (FEES.domesticShip.agentOnly && track !== 'agent') return empty

  // 판매자별로 묶습니다 — 무료 조건도, 청구도 판매자 단위입니다.
  const groups = new Map()
  items.forEach((it, idx) => {
    const seller = String(it?.seller ?? '').trim()
    // 판매자를 모르면 이 줄만의 묶음 — 남의 배송비를 깎아주지 않도록.
    const key = seller || `#${idx}`
    const g = groups.get(key) ?? { seller, feeKrw: 0, goodsKrw: 0, freeOverKrw: null }
    g.goodsKrw += Math.max(0, num(it?.productPrice)) * Math.max(1, num(it?.quantity) || 1)
    const fee = money(it?.domesticShipKrw)
    // 같은 판매자 줄마다 값이 다르면 큰 쪽 — 실제 청구서가 그렇습니다.
    if (fee > g.feeKrw) g.feeKrw = fee
    const over = money(it?.freeShipOverKrw)
    if (over > 0) g.freeOverKrw = g.freeOverKrw === null ? over : Math.min(g.freeOverKrw, over)
    groups.set(key, g)
  })

  const rows = []
  const waived = []
  for (const g of groups.values()) {
    if (g.feeKrw <= 0) continue // 무료배송이거나 못 읽은 줄 — 청구하지 않습니다
    if (g.freeOverKrw !== null && g.goodsKrw >= g.freeOverKrw) {
      waived.push({ seller: g.seller, freeOverKrw: g.freeOverKrw, goodsKrw: g.goodsKrw, feeKrw: g.feeKrw })
      continue
    }
    rows.push({ seller: g.seller, krw: g.feeKrw })
  }
  return {
    krw: rows.reduce((s, r) => s + r.krw, 0),
    rows,
    waived,
    /** 화면에서 배송비를 하나라도 읽었는가 — 못 읽었으면 견적에 "0원"이 아니라 "모름"입니다 */
    known: rows.length > 0 || waived.length > 0,
  }
}

```

### lib/pricing/duty.js

```js
/**
 * 품목군별 관세율 판별
 *
 * "세금이 더 붙는 품목"(신발 30%, 가방 25%, 의류·화장품 20% …)을
 * 단일 세율로 뭉뚱그리지 않고 품목별로 계산합니다.
 *
 * 판별에 실패하면 기본 세율을 쓰고 confidence 를 낮게 표시합니다.
 * 어차피 최종 금액은 실납부 관세로 정산되므로, 추정임을 드러내는 것이 중요합니다.
 */

import { DUTY_CATEGORIES, TAXES } from '../../config/taxes.js'
import { SAFE_TERMS } from '../../config/eligibility.js'

const normalize = (t) => String(t || '').toLowerCase().replace(/\s+/g, '')
const stripSafe = (h) => SAFE_TERMS.reduce((acc, t) => acc.split(normalize(t)).join(' '), h)

export const DEFAULT_DUTY = {
  id: 'general',
  label: '일반 품목',
  dutyRate: TAXES.defaultDutyRate,
}

/**
 * 상품의 관세 품목군을 판별합니다.
 * @param {{productName:string, categoryPath?:string}} product
 */
export function classifyDuty(product) {
  // 화장품 판별에는 '세럼' 같은 표현이 필요하므로 SAFE_TERMS 를 지우지 않은
  // 원문도 함께 봅니다. (차단 판정과 달리 오분류의 대가가 작습니다)
  const raw = normalize(`${product?.productName || ''} ${product?.categoryPath || ''}`)
  const stripped = stripSafe(raw)

  for (const cat of DUTY_CATEGORIES) {
    const hit = cat.keywords.find((kw) => raw.includes(normalize(kw)) || stripped.includes(normalize(kw)))
    if (hit) {
      return {
        categoryId: cat.id,
        label: cat.label,
        dutyRate: cat.dutyRate,
        matchedKeyword: hit,
        confidence: 'high',
        aboveDefault: cat.dutyRate > TAXES.defaultDutyRate,
      }
    }
  }

  return {
    categoryId: DEFAULT_DUTY.id,
    label: DEFAULT_DUTY.label,
    dutyRate: DEFAULT_DUTY.dutyRate,
    matchedKeyword: null,
    confidence: 'low',
    aboveDefault: false,
  }
}

/**
 * 장바구니의 품목별 관세를 계산합니다.
 *
 * 국제운임은 세관 관행에 맞춰 가액 비례로 각 품목에 배분한 뒤,
 * 품목별 CIF 에 품목별 관세율을 적용합니다.
 *
 * @param {Array<{productName:string, productPrice:number, quantity:number}>} items
 * @param {number} freightKrw 국제운임 총액 (KRW)
 */
export function calculateItemDuties(items = [], freightKrw = 0) {
  const lines = items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1)
    const value = (Number(item.productPrice) || 0) * qty
    return { item, qty, value, duty: classifyDuty(item) }
  })

  const totalValue = lines.reduce((s, l) => s + l.value, 0)

  const priced = lines.map((l) => {
    // 가액 비례 배분 (총액이 0이면 균등 배분)
    const share = totalValue > 0 ? l.value / totalValue : 1 / Math.max(lines.length, 1)
    const freightShare = Math.round(freightKrw * share)
    const cif = l.value + freightShare
    const duty = Math.round(cif * l.duty.dutyRate)
    return { ...l, freightShare, cif, dutyKrw: duty }
  })

  const dutyTotal = priced.reduce((s, l) => s + l.dutyKrw, 0)
  const cifTotal = priced.reduce((s, l) => s + l.cif, 0)

  // 기본 세율보다 높은 품목이 있으면 UI 에서 사유를 보여줍니다.
  const surcharged = priced
    .filter((l) => l.duty.aboveDefault)
    .map((l) => ({
      productName: l.item.productName,
      label: l.duty.label,
      dutyRate: l.duty.dutyRate,
      extraKrw: Math.round(l.cif * (l.duty.dutyRate - TAXES.defaultDutyRate)),
    }))

  return {
    lines: priced,
    cifTotal,
    dutyTotal,
    surcharged,
    /** 단일 기본세율로 계산했을 때와의 차이 — "추가 비용"의 정체 */
    extraVsDefaultKrw: surcharged.reduce((s, x) => s + x.extraKrw, 0),
  }
}

```

### lib/pricing/landed.js

```js
/**
 * 랜딩코스트(하노이 문 앞까지의 총 비용) 계산 — 두 트랙
 *
 * ┌ 배송대행 (forwarding) ── 고객이 쿠팡에서 직접 결제
 * │   청구액 = 국제배송비 (+ 지역 할증·상품 할증)
 * │   수익: 배송 마진
 * │
 * └ 구매대행 (agent) ── 당사가 대신 결제
 *     청구액 = 상품가 + 국내배송비 + 대행수수료(기본료 + 초과분) + 국제배송비
 *     수익: 대행수수료 + 배송 마진
 *
 * 관세·VAT·결제수수료: 현재 걷지 않습니다 — 개인통관·무증빙 채널이라
 * 수입세 미징수(config/taxes.js `collect:false`), 수금이 계좌이체뿐이라
 * 결제수수료 0(config/fees.js `paymentRate`). 정책이 바뀌면 그 두 값만
 * 되돌리면 아래 계산·표시가 다시 살아납니다.
 */

import { FEES, ORDER_MIN } from '../../config/fees.js'
import { TAXES } from '../../config/taxes.js'
import { FX } from '../../config/fx.js'
import { estimateShipmentWeight } from '../weight/estimate.js'
import { calculateShipping, usdToKrw } from './shipping.js'
import { calculateItemDuties } from './duty.js'
import { detectItemSurcharges } from './surcharges.js'
import { domesticShipping } from './domestic.js'
import { checkCartEligibility } from '../eligibility.js'
import { analyzeSourcing } from '../sourcing.js'

export const TRACK = { FORWARDING: 'forwarding', AGENT: 'agent' }

const round = (n) => Math.round(Number(n) || 0)

export const krwToVnd = (krw) => {
  const raw = krw * FX.krwToVnd * (1 + FX.spread)
  return Math.round(raw / FX.vndRoundTo) * FX.vndRoundTo
}

/**
 * 구매대행 수수료 (배송대행에는 없음)
 *
 * 기본료(config/fees.js · 상품가 10만원·5종류까지) + 10만원 초과분 5% + 5종류 초과
 * 종류당 1,000원. 정률(10%)이 비싼 주문에서 과해지는 문제를 없앴습니다.
 * @param {number} goodsKrw 상품가 합계
 * @param {string} track
 * @param {number} lineCount 상품 종류 수 (수량 아님 — 발주 노동 기준)
 */
export function calculateAgencyFee(goodsKrw, track, lineCount = 1) {
  if (track !== TRACK.AGENT) return { fee: 0, applicable: false, baseKrw: 0, excessKrw: 0, extraItemsKrw: 0 }
  const goods = Math.max(Number(goodsKrw) || 0, 0)
  const lines = Math.max(Number(lineCount) || 1, 1)
  const excessKrw = round(Math.max(goods - FEES.agencyBaseMaxGoodsKrw, 0) * FEES.agencyExcessRate)
  const extraItemsKrw = Math.max(lines - FEES.agencyBaseMaxItems, 0) * FEES.agencyPerExtraItemKrw
  return {
    fee: FEES.agencyBaseKrw + excessKrw + extraItemsKrw,
    baseKrw: FEES.agencyBaseKrw,
    excessKrw,
    extraItemsKrw,
    applicable: true,
  }
}

/**
 * 베트남 수입 세금.
 * 관세는 품목군별 세율로 계산하고, VAT 는 (CIF + 관세) 에 부과합니다.
 */
export function calculateTaxes(items, freightKrw) {
  const duties = calculateItemDuties(items, freightKrw)
  const cif = duties.cifTotal

  // 운영 정책: 개인통관·무증빙 — 관세·VAT 를 걷지 않습니다 (config/taxes.js).
  // surcharged 도 비워 "세금이 더 붙는 품목" 안내까지 함께 사라집니다.
  if (!TAXES.collect) {
    return { cif, duty: 0, vat: 0, total: 0, exempt: true, vatRate: 0, duties, extraDutyKrw: 0, surcharged: [] }
  }

  if (TAXES.deMinimisVnd > 0 && krwToVnd(cif) < TAXES.deMinimisVnd) {
    return { cif, duty: 0, vat: 0, total: 0, exempt: true, duties }
  }

  const duty = duties.dutyTotal
  const vat = round((cif + duty) * TAXES.vatRate)

  return {
    cif,
    duty,
    vat,
    total: duty + vat,
    exempt: false,
    vatRate: TAXES.vatRate,
    duties,
    /** 기본세율(10%)보다 더 붙은 금액 — "세금이 더 붙는 품목"의 실제 금액 */
    extraDutyKrw: duties.extraVsDefaultKrw,
    surcharged: duties.surcharged,
  }
}

/**
 * 견적을 계산합니다.
 *
 * @param {Array<{productName:string, productPrice:number, quantity:number}>} items
 * @param {{track?:string, zone?:string, extraUsd?:number}} options
 */
export function quote(items = [], options = {}) {
  const track = options.track === TRACK.AGENT ? TRACK.AGENT : TRACK.FORWARDING
  const normalized = items.map((i) => ({ ...i, quantity: Math.max(1, Number(i.quantity) || 1) }))

  const goods = normalized.reduce((s, i) => s + (Number(i.productPrice) || 0) * i.quantity, 0)

  // 무게를 먼저 계산합니다 — 30kg 상한 차단과 중량물 견적문의 판정에 필요합니다.
  const weight = estimateShipmentWeight(normalized)

  // 배송 불가 품목이 있으면 견적 자체를 내지 않습니다.
  const eligibility = checkCartEligibility(normalized, weight.lines)

  // 해외직구 상품이 섞이면 한국 창고 도착이 늦어져 전체 일정이 달라집니다.
  const sourcing = analyzeSourcing(normalized)
  const shipping = calculateShipping(weight.chargeableG, {
    zone: options.zone,
    extraUsd: options.extraUsd ?? 0,
  })

  // 상품 할증 (파손주의·대형) — 운임의 일부이므로 관세 과세표준(CIF)에도 포함합니다.
  const itemSurcharges = detectItemSurcharges(normalized, weight.lines)
  const freightForTaxKrw = shipping.totalKrw + itemSurcharges.totalKrw

  /**
   * 국내 배송비 — 구매대행에서만. 저희가 쿠팡에 내는 돈이라 견적에 들어갑니다.
   * 판매자마다 한 번, 무료 조건을 넘으면 0원 (규정: lib/pricing/domestic.js).
   * 수수료는 **상품가** 기준이므로 여기에 더하지 않습니다.
   */
  const domestic = domesticShipping(normalized, track)
  const agency = calculateAgencyFee(goods, track, normalized.length)
  const taxes = calculateTaxes(normalized, freightForTaxKrw)

  // 트랙별 청구 항목
  const rows = []
  if (track === TRACK.AGENT) {
    rows.push({ key: 'goods', label: '상품 금액', krw: goods })
    if (domestic.krw > 0) {
      rows.push({
        key: 'domestic',
        label: domestic.rows.length > 1
          ? `국내 배송비 (판매자 ${domestic.rows.length}곳)`
          : '국내 배송비 (쿠팡 → 한국 창고)',
        krw: domestic.krw,
      })
    }
    rows.push({
      key: 'agency',
      // 기본료만이면 '(기본)', 초과분이 붙으면 그 이유가 라벨에 보이게.
      // 금액을 문자열에 박지 않습니다 — 수수료를 바꿨을 때 라벨만 옛 값으로 남습니다.
      label: agency.excessKrw > 0 || agency.extraItemsKrw > 0
        ? `구매대행 수수료 (기본 ${FEES.agencyBaseKrw.toLocaleString('ko-KR')}원 + 초과분)`
        : '구매대행 수수료 (기본)',
      krw: agency.fee,
    })
  }
  rows.push({
    key: 'freight',
    label: `국제배송비 (${shipping.billableKg}kg × $${shipping.ratePerKgUsd}/kg)`,
    krw: shipping.freightKrw,
    usd: shipping.freightUsd,
  })
  if (shipping.zoneSurchargeKrw > 0) {
    rows.push({ key: 'zone', label: `지역 할증 (${shipping.zoneLabel.split(' (')[0]})`, krw: shipping.zoneSurchargeKrw, usd: shipping.zoneSurchargeUsd })
  }
  if (shipping.extraKrw > 0) {
    rows.push({ key: 'extra', label: '합배송 취급비', krw: shipping.extraKrw, usd: shipping.extraUsd })
  }
  for (const sc of itemSurcharges.rows) {
    rows.push({
      key: `surcharge-${sc.id}`,
      label: sc.count > 1 ? `${sc.label} (${sc.count}개)` : sc.label,
      krw: sc.krw,
      usd: sc.usd,
    })
  }
  rows.push({ key: 'duty', label: '수입관세 (품목별)', krw: taxes.duty })
  rows.push({ key: 'vat', label: `베트남 VAT (${Math.round(TAXES.vatRate * 100)}%)`, krw: taxes.vat })

  const subtotal = rows.reduce((s, r) => s + r.krw, 0)
  const paymentFee = round(subtotal * FEES.paymentRate)
  if (paymentFee > 0) rows.push({ key: 'payment', label: '결제 수수료', krw: paymentFee })

  const total = subtotal + paymentFee

  // 실측 정산 범위
  const tolerance = weight.confidence.tolerance
  const rangeAt = (g) => {
    const sh = calculateShipping(g, { zone: options.zone, extraUsd: options.extraUsd ?? 0 })
    const tx = calculateTaxes(normalized, sh.totalKrw + itemSurcharges.totalKrw)
    const base =
      (track === TRACK.AGENT ? goods + domestic.krw + agency.fee : 0) + sh.totalKrw + itemSurcharges.totalKrw + tx.total
    return base + round(base * FEES.paymentRate)
  }

  return {
    track,
    eligibility,
    itemCount: normalized.reduce((s, i) => s + i.quantity, 0),
    weight,
    shipping,
    sourcing,
    itemSurcharges,
    agency,
    /** 국내 배송비 — 청구액·무료로 깎인 내역 (화면이 이유를 말할 수 있게) */
    domestic,
    taxes,
    breakdown: rows.filter((r) => r.krw > 0),

    /** 상품가 — 배송대행에서는 청구하지 않지만 과세표준에 포함됩니다 */
    goods,
    goodsChargedToCustomer: track === TRACK.AGENT,

    /**
     * 최소 주문 금액 판정 — 이 견적에 담긴 상품가 기준.
     * 장바구니 전체 판정은 서버(POST /api/orders)가 최종으로 합니다.
     */
    /** 구매대행 1회 접수 한도 — 카드·신청서가 미리 경고하고 서버가 최종 거절 */
    agentLimit: track === TRACK.AGENT
      ? {
          maxGoodsKrw: FEES.agentMaxGoodsKrw,
          exceeded: FEES.agentMaxGoodsKrw > 0 && goods > FEES.agentMaxGoodsKrw,
        }
      : null,

    minOrder: {
      goodsKrw: ORDER_MIN.goodsKrw,
      met: ORDER_MIN.goodsKrw <= 0 || goods >= ORDER_MIN.goodsKrw,
      shortfallKrw: Math.max(ORDER_MIN.goodsKrw - goods, 0),
    },

    subtotal,
    paymentFee,
    total,
    totalVnd: krwToVnd(total),
    totalUsd: Math.round((total / FX.usdToKrw) * 100) / 100,

    range: { low: rangeAt(weight.chargeableG * (1 - tolerance)), high: rangeAt(weight.chargeableG * (1 + tolerance)) },
  }
}

```

### lib/eligibility.js

```js
/**
 * 배송 가능 여부 판정
 *
 * 확장프로그램이 쿠팡 상품 페이지에서 이 판정을 먼저 보여줍니다.
 * "결제한 뒤 창고에서 반송"이 가장 큰 손실이므로,
 * 주문 전에 걸러내는 것이 이 서비스의 핵심 가치입니다.
 */

import { BLOCK_RULES, WARN_RULES, CAUTION_RULES, DESTINATION, SAFE_TERMS, MANUAL_QUOTE_RULES, CONTEXT_MARKERS } from '../config/eligibility.js'
import { ITEM_SURCHARGES } from '../config/shipping.js'
import { detectSourcing } from './sourcing.js'

const normalize = (text) => String(text || '').toLowerCase().replace(/\s+/g, '')

/**
 * 차단 키워드를 부분 문자열로 포함하는 정상 표현을 먼저 제거합니다.
 * (예: '세럼'을 지워야 '럼'(주류)에 걸리지 않습니다)
 */
const stripSafeTerms = (haystack) =>
  SAFE_TERMS.reduce((acc, term) => acc.split(normalize(term)).join(' '), haystack)

/**
 * 상품이 어떤 문맥에 속하는지 판정합니다.
 * 화장품 문맥이면 축산물·식물 검역 규칙을 적용하지 않습니다.
 * (한국 화장품에는 유제품 이름이 흔합니다 — 자음생크림, 요거트팩, 계란 클렌징폼)
 */
function detectContexts(haystack) {
  const found = new Set()
  for (const [context, markers] of Object.entries(CONTEXT_MARKERS)) {
    if (markers.some((m) => haystack.includes(normalize(m)))) found.add(context)
  }
  /**
   * 상온 가공식품 문맥 — 통조림 햄·육포·분유처럼 **냉기가 필요 없는** 식품입니다.
   *
   * 쿠팡 카테고리는 「식품 > … > 돼지고기 양념/가공 > 햄통조림」처럼 원재료로
   * 갈래를 나눕니다. 그 '돼지고기' 때문에 상온 통조림이 통째로 막혔습니다
   * (운영자 확인 26-09-06). 상온이면 보낼 수 있으므로, 이 문맥에서는
   * 축산물 검역 규칙을 적용하지 않습니다. 냉장·냉동은 별도 규칙이 그대로 막습니다.
   */
  if (CAUTION_RULES.filter((r) => r.context === 'shelfStable').some((r) => r.keywords.some((kw) => haystack.includes(normalize(kw))))) {
    found.add('shelfStable')
  }
  return found
}

/**
 * 판정 3단계.
 *   BLOCKED      수입 금지 — 아예 받지 않음
 *   MANUAL_QUOTE 배송 가능하나 자동 견적을 내지 않음 — 물류사 견적을 받아 운영자가 입력
 *   OK           자동 견적
 */
export const VERDICT = { OK: 'ok', BLOCKED: 'blocked', MANUAL_QUOTE: 'manual-quote' }

/**
 * 상품 1건의 배송 가능 여부를 판정합니다.
 *
 * @param {{productName:string, categoryPath?:string, price?:number, quantity?:number}} product
 */
export function checkEligibility(product) {
  const haystack = stripSafeTerms(normalize(`${product?.productName || ''} ${product?.categoryPath || ''}`))

  const contexts = detectContexts(haystack)
  const chargeableKg = (Number(product?.chargeableG) || 0) / 1000

  for (const rule of BLOCK_RULES) {
    // 이 규칙이 면제되는 문맥이면 건너뜁니다.
    if (rule.exemptIfContext?.some((c) => contexts.has(c))) continue

    /**
     * 제외어 — 기기 이름이 들어간 소모품을 본체로 오인하지 않게 합니다.
     * ("식기세척기 세제"가 대형 가전으로 차단되던 사고, 26-09-01)
     */
    if (rule.excludeIfAny?.some((kw) => haystack.includes(normalize(kw)))) continue

    // 무게 상한 규칙 — 키워드로 놓친 대형 상품을 추정 무게로 잡습니다.
    if (rule.maxItemKg && chargeableKg > rule.maxItemKg) {
      return {
        verdict: VERDICT.BLOCKED,
        shippable: false,
        autoQuote: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        matchedKeyword: `${chargeableKg.toFixed(1)}kg`,
        warnings: [],
        destination: DESTINATION,
      }
    }

    const hit = rule.keywords.find((kw) => haystack.includes(normalize(kw)))
    if (hit) {
      return {
        verdict: VERDICT.BLOCKED,
        shippable: false,
        autoQuote: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        matchedKeyword: hit,
        warnings: [],
        destination: DESTINATION,
      }
    }
  }

  /**
   * 해외직구(중국 등 타국 발송) 상품 접수 중단 — 운영자 확정 26-08-31.
   * 개인통관으로 수입된 직구 상품을 베트남으로 재발송하는 것은 통관 리스크가
   * 크고 한국 창고 도착 일정도 보장되지 않아, 한국 내 발송 상품만 받습니다.
   * (로켓직구·판매자 해외배송 배지/문구를 확장이 읽어 보내줍니다)
   */
  const sourcing = detectSourcing(product)
  if (sourcing.overseas) {
    return {
      verdict: VERDICT.BLOCKED,
      shippable: false,
      autoQuote: false,
      ruleId: 'overseas-sourced',
      label: '해외직구 상품',
      reason: '중국 등 해외에서 발송되는 직구 상품은 접수하지 않습니다. 한국 내 판매(국내 발송) 상품만 신청할 수 있습니다.',
      matchedKeyword: sourcing.matchedSignal,
      warnings: [],
      destination: DESTINATION,
    }
  }

  const price = Number(product?.price) || 0
  const qty = Math.max(1, Number(product?.quantity) || 1)

  /**
   * 견적 문의 판정 — 차단을 통과한 뒤에만 확인합니다.
   * 수입 금지 품목이 견적 문의로 넘어가면 안 됩니다.
   */
  for (const rule of MANUAL_QUOTE_RULES) {
    let hit = null
    if (rule.keywords) {
      const kw = rule.keywords.find((k) => haystack.includes(normalize(k)))
      if (kw) hit = kw
    }
    if (!hit && rule.thresholdKrw && price * qty >= rule.thresholdKrw) {
      hit = `${(price * qty).toLocaleString('ko-KR')}원`
    }
    if (!hit && rule.thresholdKg && chargeableKg >= rule.thresholdKg) {
      hit = `${chargeableKg.toFixed(1)}kg`
    }
    // 30kg 초과는 차단이 아니라 상담입니다 (운영자 26-09-06)
    if (!hit && rule.maxItemKg && chargeableKg > rule.maxItemKg) {
      hit = `${chargeableKg.toFixed(1)}kg`
    }
    if (hit) {
      return {
        verdict: VERDICT.MANUAL_QUOTE,
        shippable: true,
        autoQuote: false,
        ruleId: rule.id,
        label: rule.label,
        reason: rule.reason,
        notice: rule.notice ?? null,
        matchedKeyword: hit,
        warnings: [],
        destination: DESTINATION,
      }
    }
  }

  const warnings = []

  if (price * qty >= WARN_RULES.highValueKrw) {
    warnings.push({
      id: 'high-value',
      message: `고액 주문은 분실·파손 시 손해가 큽니다. 보험이 없으니 신중히 확인해 주세요.`,
    })
  }
  /**
   * 상온 축산가공식품 — 막지 않고 알리기만 합니다 (운영자 확정 26-09-06).
   * 화장품 문맥은 제외합니다 (우유크림 세안제에 검역 안내가 붙으면 안 됩니다).
   */
  if (!contexts.has('cosmetic')) {
    for (const rule of CAUTION_RULES) {
      if (rule.silent) continue // 문맥 판정에만 쓰는 규칙 — 상온 식품은 모두 가능 (운영자 26-09-06)
      const hit = rule.keywords.find((kw) => haystack.includes(normalize(kw)))
      if (hit) warnings.push({ id: rule.id, message: rule.message })
    }
  }

  if (qty > WARN_RULES.maxSameItemQty) {
    warnings.push({
      id: 'commercial-quantity',
      message: `동일 상품 ${qty}개는 상업적 반입으로 간주되어 통관이 보류될 수 있습니다. ${WARN_RULES.maxSameItemQty}개 이하를 권장합니다.`,
    })
  }

  // 전자·가전 기기 본체 — 자동 견적하되(기기당 $40 취급비는 할증으로 자동 청구)
  // 한국 기기의 베트남 A/S 불가는 반드시 미리 알립니다.
  // 키워드는 할증 규칙(ITEM_SURCHARGES.device)과 공유 — 경고 따로 할증 따로 갈리지 않게.
  const devHay = String(product?.productName || '').toLowerCase().replace(/\s+/g, '')
  const dev = ITEM_SURCHARGES.device
  if (dev?.keywords?.some((w) => devHay.includes(normalize(w))) &&
      !dev?.exclude?.some((w) => devHay.includes(normalize(w)))) {
    warnings.push({
      id: 'device-care',
      message: `전자·가전 기기는 기기당 $${dev.usd} 취급비가 추가되며, 한국 기기는 베트남에서 A/S 가 어렵습니다.`,
    })
  }

  return {
    verdict: VERDICT.OK,
    shippable: true,
    autoQuote: true,
    ruleId: null,
    label: null,
    reason: null,
    matchedKeyword: null,
    warnings,
    destination: DESTINATION,
  }
}

/** 장바구니 전체 판정 — 하나라도 불가면 전체가 불가입니다. */
/**
 * 장바구니 전체 판정.
 *
 * @param {Array} items
 * @param {Array} [weightLines] estimateShipmentWeight().lines — 무게 기반 규칙에 필요합니다.
 *   넘기지 않으면 무게 상한(30kg)·중량물 견적문의 판정이 동작하지 않습니다.
 */
export function checkCartEligibility(items = [], weightLines = []) {
  const results = items.map((item, i) => ({
    item,
    ...checkEligibility({ ...item, chargeableG: weightLines[i]?.chargeableG ?? item.chargeableG }),
  }))
  const blocked = results.filter((r) => !r.shippable)
  const warnings = results.flatMap((r) => r.warnings.map((w) => ({ ...w, productName: r.item.productName })))

  const manualQuote = results.filter((r) => r.verdict === VERDICT.MANUAL_QUOTE)

  return {
    shippable: blocked.length === 0,
    /** 하나라도 견적 문의 대상이면 자동 견적을 내지 않습니다. */
    autoQuote: blocked.length === 0 && manualQuote.length === 0,
    blocked: blocked.map((r) => ({
      productName: r.item.productName,
      label: r.label,
      reason: r.reason,
      ruleId: r.ruleId,
    })),
    manualQuote: manualQuote.map((r) => ({
      productName: r.item.productName,
      label: r.label,
      reason: r.reason,
      notice: r.notice,
      ruleId: r.ruleId,
    })),
    warnings,
    results,
  }
}

```

### lib/weight/estimate.js

```js
/**
 * 무게 산정 엔진
 *
 *   내용물(net) = 용량(ml) × 밀도(g/ml)   ← 상품명 파싱
 *   용기(tare)  = base + ratio × net       ← 용기 종류별 테이블
 *   실무게      = (내용물 + 용기 + 완충재) × 수량
 *   부피무게    = 외박스 부피(cm³) ÷ 6000
 *   청구무게    = max(실무게, 부피무게)
 *
 * 배송 가능 여부(위험물·통관 금지)는 lib/eligibility.js 가 따로 판정합니다.
 * 이 모듈은 무게만 책임집니다.
 *
 * 결과에는 항상 confidence(신뢰도)와 basis(산출 근거)가 함께 담깁니다.
 * 구매대행 특성상 "추정치"임을 고객에게 투명하게 보여줘야 하기 때문입니다.
 */

import { parseProductSpec } from './parse.js'
import { detectForm, formByCategory, tareWeight, boxVolume, CONTAINERS } from './density.js'
import { SHIPPING } from '../../config/shipping.js'

/** 시트마스크 1매 구성 (에센스 + 시트 / 파우치) */
const SHEET = { netG: 20, tareG: 5 }

/** 기획세트 추가 포장 무게 */
const SET_BOX_G = 80

export const CONFIDENCE = {
  high: { level: 'high', label: '정확', tolerance: 0.12, description: '상품명에서 용량/중량을 확인했습니다.' },
  medium: { level: 'medium', label: '보통', tolerance: 0.25, description: '제형은 확인했으나 용량 표기가 없어 평균값을 적용했습니다.' },
  low: { level: 'low', label: '낮음', tolerance: 0.4, description: '용량·제형 정보가 없어 카테고리 기본값을 적용했습니다.' },
}

const round1 = (n) => Math.round(n * 10) / 10

/**
 * 상품 1건(구성 수량 포함)의 무게를 추정합니다.
 *
 * @param {{productName:string, categoryName?:string}} product
 * @param {number} quantity 주문 수량 (기본 1)
 */
export function estimateItemWeight(product, quantity = 1) {
  const productName = product?.productName || ''
  const nameSpec = parseProductSpec(productName)

  /**
   * 상세페이지 고시정보(내용물의 용량 또는 중량)가 있으면 그쪽이 정확합니다.
   * 용량·중량·매수만 덮어쓰고, 구성 수량(1+1, 5개입)은 상품명 쪽을 유지합니다.
   * (고시정보에는 보통 총량만 적혀 있어 수량 정보가 없습니다)
   */
  const override = product?.specOverride ? parseProductSpec(String(product.specOverride)) : null

  /**
   * 고시정보에 수량 표기가 함께 있으면(예: "600g (120g x 5)", "23ml x 10매")
   * 그 용량·중량은 이미 **총량**입니다. 여기에 상품명의 구성 수량("5개입")을
   * 다시 곱하면 5배로 부풀려집니다. 그래서 그 경우 구성 수량을 1로 둡니다.
   */
  const overrideIsTotal = Boolean(override && (override.count > 1 || override.sheets !== null))

  let spec = override
    ? {
        ...nameSpec,
        volumeMl: override.volumeMl ?? nameSpec.volumeMl,
        massG: override.massG ?? nameSpec.massG,
        sheets: override.sheets ?? nameSpec.sheets,
        count: overrideIsTotal ? 1 : nameSpec.count,
      }
    : nameSpec
  /**
   * 제형은 상품명으로 먼저 판별합니다 — 카테고리명을 함께 넣으면
   * "스킨케어" 의 '스킨' 이 토너로, "아이스크림" 의 '크림' 이 유리단지로
   * 잡히는 등 카테고리가 상품을 덮어씁니다. 못 찾을 때만 카테고리로 보완.
   */
  let detected = detectForm(productName)
  if (detected.form.id === 'unknown' && product?.categoryName) {
    // 카테고리 매핑이 먼저입니다 — 카테고리명을 상품명에 합쳐 키워드로 찾으면
    // "스킨케어"의 '스킨'이 토너로, "아이스크림"의 '크림'이 유리단지로 잡힙니다.
    const byCat = formByCategory(product.categoryName)
    detected = byCat
      ? { form: byCat, matchedKeyword: `카테고리:${product.categoryName}` }
      : detectForm(`${productName} ${product.categoryName}`)
  }
  const { form, matchedKeyword } = detected

  /**
   * 포·정 수와 함께 적힌 소용량(≤50g/ml)은 낱개 한 포의 양입니다.
   * 큰 값(예: "홍삼정 300g 30포")은 총량 표기이므로 곱하지 않습니다.
   */
  if (form.ignoreVolume) spec = { ...spec, volumeMl: null }

  const unitSpecG = spec.massG !== null && spec.massG <= 50
    ? spec.massG
    : spec.volumeMl !== null && spec.volumeMl <= 50
      ? spec.volumeMl * form.density
      : null

  const basis = []
  let netG
  let nominalMl
  let tareG
  let containerId = form.container
  let confidence

  if (form.perSheetTotalG || form.id === 'sheet-mask') {
    // 시트마스크: 매수 기준으로 계산
    const sheets = spec.sheets ?? form.defaultSheets ?? 10
    netG = sheets * SHEET.netG
    tareG = sheets * SHEET.tareG
    nominalMl = sheets * SHEET.netG
    confidence = spec.sheets ? CONFIDENCE.high : CONFIDENCE.medium
    basis.push(`${sheets}매 × (에센스 ${SHEET.netG}g + 파우치 ${SHEET.tareG}g)`)
  } else {
    if (form.id === 'stick-food' && !(spec.massG !== null && spec.massG >= 100)) {
      /**
       * 스틱·믹스 식품: "100개입"은 스틱 100개(한 상자)이지 낱개 상품
       * 100개가 아닙니다. 스틱 수 × 개당 무게로 잡고 구성 수량을 1로
       * 접습니다. (커피믹스 100개입이 55kg 로 계산되던 사고 방지)
       */
      const sticks = spec.sachets ?? (spec.count > 1 ? spec.count : 30)
      // "0.9g 100개입" 처럼 낱개 무게가 적혀 있으면 평균값보다 그 값이 정확합니다.
      const perStickG = spec.massG !== null && spec.massG <= 30 ? spec.massG : (form.defaultG ?? 12)
      netG = sticks * perStickG
      nominalMl = netG
      confidence = spec.massG !== null && spec.massG <= 30 ? CONFIDENCE.high : CONFIDENCE.medium
      basis.push(`${sticks}스틱 × ${perStickG}g`)
      spec = { ...spec, count: 1 }
    } else if (form.perPieceG && spec.count >= 6 && spec.massG === null && spec.volumeMl === null) {
      // '12개입' 과자는 낱봉지 12개가 아니라 한 상자 안 낱개 12개입니다.
      netG = spec.count * form.perPieceG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.medium
      basis.push(`${spec.count}개입 × 개당 ${form.perPieceG}g`)
      spec = { ...spec, count: 1 }
    } else if (form.perSheetG && spec.sheets) {
      /**
       * 장(매) 단위로 파는 물건 — 수건 10장, 복사용지 2500매.
       * 시트마스크와 달리 낱장이 그 자체로 상품이라 장당 무게를 곱합니다.
       */
      netG = spec.sheets * form.perSheetG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.high
      basis.push(`${spec.sheets}장 × 장당 ${form.perSheetG}g`)
    } else if ((spec.sachets || spec.tablets || spec.sheets) && unitSpecG !== null) {
      /**
       * "10ml 30포", "2g 60포" — 표기된 용량·중량은 한 포(정)의 것이고
       * 총량이 아닙니다. 곱하지 않으면 30포 홍삼이 10g 이 됩니다.
       */
      const n = spec.sachets ?? spec.tablets ?? spec.sheets
      const unitLabel = spec.sachets ? '포' : spec.tablets ? '정' : '매'
      netG = n * unitSpecG
      nominalMl = netG / form.density
      confidence = CONFIDENCE.high
      basis.push(`${n}${unitLabel} × 단위 ${round1(unitSpecG)}g`)
    } else if (spec.massG !== null && spec.count >= 10 && spec.massG <= 20) {
      /**
       * "0.9g 100개입" 커피 — 낱개가 아주 가벼우면 낱개 상품 100개가 아니라
       * 한 상자입니다. 낱개마다 용기 공차를 더하면 3.7kg 로 부풀어 오릅니다.
       */
      netG = spec.massG * spec.count
      nominalMl = netG / form.density
      confidence = CONFIDENCE.medium
      basis.push(`${spec.count}개입 × 개당 ${round1(spec.massG)}g (한 포장)`)
      spec = { ...spec, count: 1 }
    } else if (spec.massG !== null) {
      netG = spec.massG
      nominalMl = spec.massG / form.density
      confidence = CONFIDENCE.high
      basis.push(`상품명 표기 중량 ${round1(spec.massG)}g`)
    } else if (spec.volumeMl !== null) {
      netG = spec.volumeMl * form.density
      nominalMl = spec.volumeMl
      confidence = CONFIDENCE.high
      basis.push(`${round1(spec.volumeMl)}ml × ${form.label} 밀도 ${form.density}g/ml = ${round1(netG)}g`)
    } else if (spec.tablets) {
      // 알약: 알 수 × 개당 무게 — 병 하나. 구성 수량과 무관합니다.
      // 식기세척기 태블릿처럼 큰 정제는 제형 테이블이 개당 무게를 지정합니다.
      const perTab = form.perTabletG ?? 0.9
      netG = spec.tablets * perTab
      nominalMl = netG / (form.perTabletG ? form.density : 0.6)
      confidence = CONFIDENCE.medium
      basis.push(`${spec.tablets}정 × ${perTab}g`)
    } else if (spec.sachets) {
      // 포(스틱): 포 수 × 8g — 홍삼 스틱·유산균 분말 등.
      netG = spec.sachets * 8
      nominalMl = netG
      confidence = CONFIDENCE.medium
      basis.push(`${spec.sachets}포 × 8g`)
    } else if (form.defaultMl != null) {
      netG = form.defaultMl * form.density
      nominalMl = form.defaultMl
      confidence = form.id === 'unknown' ? CONFIDENCE.low : CONFIDENCE.medium
      basis.push(`용량 미표기 → ${form.label} 평균 ${form.defaultMl}ml 적용`)
    } else {
      netG = form.defaultG ?? 20
      nominalMl = netG / form.density
      confidence = form.id === 'unknown' ? CONFIDENCE.low : CONFIDENCE.medium
      basis.push(`용량 미표기 → ${form.label} 평균 ${round1(netG)}g 적용`)
    }
    containerId = form.largeContainer && netG > (form.largeThresholdG ?? 200)
      ? form.largeContainer
      : form.container
    tareG = tareWeight(containerId, netG)
    basis.push(`${CONTAINERS[containerId].label} 공차 ${round1(tareG)}g`)
  }

  const unitCount = spec.count
  if (unitCount > 1) basis.push(`구성 수량 ${unitCount}개`)

  const setExtraG = spec.isSet ? SET_BOX_G : 0
  if (setExtraG) basis.push(`기획세트 포장 ${SET_BOX_G}g`)

  /**
   * 여러 개 구성(20개입 등)은 하나의 묶음으로 옵니다 — 낱개마다 완충재를
   * 새로 넣지 않으므로 첫 개만 온전히, 나머지는 30%만 가산합니다.
   */
  const packingG = SHIPPING.packingPerItemG * (1 + (unitCount - 1) * 0.3)
  const perOrderG = (netG + tareG) * unitCount + setExtraG + packingG

  /**
   * 부피도 같은 이유로 "박스 기본 부피 1회 + 내용물 부피 × 개수"입니다.
   * 예전에는 박스 전체를 개수만큼 곱해 화장지 30롤이 42kg 로 나왔습니다.
   */
  const box = CONTAINERS[containerId]?.box ?? { base: 110, mlFactor: 2.2 }
  const volumetricCm3 = box.base + box.mlFactor * nominalMl * unitCount + (spec.isSet ? 400 : 0)
  const perOrderVolumetricG = (volumetricCm3 / SHIPPING.volumetricDivisor) * 1000

  const qty = Math.max(1, Number(quantity) || 1)
  const actualG = perOrderG * qty
  const volumetricG = perOrderVolumetricG * qty
  const chargeableG = Math.max(actualG, volumetricG)

  return {
    productName,
    quantity: qty,
    form: { id: form.id, label: form.label, density: form.density, matchedKeyword },
    container: { id: containerId, label: CONTAINERS[containerId]?.label ?? containerId },
    spec,
    netG: round1(netG * unitCount * qty),
    tareG: round1(tareG * unitCount * qty),
    packingG: round1((packingG + setExtraG) * qty),
    actualG: round1(actualG),
    volumetricCm3: Math.round(volumetricCm3 * qty),
    volumetricG: round1(volumetricG),
    chargeableG: round1(chargeableG),
    chargeableBy: actualG >= volumetricG ? 'actual' : 'volumetric',
    confidence,
    basis,
  }
}

/**
 * 장바구니 전체(여러 상품)의 배송 무게를 합산합니다.
 * 박스 무게는 배송 건당 1회만 가산합니다.
 */
export function estimateShipmentWeight(items = []) {
  const lines = items.map((item) => estimateItemWeight(item, item.quantity ?? 1))

  const itemsActualG = lines.reduce((sum, l) => sum + l.actualG, 0)
  const itemsVolumetricG = lines.reduce((sum, l) => sum + l.volumetricG, 0)

  const boxG = lines.length > 0 ? SHIPPING.boxWeightG : 0
  const actualG = itemsActualG + boxG
  const volumetricG = itemsVolumetricG + boxG
  const chargeableG = Math.max(actualG, volumetricG)

  // 신뢰도는 가장 낮은 항목을 따릅니다.
  const rank = { high: 3, medium: 2, low: 1 }
  const confidence = lines.reduce(
    (worst, l) => (rank[l.confidence.level] < rank[worst.level] ? l.confidence : worst),
    CONFIDENCE.high,
  )

  return {
    lines,
    boxG,
    actualG: round1(actualG),
    volumetricG: round1(volumetricG),
    chargeableG: round1(chargeableG),
    chargeableKg: round1(chargeableG / 1000),
    chargeableBy: actualG >= volumetricG ? 'actual' : 'volumetric',
    confidence,
    exceedsMaxParcel: chargeableG / 1000 > SHIPPING.maxParcelKg,
  }
}

```

### lib/weight/density.js

```js
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

```

### lib/order/settlement.js

```js
/**
 * 실측 정산
 *
 * 결제 시점의 무게는 상품명 기반 추정치입니다.
 * 한국 창고에서 실제로 저울에 올린 무게로 배송비와 세금을 다시 계산하고,
 * 최초 청구액과의 차액을 정산합니다.
 *
 *   차액 > 0  → 추가 청구
 *   차액 < 0  → 환불
 *   |차액| < 허용오차 → 정산 생략 (송금 수수료가 차액보다 큰 경우)
 */

import { calculateShipping } from '../pricing/shipping.js'
import { FX } from '../../config/fx.js'
import { calculateTaxes } from '../pricing/landed.js'
import { FEES } from '../../config/fees.js'
import { SETTLEMENT_RULES } from '../../config/payment.js'

const round = (n) => Math.round(Number(n) || 0)

/**
 * 실측 무게로 최종 금액을 재계산합니다.
 *
 * @param {object} order 주문 (quote 스냅샷 포함)
 * @param {number} actualWeightG 창고 실측 무게(g)
 */
export function recalculateWithActualWeight(order, actualWeightG) {
  const q = order.quote

  /**
   * 주문에 동결된 USD 환율로 재계산합니다.
   * 라이브 환율을 쓰면 주문 시점과 정산 시점 사이에 환율이 바뀌었을 때
   * 무게가 같아도 차액이 생기는, 고객이 이해할 수 없는 정산이 발생합니다.
   */
  const liveFx = FX.usdToKrw
  if (Number.isFinite(order.fx?.usdToKrw) && order.fx.usdToKrw > 0) {
    FX.usdToKrw = order.fx.usdToKrw
  }
  try {
    return recalcInner(order, q, actualWeightG)
  } finally {
    FX.usdToKrw = liveFx
  }
}

function recalcInner(order, q, actualWeightG) {
  const shipping = calculateShipping(actualWeightG, {
    zone: order.zone,
    extraUsd: order.consolidation?.handlingFeeUsd ?? 0,
  })

  // 배송대행은 상품가를 청구하지 않지만 관세 과세표준에는 포함됩니다.
  const chargesGoods = order.track === 'agent'
  const goods = q.goods
  const agencyFee = q.agency.fee
  // 상품 할증은 무게가 아니라 품목 특성이라 실측 후에도 동일하게 유지됩니다.
  const surchargeKrw = q.itemSurcharges?.totalKrw ?? 0
  const taxes = calculateTaxes(order.items, shipping.totalKrw + surchargeKrw)

  const subtotal =
    (chargesGoods ? goods + agencyFee : 0) + shipping.totalKrw + surchargeKrw + taxes.total
  const paymentFee = round(subtotal * FEES.paymentRate)

  return {
    shipping,
    taxes,
    goods,
    agencyFee,
    paymentFee,
    total: subtotal + paymentFee,
  }
}

/**
 * 이 주문의 조정 기준 금액(원) — 차액이 이 금액 이상이면 정산합니다.
 *
 * **기준은 한 곳뿐입니다** (운영자 확정 26-09-04).
 * 예전에는 견적서가 "20,000동 이상이면 조정", 장부는 "3,000~10,000원 이상이면
 * 조정"으로 서로 달라, 같은 주문을 두고 문서는 "조정 대상"이라 적고 장부는
 * 아무것도 하지 않는 일이 생길 수 있었습니다. 이제 견적서(lib/quote-doc.js)와
 * 장부(computeSettlement)가 모두 이 함수를 부릅니다.
 *
 * 무게 추정이 정확할수록(신뢰도 high) 넉넉히 흡수합니다 — 추정이 맞았는데도
 * 반내림 한 칸 때문에 매번 정산 연락을 드리는 것이 서로 손해이기 때문입니다.
 *
 * @param {object} order 주문 (quote.weight.confidence.level 을 봅니다)
 */
export function settlementToleranceKrw(order) {
  const level = order?.quote?.weight?.confidence?.level ?? 'low'
  return SETTLEMENT_RULES.toleranceByConfidence?.[level] ?? SETTLEMENT_RULES.toleranceKrw
}

/**
 * 정산 결과를 산출합니다. (원장에 기록하지는 않습니다)
 *
 * @returns {{action:'additional'|'refund'|'none', diffKrw:number, ...}}
 */
export function computeSettlement(order, actualWeightG) {
  const quoted = order.quote
  const final = recalculateWithActualWeight(order, actualWeightG)

  const diff = final.total - quoted.total
  const abs = Math.abs(diff)

  /**
   * 허용오차 판정 — 견적서와 **같은 기준**을 씁니다.
   *
   * 무게 신뢰도에 따라 흡수 한도가 다릅니다.
   * 고정 3,000원만 쓰면 한 칸 차이(0.5kg × $8 = 5,520원)가 매번 정산으로
   * 이어져 주문 7건 중 1건을 손으로 처리하게 됩니다.
   * 오차가 대칭이라 흡수는 평균적으로 손해가 아닙니다.
   */
  const confidence = quoted.weight?.confidence?.level ?? 'low'
  const toleranceKrw = settlementToleranceKrw(order)

  let action = 'none'
  if (abs >= toleranceKrw) {
    action = diff > 0 ? 'additional' : 'refund'
  }

  // 추가 청구가 지나치게 크면 자동 청구하지 않고 운영자 확인을 거칩니다.
  // (무게 추정이 크게 빗나갔거나 잘못된 상품이 입고된 경우일 수 있습니다)
  const additionalRate = quoted.total > 0 ? diff / quoted.total : 0
  const requiresReview =
    action === 'additional' && additionalRate > SETTLEMENT_RULES.maxAutoAdditionalRate

  const estimatedG = quoted.weight.chargeableG
  const weightErrorRate = estimatedG > 0 ? (actualWeightG - estimatedG) / estimatedG : 0

  return {
    action,
    label: SETTLEMENT_RULES.labels[action === 'none' ? 'none' : action],
    diffKrw: diff,
    absKrw: abs,
    requiresReview,
    additionalRate,

    estimatedWeightG: estimatedG,
    actualWeightG,
    weightErrorRate,

    /** 허용오차 판정 근거 (운영자 화면에 표시) */
    tolerance: {
      confidence,
      toleranceKrw,
      absorbed: action === 'none' && diff !== 0,
    },

    quotedTotalKrw: quoted.total,
    finalTotalKrw: final.total,

    quotedBillableKg: quoted.shipping.billableKg,
    finalBillableKg: final.shipping.billableKg,

    final,
    /** 허용오차 이내라 정산을 생략한 경우, 그 금액은 당사 손익으로 흡수됩니다. */
    absorbedKrw: action === 'none' ? diff : 0,
  }
}

/**
 * 정산 결과를 고객 원장 항목으로 변환합니다.
 * (실제 기록은 store 에서 수행합니다)
 */
export function settlementEntries(settlement, fxRate) {
  if (settlement.action === 'none') return []

  const memo = `실측 ${(settlement.actualWeightG / 1000).toFixed(2)}kg (추정 ${(
    settlement.estimatedWeightG / 1000
  ).toFixed(2)}kg, 오차 ${(settlement.weightErrorRate * 100).toFixed(1)}%)`

  if (settlement.action === 'additional') {
    return [{ type: 'ADDITIONAL_CHARGE', amountKrw: settlement.absKrw, memo, fxRate }]
  }
  // 환불: 잔액을 마이너스로 만든 뒤(CREDIT), 실제 지급 시 REFUND 로 해소합니다.
  return [{ type: 'CREDIT', amountKrw: settlement.absKrw, memo, fxRate }]
}

```

### lib/order/access.js

```js
/**
 * 주문 하나를 누가 볼 수 있나
 *
 * 주문번호는 순번(HN+날짜+0001)이라 누구나 추측할 수 있습니다. 그래서
 * 주문번호만으로는 **진행 상태만** 보이고, 이름·전화·주소·상품·취소는
 *   · owner  — 신청한 브라우저(개인 링크 열쇠가 저장됨) 또는 개인 링크(?k=)로 연 사람
 *   · admin  — 운영자 토큰
 * 에게만 열립니다 (운영자 26-09-06: "로그인이나 링크 없어도 확인이 되네").
 *
 * 열쇠 규칙은 /my 와 같습니다 — 입금 전 열쇠는 그 열쇠로 만든 주문만,
 * 입금 확인된 열쇠는 같은 전화번호의 주문 전부.
 */
import { isAdminRequest } from '../auth.js'
import { findByKey, visibleOrders } from '../customer/store.js'
import { customerView } from './store.js'
import { maskName, maskPhone } from '../mask.js'

const first = (v) => (Array.isArray(v) ? v[0] : v)

/** 요청에 실린 개인 링크 열쇠 — x-my-key 헤더 또는 ?k= */
export function myKeyFrom(req) {
  const v = first(req.headers?.['x-my-key']) || first(req.query?.k) || ''
  return String(v).trim().slice(0, 200)
}

/** 'admin' | 'owner' | 'public' */
export function orderAccess(req, order) {
  if (isAdminRequest(req)) return 'admin'
  const key = myKeyFrom(req)
  if (key) {
    const found = findByKey(key)
    if (found && visibleOrders(found, [order]).length === 1) return 'owner'
  }
  return 'public'
}

/**
 * 값 안의 비밀 문자열을 어디에 있든 가립니다 — 견적(quote) 안의 무게 계산 줄, 판정 근거 등
 * 구조가 깊어서 필드를 하나씩 지우는 방식은 빠뜨립니다 (실제로 두 군데서 상품명이 샜습니다).
 */
function scrub(value, secrets) {
  if (typeof value === 'string') {
    let out = value
    for (const s of secrets) if (s && out.includes(s)) out = out.split(s).join('***')
    return out
  }
  if (Array.isArray(value)) return value.map((x) => scrub(x, secrets))
  if (value && typeof value === 'object') {
    const o = {}
    for (const [k, x] of Object.entries(value)) o[k] = scrub(x, secrets)
    return o
  }
  return value
}

/**
 * 공개 조회용 — 고객 화면과 같은 모양이지만 개인정보·상품명·쇼핑몰 주문번호를 비웁니다.
 * (모양을 유지해야 주문 화면이 그대로 그려집니다)
 */
export function publicView(order) {
  const name = maskName(order.customer?.name)
  const c = order.customer ?? {}
  const secrets = [
    c.name, c.address, c.email, c.messenger, c.phone,
    ...(order.items ?? []).map((it) => it.productName),
  ].map((x) => String(x ?? '').trim()).filter((x) => x.length >= 2)
  const v = scrub(customerView(order), secrets)
  const guide = v.forwardingGuide
  return {
    ...v,
    customer: { name, phone: maskPhone(order.customer?.phone), address: '', email: '', messenger: '' },
    items: (v.items ?? []).map((it, i) => ({
      ...it,
      productName: `상품 ${i + 1}`,
      productUrl: null, url: null, imageUrl: null, image: null,
    })),
    inbound: null,
    // 견적 안의 판정 근거(eligibility.results)에 상품명이 실려 있습니다 — 공개 뷰에서는 뺍니다.
    quote: v.quote ? { ...v.quote, eligibility: null } : v.quote,
    forwardingGuide: guide
      ? { ...guide, addressDetail: String(guide.addressDetail ?? '').replace('***', name), linked: guide.linked }
      : null,
    ledger: { customer: [] },
  }
}

/** 공개 조회에서 막힌 동작에 돌려줄 안내 */
export const OWNER_ONLY_MESSAGE =
  '이 주문을 신청한 브라우저나 「내 주문 링크」에서만 할 수 있습니다. 링크를 잃으셨다면 주문 조회 → 내 주문 전체 보기에서 전화번호로 다시 받으세요.'

```

### lib/peek-jobs.js

```js
/**
 * 「대신 읽기」 작업 줄 — 고객이 넣은 상품 링크를, 진짜 브라우저가 있는 사장님 기기(PC 확장·폰)가
 * 대신 열어 이름·가격·용량을 읽어 오게 하는 창구 (운영자 아이디어 26-09-07: "내 폰이 주소 변환 서버 역할").
 *
 *   고객 화면 → GET /api/product-peek?url=…  → 읽기 기기가 살아 있으면 여기 줄에 넣고 「기다리는 중」
 *   읽기 기기 → GET /api/worker/jobs (운영자 토큰) 로 가져가서 열어 읽고 → POST /api/worker/jobs/:id 로 결과
 *   고객 화면 → GET /api/product-peek?job=… 로 몇 초 동안 물어봄 → 결과가 오면 채움, 늦으면 직접 적기
 *
 * 메모리 안에서만 삽니다(서버 한 대). 작업은 3분이면 지웁니다. 상품 정보 외에 고객 정보는 담지 않습니다.
 */
const state = globalThis.__kbPeekJobs ?? (globalThis.__kbPeekJobs = { jobs: new Map(), lastPollAt: 0, seq: 0 })

const ONLINE_MS = 20_000      // 이 안에 가져간 적이 있으면 「읽기 기기 살아 있음」
const TAKE_TTL_MS = 30_000    // 가져간 뒤 이만큼 결과가 없으면 다른 기기가 다시 가져갈 수 있음
const JOB_TTL_MS = 3 * 60_000

const gc = () => {
  const now = Date.now()
  for (const [id, j] of state.jobs) if (now - j.createdAt > JOB_TTL_MS) state.jobs.delete(id)
}

export const workerOnline = (now = Date.now()) => now - state.lastPollAt < ONLINE_MS

/** 같은 상품(캐시 키)의 진행 중 작업이 있으면 그것을 돌려줍니다 */
export function enqueue({ key, url, productId, itemId = null, vendorItemId = null }) {
  gc()
  for (const j of state.jobs.values()) if (j.key === key && j.status === 'pending') return j
  state.seq += 1
  const job = {
    id: `pj_${Date.now().toString(36)}_${state.seq.toString(36)}`,
    key, url, productId, itemId, vendorItemId,
    status: 'pending', createdAt: Date.now(), takenAt: 0, result: null,
  }
  state.jobs.set(job.id, job)
  return job
}

/** 읽기 기기가 가져갑니다 — 아직 아무도 안 가져갔거나, 가져간 지 오래된 것만 */
export function take({ limit = 3, now = Date.now() } = {}) {
  gc()
  state.lastPollAt = now
  const out = []
  for (const j of state.jobs.values()) {
    if (j.status !== 'pending') continue
    if (j.takenAt && now - j.takenAt < TAKE_TTL_MS) continue
    j.takenAt = now
    out.push({ id: j.id, url: j.url, productId: j.productId })
    if (out.length >= limit) break
  }
  return out
}

export function complete(id, result) {
  const j = state.jobs.get(id)
  if (!j || j.status !== 'pending') return null
  j.status = result?.ok ? 'done' : 'failed'
  j.result = result ?? { ok: false }
  j.doneAt = Date.now()
  return j
}

export const getJob = (id) => state.jobs.get(id) ?? null

export function stats(now = Date.now()) {
  gc()
  let pending = 0
  for (const j of state.jobs.values()) if (j.status === 'pending') pending += 1
  return { online: workerOnline(now), lastPollAt: state.lastPollAt, pending }
}

/** 최근 작업 — 운영자 상태 화면용 (상품 번호·결과만, 고객 정보 없음). 최신순 */
export function recentJobs(limit = 10) {
  gc()
  return [...state.jobs.values()]
    .reverse() // Map 은 넣은 순서를 지킵니다 — 같은 밀리초에 만든 작업도 최신이 앞에
    .slice(0, limit)
    .map((j) => ({
      id: j.id, productId: j.productId, status: j.status, createdAt: j.createdAt, takenAt: j.takenAt || null, doneAt: j.doneAt ?? null,
      productName: j.result?.productName ?? null, productPrice: j.result?.productPrice ?? null,
      options: Array.isArray(j.result?.options) ? j.result.options.length : 0, message: j.result?.message ?? null,
    }))
}

export function _resetJobs() { state.jobs.clear(); state.lastPollAt = 0; state.seq = 0 }

```

### lib/peek-result.js

```js
/**
 * 「대신 읽기」 결과 정리 — 읽기 기기(운영자 확장)가 보낸 값을 고객 화면에 줄 모양으로 다듬습니다.
 *
 * 받는 것은 값뿐입니다(코드 아님). 길이 상한을 두고, 숫자는 검증하고, 옵션은 이 상품의 쇼핑몰 주소로
 * 확인된 것만 url 을 남깁니다 — 고객 화면은 그 url 로 「그 옵션의 가격」을 다시 읽습니다 (lib/peek-jobs.js).
 */
import { parseProductUrl } from './coupang-url.js'

const str = (v, n) => String(v ?? '').slice(0, n)
const digits = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? d.slice(0, 20) : null }
export const MAX_OPTIONS = 60

/** 옵션 목록 정리 — 라벨 80자, 같은 번호는 하나로, url 은 같은 상품의 정식 주소일 때만 */
export function sanitizeOptions(list, { productId = null } = {}) {
  if (!Array.isArray(list)) return []
  const want = productId ? String(productId) : null
  const out = []
  const seen = new Set()
  for (const o of list) {
    if (!o || typeof o !== 'object') continue
    const label = str(o.label, 80).replace(/\s+/g, ' ').trim()
    if (!label) continue
    const itemId = digits(o.itemId)
    const vendorItemId = digits(o.vendorItemId)
    let url = null
    if (o.url) {
      const p = parseProductUrl(String(o.url))
      if (p?.productId && (!want || p.productId === want)) url = p.url
    }
    const key = itemId || vendorItemId ? `${itemId ?? ''}:${vendorItemId ?? ''}` : `l:${label}`
    if (seen.has(key)) continue
    seen.add(key)
    const price = Number(o.price)
    out.push({ label, itemId, vendorItemId, url, price: Number.isFinite(price) && price > 0 ? Math.round(price) : null, selected: Boolean(o.selected) })
    if (out.length >= MAX_OPTIONS) break
  }
  return out
}

/**
 * 읽기 기기가 POST 한 본문 → 고객 화면용 결과.
 * 이름도 가격도 없으면 실패(ok:false)로 — 빈 성공은 고객에게 "읽었다"고 거짓말하는 셈입니다.
 */
export function sanitizeWorkerResult(body, { productId = null } = {}) {
  const b = body && typeof body === 'object' ? body : {}
  const price = Number(b.productPrice)
  if (!(b.ok && (b.productName || price > 0))) {
    // 상품 화면이 아니었지만(브랜드관 등) 화면 속에서 상품 주소를 찾은 경우 — 고객 화면이 그 주소로 다시 읽습니다
    const r = b.redirect ? parseProductUrl(String(b.redirect)) : null
    if (r?.productId) return { ok: false, reason: 'redirect', redirect: r.url, productId: r.productId, message: str(b.message, 200) }
    return { ok: false, message: str(b.message, 200) }
  }
  const productUrl = b.productUrl ? (parseProductUrl(String(b.productUrl))?.url ?? null) : null
  return {
    ok: true,
    productName: str(b.productName, 300),
    productPrice: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
    spec: b.spec ? str(b.spec, 120) : null,
    badges: Array.isArray(b.badges) ? b.badges.slice(0, 12).map((x) => str(x, 40)) : [],
    categoryPath: str(b.categoryPath, 200),
    shippingText: str(b.shippingText, 300),
    blocked: b.blocked ? str(b.blocked, 80) : null,
    productUrl,
    options: sanitizeOptions(b.options, { productId }),
    via: 'worker',
  }
}

```
