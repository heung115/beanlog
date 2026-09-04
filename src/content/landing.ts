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
    eyebrow: "개인 커피 테이스팅 저널",
    title: "beanlog",
    description:
      "beanmap은 로스터리·산지·품종·가공 방식·테이스팅 노트·점수를 한곳에 남기고, 필요할 때 다시 찾는 커피 원두 기록장입니다.",
    primaryAction: "기록 하나 먼저 써보기",
    secondaryAction: "계정 만들기",
    quickFacts: [
      ["기록", "원두 정보 · 마신 날짜 · 점수 · 테이스팅 노트"],
      ["찾기", "커피 · 로스터리 · 산지 · 메모 검색"],
      ["발견", "산지 · 가공 방식 · 품종 · 월별 취향 통계"],
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
      eyebrow: "기록이 쓸모 있어지는 방식",
      title: "점수 하나보다 오래 남는 커피 기록",
      intro:
        "간단히 시작하고, 기억해두고 싶은 커피에는 산지와 추출 경험을 더 자세히 남길 수 있습니다.",
      items: [
        [
          "원두 봉투의 정보를 그대로",
          "로스터리, 생산 국가와 지역, 품종, 가공 방식, 로스팅 날짜와 구매 정보를 한 기록에 모읍니다.",
        ],
        [
          "몇 달 뒤에도 다시 찾기",
          "커피 이름·로스터리·메모를 검색하고 산지·가공 방식·품종으로 걸러봅니다.",
        ],
        [
          "기록이 쌓일수록 선명한 취향",
          "월별 기록과 점수 분포, 자주 마신 산지·품종·가공 방식을 통계로 확인합니다.",
        ],
        [
          "기록하면서 살펴보는 산지",
          "20개 생산 국가의 대표 향미, 재배 고도, 주요 품종과 생산 지역을 함께 살펴봅니다.",
        ],
      ],
    },
    origins: {
      eyebrow: "커피 산지 가이드",
      title: "봉투에 적힌 산지가 궁금할 때",
      intro:
        "대표적인 커피 생산 국가의 지역, 고도, 품종과 흔히 만나는 향미를 한국어와 영어로 정리했습니다.",
      viewAll: "20개 산지 모두 보기",
      viewCountry: "산지 가이드 보기",
    },
    steps: {
      eyebrow: "시작 방법",
      title: "기록 하나부터 가볍게",
      items: [
        ["계정 없이 써보기", "첫 기록은 현재 브라우저에 임시로 저장됩니다."],
        ["계정에 보관하기", "회원가입하거나 로그인해 임시 기록을 내 저널에 옮깁니다."],
        ["나만의 기준 만들기", "커피가 쌓이면 검색과 통계로 다시 마실 원두를 찾습니다."],
      ],
    },
    privacy: {
      eyebrow: "내 기록은 나에게만",
      title: "광고를 위한 기록이 아닙니다.",
      description:
        "커피 기록은 본인 계정에서만 볼 수 있습니다. 전체 기록을 JSON으로 내려받거나 설정에서 계정과 데이터를 삭제할 수 있으며, 광고·행동 추적 쿠키를 사용하지 않습니다.",
    },
    faq: {
      eyebrow: "자주 묻는 질문",
      title: "시작하기 전에 궁금한 점",
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
    eyebrow: "A private coffee tasting journal",
    title: "beanlog",
    description:
      "beanmap is a coffee bean journal for saving roasters, origins, varieties, processing methods, tasting notes, and scores—then finding them when you need them.",
    primaryAction: "Try one record",
    secondaryAction: "Create an account",
    quickFacts: [
      ["Record", "Bean details · brew date · scores · tasting notes"],
      ["Find", "Search by coffee · roaster · origin · note"],
      ["Learn", "See patterns by origin · process · variety · month"],
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
      eyebrow: "A journal that stays useful",
      title: "More memorable than a score alone",
      intro:
        "Start with the essentials, then add the origin and tasting detail that makes a special coffee easy to recognize later.",
      items: [
        [
          "Capture the whole bag",
          "Keep the roaster, country, region, variety, process, roast date, and purchase details together in one entry.",
        ],
        [
          "Find a coffee months later",
          "Search names, roasters, and notes, then filter your journal by origin, process, or variety.",
        ],
        [
          "See your taste take shape",
          "Review monthly activity, score distribution, and the origins, processes, and varieties you return to.",
        ],
        [
          "Learn while you log",
          "Browse typical flavors, elevations, key varieties, and growing regions across 20 coffee-producing countries.",
        ],
      ],
    },
    origins: {
      eyebrow: "Coffee origin guide",
      title: "Make sense of the place on the bag",
      intro:
        "Explore regions, elevations, key varieties, and commonly found cup profiles from major coffee-producing countries—in English or Korean.",
      viewAll: "Browse all 20 origins",
      viewCountry: "Open origin guide",
    },
    steps: {
      eyebrow: "How it works",
      title: "Start with a single cup",
      items: [
        ["Try it without an account", "Your first draft stays temporarily in this browser."],
        ["Keep it in your journal", "Sign up or log in to move that draft into your account."],
        ["Build a useful history", "As entries grow, search and stats help you choose what to drink again."],
      ],
    },
    privacy: {
      eyebrow: "Your journal stays yours",
      title: "Your notes are not advertising data.",
      description:
        "Coffee entries are private to your account. You can export every record as JSON or delete your account and its data from Settings. beanmap uses no advertising or behavioral-tracking cookies.",
    },
    faq: {
      eyebrow: "Common questions",
      title: "Before your first entry",
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
