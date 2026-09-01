/**
 * 상품명에서 용량·중량·구성 수량을 추출합니다.
 *
 * 쿠팡 상품명에는 규격이 텍스트로만 들어있어(예: "토리든 다이브인 세럼 50ml 2개")
 * 무게 산정을 위해 이 값을 먼저 파싱해야 합니다.
 *
 * 오탐(false positive)이 정확도를 크게 떨어뜨리므로,
 * SPF50 / PA++++ / 21호 / 2025년 같은 "숫자처럼 보이지만 용량이 아닌" 토큰을
 * 파싱 전에 제거합니다.
 */

const FL_OZ_TO_ML = 29.5735

/** 용량으로 오인되기 쉬운 토큰 제거 */
const NOISE_PATTERNS = [
  /SPF\s*\d+\+*/gi, // 자외선차단지수
  /PA\+{1,4}/gi, // PA 등급
  /\d+\s*호\b/g, // 색상 호수 (21호, 23호)
  /\b(19|20)\d{2}\s*년?\b/g, // 연도
  /\b\d+\s*%/g, // 성분 함량 (나이아신아마이드 5%)
  /\d+\s*(?:시간|일|개월|년)\b/g, // 기간
  /\bNo\.?\s*\d+/gi, // 색상 번호
  /#\s*\d+/g, // 색상 해시태그
  /\b\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|CM|MM|센치|센티)?\b/g, // 치수 (40x80, 76x76x5)
]

const stripNoise = (text) =>
  NOISE_PATTERNS.reduce((acc, re) => acc.replace(re, ' '), ` ${text} `)

const num = (raw) => Number.parseFloat(String(raw).replace(/,/g, ''))

/**
 * @param {string} productName 쿠팡 상품명
 * @returns {{volumeMl:number|null, massG:number|null, sheets:number|null,
 *            count:number, isSet:boolean, matches:Array<{type:string,raw:string}>}}
 */
