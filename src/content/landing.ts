export type LandingLocale = "ko" | "en";

interface LandingCopy {
  navigation: string;
  login: string;
  signup: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  quickFacts: readonly (readonly [string, string])[];
  example: {
    label: string;
    ariaLabel: string;
    date: string;
    roaster: string;
    coffee: string;
    fields: readonly (readonly [string, string])[];
    tastingNotesLabel: string;
    tastingNotes: string;
    scoreLabel: string;
  };
  features: {
    eyebrow: string;
    title: string;
    intro: string;
    items: readonly (readonly [string, string])[];
  };
  origins: {
    eyebrow: string;
    title: string;
    intro: string;
    viewAll: string;
    viewCountry: string;
  };
  steps: {
    eyebrow: string;
    title: string;
    items: readonly (readonly [string, string])[];
  };
  privacy: {
    eyebrow: string;
    title: string;
    description: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: readonly (readonly [string, string])[];
  };
}

export const landingCopy: Record<LandingLocale, LandingCopy> = {
  ko: {
    navigation: "첫 화면",
    login: "로그인",
    signup: "회원가입",
    eyebrow: "커피 기록",
    title: "beanlog",
    description:
      "beanmap은 로스터리·산지·품종·가공 방식·테이스팅 노트·점수를 한곳에 남기고, 필요할 때 다시 찾는 커피 원두 기록장입니다.",
    primaryAction: "비회원으로 기록하기",
    secondaryAction: "회원가입",
    quickFacts: [
      ["기록", "원두 정보 · 마신 날짜 · 점수 · 테이스팅 노트"],
      ["검색", "커피 · 로스터리 · 산지 · 메모"],
      ["통계", "산지 · 가공 방식 · 품종 · 월별 기록"],
    ],
    example: {
      label: "기록 예시",
      ariaLabel: "beanmap 커피 기록 예시",
      date: "2026. 08. 12",
      roaster: "Fritz Coffee Company",
      coffee: "Ethiopia Bensa Bombe",
      fields: [
        ["산지", "에티오피아 · 벤사"],
        ["가공", "내추럴"],
        ["품종", "74158"],
        ["로스팅", "약배전"],
      ],
      tastingNotesLabel: "테이스팅 노트",
      tastingNotes: "복숭아 · 재스민 · 꿀 같은 단맛",
      scoreLabel: "종합 점수",
    },
    features: {
      eyebrow: "기능 / 01",
      title: "기록 기능",
      intro:
        "기본 정보부터 산지·추출 정보까지 필요한 항목만 입력할 수 있습니다.",
      items: [
        [
          "원두 정보",
          "로스터리, 생산 국가와 지역, 품종, 가공 방식, 로스팅 날짜와 구매 정보를 한 기록에 모읍니다.",
        ],
        [
          "검색과 필터",
          "커피 이름·로스터리·메모를 검색하고 산지·가공 방식·품종으로 걸러봅니다.",
        ],
        [
          "기록 통계",
          "월별 기록과 점수 분포, 자주 마신 산지·품종·가공 방식을 통계로 확인합니다.",
        ],
        [
          "산지 정보",
          "20개 생산 국가의 대표 향미, 재배 고도, 주요 품종과 생산 지역을 함께 살펴봅니다.",
        ],
      ],
    },
    origins: {
      eyebrow: "가이드 / 02",
      title: "커피 산지 정보",
      intro:
        "대표적인 커피 생산 국가의 지역, 고도, 품종과 대표 향미 정보를 제공합니다.",
      viewAll: "20개 산지 모두 보기",
      viewCountry: "산지 가이드 보기",
    },
    steps: {
      eyebrow: "사용 방법 / 03",
      title: "시작하기",
      items: [
        ["비회원 기록", "첫 기록은 현재 브라우저에 임시 저장됩니다."],
        ["계정 저장", "회원가입하거나 로그인하면 임시 기록이 계정으로 이동합니다."],
        ["검색과 통계", "저장한 기록은 검색·필터·통계에서 확인할 수 있습니다."],
      ],
    },
    privacy: {
      eyebrow: "개인정보 / 04",
      title: "개인정보와 데이터",
      description:
        "커피 기록은 본인 계정에서만 볼 수 있습니다. 전체 기록을 JSON으로 내려받거나 설정에서 계정과 데이터를 삭제할 수 있으며, 광고·행동 추적 쿠키를 사용하지 않습니다.",
    },
    faq: {
      eyebrow: "도움말 / 05",
      title: "자주 묻는 질문",
      items: [
        [
          "회원가입 없이 써볼 수 있나요?",
          "네. 기록 하나를 브라우저에 임시 저장해볼 수 있습니다. 계정을 만들면 그 기록을 그대로 옮겨 보관할 수 있습니다.",
        ],
        [
          "어떤 커피 정보를 기록할 수 있나요?",
          "원두 이름, 로스터리, 산지, 품종, 가공 방식, 로스팅·구매 정보, 마신 날짜와 장소, 점수와 테이스팅 노트를 남길 수 있습니다.",
        ],
        [
          "영어로도 사용할 수 있나요?",
          "네. 첫 화면과 기록 기능, 산지 가이드, 이용약관과 개인정보 처리방침을 한국어와 영어로 제공합니다.",
        ],
      ],
    },
  },
  en: {
    navigation: "Home",
    login: "Log in",
    signup: "Sign up",
    eyebrow: "Coffee records",
    title: "beanlog",
    description:
      "beanmap is a coffee bean journal for saving roasters, origins, varieties, processing methods, tasting notes, and scores—then finding them when you need them.",
    primaryAction: "Record without an account",
    secondaryAction: "Sign up",
    quickFacts: [
      ["Record", "Bean details · brew date · scores · tasting notes"],
      ["Search", "Coffee · roaster · origin · note"],
      ["Stats", "Origin · process · variety · monthly records"],
    ],
    example: {
      label: "Sample entry",
      ariaLabel: "Sample coffee entry in beanmap",
      date: "Aug 12, 2026",
      roaster: "Fritz Coffee Company",
      coffee: "Ethiopia Bensa Bombe",
      fields: [
        ["Origin", "Ethiopia · Bensa"],
        ["Process", "Natural"],
        ["Variety", "74158"],
        ["Roast", "Light"],
      ],
      tastingNotesLabel: "Tasting notes",
      tastingNotes: "Peach · jasmine · honey-like sweetness",
      scoreLabel: "Overall score",
    },
    features: {
      eyebrow: "Features / 01",
      title: "Record features",
      intro:
        "Enter only the fields you need, from basic bean details to origin and brewing information.",
      items: [
        [
          "Bean details",
          "Keep the roaster, country, region, variety, process, roast date, and purchase details together in one entry.",
        ],
        [
          "Search and filters",
          "Search names, roasters, and notes, then filter your journal by origin, process, or variety.",
        ],
        [
          "Record statistics",
          "Review monthly activity, score distribution, and the origins, processes, and varieties you return to.",
        ],
        [
          "Origin information",
          "Browse typical flavors, elevations, key varieties, and growing regions across 20 coffee-producing countries.",
        ],
      ],
    },
    origins: {
      eyebrow: "Guide / 02",
      title: "Coffee origin information",
      intro:
        "View regions, elevations, key varieties, and common cup profiles from major coffee-producing countries.",
      viewAll: "Browse all 20 origins",
      viewCountry: "Open origin guide",
    },
    steps: {
      eyebrow: "How to use / 03",
      title: "Getting started",
      items: [
        ["Guest record", "Your first draft stays temporarily in this browser."],
        ["Account storage", "Sign up or log in to move the draft into your account."],
        ["Search and statistics", "Saved records are available through search, filters, and statistics."],
      ],
    },
    privacy: {
      eyebrow: "Privacy / 04",
      title: "Privacy and data",
      description:
        "Coffee entries are private to your account. You can export every record as JSON or delete your account and its data from Settings. beanmap uses no advertising or behavioral-tracking cookies.",
    },
    faq: {
      eyebrow: "Help / 05",
      title: "Frequently asked questions",
      items: [
        [
          "Can I try beanmap without signing up?",
          "Yes. You can save one draft temporarily in your browser. Create an account when you want to keep that entry in your journal.",
        ],
        [
          "What coffee details can I record?",
          "Save the coffee and roaster names, origin, variety, process, roast and purchase details, date and place, scores, and tasting notes.",
        ],
        [
          "Is beanmap available in English and Korean?",
          "Yes. The landing pages, journal, origin guide, Terms of Service, and Privacy Policy are available in both languages.",
        ],
      ],
    },
  },
};
