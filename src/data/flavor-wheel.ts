export interface FlavorTag {
  tag: string;
  tagKo: string;
  category: FlavorCategory;
}

export type FlavorCategory =
  | "fruity"
  | "floral"
  | "sweet"
  | "nutty"
  | "cocoa"
  | "spice"
  | "roasted"
  | "sour"
  | "green"
  | "other";

export const flavorCategories: { id: FlavorCategory; label: string; labelKo: string }[] = [
  { id: "fruity", label: "Fruity", labelKo: "과일" },
  { id: "floral", label: "Floral", labelKo: "꽃" },
  { id: "sweet", label: "Sweet", labelKo: "단맛" },
  { id: "nutty", label: "Nutty / Cacao", labelKo: "견과 / 카카오" },
  { id: "cocoa", label: "Cocoa", labelKo: "초콜릿" },
  { id: "spice", label: "Spice", labelKo: "스파이스" },
  { id: "roasted", label: "Roasted", labelKo: "로스티드" },
  { id: "sour", label: "Sour / Fermented", labelKo: "산미 / 발효" },
  { id: "green", label: "Green / Herbal", labelKo: "그린 / 허브" },
  { id: "other", label: "Other", labelKo: "기타" },
];

export const flavorPresets: FlavorTag[] = [
  // Fruity
  { tag: "blueberry", tagKo: "블루베리", category: "fruity" },
  { tag: "strawberry", tagKo: "딸기", category: "fruity" },
  { tag: "raspberry", tagKo: "라즈베리", category: "fruity" },
  { tag: "blackberry", tagKo: "블랙베리", category: "fruity" },
  { tag: "cherry", tagKo: "체리", category: "fruity" },
  { tag: "grape", tagKo: "포도", category: "fruity" },
  { tag: "apple", tagKo: "사과", category: "fruity" },
  { tag: "pear", tagKo: "배", category: "fruity" },
  { tag: "peach", tagKo: "복숭아", category: "fruity" },
  { tag: "apricot", tagKo: "살구", category: "fruity" },
  { tag: "citrus", tagKo: "시트러스", category: "fruity" },
  { tag: "lemon", tagKo: "레몬", category: "fruity" },
  { tag: "orange", tagKo: "오렌지", category: "fruity" },
  { tag: "grapefruit", tagKo: "자몽", category: "fruity" },
  { tag: "lime", tagKo: "라임", category: "fruity" },
  { tag: "mango", tagKo: "망고", category: "fruity" },
  { tag: "papaya", tagKo: "파파야", category: "fruity" },
  { tag: "pineapple", tagKo: "파인애플", category: "fruity" },
  { tag: "tropical", tagKo: "트로피컬", category: "fruity" },
  { tag: "dried-fruit", tagKo: "건과일", category: "fruity" },
  { tag: "raisin", tagKo: "건포도", category: "fruity" },
  { tag: "plum", tagKo: "자두", category: "fruity" },
  // Floral
  { tag: "jasmine", tagKo: "자스민", category: "floral" },
  { tag: "rose", tagKo: "장미", category: "floral" },
  { tag: "lavender", tagKo: "라벤더", category: "floral" },
  { tag: "chamomile", tagKo: "캐모마일", category: "floral" },
  { tag: "bergamot", tagKo: "베르가못", category: "floral" },
  { tag: "floral", tagKo: "꽃향", category: "floral" },
  // Sweet
  { tag: "honey", tagKo: "꿀", category: "sweet" },
  { tag: "caramel", tagKo: "캐러멜", category: "sweet" },
  { tag: "brown-sugar", tagKo: "흑설탕", category: "sweet" },
  { tag: "molasses", tagKo: "당밀", category: "sweet" },
  { tag: "maple", tagKo: "메이플", category: "sweet" },
  { tag: "vanilla", tagKo: "바닐라", category: "sweet" },
  { tag: "toffee", tagKo: "토피", category: "sweet" },
  // Nutty / Cacao
  { tag: "almond", tagKo: "아몬드", category: "nutty" },
  { tag: "hazelnut", tagKo: "헤이즐넛", category: "nutty" },
  { tag: "peanut", tagKo: "땅콩", category: "nutty" },
  { tag: "walnut", tagKo: "호두", category: "nutty" },
  { tag: "chocolate", tagKo: "초콜릿", category: "cocoa" },
  { tag: "dark-chocolate", tagKo: "다크초콜릿", category: "cocoa" },
  { tag: "cocoa", tagKo: "코코아", category: "cocoa" },
  // Spice
  { tag: "cinnamon", tagKo: "시나몬", category: "spice" },
  { tag: "clove", tagKo: "클로브", category: "spice" },
  { tag: "nutmeg", tagKo: "넛맥", category: "spice" },
  { tag: "black-pepper", tagKo: "후추", category: "spice" },
  { tag: "ginger", tagKo: "생강", category: "spice" },
  { tag: "anise", tagKo: "아니스", category: "spice" },
  // Roasted
  { tag: "roasted", tagKo: "로스티드", category: "roasted" },
  { tag: "smoky", tagKo: "스모키", category: "roasted" },
  { tag: "toasty", tagKo: "토스티", category: "roasted" },
  { tag: "malt", tagKo: "맥아", category: "roasted" },
  { tag: "grain", tagKo: "곡물", category: "roasted" },
  // Sour / Fermented
  { tag: "wine", tagKo: "와인", category: "sour" },
  { tag: "fermented", tagKo: "발효", category: "sour" },
  { tag: "vinegar", tagKo: "식초", category: "sour" },
  { tag: "tart", tagKo: "타트", category: "sour" },
  // Green / Herbal
  { tag: "herbal", tagKo: "허브", category: "green" },
  { tag: "tea", tagKo: "차", category: "green" },
  { tag: "green-tea", tagKo: "녹차", category: "green" },
  { tag: "black-tea", tagKo: "홍차", category: "green" },
  { tag: "grass", tagKo: "풀", category: "green" },
  { tag: "vegetal", tagKo: "채소", category: "green" },
  // Other
  { tag: "buttery", tagKo: "버터리", category: "other" },
  { tag: "creamy", tagKo: "크리미", category: "other" },
  { tag: "clean", tagKo: "클린", category: "other" },
  { tag: "complex", tagKo: "복합적", category: "other" },
  { tag: "balanced", tagKo: "밸런스", category: "other" },
  { tag: "juicy", tagKo: "주시", category: "other" },
  { tag: "silky", tagKo: "실키", category: "other" },
];

export function normalizeTag(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "");
}