export function parseProductSpec(productName) {
  const matches = []
  if (!productName || typeof productName !== 'string') {
    return { volumeMl: null, massG: null, sheets: null, count: 1, isSet: false, matches }
  }

  const text = stripNoise(productName)

  let volumeMl = null
  let massG = null
  let sheets = null
  let count = 1
  // 표기 중량·용량이 상품명 어디에 있는지 — 구성 수량 판정 기준점
  let specIdx = null

  // 1) 리터 (2L, 1.5리터)
  const litre = text.match(/(\d+(?:[.,]\d+)?)\s*(?:L|리터)(?![a-zA-Z가-힣])/)
  if (litre) {
    volumeMl = num(litre[1]) * 1000
    specIdx = litre.index
    matches.push({ type: 'volume', raw: litre[0].trim() })
  }

  // 2) 밀리리터 (50ml, 100mL, 30cc)
  if (volumeMl === null) {
    const ml = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|mL|ML|㎖|cc|CC|밀리|미리)(?![a-zA-Z가-힣])/)
    if (ml) {
      volumeMl = num(ml[1])
      specIdx = ml.index
      matches.push({ type: 'volume', raw: ml[0].trim() })
    }
  }

  // 3) fl oz (해외직구 표기)
  if (volumeMl === null) {
    const oz = text.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?(?:oz|온스)/i)
    if (oz) {
      volumeMl = num(oz[1]) * FL_OZ_TO_ML
      specIdx = oz.index
      matches.push({ type: 'volume', raw: oz[0].trim() })
    }
  }

  // 4) 중량 (50g, 1kg) — 숫자 바로 뒤에 오는 경우만 인정
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|KG|Kg|킬로)(?![a-zA-Z가-힣])/)
  if (kg) {
    massG = num(kg[1]) * 1000
    specIdx = kg.index
    matches.push({ type: 'mass', raw: kg[0].trim() })
  } else {
    const g = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|G|그램|㎖?g)(?![a-zA-Z가-힣])/)
    if (g) {
      massG = num(g[1])
      specIdx = g.index
      matches.push({ type: 'mass', raw: g[0].trim() })
    }
  }

  // 5) 매수 (30매, 10장) — 시트마스크·화장솜
  const sheetMatch = text.match(/(\d+)\s*(?:매|장)(?![a-zA-Z가-힣])/)
  if (sheetMatch) {
    sheets = Number.parseInt(sheetMatch[1], 10)
    matches.push({ type: 'sheets', raw: sheetMatch[0].trim() })
  }

  // 5-1) 알약 (180정, 60캡슐) — 병 하나 안의 알 수. 구성 수량이 절대 아닙니다.
  //      ('90정'을 상품 90개로 곱하면 영양제 하나가 11kg 로 계산됩니다)
  let tablets = null
  const tab = text.match(/(\d+)\s*(?:정|캡슐|환|타블렛|소프트젤|연질캡슐)(?![a-zA-Z가-힣])/)
  if (tab) {
    tablets = Number.parseInt(tab[1], 10)
    matches.push({ type: 'tablets', raw: tab[0].trim() })
  }

  // 5-2) 포 (30포, 50포) — 스틱 개수. 역시 구성 수량이 아닙니다.
  let sachets = null
  const sac = text.match(/(\d+)\s*포(?![a-zA-Z가-힣])/)
  if (sac) {
    sachets = Number.parseInt(sac[1], 10)
    matches.push({ type: 'sachets', raw: sac[0].trim() })
  }

  // 6) 증정 구성 (1+1, 2+1) — 총 개수로 환산
  const plus = text.match(/(\d+)\s*\+\s*(\d+)(?!\s*[a-zA-Z가-힣])/)
  if (plus) {
    count = Number.parseInt(plus[1], 10) + Number.parseInt(plus[2], 10)
    matches.push({ type: 'count', raw: plus[0].trim() })
  }

  // 7) 배수 표기 (x2, ×3, *2)
  if (count === 1) {
    const mult = text.match(/[x×*]\s*(\d+)(?![a-zA-Z가-힣0-9])/i)
    if (mult) {
      count = Number.parseInt(mult[1], 10)
      matches.push({ type: 'count', raw: mult[0].trim() })
    }
  }

  /**
   * 8) 개입 표기 (2개입, 3개, 5팩) — '정'은 알약 수라 여기서 제외
   *
   * 쿠팡 상품명은 "규격, 총중량, 구성수량" 순서입니다:
   *   "식기세척기 캡슐 세제 55입, 440g, 2개"
   * 여기서 55는 봉지 안 캡슐 수(내용물)이고 440g 이 그 봉지의 총중량,
   * 2개가 실제 구성 수량입니다. 중량 앞의 수량을 곱하면 440g×55 = 24kg 가
   * 되어 "중량 초과"로 막히므로, 중량·용량 표기 **뒤**의 수량만 구성
   * 수량으로 인정하고 앞의 것은 낱개 수(pieces)로 따로 둡니다.
   */
  let pieces = null
  if (count === 1) {
    const all = [...text.matchAll(
      /(\d+)\s*(?:개입|개|입|팩|병|본|봉|갑|캔|롤|족|켤레|자루|박스|패드|묶음|줄|권|색|켤레)(?![a-zA-Z가-힣])/g)]
    const after = specIdx === null ? all : all.filter((m) => m.index > specIdx)
    /**
     * 수량 표기가 둘이면 곱합니다 — "140g 5개입 4묶음" = 20개.
     * (매수와 같은 숫자는 중복 계산이라 제외합니다)
     */
    const packs = after.filter((m) => !(sheets && Number.parseInt(m[1], 10) === sheets)).slice(-2)
    if (packs.length > 0) {
      count = packs.reduce((acc, m) => acc * Number.parseInt(m[1], 10), 1)
      matches.push({ type: 'count', raw: packs.map((m) => m[0].trim()).join(' × ') })
    } else if (all.length > 0) {
      // 중량·용량 앞에만 있는 수량 = 포장 안 낱개 수 (곱하지 않습니다)
      pieces = Number.parseInt(all[0][1], 10)
      matches.push({ type: 'pieces', raw: all[0][0].trim() })
    }
  }

  const isSet = /세트|셋트|기획|키트|kit|set|콜렉션|컬렉션/i.test(productName)

  // 비현실적인 값 방어
  if (volumeMl !== null && (volumeMl <= 0 || volumeMl > 20000)) volumeMl = null
  if (massG !== null && (massG <= 0 || massG > 20000)) massG = null
  if (sheets !== null && (sheets <= 0 || sheets > 5000)) sheets = null
  if (tablets !== null && (tablets <= 0 || tablets > 1000)) tablets = null
  if (sachets !== null && (sachets <= 0 || sachets > 500)) sachets = null
  if (pieces !== null && (pieces <= 0 || pieces > 1000)) pieces = null
  if (!Number.isFinite(count) || count < 1 || count > 400) count = 1

  return { volumeMl, massG, sheets, tablets, sachets, pieces, count, isSet, matches }
}
