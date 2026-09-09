import type { OriginRegionGuide } from "./types.ts";

/** Regional references and explicitly identified lot examples; not guaranteed tasting outcomes. */
export const centralAmericaOriginGuides: OriginRegionGuide[] = [
  {
    "id": "panama-boquete",
    "country": "Panama",
    "name": "Boquete",
    "nameKo": "보케테",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "바루 화산 주변의 산지로, 게이샤와 전통 품종을 재배하는 농장이 있습니다.",
      "en": "A growing area around Barú with both Geisha-focused estates and traditional varieties."
    },
    "environment": {
      "ko": "화산 토양과 산악 미기후가 특징이며, 그늘과 안개, 사면 방향은 농장마다 다릅니다.",
      "en": "Volcanic soils and mountain microclimates; shade, mist and exposure vary between farms."
    },
    "flavorNotes": {
      "ko": [
        "자스민",
        "핵과류",
        "꽃향"
      ],
      "en": [
        "Jasmine",
        "Stone fruit",
        "Floral"
      ]
    },
    "varieties": [
      "Geisha",
      "Catuai",
      "Pacamara"
    ],
    "processes": {
      "ko": [
        "워시드",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "하라미요와 알토 키엘을 나누어 농장·품종·가공별 로트를 비교할 수 있습니다.",
      "en": "Explore Jaramillo and Alto Quiel separately to compare farms, varieties and processes."
    },
    "sources": [
      {
        "title": "About SCAP",
        "url": "https://scap-panama.com/about-scap/",
        "publisher": "Specialty Coffee Association of Panama",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Agricola Geisha",
        "url": "https://scap-panama.com/agricola-geisha/",
        "publisher": "Specialty Coffee Association of Panama",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Hacienda La Esmeralda",
        "url": "https://haciendaesmeralda.com/",
        "publisher": "Hacienda La Esmeralda",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Hacienda La Esmeralda가 소개하는 자사 게이샤 계열의 향미입니다. 보케테 전체의 공통 향미로 보지 않습니다.",
        "en": "Hacienda La Esmeralda’s own Geisha profile; these notes do not describe every Boquete coffee."
      },
      "flavorSourceUrls": [
        "https://haciendaesmeralda.com/"
      ]
    }
  },
  {
    "id": "panama-volcan",
    "country": "Panama",
    "name": "Volcán",
    "nameKo": "볼칸",
    "kind": "region",
    "aliases": [
      "Volcan"
    ],
    "summary": {
      "ko": "바루·티싱갈 화산 주변의 서부 치리키 커피 산지입니다.",
      "en": "A western Chiriquí origin around the Barú and Tisingal volcanoes."
    },
    "environment": {
      "ko": "얀손 농장은 숲으로 구획을 나누고 용천수를 워시드 가공에 사용합니다.",
      "en": "Janson separates plots with forest and uses spring water for wet processing."
    },
    "flavorNotes": {
      "ko": [
        "자스민",
        "청사과",
        "복숭아"
      ],
      "en": [
        "Jasmine",
        "Green apple",
        "Peach"
      ]
    },
    "varieties": [
      "Geisha",
      "Catuai",
      "Caturra",
      "Pacamara"
    ],
    "processes": {
      "ko": [
        "워시드",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "얀손처럼 농장·품종·가공이 공개된 로트를 살펴볼 만합니다.",
      "en": "Explore traceable lots with disclosed farms, varieties and processes, such as Janson."
    },
    "sources": [
      {
        "title": "Janson Coffee Farm",
        "url": "https://scap-panama.com/janson/",
        "publisher": "Specialty Coffee Association of Panama",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Volcán — Janson Coffee Farm Washed Geisha Lot 117",
        "url": "https://www.reyachcoffee.com/en/store/panama-volcan-chiriqui-janson-coffee-farm-washed-geisha/",
        "publisher": "Reyach Coffee Roastery",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Reyach Coffee가 소개한 얀손 게이샤 워시드 Lot 117의 라이트·미디엄 로스팅 향미입니다.",
        "en": "Reyach Coffee’s Janson washed Geisha Lot 117, described at a light-medium roast."
      },
      "flavorSourceUrls": [
        "https://www.reyachcoffee.com/en/store/panama-volcan-chiriqui-janson-coffee-farm-washed-geisha/"
      ]
    }
  },
  {
    "id": "panama-jaramillo",
    "country": "Panama",
    "name": "Jaramillo",
    "nameKo": "하라미요",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "보케테의 세부 산지로, 꽃향을 지닌 게이샤 로트가 생산됩니다.",
      "en": "A Boquete subregion with floral Geisha lots."
    },
    "environment": {
      "ko": "에스메랄다의 하라미요 농장은 가파른 사면에 큰 그늘나무가 있고, 산 공기는 차고 습합니다.",
      "en": "Esmeralda’s Jaramillo farm has cold, humid mountain air, mature shade trees and steep slopes."
    },
    "flavorNotes": {
      "ko": [
        "레몬 사탕",
        "녹차",
        "백도",
        "자스민"
      ],
      "en": [
        "Lemon candy",
        "Green tea",
        "White peach",
        "Jasmine"
      ]
    },
    "varieties": [
      "Geisha",
      "Pacamara"
    ],
    "processes": {
      "ko": [
        "워시드",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "농장 안에서도 작은 구획별로 로트를 분리합니다. 에스메랄다와 아그리콜라 게이샤의 농장 정보를 품종·가공별로 비교해 보세요.",
      "en": "Lots are separated even within farms. Compare Esmeralda and Agricola Geisha by plot, variety and process."
    },
    "sources": [
      {
        "title": "Jaramillo Farm",
        "url": "https://haciendaesmeralda.com/jaramillo-farm/",
        "publisher": "Hacienda La Esmeralda",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Agricola Geisha",
        "url": "https://scap-panama.com/agricola-geisha/",
        "publisher": "Specialty Coffee Association of Panama",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Hacienda La Esmeralda — Mario #5",
        "url": "https://www.offshootcoffee.com.au/products/hacienda-la-esmeralda-mario-5-rare",
        "publisher": "Offshoot Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "panama-boquete",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Offshoot Coffee가 2023년에 소개한 하라미요 농장 Mario #5 워시드 게이샤 로트의 기록입니다.",
        "en": "Offshoot Coffee’s 2023 Mario #5 washed Geisha from the Mario plot at Jaramillo Farm."
      },
      "flavorSourceUrls": [
        "https://www.offshootcoffee.com.au/products/hacienda-la-esmeralda-mario-5-rare"
      ]
    }
  },
  {
    "id": "panama-alto-quiel",
    "country": "Panama",
    "name": "Alto Quiel",
    "nameKo": "알토 키엘",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "엘리다 농장이 있는 보케테의 고지대 세부 산지입니다.",
      "en": "A highland part of Boquete containing Elida Estate."
    },
    "environment": {
      "ko": "엘리다의 재배 환경은 화산 토양, 안개, 차가운 밤과 주변 운무림의 영향을 받습니다.",
      "en": "Elida has volcanic soils, mist and cold nights, with surrounding cloud forest."
    },
    "flavorNotes": {
      "ko": [
        "자두",
        "장미수",
        "블랙베리"
      ],
      "en": [
        "Plum",
        "Rosewater",
        "Blackberry"
      ]
    },
    "varieties": [
      "Geisha",
      "Catuai",
      "Typica"
    ],
    "processes": {
      "ko": [
        "워시드",
        "허니",
        "내추럴",
        "무산소 내추럴·장기 건조"
      ],
      "en": [
        "Washed",
        "Honey",
        "Natural",
        "Anaerobic natural, slow dried"
      ]
    },
    "specialty": {
      "ko": "엘리다는 Best of Panama 수상 이력이 있습니다. 품종과 가공을 구분해 농장 안의 로트를 비교할 수 있습니다.",
      "en": "Elida has Best of Panama recognition and offers lots separated by variety and process."
    },
    "sources": [
      {
        "title": "Lamastus Family Estates",
        "url": "https://scap-panama.com/lamastus-coffees/",
        "publisher": "Specialty Coffee Association of Panama",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Panama Elida Estate",
        "url": "https://samplecoffee.com.au/coffee/elida-estate",
        "publisher": "Sample Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "panama-boquete",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Sample Coffee의 2024년 1월 수확 엘리다 카투아이 로트입니다. 무산소 발효 후 천천히 건조한 내추럴(ASD) 가공입니다.",
        "en": "Sample Coffee’s January 2024 Elida Catuai harvest, processed as anaerobic slow-dried natural (ASD)."
      },
      "flavorSourceUrls": [
        "https://samplecoffee.com.au/coffee/elida-estate"
      ]
    }
  },
  {
    "id": "panama-bambito",
    "country": "Panama",
    "name": "Bambito",
    "nameKo": "밤비토",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "세로 푼타의 밤비토 고지대입니다.",
      "en": "The Bambito highlands in Cerro Punta."
    },
    "environment": {
      "ko": "밤비토 에스테이트는 두 산등성이 사이에 있어 바람을 피하고 서로 다른 미기후를 형성합니다.",
      "en": "At Bambito Estate, two ridges shelter the farm from wind and create distinct microclimates."
    },
    "flavorNotes": {
      "ko": [
        "풋사과",
        "백차",
        "패션프루트"
      ],
      "en": [
        "Green apple",
        "White tea",
        "Passion fruit"
      ]
    },
    "varieties": [
      "Geisha",
      "Typica",
      "Caturra",
      "Catuai",
      "Yellow Catuai",
      "Red Bourbon"
    ],
    "processes": {
      "ko": [
        "워시드",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "밤비토 에스테이트에서 게이샤 워시드와 옐로 카투아이 내추럴 등 품종·가공별 사례를 살펴볼 수 있습니다.",
      "en": "Bambito Estate documents examples including washed Geisha and natural Yellow Catuai."
    },
    "sources": [
      {
        "title": "Bambito Estate Coffee",
        "url": "https://scap-panama.com/bambito-estate-coffee/",
        "publisher": "Specialty Coffee Association of Panama",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Bambito Estate Coffee — Yellow Catuai Natural",
        "url": "https://greencoffeecollective.com/products/bambito-estate-coffee-yellow-catuai-natural",
        "publisher": "Green Coffee Collective",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "panama-volcan",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Green Coffee Collective의 밤비토 옐로 카투아이 내추럴 기록입니다. 풋사과·패션프루트는 향, 백차는 여운의 묘사입니다.",
        "en": "Green Coffee Collective’s Bambito Yellow Catuai natural: green apple and passion fruit in fragrance, white tea in the finish."
      },
      "flavorSourceUrls": [
        "https://greencoffeecollective.com/products/bambito-estate-coffee-yellow-catuai-natural"
      ]
    }
  },
  {
    "id": "guatemala-antigua",
    "country": "Guatemala",
    "name": "Antigua",
    "nameKo": "안티구아",
    "kind": "region",
    "aliases": [
      "Antigua Coffee",
      "Antigua Guatemala"
    ],
    "summary": {
      "ko": "아구아·푸에고·아카테낭고 화산이 둘러싼 계곡의 커피 산지입니다.",
      "en": "A coffee valley enclosed by Agua, Fuego and Acatenango volcanoes."
    },
    "environment": {
      "ko": "일조량이 많고 밤은 서늘합니다. 토양의 부석이 수분을 보유하며 그늘나무는 때때로 찾아오는 서리로부터 커피를 보호합니다.",
      "en": "Sunny days and cool nights meet moisture-retaining pumice and shade that protects coffee during occasional frost."
    },
    "flavorNotes": {
      "ko": [
        "진한 단맛",
        "풍부한 향",
        "균형감"
      ],
      "en": [
        "Pronounced sweetness",
        "Rich aroma",
        "Balance"
      ]
    },
    "varieties": [
      "Bourbon",
      "Caturra",
      "Typica"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Los Volcanes는 여러 농가의 체리를 모아 가공한 워시드 사례입니다. 생산자 단독 로트와 구분해 비교할 수 있습니다.",
      "en": "Los Volcanes is a washed selection combining cherries from several farms; distinguish it from single-producer lots."
    },
    "sources": [
      {
        "title": "Antigua Coffee",
        "url": "https://www.guatemalancoffees.com/main/regions-and-profiles/antigua-coffee/",
        "publisher": "Anacafé / Guatemalan Coffees",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Guatemalan Antigua — Los Volcanes — Washed",
        "url": "https://burmancoffee.com/product/green-coffee-beans/guatemalan-volcanes/",
        "publisher": "Burman Coffee Traders",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "regional",
      "flavorContext": {
        "ko": "Anacafé가 안티구아 지역 프로필에서 설명한 단맛·향·균형입니다.",
        "en": "Sweetness, aroma and balance from Anacafé’s Antigua regional profile."
      },
      "flavorSourceUrls": [
        "https://www.guatemalancoffees.com/main/regions-and-profiles/antigua-coffee/"
      ]
    }
  },
  {
    "id": "guatemala-huehuetenango",
    "country": "Guatemala",
    "name": "Huehuetenango",
    "nameKo": "우에우에테낭고",
    "kind": "region",
    "aliases": [
      "Highland Huehue",
      "Huehue"
    ],
    "summary": {
      "ko": "비화산성 고산 지대에 농가와 자체 가공시설이 분산된 산지입니다.",
      "en": "A non-volcanic highland origin with dispersed farms and on-farm processing."
    },
    "environment": {
      "ko": "멕시코 테우안테펙에서 불어오는 건조하고 따뜻한 바람이 서리 위험을 낮춥니다. 하천과 계곡을 따라 가공시설이 자리합니다.",
      "en": "Warm, dry winds from Mexico’s Tehuantepec plain reduce frost risk; streams support local wet mills."
    },
    "flavorNotes": {
      "ko": [
        "와인 같은 향",
        "선명한 산미",
        "묵직한 바디"
      ],
      "en": [
        "Wine-like notes",
        "Intense acidity",
        "Full body"
      ]
    },
    "varieties": [
      "Bourbon",
      "Caturra",
      "Catuai",
      "Mundo Novo"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "산페드로 넥타처럼 마을과 생산자까지 나누어 탐색할 수 있습니다. 품종 목록은 라프로비덴시아의 확인된 로트 사례입니다.",
      "en": "Explore villages such as San Pedro Necta and individual producers. Listed varieties are documented in a La Providencia lot."
    },
    "sources": [
      {
        "title": "Highland Huehue",
        "url": "https://www.guatemalancoffees.com/main/regions-and-profiles/highland-huehue/",
        "publisher": "Anacafé / Guatemalan Coffees",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "CJ1206 — San Pedro Necta Maximiliano Palacios Fully Washed",
        "url": "https://cdn.royalcoffee.com/wp-content/uploads/2018/06/21124732/CJ1206-Guatemala-San-Pedro-Necta-Maximiliano-Palacios-Fully-Washed-Crown-Jewel.pdf",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "regional",
      "flavorContext": {
        "ko": "Anacafé의 Highland Huehue 지역 설명에 근거한 와인 계열 향미·산미·바디입니다.",
        "en": "Wine-like character, acidity and body described in Anacafé’s Highland Huehue regional profile."
      },
      "flavorSourceUrls": [
        "https://www.guatemalancoffees.com/main/regions-and-profiles/highland-huehue/"
      ]
    }
  },
  {
    "id": "guatemala-atitlan",
    "country": "Guatemala",
    "name": "Atitlán",
    "nameKo": "아티틀란",
    "kind": "region",
    "aliases": [
      "Atitlan",
      "Traditional Atitlan"
    ],
    "summary": {
      "ko": "아티틀란 호수 주변 화산 사면을 따라 형성된 산지입니다.",
      "en": "Coffee grows on volcanic slopes around Lake Atitlán."
    },
    "environment": {
      "ko": "유기물이 풍부한 화산 토양과 호수에서 부는 쇼코밀 바람이 재배지의 미기후에 영향을 줍니다.",
      "en": "Organic-rich volcanic soils and Xocomil winds from the lake influence the growing microclimate."
    },
    "flavorNotes": {
      "ko": [
        "시트러스",
        "청사과",
        "초콜릿"
      ],
      "en": [
        "Citrus",
        "Green apple",
        "Chocolate"
      ]
    },
    "varieties": [
      "Typica",
      "Bourbon",
      "Caturra"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "라보스 협동조합의 워시드는 농가별 수확물을 공동으로 가공하는 유통 사례입니다.",
      "en": "La Voz offers a documented cooperative washed selection."
    },
    "sources": [
      {
        "title": "Traditional Atitlan",
        "url": "https://www.guatemalancoffees.com/main/regions-and-profiles/traditional-atitlan/",
        "publisher": "Anacafé / Guatemalan Coffees",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Guatemala SHB Atitlán Cooperative La Voz",
        "url": "https://www.nkgquality.com/wp-content/uploads/2020/04/FS_Guatemala-SHB-Atitlan-La-Voz.pdf",
        "publisher": "InterAmerican Coffee / NKG",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "mixed",
      "flavorContext": {
        "ko": "시트러스 산미는 Anacafé 지역 설명, 청사과·초콜릿은 InterAmerican Coffee의 라보스 협동조합 워시드 자료에 근거합니다.",
        "en": "Citrus acidity comes from Anacafé’s regional profile; green apple and chocolate from InterAmerican Coffee’s La Voz washed selection."
      },
      "flavorSourceUrls": [
        "https://www.guatemalancoffees.com/main/regions-and-profiles/traditional-atitlan/",
        "https://www.nkgquality.com/wp-content/uploads/2020/04/FS_Guatemala-SHB-Atitlan-La-Voz.pdf"
      ]
    }
  },
  {
    "id": "guatemala-coban",
    "country": "Guatemala",
    "name": "Cobán",
    "nameKo": "코반",
    "kind": "region",
    "aliases": [
      "Coban",
      "Rainforest Coban"
    ],
    "summary": {
      "ko": "비와 안개가 잦은 알타베라파스의 숲 지대 커피 산지입니다.",
      "en": "A forested Alta Verapaz origin with frequent rain and mist."
    },
    "environment": {
      "ko": "대서양 기후의 영향을 받아 서늘하고 습하며, 석회암·점토 토양의 구릉에 커피가 자랍니다. 치피치피라는 미세한 안개비가 특징입니다.",
      "en": "Atlantic influence brings cool, wet conditions to limestone and clay hills, including the fine mist known as chipichipi."
    },
    "flavorNotes": {
      "ko": [
        "신선한 과일",
        "은은한 견과",
        "크리미한 질감"
      ],
      "en": [
        "Fresh fruit",
        "Gentle nuttiness",
        "Creamy texture"
      ]
    },
    "varieties": [
      "Bourbon",
      "Caturra",
      "Pache",
      "Maragogype"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Selección Coban은 소농의 워시드 커피를 묶어 소개한 실제 유통 사례입니다.",
      "en": "Selección Coban is a documented washed smallholder selection."
    },
    "sources": [
      {
        "title": "Rainforest Coban",
        "url": "https://www.guatemalancoffees.com/main/regions-and-profiles/rainforest-coban/",
        "publisher": "Anacafé / Guatemalan Coffees",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Guatemala: Selección Coban",
        "url": "https://www.covoyacoffee.com/mwdownloads/download/link/id/247",
        "publisher": "Covoya / Olam Specialty Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "mixed",
      "flavorContext": {
        "ko": "신선한 과일은 Anacafé의 지역 설명, 견과·크리미한 질감은 Covoya/Olam의 Selección Coban 워시드 자료에서 확인됩니다.",
        "en": "Fresh fruit follows Anacafé’s regional profile; nuttiness and creamy texture follow Covoya/Olam’s washed Selección Coban."
      },
      "flavorSourceUrls": [
        "https://www.guatemalancoffees.com/main/regions-and-profiles/rainforest-coban/",
        "https://www.covoyacoffee.com/mwdownloads/download/link/id/247"
      ]
    }
  },
  {
    "id": "guatemala-san-pedro-necta",
    "country": "Guatemala",
    "name": "San Pedro Necta",
    "nameKo": "산페드로 넥타",
    "kind": "microregion",
    "aliases": [
      "San Pedro Nectá"
    ],
    "summary": {
      "ko": "우에우에테낭고 안의 세부 커피 산지입니다.",
      "en": "A coffee subregion within Huehuetenango."
    },
    "environment": {
      "ko": "라프로비덴시아 농장은 경사진 지형을 활용한 수로와 가공시설을 운영합니다.",
      "en": "La Providencia uses its sloped terrain for a gravity-assisted mill and water channels."
    },
    "flavorNotes": {
      "ko": [
        "백도",
        "살구",
        "황설탕",
        "라임 껍질"
      ],
      "en": [
        "White peach",
        "Apricot",
        "Brown sugar",
        "Lime zest"
      ]
    },
    "varieties": [
      "Bourbon",
      "Catuai",
      "Caturra",
      "Mundo Novo"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "라프로비덴시아처럼 마을·생산자·수확연도를 함께 확인할 수 있는 로트를 비교하세요.",
      "en": "Compare lots that disclose village, producer and harvest, such as La Providencia."
    },
    "sources": [
      {
        "title": "CJ1206 — San Pedro Necta Maximiliano Palacios Fully Washed",
        "url": "https://cdn.royalcoffee.com/wp-content/uploads/2018/06/21124732/CJ1206-Guatemala-San-Pedro-Necta-Maximiliano-Palacios-Fully-Washed-Crown-Jewel.pdf",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "guatemala-huehuetenango",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Royal Coffee가 2018년에 분석한 Maximiliano Palacios의 2017/18 수확 워시드 로트(CJ1206) 추출평가입니다.",
        "en": "Royal Coffee’s 2018 brew analysis of Maximiliano Palacios’s washed CJ1206 lot from the 2017/18 harvest."
      },
      "flavorSourceUrls": [
        "https://cdn.royalcoffee.com/wp-content/uploads/2018/06/21124732/CJ1206-Guatemala-San-Pedro-Necta-Maximiliano-Palacios-Fully-Washed-Crown-Jewel.pdf"
      ]
    }
  },
  {
    "id": "costa-rica-tarrazu",
    "country": "Costa Rica",
    "name": "Tarrazú",
    "nameKo": "타라수",
    "kind": "region",
    "aliases": [
      "Tarrazu"
    ],
    "summary": {
      "ko": "로스산토스 커피권의 산지로, 타라수·도타·레온코르테스는 원산지명에서도 함께 다뤄집니다.",
      "en": "A Los Santos coffee origin; the Tarrazú designation also covers Dota and León Cortés."
    },
    "environment": {
      "ko": "작은 계곡과 가파른 사면, 뚜렷한 우기·건기가 특징이며, 토양의 상당 부분은 퇴적암 기원입니다.",
      "en": "Small valleys and steep slopes have distinct wet and dry seasons, with much of the area’s soil sedimentary in origin."
    },
    "flavorNotes": {
      "ko": [
        "섬세한 산미",
        "은은한 초콜릿",
        "풍부한 향"
      ],
      "en": [
        "Fine acidity",
        "Light chocolate",
        "Intense aroma"
      ]
    },
    "varieties": [
      "Caturra",
      "Catuai"
    ],
    "processes": {
      "ko": [
        "워시드",
        "허니",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Honey",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "Santa Elena처럼 가공을 나누어 제공하는 농장의 워시드·허니·내추럴 로트를 비교할 수 있습니다.",
      "en": "Compare washed, honey and natural lots from farms documenting separate processes, such as Santa Elena."
    },
    "sources": [
      {
        "title": "Los Santos",
        "url": "https://www.icafe.cr/nuestro-cafe/regiones-cafetaleras/lossantos/",
        "publisher": "ICAFE",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Denominación de Origen Café Tarrazú",
        "url": "https://docafetarrazu.com/",
        "publisher": "Consejo Regulador de la D.O. Café Tarrazú",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Santa Elena Estate",
        "url": "https://www.atlascoffee.com/coffees/santa-elena-estate/",
        "publisher": "Atlas Coffee Importers",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "regional",
      "flavorContext": {
        "ko": "ICAFE의 넓은 로스산토스 커피권 설명입니다. 타라수의 모든 개별 농장이 같은 향미를 갖는다는 뜻은 아닙니다.",
        "en": "ICAFE’s wider Los Santos coffee-region profile; it is not a uniform description of every Tarrazú farm."
      },
      "flavorSourceUrls": [
        "https://www.icafe.cr/nuestro-cafe/regiones-cafetaleras/lossantos/"
      ]
    }
  },
  {
    "id": "costa-rica-west-valley",
    "country": "Costa Rica",
    "name": "West Valley",
    "nameKo": "웨스트 밸리",
    "kind": "region",
    "aliases": [
      "Valle Occidental",
      "Occidental",
      "Occidente"
    ],
    "summary": {
      "ko": "나란호·산라몬·팔마레스 등 여러 마을을 포함하는 서부 커피 산지입니다.",
      "en": "A western origin encompassing localities such as Naranjo, San Ramón and Palmares."
    },
    "environment": {
      "ko": "중앙산맥의 계곡과 사면에 화산 토양이 발달했습니다. 건기와 수확기가 겹쳐 건조 작업에 유리합니다.",
      "en": "Volcanic soils cover Central Range valleys and slopes; harvest overlaps the dry season."
    },
    "flavorNotes": {
      "ko": [
        "살구",
        "복숭아",
        "균형 잡힌 산미"
      ],
      "en": [
        "Apricot",
        "Peach",
        "Balanced acidity"
      ]
    },
    "varieties": [
      "Caturra",
      "Catuai",
      "Villa Sarchi"
    ],
    "processes": {
      "ko": [
        "워시드",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "나란호의 비야사르치처럼 품종과 가공이 공개된 로트로 탐색 범위를 좁힐 수 있습니다.",
      "en": "Narrow the search to traceable varieties and processes, including Naranjo Villa Sarchi lots."
    },
    "sources": [
      {
        "title": "Valle Occidental",
        "url": "https://www.icafe.cr/nuestro-cafe/regiones-cafetaleras/valle-occidental/",
        "publisher": "ICAFE",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Los Coyotes Natural",
        "url": "https://www.allycoffee.com/coffees/los-coyotes-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Villa Sarchi Washed SHB — Cafetalera Herbazu",
        "url": "https://docnursecoffee.com/villa-sarchi-washed-shb-coffee/",
        "publisher": "DocNurse Coffee Importers",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "regional",
      "flavorContext": {
        "ko": "ICAFE의 Valle Occidental 지역 설명에 나온 핵과류 연상과 산미의 균형을 옮겼습니다.",
        "en": "Stone-fruit associations and balanced acidity from ICAFE’s Valle Occidental regional profile."
      },
      "flavorSourceUrls": [
        "https://www.icafe.cr/nuestro-cafe/regiones-cafetaleras/valle-occidental/"
      ]
    }
  },
  {
    "id": "costa-rica-central-valley",
    "country": "Costa Rica",
    "name": "Central Valley",
    "nameKo": "센트럴 밸리",
    "kind": "region",
    "aliases": [
      "Valle Central"
    ],
    "summary": {
      "ko": "산호세·에레디아·알라후엘라에 걸친 코스타리카의 오래된 커피 산지입니다.",
      "en": "A long-established origin spanning San José, Heredia and Alajuela."
    },
    "environment": {
      "ko": "산과 화산으로 둘러싸인 중앙 고원에 있으며, 산호세·알라후엘라·에레디아의 도시 외곽에도 농장이 남아 있습니다.",
      "en": "A central plateau surrounded by mountains and volcanoes, with farms around the outskirts of San José, Alajuela and Heredia."
    },
    "flavorNotes": {
      "ko": [
        "사과",
        "레몬",
        "다크 초콜릿"
      ],
      "en": [
        "Apple",
        "Lemon",
        "Dark chocolate"
      ]
    },
    "varieties": [
      "Villa Sarchi",
      "Geisha"
    ],
    "processes": {
      "ko": [
        "워시드",
        "허니"
      ],
      "en": [
        "Washed",
        "Honey"
      ]
    },
    "specialty": {
      "ko": "Brumas del Zurquí처럼 품종과 가공을 분리한 마이크로밀 로트를 찾을 수 있습니다. 품종 목록은 확인된 유통 사례를 나타냅니다.",
      "en": "Micromills such as Brumas del Zurquí offer variety- and process-separated lots. Listed varieties are documented examples."
    },
    "sources": [
      {
        "title": "Brumas del Zurquí Villa Sarchi Washed",
        "url": "https://www.allycoffee.com/coffees/brumas-del-zurqui-villa-sarchi-washed/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brumas del Zurquí Geisha Honey",
        "url": "https://www.allycoffee.com/coffees/brumas-del-zurqui-geisha-honey/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Ally Coffee가 소개한 Brumas del Zurquí의 El Centro 농장 비야사르치 워시드, 2026년 수확 로트 향미입니다.",
        "en": "Ally Coffee’s 2026 El Centro Villa Sarchi washed lot from Brumas del Zurquí."
      },
      "flavorSourceUrls": [
        "https://www.allycoffee.com/coffees/brumas-del-zurqui-villa-sarchi-washed/"
      ]
    }
  },
  {
    "id": "costa-rica-dota",
    "country": "Costa Rica",
    "name": "Dota",
    "nameKo": "도타",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "타라수 커피권의 세부 산지로, 산타마리아·코페이에 농장과 가공소가 있습니다.",
      "en": "A Tarrazú coffee subregion with farms and mills in Santa María and Copey."
    },
    "environment": {
      "ko": "로스산토스의 산악 지대에 있으며, 코페이의 Dota Coffee Company는 고지대에서 게이샤·카투아이를 재배합니다.",
      "en": "Part of the Los Santos mountains; Dota Coffee Company grows Geisha and Catuai at high elevations in Copey."
    },
    "flavorNotes": {
      "ko": [
        "꽃향",
        "꿀",
        "크리미한 여운"
      ],
      "en": [
        "Floral",
        "Honey",
        "Creamy finish"
      ]
    },
    "varieties": [
      "Catuai",
      "Geisha"
    ],
    "processes": {
      "ko": [
        "워시드",
        "블랙 허니"
      ],
      "en": [
        "Washed",
        "Black honey"
      ]
    },
    "specialty": {
      "ko": "Coopedota의 워시드 가공과 Dota Coffee Company의 블랙 허니처럼 생산자·가공별 사례를 나누어 살펴볼 수 있습니다.",
      "en": "Explore distinct producer and process examples, including Coopedota washed coffee and Dota Coffee Company black honey."
    },
    "sources": [
      {
        "title": "Costa Rica Guanacaste from Coopedota",
        "url": "https://medium.com/ally-coffee/costa-rica-guanacaste-from-coopedota-a62749a94e2a",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Dota Coffee Company",
        "url": "https://www.dotacoffeecompany.com/",
        "publisher": "Dota Coffee Company",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Denominación de Origen Café Tarrazú",
        "url": "https://docafetarrazu.com/",
        "publisher": "Consejo Regulador de la D.O. Café Tarrazú",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Geisha 340 g — Black Honey",
        "url": "https://www.dotacoffeecompany.com/product-page/geisha-340-g",
        "publisher": "Dota Coffee Company",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "costa-rica-tarrazu",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "코페이의 Dota Coffee Company가 소개한 게이샤 블랙 허니 제품의 미디엄 로스팅 향미입니다.",
        "en": "Dota Coffee Company’s medium-roasted Geisha black-honey product from Copey."
      },
      "flavorSourceUrls": [
        "https://www.dotacoffeecompany.com/product-page/geisha-340-g"
      ]
    }
  },
  {
    "id": "costa-rica-naranjo",
    "country": "Costa Rica",
    "name": "Naranjo",
    "nameKo": "나란호",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "웨스트 밸리 안에서 비야사르치 등의 스페셜티 로트가 생산되는 산지입니다.",
      "en": "A West Valley locality producing specialty lots such as Villa Sarchi."
    },
    "environment": {
      "ko": "같은 마을 안에서도 농장마다 고도와 가공 환경이 다릅니다.",
      "en": "Farm elevations and processing conditions vary within the locality."
    },
    "flavorNotes": {
      "ko": [
        "꽃향",
        "블루베리",
        "둥근 질감"
      ],
      "en": [
        "Floral",
        "Blueberry",
        "Round mouthfeel"
      ]
    },
    "varieties": [
      "Villa Sarchi",
      "Villa Lobos",
      "Caturra",
      "Catuai"
    ],
    "processes": {
      "ko": [
        "워시드",
        "허니",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Honey",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "Aguilera 형제의 내추럴·허니와 Herbazu의 워시드 등, 같은 나란호 안에서도 생산자와 가공을 나누어 비교할 수 있습니다.",
      "en": "Compare producers and processes within Naranjo, including Aguilera natural/honey lots and Herbazu washed coffee."
    },
    "sources": [
      {
        "title": "Valle Occidental",
        "url": "https://www.icafe.cr/nuestro-cafe/regiones-cafetaleras/valle-occidental/",
        "publisher": "ICAFE",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Los Coyotes Natural",
        "url": "https://www.allycoffee.com/coffees/los-coyotes-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Aguilera Brothers — Producer Profile",
        "url": "https://www.horshamcoffeeroaster.co.uk/pages/coffee-producer/aguilera-brothers",
        "publisher": "Horsham Coffee Roaster",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Villa Sarchi Washed SHB — Cafetalera Herbazu",
        "url": "https://docnursecoffee.com/villa-sarchi-washed-shb-coffee/",
        "publisher": "DocNurse Coffee Importers",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "costa-rica-west-valley",
    "altitude": {
      "min": 800,
      "max": 1700
    },
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Ally Coffee가 소개한 Aguilera 형제의 Los Coyotes 비야사르치 내추럴 로트 기록입니다.",
        "en": "Ally Coffee’s Los Coyotes Villa Sarchi natural lot from the Aguilera brothers."
      },
      "flavorSourceUrls": [
        "https://www.allycoffee.com/coffees/los-coyotes-natural/"
      ]
    }
  },
  {
    "id": "honduras-marcala",
    "country": "Honduras",
    "name": "Marcala",
    "nameKo": "마르칼라",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "라파스의 커피 산지로, COMSA 같은 생산자 조직이 있습니다.",
      "en": "A La Paz coffee origin with producer groups such as COMSA."
    },
    "environment": {
      "ko": "COMSA는 산악 농장들의 커피를 모으며, 일부 워시드 로트는 햇빛과 기계로 건조합니다.",
      "en": "COMSA brings together mountain farms; some washed lots combine sun and mechanical drying."
    },
    "flavorNotes": {
      "ko": [
        "시트러스",
        "적포도",
        "황설탕",
        "카카오닙"
      ],
      "en": [
        "Citrus",
        "Red grape",
        "Brown sugar",
        "Cacao nib"
      ]
    },
    "varieties": [
      "Bourbon",
      "Catuai",
      "Caturra",
      "Lempira",
      "IHCAFE 90",
      "Pacas"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "향미는 Royal Coffee의 COMSA 워시드 제품 기록에 근거합니다. 단체 로트와 개별 생산자 로트를 구분하면 산지 내 차이를 보기 쉽습니다.",
      "en": "Flavor examples follow Royal Coffee’s COMSA washed offering. Distinguish group selections from individually identified producer lots."
    },
    "sources": [
      {
        "title": "Honduras Organic COMSA SHG EP — lot 38573",
        "url": "https://royalcoffee.com/product/3427097000048416145/",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Royal Coffee의 COMSA 워시드 로트 38573의 향미입니다. 디카페인 제품의 노트와 구분합니다.",
        "en": "Descriptors refer to Royal Coffee’s COMSA washed lot 38573, separate from its decaffeinated offerings."
      },
      "flavorSourceUrls": [
        "https://royalcoffee.com/product/3427097000048416145/"
      ]
    }
  },
  {
    "id": "honduras-copan",
    "country": "Honduras",
    "name": "Copán",
    "nameKo": "코판",
    "kind": "region",
    "aliases": [
      "Copan"
    ],
    "summary": {
      "ko": "과테말라 국경을 따라 이어지는 온두라스 북서부 산악 커피권입니다.",
      "en": "A northwestern mountain coffee origin along Honduras’ border with Guatemala."
    },
    "environment": {
      "ko": "인가·과수·산림 나무를 그늘로 사용하며, 재배 고도는 1,000~1,500m입니다. San Isidro 주변은 비교적 건조합니다.",
      "en": "Shade includes Inga, fruit and forest trees. Coffee grows at 1,000–1,500 m; San Isidro is relatively dry."
    },
    "flavorNotes": {
      "ko": [
        "꽃향",
        "만다린",
        "섬세함"
      ],
      "en": [
        "Floral",
        "Mandarin orange",
        "Delicate"
      ]
    },
    "varieties": [
      "Catuai",
      "Obata"
    ],
    "processes": {
      "ko": [
        "3단계 발효"
      ],
      "en": [
        "Triple fermentation"
      ]
    },
    "specialty": {
      "ko": "Katia Duke의 San Isidro는 발효 단계별 실험을 확인할 수 있는 생산자 사례입니다. 표시 향미와 품종은 이 로트에 근거합니다.",
      "en": "Katia Duke’s San Isidro illustrates staged fermentation. Listed flavors and varieties refer to that documented lot."
    },
    "sources": [
      {
        "title": "San Isidro Triple Fermentation",
        "url": "https://www.allycoffee.com/coffees/san-isidro-triple-fermentation/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "altitude": {
      "min": 1000,
      "max": 1500
    },
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Katia Duke의 San Isidro 3단계 발효 로트 사례이며 농장 고도는 1,300m입니다.",
        "en": "Descriptors refer to Katia Duke’s San Isidro triple-fermentation lot, documented at 1,300 m."
      },
      "flavorSourceUrls": [
        "https://www.allycoffee.com/coffees/san-isidro-triple-fermentation/"
      ]
    }
  },
  {
    "id": "honduras-comayagua",
    "country": "Honduras",
    "name": "Comayagua",
    "nameKo": "코마야과",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "온두라스 중부 산악 지대의 커피 산지입니다.",
      "en": "A coffee origin in the mountains of central Honduras."
    },
    "environment": {
      "ko": "몬테시요스 산맥 쪽 농가의 워시드 로트는 수확한 날 탈과육하고, 발효·수세 뒤 천일 건조합니다.",
      "en": "The washed selection from farms toward Montecillos is pulped on the day of harvest, fermented, washed and sun-dried."
    },
    "flavorNotes": {
      "ko": [
        "자몽",
        "시트러스",
        "과일향"
      ],
      "en": [
        "Grapefruit",
        "Citrus",
        "Fruit"
      ]
    },
    "varieties": [
      "Bourbon",
      "Catuai",
      "IHCAFE 90",
      "Typica"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Sucafina의 Comayagua SHG 로트는 밝은 산미와 자몽의 여운을 소개합니다. SHG 표기만으로 스페셜티 품질을 보장하지는 않습니다.",
      "en": "Sucafina’s Comayagua SHG lot documents bright acidity and a grapefruit finish. SHG alone does not establish specialty quality."
    },
    "sources": [
      {
        "title": "Comayagua SHG Fully Washed",
        "url": "https://sucafina.com/na/offerings/comayagua-shg-fully-washed",
        "publisher": "Sucafina",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Sucafina가 Comayagua로 판매하는 Montecillos 소농 워시드 선별 사례입니다.",
        "en": "Descriptors refer to Sucafina’s Comayagua washed selection from small farms in Montecillos."
      },
      "flavorSourceUrls": [
        "https://sucafina.com/na/offerings/comayagua-shg-fully-washed"
      ]
    }
  },
  {
    "id": "honduras-santa-barbara",
    "country": "Honduras",
    "name": "Santa Bárbara",
    "nameKo": "산타바르바라",
    "kind": "region",
    "aliases": [
      "Santa Barbara"
    ],
    "summary": {
      "ko": "산타바르바라 산 주변의 소농 로트로 주목받는 산지입니다.",
      "en": "An origin known for smallholder lots around Santa Bárbara Mountain."
    },
    "environment": {
      "ko": "요호아 호수와 열대림 주변에 농장이 분포합니다. 산타바르바라 행정구역은 코판·오팔라카·몬테시요스 커피권에 걸쳐 있습니다.",
      "en": "Farms lie near Lake Yojoa and rainforest. The department overlaps the Copán, Opalaca and Montecillos coffee regions."
    },
    "flavorNotes": {
      "ko": [
        "핵과일",
        "청포도",
        "꿀"
      ],
      "en": [
        "Stone fruit",
        "White grape",
        "Honey"
      ]
    },
    "varieties": [
      "Pacas",
      "Bourbon",
      "Parainema",
      "Lempira",
      "IHCAFE 90"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "San Vicente가 연결한 생산자별 로트를 비교할 수 있습니다. Edgardo Reyes 판매 기록은 파카스·부르봉 워시드로 표시됩니다.",
      "en": "Compare producer lots connected through San Vicente. The Edgardo Reyes offering is labeled washed Pacas and Bourbon."
    },
    "sources": [
      {
        "title": "El Pino — Core Coffee",
        "url": "https://www.allycoffee.com/coffees/el-pino-washed/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Honduras Edgardo Reyes",
        "url": "https://onyxcoffeelab.com/products/honduras-edgardo-reyes-old",
        "publisher": "Onyx Coffee Lab",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Onyx의 Edgardo Reyes 워시드 판매 기록에 근거합니다. 지역 전체의 공통 향미는 아닙니다.",
        "en": "Descriptors refer to Onyx’s archived Edgardo Reyes washed offering, rather than every Santa Bárbara coffee."
      },
      "flavorSourceUrls": [
        "https://onyxcoffeelab.com/products/honduras-edgardo-reyes-old"
      ]
    }
  },
  {
    "id": "el-salvador-santa-ana",
    "country": "El Salvador",
    "name": "Santa Ana",
    "nameKo": "산타아나",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "엘살바도르 서부 화산 사면의 전통적인 커피 산지입니다.",
      "en": "A traditional coffee origin on western El Salvador’s volcanic slopes."
    },
    "environment": {
      "ko": "화산 사면에서 부르봉 커피를 재배합니다.",
      "en": "Bourbon coffee grows on the volcanic slopes."
    },
    "flavorNotes": {
      "ko": [
        "버터스카치",
        "시트러스 껍질",
        "피칸"
      ],
      "en": [
        "Butterscotch",
        "Citrus zest",
        "Pecan"
      ]
    },
    "varieties": [
      "Bourbon"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "지역 설명과 판매 로트를 나누어 읽으면 품종·수확별 차이를 비교하기 쉽습니다.",
      "en": "Compare regional descriptions with individual offerings to distinguish variety and harvest differences."
    },
    "sources": [
      {
        "title": "Chalate 2017 — The Project",
        "url": "https://www.cafeimports.com/europe/blog/2017/11/14/chalate-2017-the-project/",
        "publisher": "Cafe Imports",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Balam Santa Ana — washed selection 25788",
        "url": "https://www.cafeimports.com/north-america/offerings?view=beanology.view.santa-ana-25788",
        "publisher": "Cafe Imports",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "mixed",
      "flavorContext": {
        "ko": "버터스카치는 2017년 지역 설명, 시트러스 껍질·피칸은 Balam 워시드 25788의 노트입니다.",
        "en": "Butterscotch follows the 2017 regional description; citrus zest and pecan refer to Balam washed selection 25788."
      },
      "flavorSourceUrls": [
        "https://www.cafeimports.com/europe/blog/2017/11/14/chalate-2017-the-project/",
        "https://www.cafeimports.com/north-america/offerings?view=beanology.view.santa-ana-25788"
      ]
    }
  },
  {
    "id": "el-salvador-chalatenango",
    "country": "El Salvador",
    "name": "Chalatenango",
    "nameKo": "찰라테낭고",
    "kind": "region",
    "aliases": [
      "Chalate"
    ],
    "summary": {
      "ko": "파카스와 파카마라를 재배하는 소농들이 있는 북부 산지입니다.",
      "en": "A northern origin with smallholders growing Pacas and Pacamara."
    },
    "environment": {
      "ko": "2017년에는 폭우 뒤 농장 접근로의 통행이 어려웠고, 농가별 수확량은 적었습니다.",
      "en": "In 2017, farms faced difficult road access after heavy rain and small farm-level harvests."
    },
    "flavorNotes": {
      "ko": [
        "복숭아",
        "꽃향",
        "베리"
      ],
      "en": [
        "Peach",
        "Floral",
        "Berry"
      ]
    },
    "varieties": [
      "Pacas",
      "Pacamara"
    ],
    "processes": {
      "ko": [
        "워시드",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "장기 구매 프로젝트와 지역 품평회가 생산자별 커피를 소개합니다. 2019년에는 Peña Redonda의 파카마라 내추럴이 기록됩니다.",
      "en": "Sourcing projects and regional cuppings identify producers; the 2019 report documents Peña Redonda’s natural Pacamara."
    },
    "sources": [
      {
        "title": "Chalate 2017 — The Project",
        "url": "https://www.cafeimports.com/europe/blog/2017/11/14/chalate-2017-the-project/",
        "publisher": "Cafe Imports",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "El Salvador Harvest Report 2019",
        "url": "https://www.cafeimports.com/europe/blog/2019/05/29/el-salvador-harvest-report-2019/",
        "publisher": "Cafe Imports",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Chalate Microlot — Efrain Solis, Finca El Amoton, Pacamara Washed 26496",
        "url": "https://www.cafeimports.com/north-america/offerings?view=beanology.view.efrain-solis-finca-el-amoton-pacamara-washed-26496",
        "publisher": "Cafe Imports",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "2017년 글에서 회고한 Jason Long의 2008년 파카마라 시음 사례입니다. 해당 문장에는 농장·로트 번호가 없습니다.",
        "en": "Descriptors come from Jason Long’s 2008 Pacamara tasting recalled in the 2017 article; that passage gives no farm or lot number."
      },
      "flavorSourceUrls": [
        "https://www.cafeimports.com/europe/blog/2017/11/14/chalate-2017-the-project/"
      ]
    }
  },
  {
    "id": "nicaragua-jinotega",
    "country": "Nicaragua",
    "name": "Jinotega",
    "nameKo": "히노테가",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "Aldea Global 같은 생산자 조직을 통해 가족 농가의 커피가 유통되는 북부 산지입니다.",
      "en": "A northern origin with family-farm coffees organized through groups such as Aldea Global."
    },
    "environment": {
      "ko": "Aldea 선별 커피는 점토질 토양의 농가에서 생산되며, 수세 후 햇빛에 건조합니다.",
      "en": "The Aldea selection comes from farms with clay-mineral soils and is washed and sun-dried."
    },
    "flavorNotes": {
      "ko": [
        "청사과",
        "건망고",
        "황설탕",
        "다크초콜릿"
      ],
      "en": [
        "Green apple",
        "Dried mango",
        "Brown sugar",
        "Dark chocolate"
      ]
    },
    "varieties": [
      "Bourbon",
      "Catuai",
      "Caturra"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Aldea Global처럼 생산자 조직이 확인되는 선별 커피를 비교할 수 있습니다. 향미는 개별 판매 기록을 확인하세요.",
      "en": "Compare selections identified by producer organizations such as Aldea Global, checking each offering’s flavor record."
    },
    "sources": [
      {
        "title": "Nicaragua Jinotega Aldea SHG EP",
        "url": "https://royalcoffee.com/product/3427097000031047013/",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Royal Coffee의 Jinotega Aldea SHG EP 로트 34243의 향미입니다.",
        "en": "Descriptors refer to Royal Coffee’s Jinotega Aldea SHG EP lot 34243."
      },
      "flavorSourceUrls": [
        "https://royalcoffee.com/product/3427097000031047013/"
      ]
    }
  },
  {
    "id": "nicaragua-matagalpa",
    "country": "Nicaragua",
    "name": "Matagalpa",
    "nameKo": "마타갈파",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "니카라과 북부의 산악 커피 산지로, 야시카 노르테에 Limoncillo 농장이 있다.",
      "en": "A mountainous coffee origin in northern Nicaragua, with Limoncillo in Yasica Norte."
    },
    "environment": {
      "ko": "Limoncillo에는 커피 재배지와 보전된 열대우림이 함께 분포한다.",
      "en": "Limoncillo combines coffee plantings with protected rainforest."
    },
    "flavorNotes": {
      "ko": [
        "퍼지",
        "피칸",
        "노란 자두"
      ],
      "en": [
        "Fudge",
        "Pecan",
        "Yellow plum"
      ]
    },
    "varieties": [
      "Ethiosar"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Mierisch 가문의 Limoncillo Ethiosar 워시드는 Ozone이 별도로 소개한 농장 로트다.",
      "en": "Ozone documents a distinct washed Ethiosar lot from the Mierisch family's Limoncillo."
    },
    "sources": [
      {
        "title": "927 — Finca Limoncillo, Ethiosar, Washed",
        "url": "https://ozonecoffee.co.uk/blogs/in-my-mug-episodes/927-nicaragua-finca-limoncillo-ethiosar-washed",
        "publisher": "Ozone Coffee UK",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Ozone의 Limoncillo Ethiosar 워시드 IMM 927 로트 향미다.",
        "en": "These notes describe Ozone’s Limoncillo Ethiosar washed IMM 927 lot."
      },
      "flavorSourceUrls": [
        "https://ozonecoffee.co.uk/blogs/in-my-mug-episodes/927-nicaragua-finca-limoncillo-ethiosar-washed"
      ]
    }
  },
  {
    "id": "nicaragua-nueva-segovia",
    "country": "Nicaragua",
    "name": "Nueva Segovia",
    "nameKo": "누에바 세고비아",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "온두라스 국경의 산악 산지로, 디필토·모손테 등의 커피 마을을 포함합니다.",
      "en": "A mountainous origin on the Honduran border, including coffee localities such as Dipilto and Mozonte."
    },
    "environment": {
      "ko": "일부 농장에서는 커피와 인가·과수·숲 나무를 함께 재배합니다. 오코탈에는 건식 가공·보관 시설이 모입니다.",
      "en": "Some farms grow coffee alongside Inga, fruit and forest trees; Ocotal hosts dry mills and warehouses."
    },
    "flavorNotes": {
      "ko": [
        "황설탕",
        "카카오닙",
        "캐러멜",
        "레몬"
      ],
      "en": [
        "Brown sugar",
        "Cacao nib",
        "Caramel",
        "Lemon"
      ]
    },
    "varieties": [
      "Caturra",
      "Catuai"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "2026년 Cafetos de Segovia 선별 로트는 농장명과 가공 경로가 공개된 사례입니다. 디필토로 범위를 좁혀 생산자별 커피도 비교할 수 있습니다.",
      "en": "A 2026 Cafetos de Segovia selection documents farms and processing. Narrow the search to Dipilto for producer-level comparisons."
    },
    "sources": [
      {
        "title": "Regional Nueva Segovia — Caturra & Catuai — Washed — 2026",
        "url": "https://www.allycoffee.com/coffees/regional-nueva-segovia-caturra-catuai-washed-2026/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "2025/26 El Naranjal·San Antonio·Santa Isabel 워시드 블렌드입니다. Dipilto와 Mozonte 농장이 함께 참여합니다.",
        "en": "Descriptors refer to the 2025/26 El Naranjal, San Antonio and Santa Isabel washed blend, including farms in Dipilto and Mozonte."
      },
      "flavorSourceUrls": [
        "https://www.allycoffee.com/coffees/regional-nueva-segovia-caturra-catuai-washed-2026/"
      ]
    }
  },
  {
    "id": "nicaragua-dipilto",
    "country": "Nicaragua",
    "name": "Dipilto",
    "nameKo": "디필토",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "누에바 세고비아 안에 스페셜티 농장들이 자리한 세부 산지입니다.",
      "en": "A Nueva Segovia locality with specialty coffee farms."
    },
    "environment": {
      "ko": "Las Nubes는 Dipilto Viejo의 국경 인근 농장으로, 2012년 당시 수원과 보호 숲을 관리했습니다.",
      "en": "Las Nubes, near the border in Old Dipilto, maintained water sources and protected forest in 2012."
    },
    "flavorNotes": {
      "ko": [
        "자스민",
        "귤",
        "자두",
        "레몬"
      ],
      "en": [
        "Jasmine",
        "Tangerine",
        "Plum",
        "Lemon"
      ]
    },
    "varieties": [
      "Hybrid (unspecified)"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Las Nubes의 2012년 대회 워시드 로트가 구체적인 사례입니다. 품종은 기록상 Hybrid이며 세부 교배명은 명시되지 않습니다.",
      "en": "Las Nubes’ 2012 competition washed lot provides a specific example. The record lists Hybrid without identifying its cross."
    },
    "sources": [
      {
        "title": "Las Nubes — Nicaragua Cup of Excellence 2012, 87.22",
        "url": "https://allianceforcoffeeexcellence.org/farm-directory/87-22-3/",
        "publisher": "Alliance for Coffee Excellence",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "nicaragua-nueva-segovia",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "ACE가 기록한 Carlos Alberto Bendaña Albir의 Las Nubes 2012년 출품 로트의 향·맛·산미에서 골랐습니다.",
        "en": "Descriptors are selected from the aroma, flavor and acidity record of Carlos Alberto Bendaña Albir’s Las Nubes 2012 entry."
      },
      "flavorSourceUrls": [
        "https://allianceforcoffeeexcellence.org/farm-directory/87-22-3/"
      ]
    }
  },
  {
    "id": "mexico-chiapas",
    "country": "Mexico",
    "name": "Chiapas",
    "nameKo": "치아파스",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "멕시코 남부의 넓은 산악 산지로, 같은 주 안에서도 마을·생산자별 차이가 큽니다.",
      "en": "A broad southern Mexican mountain origin with substantial locality and producer differences."
    },
    "environment": {
      "ko": "산악 지형과 많은 비, 다양한 미기후가 재배 환경을 만듭니다. 소농 커피를 분리해 소개하는 생산자 지원 조직이 있습니다.",
      "en": "Mountain terrain, abundant rain and varied microclimates support small farms and producer-focused sourcing organizations."
    },
    "flavorNotes": {
      "ko": [
        "시트러스",
        "과일향",
        "밀크초콜릿",
        "견과"
      ],
      "en": [
        "Citrus",
        "Fruit",
        "Milk chocolate",
        "Nutty"
      ]
    },
    "varieties": [
      "Bourbon",
      "Caturra"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Cafeología가 소개한 Nelson Jimenez의 워시드 로트가 향미의 구체적 사례입니다. 주 이름 다음에 생산자와 마을 정보를 확인해 보세요.",
      "en": "Nelson Jimenez’s washed coffee through Cafeología provides a concrete flavor example. Follow the state name with producer and locality details."
    },
    "sources": [
      {
        "title": "Cafeología — Nelson Jimenez — Bourbon Caturra — Washed",
        "url": "https://www.allycoffee.com/coffees/cafeologia-nelson-jimenez-bourbon-caturra-washed/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Cafeología가 공급한 Nelson Jimenez의 2024/25 부르봉·카투라 워시드 로트입니다.",
        "en": "Descriptors refer to Nelson Jimenez’s 2024/25 Bourbon-Caturra washed lot supplied through Cafeología."
      },
      "flavorSourceUrls": [
        "https://www.allycoffee.com/coffees/cafeologia-nelson-jimenez-bourbon-caturra-washed/"
      ]
    }
  },
  {
    "id": "mexico-oaxaca",
    "country": "Mexico",
    "name": "Oaxaca",
    "nameKo": "오악사카",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "시에라수르·시에라노르테·플루마 등을 포함하는 산악 커피 산지입니다.",
      "en": "A mountain coffee origin encompassing Sierra Sur, Sierra Norte, Pluma and other localities."
    },
    "environment": {
      "ko": "산맥과 해안 쪽 사면의 환경이 다르며, 플루마 권역은 시에라마드레델수르에 자리합니다.",
      "en": "Mountain ranges and coast-facing slopes differ; the Pluma area lies in the Sierra Madre del Sur."
    },
    "flavorNotes": {
      "ko": [
        "캐러멜",
        "청사과",
        "코코아",
        "멜론"
      ],
      "en": [
        "Caramel",
        "Green apple",
        "Cocoa",
        "Melon"
      ]
    },
    "varieties": [
      "Typica",
      "Bourbon",
      "Pluma Hidalgo"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Royal Coffee의 San Vicente Yogondoy·Buenavista Loxicha 기록처럼 마을별 향미를 비교할 수 있습니다. 플루마는 별도 원산지 권역으로도 관리됩니다.",
      "en": "Compare documented village lots such as San Vicente Yogondoy and Buenavista Loxicha. Pluma also has its own origin designation."
    },
    "sources": [
      {
        "title": "Oaxaca Sierra Sur Pluma San Vicente Yogondoy — lot 39756",
        "url": "https://royalcoffee.com/product/3427097000052393319/",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Oaxaca Pluma Sierra Sur Buenavista Loxicha — lot 39758",
        "url": "https://royalcoffee.com/product/3427097000052393331/",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Declaración de protección de la Denominación de Origen PLUMA",
        "url": "https://dof.gob.mx/nota_detalle_popup.php?codigo=5585437",
        "publisher": "Diario Oficial de la Federación / IMPI",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Royal Coffee의 San Vicente Yogondoy 39756과 Buenavista Loxicha 39758 워시드 마을 선별 로트에서 골랐습니다.",
        "en": "Descriptors combine Royal Coffee’s San Vicente Yogondoy 39756 and Buenavista Loxicha 39758 washed community selections."
      },
      "flavorSourceUrls": [
        "https://royalcoffee.com/product/3427097000052393319/",
        "https://royalcoffee.com/product/3427097000052393331/"
      ]
    }
  },
  {
    "id": "mexico-veracruz",
    "country": "Mexico",
    "name": "Veracruz",
    "nameKo": "베라크루스",
    "kind": "region",
    "aliases": [],
    "summary": {
      "ko": "코아테펙의 Finca Fátima처럼 스페셜티 커피를 생산하는 농장이 있는 산지입니다.",
      "en": "An origin with specialty coffee farms such as Finca Fátima in Coatepec."
    },
    "environment": {
      "ko": "Finca Fátima는 운무림 지대의 농장으로, 수원과 토착 생태계를 보전합니다.",
      "en": "Finca Fátima lies in a cloud-forest corridor and preserves water sources and native ecosystems."
    },
    "flavorNotes": {
      "ko": [
        "헤이즐넛 프랄린",
        "사과",
        "석류",
        "초콜릿"
      ],
      "en": [
        "Hazelnut praline",
        "Apple",
        "Pomegranate",
        "Chocolate"
      ]
    },
    "varieties": [
      "Marsellesa",
      "Caturra",
      "Garnica",
      "Gesha",
      "Typica"
    ],
    "processes": {
      "ko": [
        "워시드"
      ],
      "en": [
        "Washed"
      ]
    },
    "specialty": {
      "ko": "Finca Fátima의 재배 품종과 실제 판매 로트의 품종을 구분해 보세요. 여기의 워시드 사례는 마르세예사입니다.",
      "en": "Distinguish varieties grown at Finca Fátima from the variety of a specific offering: this washed example is Marsellesa."
    },
    "sources": [
      {
        "title": "Crown Jewel Mexico Washed Marsellesa — Givette Pérez Orea CJ1636",
        "url": "https://cdn.royalcoffee.com/wp-content/uploads/2025/09/23081035/Crown-Jewel-Mexico-Washed-Marsellesa-Givette-Perez-Orea-CJ1636.pdf",
        "publisher": "Royal Coffee",
        "accessedAt": "2026-09-08"
      }
    ],
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "lot",
      "flavorContext": {
        "ko": "Royal Coffee의 2025-09-23 CJ1636 분석에 기록된 Givette Pérez Orea의 Finca Fátima 마르세예사 워시드 향미입니다.",
        "en": "Descriptors refer to Givette Pérez Orea’s Finca Fátima washed Marsellesa in Royal Coffee’s CJ1636 analysis dated 2025-09-23."
      },
      "flavorSourceUrls": [
        "https://cdn.royalcoffee.com/wp-content/uploads/2025/09/23081035/Crown-Jewel-Mexico-Washed-Marsellesa-Givette-Perez-Orea-CJ1636.pdf"
      ]
    }
  },
  {
    "id": "mexico-pluma-hidalgo",
    "country": "Mexico",
    "name": "Pluma Hidalgo",
    "nameKo": "플루마 이달고",
    "kind": "microregion",
    "aliases": [],
    "summary": {
      "ko": "오악사카의 플루마 원산지 권역을 대표하는 커피 마을입니다.",
      "en": "A coffee locality within Oaxaca’s broader Pluma origin area."
    },
    "environment": {
      "ko": "태평양 쪽 시에라마드레델수르 산악 지대에 자리합니다. 플루마 원산지 권역은 이 마을보다 넓습니다.",
      "en": "It lies in the Pacific-facing Sierra Madre del Sur. The Pluma designation covers a wider area than this locality."
    },
    "flavorNotes": {
      "ko": [
        "풍부한 향",
        "선명한 산미",
        "가벼운 바디"
      ],
      "en": [
        "Aromatic",
        "Pronounced acidity",
        "Light body"
      ]
    },
    "varieties": [
      "Typica",
      "Pluma Hidalgo",
      "Bourbon"
    ],
    "processes": {
      "ko": [
        "워시드",
        "허니",
        "내추럴"
      ],
      "en": [
        "Washed",
        "Honey",
        "Natural"
      ]
    },
    "specialty": {
      "ko": "Typica·Pluma Hidalgo 계통을 비롯한 여러 품종이 생산됩니다. 가공 목록은 Café Pluma México의 판매 사례를 포함합니다.",
      "en": "Several varieties are grown, including Typica and Pluma Hidalgo lineage. Processes include offerings documented by Café Pluma México."
    },
    "sources": [
      {
        "title": "Declaración de protección de la Denominación de Origen PLUMA",
        "url": "https://dof.gob.mx/nota_detalle_popup.php?codigo=5585437",
        "publisher": "Diario Oficial de la Federación / IMPI",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Café Pluma México",
        "url": "https://www.cafepluma.com.mx/",
        "publisher": "Café Pluma México",
        "accessedAt": "2026-09-08"
      }
    ],
    "parentId": "mexico-oaxaca",
    "verification": {
      "reviewedAt": "2026-09-08",
      "flavorBasis": "regional",
      "flavorContext": {
        "ko": "향·산미·바디는 마을을 포함하는 더 넓은 PLUMA 원산지 권역의 2020년 공식 설명입니다. 모든 마을 로트의 보장은 아닙니다.",
        "en": "Aroma, acidity and body follow the 2020 official profile of the broader PLUMA designation that includes this locality; they do not guarantee every village lot."
      },
      "flavorSourceUrls": [
        "https://dof.gob.mx/nota_detalle_popup.php?codigo=5585437"
      ]
    }
  }
];
