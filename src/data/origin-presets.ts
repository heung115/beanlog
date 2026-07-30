export interface OriginPresetData {
  country: string;
  countryKo: string;
  regions: {
    name: string;
    nameKo: string;
    lat: number;
    lng: number;
  }[];
  altitudeRange: string;
  signature: string;
  signatureKo: string;
  keyVarietals: string[];
}

export const originPresets: OriginPresetData[] = [
  {
    country: "Ethiopia",
    countryKo: "에티오피아",
    regions: [
      { name: "Yirgacheffe", nameKo: "예가체프", lat: 6.16, lng: 38.2 },
      { name: "Guji", nameKo: "구지", lat: 5.8, lng: 39.1 },
      { name: "Sidama", nameKo: "시다마", lat: 6.65, lng: 38.47 },
      { name: "Limu", nameKo: "리무", lat: 8.0, lng: 36.5 },
      { name: "Harrar", nameKo: "하라르", lat: 9.31, lng: 42.12 },
    ],
    altitudeRange: "1,700~2,200m",
    signature: "Floral, citrus, berry, tea-like body",
    signatureKo: "화사한 꽃향, 시트러스, 베리, 차 같은 바디",
    keyVarietals: ["Heirloom", "Kurume", "Dega", "Wolisho"],
  },
  {
    country: "Colombia",
    countryKo: "콜롬비아",
    regions: [
      { name: "Huila", nameKo: "우일라", lat: 2.53, lng: -75.52 },
      { name: "Nariño", nameKo: "나리뇨", lat: 1.29, lng: -77.36 },
      { name: "Antioquia", nameKo: "안티오키아", lat: 6.25, lng: -75.56 },
      { name: "Tolima", nameKo: "톨리마", lat: 4.44, lng: -75.23 },
      { name: "Cauca", nameKo: "카우카", lat: 2.45, lng: -76.61 },
    ],
    altitudeRange: "1,200~2,000m",
    signature: "Caramel, red apple, balanced acidity, medium body",
    signatureKo: "캐러멜, 붉은 사과, 균형 잡힌 산미, 중간 바디",
    keyVarietals: ["Caturra", "Castillo", "Colombia", "Pink Bourbon", "Geisha"],
  },
  {
    country: "Kenya",
    countryKo: "케냐",
    regions: [
      { name: "Nyeri", nameKo: "니에리", lat: -0.42, lng: 36.95 },
      { name: "Kirinyaga", nameKo: "키리냐가", lat: -0.5, lng: 37.28 },
      { name: "Kiambu", nameKo: "키암부", lat: -1.17, lng: 36.83 },
      { name: "Muranga", nameKo: "무랑가", lat: -0.72, lng: 37.15 },
    ],
    altitudeRange: "1,500~2,100m",
    signature: "Blackcurrant, tomato, bright acidity, full body",
    signatureKo: "블랙커런트, 토마토, 밝은 산미, 풀바디",
    keyVarietals: ["SL28", "SL34", "Ruiru 11", "Batian"],
  },
  {
    country: "Panama",
    countryKo: "파나마",
    regions: [
      { name: "Boquete", nameKo: "보케테", lat: 8.78, lng: -82.43 },
      { name: "Volcán", nameKo: "볼칸", lat: 8.77, lng: -82.63 },
    ],
    altitudeRange: "1,200~1,800m",
    signature: "Jasmine, bergamot, tropical fruit, silky body",
    signatureKo: "자스민, 베르가못, 열대과일, 실키한 바디",
    keyVarietals: ["Geisha", "Caturra", "Catuai", "Bourbon"],
  },
  {
    country: "Guatemala",
    countryKo: "과테말라",
    regions: [
      { name: "Antigua", nameKo: "안티구아", lat: 14.56, lng: -90.73 },
      { name: "Huehuetenango", nameKo: "우에우에테낭고", lat: 15.31, lng: -91.48 },
      { name: "Atitlán", nameKo: "아티틀란", lat: 14.75, lng: -91.19 },
      { name: "Cobán", nameKo: "코반", lat: 15.47, lng: -90.37 },
    ],
    altitudeRange: "1,300~2,000m",
    signature: "Chocolate, spice, orange, full body",
    signatureKo: "초콜릿, 스파이스, 오렌지, 풀바디",
    keyVarietals: ["Bourbon", "Caturra", "Catuai", "Pache"],
  },
  {
    country: "Brazil",
    countryKo: "브라질",
    regions: [
      { name: "Cerrado", nameKo: "세하도", lat: -18.5, lng: -47.5 },
      { name: "Sul de Minas", nameKo: "술 지 미나스", lat: -21.5, lng: -45.5 },
      { name: "Mogiana", nameKo: "모지아나", lat: -20.5, lng: -47.5 },
      { name: "Bahia", nameKo: "바이아", lat: -12.0, lng: -41.5 },
    ],
    altitudeRange: "800~1,400m",
    signature: "Nutty, chocolate, low acidity, heavy body",
    signatureKo: "견과, 초콜릿, 낮은 산미, 무거운 바디",
    keyVarietals: ["Mundo Novo", "Catuai", "Bourbon", "Yellow Bourbon"],
  },
  {
    country: "Costa Rica",
    countryKo: "코스타리카",
    regions: [
      { name: "Tarrazú", nameKo: "타라수", lat: 9.65, lng: -84.0 },
      { name: "West Valley", nameKo: "웨스트 밸리", lat: 10.1, lng: -84.3 },
      { name: "Central Valley", nameKo: "센트럴 밸리", lat: 9.93, lng: -84.08 },
    ],
    altitudeRange: "1,200~1,900m",
    signature: "Honey, citrus, clean, bright acidity",
    signatureKo: "꿀, 시트러스, 클린, 밝은 산미",
    keyVarietals: ["Caturra", "Catuai", "Villa Sarchi", "Geisha"],
  },
  {
    country: "Indonesia",
    countryKo: "인도네시아",
    regions: [
      { name: "Sumatra", nameKo: "수마트라", lat: 0.5, lng: 99.0 },
      { name: "Java", nameKo: "자바", lat: -7.5, lng: 110.0 },
      { name: "Sulawesi", nameKo: "술라웨시", lat: -2.5, lng: 120.0 },
      { name: "Flores", nameKo: "플로레스", lat: -8.6, lng: 121.0 },
    ],
    altitudeRange: "1,000~1,600m",
    signature: "Earthy, herbal, tobacco, heavy body, low acidity",
    signatureKo: "얼씨, 허브, 담배, 무거운 바디, 낮은 산미",
    keyVarietals: ["Typica", "Catimor", "Ateng", "Tim Tim"],
  },
  {
    country: "Rwanda",
    countryKo: "르완다",
    regions: [
      { name: "Nyamasheke", nameKo: "냐마셰케", lat: -2.35, lng: 29.1 },
      { name: "Huye", nameKo: "후예", lat: -2.53, lng: 29.74 },
      { name: "Gakenke", nameKo: "가켄케", lat: -1.68, lng: 29.78 },
    ],
    altitudeRange: "1,500~2,000m",
    signature: "Orange, floral, tea, silky body",
    signatureKo: "오렌지, 꽃향, 차, 실키한 바디",
    keyVarietals: ["Red Bourbon", "Jackson", "Pop 3303"],
  },
  {
    country: "Peru",
    countryKo: "페루",
    regions: [
      { name: "Cajamarca", nameKo: "카하마르카", lat: -7.16, lng: -78.51 },
      { name: "Cusco", nameKo: "쿠스코", lat: -13.53, lng: -71.97 },
      { name: "Junín", nameKo: "후닌", lat: -11.5, lng: -75.5 },
    ],
    altitudeRange: "1,200~2,000m",
    signature: "Nutty, chocolate, mild acidity, smooth body",
    signatureKo: "견과, 초콜릿, 부드러운 산미, 스무스 바디",
    keyVarietals: ["Typica", "Caturra", "Bourbon", "Catimor"],
  },
  {
    country: "Honduras",
    countryKo: "온두라스",
    regions: [
      { name: "Marcala", nameKo: "마르칼라", lat: 14.15, lng: -88.03 },
      { name: "Copán", nameKo: "코판", lat: 14.84, lng: -88.87 },
      { name: "Comayagua", nameKo: "코마야과", lat: 14.45, lng: -87.63 },
    ],
    altitudeRange: "1,100~1,700m",
    signature: "Caramel, tropical fruit, balanced, medium body",
    signatureKo: "캐러멜, 열대과일, 균형, 중간 바디",
    keyVarietals: ["Catuai", "Caturra", "Lempira", "Parainema"],
  },
  {
    country: "Yemen",
    countryKo: "예멘",
    regions: [
      { name: "Haraaz", nameKo: "하라즈", lat: 15.1, lng: 43.7 },
      { name: "Mattari", nameKo: "마타리", lat: 15.2, lng: 43.8 },
    ],
    altitudeRange: "1,500~2,400m",
    signature: "Dried fruit, wine, spice, complex, heavy body",
    signatureKo: "건과일, 와인, 스파이스, 복합적, 무거운 바디",
    keyVarietals: ["Udaini", "Tuffahi", "Dairi"],
  },
  {
    country: "Burundi",
    countryKo: "부룬디",
    regions: [
      { name: "Kayanza", nameKo: "카얀자", lat: -2.92, lng: 29.63 },
      { name: "Ngozi", nameKo: "은고지", lat: -2.91, lng: 29.83 },
    ],
    altitudeRange: "1,500~2,000m",
    signature: "Red fruit, citrus, floral, clean",
    signatureKo: "붉은 과일, 시트러스, 꽃향, 클린",
    keyVarietals: ["Red Bourbon", "Jackson"],
  },
  {
    country: "Tanzania",
    countryKo: "탄자니아",
    regions: [
      { name: "Kilimanjaro", nameKo: "킬리만자로", lat: -3.07, lng: 37.35 },
      { name: "Mbeya", nameKo: "음베야", lat: -8.9, lng: 33.45 },
    ],
    altitudeRange: "1,400~2,000m",
    signature: "Blackcurrant, wine, bright acidity, medium body",
    signatureKo: "블랙커런트, 와인, 밝은 산미, 중간 바디",
    keyVarietals: ["Bourbon", "Kent", "N39", "KP423"],
  },
  {
    country: "El Salvador",
    countryKo: "엘살바도르",
    regions: [
      { name: "Santa Ana", nameKo: "산타아나", lat: 13.99, lng: -89.56 },
      { name: "Chalatenango", nameKo: "찰라테낭고", lat: 14.03, lng: -88.93 },
    ],
    altitudeRange: "1,200~1,800m",
    signature: "Honey, almond, red apple, creamy body",
    signatureKo: "꿀, 아몬드, 붉은 사과, 크리미 바디",
    keyVarietals: ["Bourbon", "Pacas", "Pacamara", "Catimor"],
  },
  {
    country: "Nicaragua",
    countryKo: "니카라과",
    regions: [
      { name: "Jinotega", nameKo: "히노테가", lat: 13.09, lng: -86.0 },
      { name: "Matagalpa", nameKo: "마타갈파", lat: 12.92, lng: -85.91 },
      { name: "Nueva Segovia", nameKo: "누에바 세고비아", lat: 13.63, lng: -86.47 },
    ],
    altitudeRange: "1,100~1,700m",
    signature: "Chocolate, citrus, balanced, medium body",
    signatureKo: "초콜릿, 시트러스, 균형, 중간 바디",
    keyVarietals: ["Caturra", "Bourbon", "Catuai", "Maracaturra"],
  },
  {
    country: "Mexico",
    countryKo: "멕시코",
    regions: [
      { name: "Chiapas", nameKo: "치아파스", lat: 16.75, lng: -93.12 },
      { name: "Oaxaca", nameKo: "오악사카", lat: 17.07, lng: -96.72 },
      { name: "Veracruz", nameKo: "베라크루스", lat: 19.18, lng: -96.14 },
    ],
    altitudeRange: "1,000~1,700m",
    signature: "Chocolate, nutty, mild acidity, light body",
    signatureKo: "초콜릿, 견과, 부드러운 산미, 가벼운 바디",
    keyVarietals: ["Typica", "Bourbon", "Caturra", "Mundo Novo"],
  },
  {
    country: "Papua New Guinea",
    countryKo: "파푸아뉴기니",
    regions: [
      { name: "Eastern Highlands", nameKo: "이스턴 하일랜즈", lat: -6.1, lng: 145.5 },
      { name: "Western Highlands", nameKo: "웨스턴 하일랜즈", lat: -5.85, lng: 143.9 },
    ],
    altitudeRange: "1,300~1,800m",
    signature: "Tropical fruit, buttery, complex, medium body",
    signatureKo: "열대과일, 버터리, 복합적, 중간 바디",
    keyVarietals: ["Typica", "Bourbon", "Arusha"],
  },
  {
    country: "India",
    countryKo: "인도",
    regions: [
      { name: "Karnataka", nameKo: "카르나타카", lat: 13.0, lng: 75.5 },
      { name: "Kerala", nameKo: "케랄라", lat: 10.0, lng: 76.5 },
    ],
    altitudeRange: "1,000~1,500m",
    signature: "Spice, chocolate, full body, low acidity",
    signatureKo: "스파이스, 초콜릿, 풀바디, 낮은 산미",
    keyVarietals: ["S795", "SL9", "Selection 9", "Catimor"],
  },
  {
    country: "Vietnam",
    countryKo: "베트남",
    regions: [
      { name: "Da Lat", nameKo: "달랏", lat: 11.94, lng: 108.44 },
      { name: "Buon Ma Thuot", nameKo: "부온마투옷", lat: 12.68, lng: 108.05 },
    ],
    altitudeRange: "800~1,500m",
    signature: "Chocolate, nutty, bold, heavy body",
    signatureKo: "초콜릿, 견과, 진한, 무거운 바디",
    keyVarietals: ["Catimor", "Typica", "Bourbon"],
  },
];

export function findCountryPreset(country: string): OriginPresetData | undefined {
  const lower = country.toLowerCase().trim();
  return originPresets.find(
    (p) => p.country.toLowerCase() === lower || p.countryKo === country.trim()
  );
}

export function findRegionCoords(
  country: string,
  region: string
): { lat: number; lng: number } | undefined {
  const preset = findCountryPreset(country);
  if (!preset) return undefined;
  const lower = region.toLowerCase().trim();
  const found = preset.regions.find(
    (r) => r.name.toLowerCase() === lower || r.nameKo === region.trim()
  );
  return found ? { lat: found.lat, lng: found.lng } : undefined;
}
