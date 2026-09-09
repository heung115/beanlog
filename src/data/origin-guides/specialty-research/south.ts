import type { OriginSpecialtyProfile } from "../types.ts";

/** Exact source lots; broad/microregion reuse preserves one underlying lot identity. */
export const southSpecialtyProfiles: OriginSpecialtyProfile[] = [
  {
    "regionId": "colombia-huila",
    "priority": "focus",
    "rationale": "Sucafina–Cuatro Vientos의 지속 거래와 전문 수입사의 농장별 로트가 확인된다. Acevedo의 워시드 Papayo와 Acevedo–Pitalito 경계의 내추럴 Pink Bourbon을 구분해 다룬다.",
    "sources": [
      {
        "title": "Luis Anibal Papayo FW",
        "url": "https://sucafina.com/na/offerings/luis-anibal-papayo-fw",
        "publisher": "Sucafina",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Las Veraneras Pink Bourbon Natural",
        "url": "https://www.allycoffee.com/coffees/las-veraneras-pink-bourbon-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Betania Farm Papayo",
        "url": "https://ineffablecoffee.com/products/betania-farm-papayo",
        "publisher": "Ineffable Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Villa Betulia Papayo Fully Washed",
        "producer": "Luis Anibal Calderón",
        "location": "La Primavera, Acevedo, Huila, Colombia",
        "varieties": [
          "Papayo"
        ],
        "process": {
          "ko": "풀리 워시드",
          "en": "Fully washed"
        },
        "flavorNotes": {
          "ko": [
            "코코아를 입힌 체리",
            "열대과일",
            "꽃향"
          ],
          "en": [
            "Cocoa-dusted cherry",
            "Tropical fruit",
            "Floral"
          ]
        },
        "sources": [
          {
            "title": "Luis Anibal Papayo FW",
            "url": "https://sucafina.com/na/offerings/luis-anibal-papayo-fw",
            "publisher": "Sucafina",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Las Veraneras Pink Bourbon Natural",
        "producer": "Rodrigo Sanchez & Claudia Samboni",
        "location": "Peñas Blancas, Acevedo–Pitalito border, Huila, Colombia",
        "varieties": [
          "Pink Bourbon"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "카카오닙스",
            "꿀",
            "체리"
          ],
          "en": [
            "Cacao nibs",
            "Honey",
            "Cherry"
          ]
        },
        "sources": [
          {
            "title": "Las Veraneras Pink Bourbon Natural",
            "url": "https://www.allycoffee.com/coffees/las-veraneras-pink-bourbon-natural/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Betania Farm Papayo — Ineffable",
        "producer": "Linarco Rodríguez",
        "location": "Huila, Colombia",
        "varieties": [
          "Papayo"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anaerobic washed"
        },
        "flavorNotes": {
          "ko": [
            "체리모야",
            "살구",
            "바닐라"
          ],
          "en": [
            "Cherimoya",
            "Apricot",
            "Vanilla"
          ]
        },
        "sources": [
          {
            "title": "Betania Farm Papayo",
            "url": "https://ineffablecoffee.com/products/betania-farm-papayo",
            "publisher": "Ineffable Coffee",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2026"
      }
    ]
  },
  {
    "regionId": "colombia-narino",
    "priority": "focus",
    "rationale": "El Obraje의 Maracaturra·Gesha 품종별 상품과 2025년 수확 Caturra P007018#1이 확인된다. 모두 Tangua의 같은 농장이지만 서로 다른 품종·로트의 시음 기록을 보존한다.",
    "sources": [
      {
        "title": "El Obraje Maracaturra Washed",
        "url": "https://www.allycoffee.com/coffees/obraje-maracaturra/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "El Obraje Gesha Washed",
        "url": "https://www.allycoffee.com/coffees/obraje-gesha-washed/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Current Europe Offerings — 6 March 2026",
        "url": "https://www.allycoffee.com/wp-content/uploads/2026/03/ALLY-EU-OFFERINGS-06MAR26.pdf",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Colombia Finca El Obraje",
        "url": "https://caffegoriziana.it/en/product/colombia-finca-el-obraje-2/",
        "publisher": "Torrefazione Goriziana",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "El Obraje Maracaturra Washed",
        "producer": "Pablo Andres Guerrero",
        "location": "Tangua, Nariño, Colombia",
        "varieties": [
          "Maracaturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "멜론",
            "꿀",
            "오렌지꽃"
          ],
          "en": [
            "Melon",
            "Honey",
            "Orange blossom"
          ]
        },
        "sources": [
          {
            "title": "El Obraje Maracaturra Washed",
            "url": "https://www.allycoffee.com/coffees/obraje-maracaturra/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "El Obraje Gesha Washed",
        "producer": "Pablo Guerrero",
        "location": "Tangua, Nariño, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "풋사과",
            "열대과일",
            "히비스커스",
            "복숭아"
          ],
          "en": [
            "Green apple",
            "Tropical fruit",
            "Hibiscus",
            "Peach"
          ]
        },
        "sources": [
          {
            "title": "El Obraje Gesha Washed",
            "url": "https://www.allycoffee.com/coffees/obraje-gesha-washed/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "El Obraje Caturra — P007018#1",
        "producer": "Pablo Guerrero",
        "location": "Tangua, Nariño, Colombia",
        "varieties": [
          "Caturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "붉은 과일",
            "누가",
            "초콜릿"
          ],
          "en": [
            "Red fruit",
            "Nougat",
            "Chocolate"
          ]
        },
        "harvest": "2025",
        "sources": [
          {
            "title": "Current Europe Offerings — 6 March 2026",
            "url": "https://www.allycoffee.com/wp-content/uploads/2026/03/ALLY-EU-OFFERINGS-06MAR26.pdf",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-09"
          },
          {
            "title": "El Obraje Gesha Washed",
            "url": "https://www.allycoffee.com/coffees/obraje-gesha-washed/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Finca El Obraje Caturra Natural — Goriziana",
        "producer": "Finca El Obraje",
        "location": "Nariño, Colombia",
        "varieties": [
          "Caturra"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "망고",
            "자스민",
            "꿀"
          ],
          "en": [
            "Mango",
            "Jasmine",
            "Honey"
          ]
        },
        "sources": [
          {
            "title": "Colombia Finca El Obraje",
            "url": "https://caffegoriziana.it/en/product/colombia-finca-el-obraje-2/",
            "publisher": "Torrefazione Goriziana",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "colombia-antioquia",
    "priority": "focus",
    "rationale": "Concordia의 El Zacatin 내추럴 로트와 Urrao의 La Casita 2025년 7월 수확 워시드가 확인된다. 다른 농장과 가공의 Chiroso 및 Pink Bourbon을 구분한다.",
    "sources": [
      {
        "title": "El Zacatin Chiroso Natural",
        "url": "https://www.allycoffee.com/coffees/el-zacatin-chiroso-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "El Zacatin Pink Bourbon Natural",
        "url": "https://www.allycoffee.com/coffees/el-zacatin-pink-bourbon-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "2025 David Berrio; La Casita, New Season — Colombia",
        "url": "https://www.seycoffee.com/products/2025-david-berrio-la-casita-new-season-colombia",
        "publisher": "SEY Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Edgar Gonzalez — Chiroso",
        "url": "https://flowerchildcoffee.com/products/edgar-gonzalez-chiroso",
        "publisher": "Flower Child Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "El Zacatin Chiroso Natural",
        "producer": "Eduardo Fernandez-Restrepo",
        "location": "Concordia, Antioquia, Colombia",
        "varieties": [
          "Chiroso"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "초콜릿",
            "라즈베리",
            "단맛"
          ],
          "en": [
            "Chocolate",
            "Raspberry",
            "Sweetness"
          ]
        },
        "sources": [
          {
            "title": "El Zacatin Chiroso Natural",
            "url": "https://www.allycoffee.com/coffees/el-zacatin-chiroso-natural/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "El Zacatin Pink Bourbon Natural",
        "producer": "Eduardo Fernandez-Restrepo",
        "location": "Concordia, Antioquia, Colombia",
        "varieties": [
          "Pink Bourbon"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "다크초콜릿",
            "딸기",
            "레드와인",
            "라임 제스트"
          ],
          "en": [
            "Dark chocolate",
            "Strawberry",
            "Red wine",
            "Lime zest"
          ]
        },
        "sources": [
          {
            "title": "El Zacatin Pink Bourbon Natural",
            "url": "https://www.allycoffee.com/coffees/el-zacatin-pink-bourbon-natural/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "La Casita Chiroso — New Season, 1st Harvest",
        "producer": "David Berrio",
        "location": "Urrao, Antioquia, Colombia",
        "varieties": [
          "Chiroso"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "잘 익은 열대과일",
            "백차",
            "단맛"
          ],
          "en": [
            "Ripe tropical fruit",
            "White tea",
            "Sweetness"
          ]
        },
        "harvest": "2025-07",
        "sources": [
          {
            "title": "2025 David Berrio; La Casita, New Season — Colombia",
            "url": "https://www.seycoffee.com/products/2025-david-berrio-la-casita-new-season-colombia",
            "publisher": "SEY Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Edgar Gonzalez Chiroso — Flower Child",
        "producer": "Edgar Gonzalez",
        "location": "Urrao, Antioquia, Colombia",
        "varieties": [
          "Chiroso"
        ],
        "process": {
          "ko": "워시드·이중 발효",
          "en": "Washed; double fermentation"
        },
        "flavorNotes": {
          "ko": [
            "말린 베리",
            "카스카라",
            "제라늄"
          ],
          "en": [
            "Dried berries",
            "Cascara",
            "Geranium"
          ]
        },
        "sources": [
          {
            "title": "Edgar Gonzalez — Chiroso",
            "url": "https://flowerchildcoffee.com/products/edgar-gonzalez-chiroso",
            "publisher": "Flower Child Coffee",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2026-03"
      }
    ]
  },
  {
    "regionId": "colombia-tolima",
    "priority": "focus",
    "rationale": "Rioblanco의 Racafé 단일 농장 자료와 Planadas의 반복 전문 거래가 함께 확인된다. 허니 Gesha와 무산소 워시드 Pink Bourbon으로 서로 다른 생산 지역을 다룬다.",
    "sources": [
      {
        "title": "Monteverde Single Estate: Gesha Honey",
        "url": "https://racafe.com.co/documents/28/MONTEVERDE_GESHA_HONEY_ENG_compressed.pdf",
        "publisher": "Racafé",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Jorge Rojas: Pink Bourbon",
        "url": "https://september.coffee/en-us/products/jorge-rojas-2025",
        "publisher": "September Coffee Company",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia Planadas",
        "url": "https://patiocoffee.com.au/shop/colombia-planadas/",
        "publisher": "Patio Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Monteverde Gesha Honey",
        "producer": "Gutiérrez family",
        "location": "Las Mercedes, Rioblanco, Tolima, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "허니",
          "en": "Honey"
        },
        "flavorNotes": {
          "ko": [
            "레몬",
            "자스민",
            "꿀",
            "시나몬"
          ],
          "en": [
            "Lemon",
            "Jasmine",
            "Honey",
            "Cinnamon"
          ]
        },
        "sources": [
          {
            "title": "Monteverde Single Estate: Gesha Honey",
            "url": "https://racafe.com.co/documents/28/MONTEVERDE_GESHA_HONEY_ENG_compressed.pdf",
            "publisher": "Racafé",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "La Roca Pink Bourbon — Jorge Rojas",
        "producer": "Jorge Rojas",
        "location": "Planadas, Tolima, Colombia",
        "varieties": [
          "Pink Bourbon"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anaerobic washed"
        },
        "flavorNotes": {
          "ko": [
            "블랙베리",
            "졸리랜처 캔디",
            "잘 익은 체리"
          ],
          "en": [
            "Blackberry",
            "Jolly Rancher candy",
            "Ripe cherry"
          ]
        },
        "sources": [
          {
            "title": "Jorge Rojas: Pink Bourbon",
            "url": "https://september.coffee/en-us/products/jorge-rojas-2025",
            "publisher": "September Coffee Company",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Planadas Natural Fermented — Patio",
        "producer": "Planadas regional selection",
        "location": "Planadas, Tolima, Colombia",
        "varieties": [
          "Typica",
          "Castillo",
          "Caturra"
        ],
        "process": {
          "ko": "발효 내추럴",
          "en": "Natural fermented"
        },
        "flavorNotes": {
          "ko": [
            "붉은 사과",
            "꿀",
            "누가"
          ],
          "en": [
            "Red apple",
            "Honey",
            "Nougat"
          ]
        },
        "sources": [
          {
            "title": "Colombia Planadas",
            "url": "https://patiocoffee.com.au/shop/colombia-planadas/",
            "publisher": "Patio Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "colombia-cauca",
    "priority": "focus",
    "rationale": "Pescador의 Patio Bonito 2025년 수확 Typica, Sotará의 Manos Juntas, Inzá의 Gesha 공동 로트가 확인된다. 서로 다른 생산권역과 가공을 구분한다.",
    "sources": [
      {
        "title": "Manos Juntas",
        "url": "https://olisipo.coffee/product/manos-juntas/",
        "publisher": "Olisipo Coffee Roasters",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Gesha del Pueblo",
        "url": "https://melbournecoffeemerchants.com.au/coffee/gesha-del-pueblo/",
        "publisher": "Melbourne Coffee Merchants",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia Paola Trujillo Typica — Transparency Report",
        "url": "https://www.rumblecoffee.com.au/blogs/transparency-project/colombia-paola-trujillo-typica",
        "publisher": "Rumble Coffee Roasters",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Colombia — Gesha — Inza",
        "url": "https://theangryroaster.com/products/colombia-gesha-inza",
        "publisher": "The Angry Roaster Coffee Co.",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Patio Bonito Typica — Rumble 120 kg lot",
        "producer": "Paola Trujillo",
        "location": "Pescador, Cauca, Colombia",
        "varieties": [
          "Typica"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "살구",
            "바닐라",
            "적포도"
          ],
          "en": [
            "Apricot",
            "Vanilla",
            "Red grape"
          ]
        },
        "harvest": "2025-05",
        "sources": [
          {
            "title": "Colombia Paola Trujillo Typica — Transparency Report",
            "url": "https://www.rumblecoffee.com.au/blogs/transparency-project/colombia-paola-trujillo-typica",
            "publisher": "Rumble Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Manos Juntas Castillo Natural",
        "producer": "Smallholders supplying Manos Juntas micromill",
        "location": "Sotará, Cauca, Colombia",
        "varieties": [
          "Castillo"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "딸기잼",
            "케이크",
            "초콜릿"
          ],
          "en": [
            "Strawberry jam",
            "Cake",
            "Chocolate"
          ]
        },
        "sources": [
          {
            "title": "Manos Juntas",
            "url": "https://olisipo.coffee/product/manos-juntas/",
            "publisher": "Olisipo Coffee Roasters",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Gesha del Pueblo",
        "producer": "Neyid Pillimue, Arnulfo Quintero & Yimi Tunubala",
        "location": "El Carmen, Pergamino & Las Palmas farms, Inzá, Cauca, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "흰 꽃",
            "만다린",
            "천도복숭아",
            "우롱차"
          ],
          "en": [
            "White blossom",
            "Mandarin",
            "Nectarine",
            "Oolong tea"
          ]
        },
        "sources": [
          {
            "title": "Gesha del Pueblo",
            "url": "https://melbournecoffeemerchants.com.au/coffee/gesha-del-pueblo/",
            "publisher": "Melbourne Coffee Merchants",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Finca La Colina Gesha — The Angry Roaster",
        "producer": "Rafael Velasquéz & Andrés Martinez",
        "location": "Inzá, Cauca, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "베르가모트",
            "클레멘타인",
            "라벤더",
            "블루베리"
          ],
          "en": [
            "Bergamot",
            "Clementine",
            "Lavender",
            "Blueberries"
          ]
        },
        "sources": [
          {
            "title": "Colombia — Gesha — Inza",
            "url": "https://theangryroaster.com/products/colombia-gesha-inza",
            "publisher": "The Angry Roaster Coffee Co.",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "colombia-pitalito",
    "priority": "focus",
    "rationale": "수입사의 2025 Ombligon 로트와 별도 구매 관계의 소농 Caturra 로트가 확인된다. El Diviso와 La Esmeralda의 Buena Vista를 구분해 품종·가공 폭을 보여준다.",
    "sources": [
      {
        "title": "Finca El Diviso: Nestor Lasso, Ombligon P11552",
        "url": "https://www.touton-specialty-coffee.com/en/p11552",
        "publisher": "Touton Specialty Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Colombia Pitalito Franky Peña",
        "url": "https://www.sweetmarias.com/products/colombia-pitalito-franky-pena-8587",
        "publisher": "Sweet Maria's",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia Yadimir Quiguanas Pérez Bourbon Ají",
        "url": "https://onyxcoffeelab.com/en-int/products/colombia-yadimir-quiguanas-perez-bourbon-aji",
        "publisher": "Onyx Coffee Lab",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "El Diviso Ombligon P11552",
        "producer": "Nestor Lasso",
        "location": "Pitalito, Huila, Colombia",
        "varieties": [
          "Ombligon"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "블랙커런트",
            "블루베리",
            "샴페인",
            "구스베리",
            "꿀",
            "럼"
          ],
          "en": [
            "Blackcurrant",
            "Blueberry",
            "Champagne",
            "Gooseberry",
            "Honey",
            "Rum"
          ]
        },
        "sources": [
          {
            "title": "Finca El Diviso: Nestor Lasso, Ombligon P11552",
            "url": "https://www.touton-specialty-coffee.com/en/p11552",
            "publisher": "Touton Specialty Coffee",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025"
      },
      {
        "name": "Buena Vista — Franky Peña 8587",
        "producer": "Franky Peña",
        "location": "La Esmeralda, El Bombo, Pitalito, Huila, Colombia",
        "varieties": [
          "Caturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "비정제 설탕",
            "포멜로",
            "말린 오렌지"
          ],
          "en": [
            "Unrefined sugar",
            "Pomelo",
            "Dried orange"
          ]
        },
        "sources": [
          {
            "title": "Colombia Pitalito Franky Peña",
            "url": "https://www.sweetmarias.com/products/colombia-pitalito-franky-pena-8587",
            "publisher": "Sweet Maria's",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Los Yarumos Bourbon Ají — Onyx",
        "producer": "Yadimir Quiguanas Pérez",
        "location": "Pitalito, Huila, Colombia",
        "varieties": [
          "Bourbon Aji"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "히비스커스",
            "바닐라",
            "루비 레드 자몽",
            "사과"
          ],
          "en": [
            "Hibiscus",
            "Vanilla",
            "Ruby red grapefruit",
            "Apple"
          ]
        },
        "sources": [
          {
            "title": "Colombia Yadimir Quiguanas Pérez Bourbon Ají",
            "url": "https://onyxcoffeelab.com/en-int/products/colombia-yadimir-quiguanas-perez-bourbon-aji",
            "publisher": "Onyx Coffee Lab",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "Early 2024"
      }
    ]
  },
  {
    "regionId": "colombia-san-agustin",
    "priority": "focus",
    "rationale": "Monkaaba·Semilla 및 Los Naranjos를 통한 반복 거래가 생산자 단위로 확인된다. Swerl은 Jhon의 네 번째 수확분 구매라고 명시하며, 세 농가의 서로 다른 로트를 확보했다.",
    "sources": [
      {
        "title": "Colombia Angel Ortega Gesha",
        "url": "https://www.wadi.coffee/products/colombia-angel-ortega-gesha",
        "publisher": "Wadi Coffee Roasters",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Faiber Bolaños — Colombia",
        "url": "https://silverbirdcoffee.com/products/faiber-bolanos-colombia-gold-label-reserve",
        "publisher": "Silverbird Roasting Co.",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "[ODD B] Jhon Jairo Espresso — Colombia",
        "url": "https://swerl.se/products/odd-b-jhon-jairo-espresso-colombia",
        "publisher": "Swerl Coffee Roasters",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "2025 Victor Alfonso Bonilla — La Chorrera, End of Season",
        "url": "https://www.seycoffee.com/products/2025-victor-alfonso-bonilla-la-chorrera-end-of-season-colombia",
        "publisher": "SEY Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Miramar — Angel Ortega Gesha",
        "producer": "Angel Ortega",
        "location": "Kennedy, San Agustín, Huila, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "천도복숭아",
            "바닐라",
            "꽃향"
          ],
          "en": [
            "Nectarine",
            "Vanilla",
            "Floral"
          ]
        },
        "sources": [
          {
            "title": "Colombia Angel Ortega Gesha",
            "url": "https://www.wadi.coffee/products/colombia-angel-ortega-gesha",
            "publisher": "Wadi Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025-01"
      },
      {
        "name": "La Esperanza — Faiber Bolaños",
        "producer": "Faiber Bolaños",
        "location": "San Agustín, Huila, Colombia",
        "varieties": [
          "Gesha",
          "Pink Bourbon"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anaerobic washed"
        },
        "flavorNotes": {
          "ko": [
            "엘더베리",
            "만다린",
            "야생화 꿀"
          ],
          "en": [
            "Elderberry",
            "Mandarin",
            "Wildflower honey"
          ]
        },
        "sources": [
          {
            "title": "Faiber Bolaños — Colombia",
            "url": "https://silverbirdcoffee.com/products/faiber-bolanos-colombia-gold-label-reserve",
            "publisher": "Silverbird Roasting Co.",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Jhon Jairo Espresso — Washed Tabi",
        "producer": "Jhon Jairo Gomez",
        "location": "El Rosario, San Agustín, Huila, Colombia",
        "varieties": [
          "Tabi"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "열대과일",
            "오렌지 마멀레이드"
          ],
          "en": [
            "Tropical fruit",
            "Orange marmalade"
          ]
        },
        "sources": [
          {
            "title": "[ODD B] Jhon Jairo Espresso — Colombia",
            "url": "https://swerl.se/products/odd-b-jhon-jairo-espresso-colombia",
            "publisher": "Swerl Coffee Roasters",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "La Chorrera Aruzi — End of Season",
        "producer": "Victor Alfonso Bonilla",
        "location": "La Argentina, San Agustín, Huila, Colombia",
        "varieties": [
          "Aruzi"
        ],
        "process": {
          "ko": "36시간 건식 발효 워시드",
          "en": "Washed; 36-hour dry fermentation"
        },
        "flavorNotes": {
          "ko": [
            "캐모마일",
            "허니듀 멜론",
            "복숭아"
          ],
          "en": [
            "Chamomile",
            "Honeydew",
            "Peach"
          ]
        },
        "sources": [
          {
            "title": "2025 Victor Alfonso Bonilla — La Chorrera, End of Season",
            "url": "https://www.seycoffee.com/products/2025-victor-alfonso-bonilla-la-chorrera-end-of-season-colombia",
            "publisher": "SEY Coffee",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025-01"
      }
    ]
  },
  {
    "regionId": "colombia-inza",
    "priority": "focus",
    "rationale": "Gesha del Pueblo의 품종별 생산자 공동 로트, El Tabor의 마을 로트와 Asobombo의 2025/26 수확 상품이 확인된다. 개별 농장·마을·생산자 조합의 범위를 구분한다.",
    "sources": [
      {
        "title": "Gesha del Pueblo",
        "url": "https://melbournecoffeemerchants.com.au/coffee/gesha-del-pueblo/",
        "publisher": "Melbourne Coffee Merchants",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia Inzá El Tabor",
        "url": "https://www.sweetmarias.com/products/colombia-inza-el-tabor-8601",
        "publisher": "Sweet Maria's",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia Cauca Organic - Asobombo",
        "url": "https://www.covoyacoffee.com/p615205-4-colombia-cauca-org-asobombo-nj.html",
        "publisher": "Covoya Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Colombia — Gesha — Inza",
        "url": "https://theangryroaster.com/products/colombia-gesha-inza",
        "publisher": "The Angry Roaster Coffee Co.",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Gesha del Pueblo",
        "producer": "Neyid Pillimue, Arnulfo Quintero & Yimi Tunubala",
        "location": "El Carmen, Pergamino & Las Palmas farms, Inzá, Cauca, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "흰 꽃",
            "만다린",
            "천도복숭아",
            "우롱차"
          ],
          "en": [
            "White blossom",
            "Mandarin",
            "Nectarine",
            "Oolong tea"
          ]
        },
        "sources": [
          {
            "title": "Gesha del Pueblo",
            "url": "https://melbournecoffeemerchants.com.au/coffee/gesha-del-pueblo/",
            "publisher": "Melbourne Coffee Merchants",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Inzá El Tabor 8601",
        "producer": "Maria Cuchimba & Robinson Sancho",
        "location": "El Tabor, Inzá, Cauca, Colombia",
        "varieties": [
          "Caturra",
          "Colombia"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "흑설탕",
            "오트밀 쿠키",
            "마지팬"
          ],
          "en": [
            "Brown sugar",
            "Oatmeal cookie",
            "Marzipan"
          ]
        },
        "sources": [
          {
            "title": "Colombia Inzá El Tabor",
            "url": "https://www.sweetmarias.com/products/colombia-inza-el-tabor-8601",
            "publisher": "Sweet Maria's",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Asobombo Inzá Organic — P615205-4",
        "producer": "Asobombo Inzá smallholder producers",
        "location": "Inzá, Cauca, Colombia",
        "varieties": [
          "Castillo",
          "Caturra",
          "Colombia"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "초콜릿",
            "누가",
            "블랙체리",
            "오렌지 제스트"
          ],
          "en": [
            "Chocolate",
            "Nougat",
            "Black cherry",
            "Orange zest"
          ]
        },
        "harvest": "2025/26",
        "sources": [
          {
            "title": "Colombia Cauca Organic - Asobombo",
            "url": "https://www.covoyacoffee.com/p615205-4-colombia-cauca-org-asobombo-nj.html",
            "publisher": "Covoya Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Finca La Colina Gesha — The Angry Roaster",
        "producer": "Rafael Velasquéz & Andrés Martinez",
        "location": "Inzá, Cauca, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "베르가모트",
            "클레멘타인",
            "라벤더",
            "블루베리"
          ],
          "en": [
            "Bergamot",
            "Clementine",
            "Lavender",
            "Blueberries"
          ]
        },
        "sources": [
          {
            "title": "Colombia — Gesha — Inza",
            "url": "https://theangryroaster.com/products/colombia-gesha-inza",
            "publisher": "The Angry Roaster Coffee Co.",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "colombia-planadas",
    "priority": "focus",
    "rationale": "Covoya의 생산자 그룹 로트와 September의 세 번째 Jorge Rojas 소개 기록이 확인된다. 공동 워시드와 La Roca의 품종별 무산소 워시드를 함께 다룬다.",
    "sources": [
      {
        "title": "Colombia Seleccion Planadas Organic",
        "url": "https://eu.covoyacoffee.com/seleccion-planadas-organic-eu.html",
        "publisher": "Covoya Specialty Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Jorge Rojas: Pink Bourbon",
        "url": "https://september.coffee/en-us/products/jorge-rojas-2025",
        "publisher": "September Coffee Company",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Colombia Planadas",
        "url": "https://patiocoffee.com.au/shop/colombia-planadas/",
        "publisher": "Patio Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Seleccion Planadas Organic CO-PL-ORG-EU",
        "producer": "Seleccion Planadas smallholder producer groups",
        "location": "Planadas, Tolima, Colombia",
        "varieties": [
          "Castillo",
          "Caturra",
          "Colombia"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "블랙베리",
            "사과",
            "밀크초콜릿"
          ],
          "en": [
            "Blackberry",
            "Apple",
            "Milk chocolate"
          ]
        },
        "sources": [
          {
            "title": "Colombia Seleccion Planadas Organic",
            "url": "https://eu.covoyacoffee.com/seleccion-planadas-organic-eu.html",
            "publisher": "Covoya Specialty Coffee",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025/26"
      },
      {
        "name": "La Roca Pink Bourbon — Jorge Rojas",
        "producer": "Jorge Rojas",
        "location": "Planadas, Tolima, Colombia",
        "varieties": [
          "Pink Bourbon"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anaerobic washed"
        },
        "flavorNotes": {
          "ko": [
            "블랙베리",
            "졸리랜처 캔디",
            "잘 익은 체리"
          ],
          "en": [
            "Blackberry",
            "Jolly Rancher candy",
            "Ripe cherry"
          ]
        },
        "sources": [
          {
            "title": "Jorge Rojas: Pink Bourbon",
            "url": "https://september.coffee/en-us/products/jorge-rojas-2025",
            "publisher": "September Coffee Company",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Planadas Natural Fermented — Patio",
        "producer": "Planadas regional selection",
        "location": "Planadas, Tolima, Colombia",
        "varieties": [
          "Typica",
          "Castillo",
          "Caturra"
        ],
        "process": {
          "ko": "발효 내추럴",
          "en": "Natural fermented"
        },
        "flavorNotes": {
          "ko": [
            "붉은 사과",
            "꿀",
            "누가"
          ],
          "en": [
            "Red apple",
            "Honey",
            "Nougat"
          ]
        },
        "sources": [
          {
            "title": "Colombia Planadas",
            "url": "https://patiocoffee.com.au/shop/colombia-planadas/",
            "publisher": "Patio Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-cerrado",
    "priority": "focus",
    "rationale": "원산지 인증 지역의 농장별 전문 거래와 Barinas의 명시된 2025년 수확 로트가 확인된다. Pântano·Caixetas·Barinas의 서로 다른 생산자와 품종을 구분한다.",
    "sources": [
      {
        "title": "Nosso Terroir",
        "url": "https://www.cafedocerrado.org/index.php?pg=nossoterroir",
        "publisher": "Federação dos Cafeicultores do Cerrado",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Fazenda Pântano – Mauro Galheri – Maragogipe Natural",
        "url": "https://www.allycoffee.com/coffees/fazenda-pantano-mauro-galheri-maragogipe-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Fazenda Caixetas – Vinicius Wagner Ignotti Acauã Natural",
        "url": "https://www.allycoffee.com/coffees/fazenda-caixetas-vinicius-wagner-ignotti-acaua-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Europe Offerlist — 6 March 2026, Barinas P006963#1",
        "url": "https://www.allycoffee.com/wp-content/uploads/2026/03/ALLY-EU-OFFERINGS-06MAR26.pdf",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Daterra — Our Plot Project",
        "url": "https://www.blackwhiteroasters.com/products/r-daterra-our-plot-project-jan-25",
        "publisher": "Black & White Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Fazenda Pântano Maragogipe Natural",
        "producer": "Mauro Galheri",
        "location": "Cerrado Mineiro, Minas Gerais",
        "varieties": [
          "Maragogipe"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "붉은 과일",
            "꿀",
            "레몬그라스",
            "아니스"
          ],
          "en": [
            "Red fruits",
            "Honey",
            "Lemongrass",
            "Anise"
          ]
        },
        "sources": [
          {
            "title": "Fazenda Pântano – Mauro Galheri – Maragogipe Natural",
            "url": "https://www.allycoffee.com/coffees/fazenda-pantano-mauro-galheri-maragogipe-natural/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Caixetas Acauã Natural",
        "producer": "Vinicius Wagner Ignotti",
        "location": "Guimarânia, Cerrado Mineiro, Minas Gerais",
        "varieties": [
          "Acaua"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "캐러멜",
            "화이트초콜릿",
            "만다린"
          ],
          "en": [
            "Caramel",
            "White chocolate",
            "Mandarin"
          ]
        },
        "sources": [
          {
            "title": "Fazenda Caixetas – Vinicius Wagner Ignotti Acauã Natural",
            "url": "https://www.allycoffee.com/coffees/fazenda-caixetas-vinicius-wagner-ignotti-acaua-natural/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Barinas Topazio Natural — P006963#1",
        "producer": "Márcio Borges",
        "location": "Cerrado Mineiro, Minas Gerais, Brazil",
        "varieties": [
          "Topazio"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "구운 견과류",
            "토피",
            "오렌지"
          ],
          "en": [
            "Roasted nuts",
            "Toffee",
            "Orange"
          ]
        },
        "harvest": "2025",
        "sources": [
          {
            "title": "Europe Offerlist — 6 March 2026, Barinas P006963#1",
            "url": "https://www.allycoffee.com/wp-content/uploads/2026/03/ALLY-EU-OFFERINGS-06MAR26.pdf",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Daterra Our Plot Project — Yellow Arara",
        "producer": "Luis N. Pascoal / Our Plot Project",
        "location": "São José, Cerrado, Brazil",
        "varieties": [
          "Yellow Arara"
        ],
        "process": {
          "ko": "효모 발효 무산소 내추럴·3개 마이크로로트 블렌드",
          "en": "Yeast-fermented anaerobic natural; three-microlot blend"
        },
        "flavorNotes": {
          "ko": [
            "프랄린 피칸",
            "크렘 브륄레 시트러스",
            "숙성 럼",
            "밀크초콜릿"
          ],
          "en": [
            "Praline pecan",
            "Crème brûléed citrus",
            "Aged rum",
            "Milk chocolate"
          ]
        },
        "sources": [
          {
            "title": "Daterra — Our Plot Project",
            "url": "https://www.blackwhiteroasters.com/products/r-daterra-our-plot-project-jan-25",
            "publisher": "Black & White Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-sul-de-minas",
    "priority": "standard",
    "rationale": "Brejinho의 단일 품종 상품, COOPERVITAE의 개별 대회 로트와 Nossa Senhora Aparecida의 2025/26 수확 직접 수입 로트가 확인된다. 수입 목록의 입고일과 명시된 작황을 구분한다.",
    "sources": [
      {
        "title": "Fazenda Brejinho – Orestina Silva Reis – Red Catuai Natural",
        "url": "https://www.allycoffee.com/coffees/fazenda-brejinho-orestina-silva-reis-red-catuai-natural/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brazil Pulped-Natural Sul de Minas Arara COOPERVITAE Fairtrade",
        "url": "https://www.list-beisler.coffee/media/pdf/BRA_Pulped-Natural_Sul_de_Minas_Arara_Coopervitae_POSTCARD.pdf",
        "publisher": "List + Beisler",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brazil Estavam Mario Natural",
        "url": "https://www.roastmasters.com/brazil-estevab-mario.html",
        "publisher": "Roastmasters.com",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Santa Luzia, Brazil",
        "url": "https://www.parlor.coffee/products/santa-luzia-brazil",
        "publisher": "Parlor Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Fazenda Brejinho Red Catuai Natural",
        "producer": "Orestina Silva Reis",
        "location": "Sul de Minas, Minas Gerais",
        "varieties": [
          "Red Catuai"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "밀크초콜릿",
            "대추야자",
            "딸기"
          ],
          "en": [
            "Milk chocolate",
            "Dates",
            "Strawberry"
          ]
        },
        "sources": [
          {
            "title": "Fazenda Brejinho – Orestina Silva Reis – Red Catuai Natural",
            "url": "https://www.allycoffee.com/coffees/fazenda-brejinho-orestina-silva-reis-red-catuai-natural/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "COOPERVITAE Arara — 2020 competition lot",
        "producer": "Antonio Rodrigues de Miranda / COOPERVITAE",
        "location": "Sul de Minas, Minas Gerais",
        "varieties": [
          "Arara"
        ],
        "process": {
          "ko": "펄프드 내추럴",
          "en": "Pulped natural"
        },
        "flavorNotes": {
          "ko": [
            "붉은 포도",
            "단맛",
            "부드러운 질감"
          ],
          "en": [
            "Red grape",
            "Sweetness",
            "Smooth texture"
          ]
        },
        "sources": [
          {
            "title": "Brazil Pulped-Natural Sul de Minas Arara COOPERVITAE Fairtrade",
            "url": "https://www.list-beisler.coffee/media/pdf/BRA_Pulped-Natural_Sul_de_Minas_Arara_Coopervitae_POSTCARD.pdf",
            "publisher": "List + Beisler",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Nossa Senhora Aparecida — Estevam Mario Natural",
        "producer": "Estevam Mario",
        "location": "Carmo da Cachoeira, Sul de Minas, Minas Gerais, Brazil",
        "varieties": [
          "Red Catuai"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "무화과",
            "프룬",
            "타마린드",
            "헤이즐넛"
          ],
          "en": [
            "Fig",
            "Prune",
            "Tamarind",
            "Hazelnut"
          ]
        },
        "harvest": "2025/26",
        "sources": [
          {
            "title": "Brazil Estavam Mario Natural",
            "url": "https://www.roastmasters.com/brazil-estevab-mario.html",
            "publisher": "Roastmasters.com",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Santa Luzia — Parlor",
        "producer": "Santa Luzia women producers",
        "location": "Sul de Minas, Brazil",
        "varieties": [
          "Catuai",
          "Catucai",
          "Mundo Novo",
          "Acaia",
          "Arara"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "아몬드",
            "황설탕",
            "캐러멜",
            "노란 과일"
          ],
          "en": [
            "Almond",
            "Brown sugar",
            "Caramel",
            "Yellow fruit"
          ]
        },
        "sources": [
          {
            "title": "Santa Luzia, Brazil",
            "url": "https://www.parlor.coffee/products/santa-luzia-brazil",
            "publisher": "Parlor Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-mogiana",
    "priority": "standard",
    "rationale": "Média Mogiana의 Recreio COE 로트와 Espírito Santo do Pinhal의 Santo Antônio 2025/26 수확분이 확인된다. 서로 다른 생산자의 내추럴 Gesha와 화산형 더미 발효 Mundo Novo를 구분한다.",
    "sources": [
      {
        "title": "Brazil 2021: competition results",
        "url": "https://allianceforcoffeeexcellence.org/brazil-2021/",
        "publisher": "Alliance for Coffee Excellence",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Fazenda Recreio, Homero Teixeira de Macedo Junior – Brazil 2021",
        "url": "https://farmdirectory.cupofexcellence.org/listing/15-fazenda-recreio-homero-teixeira-de-macedo-junior-brazil-2021/",
        "publisher": "Cup of Excellence",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brazil Volcanic Fermentation Patricia",
        "url": "https://capitalcoffee.co.uk/products/brazil-volcanic-fermentation-patricia",
        "publisher": "Capital Coffee Roasters",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Mogiana — Yellow Bourbon",
        "url": "https://reykjavikroasters.is/en/portfolio-posts/mogiana-en/",
        "publisher": "Reykjavík Roasters",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Brazil — Sítio Siriema — Arara Natural",
        "url": "https://boxxcoffee.la/products/brazil-sitio-siriema",
        "publisher": "Boxx Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Fazenda Recreio Gesha — COE 2021",
        "producer": "Homero Teixeira de Macedo Junior",
        "location": "São Sebastião da Grama, Média Mogiana, São Paulo",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "딸기",
            "자스민",
            "리치",
            "배"
          ],
          "en": [
            "Strawberry",
            "Jasmine",
            "Lychee",
            "Pear"
          ]
        },
        "sources": [
          {
            "title": "Fazenda Recreio, Homero Teixeira de Macedo Junior – Brazil 2021",
            "url": "https://farmdirectory.cupofexcellence.org/listing/15-fazenda-recreio-homero-teixeira-de-macedo-junior-brazil-2021/",
            "publisher": "Cup of Excellence",
            "accessedAt": "2026-09-08"
          },
          {
            "title": "Brazil 2021: competition results",
            "url": "https://allianceforcoffeeexcellence.org/brazil-2021/",
            "publisher": "Alliance for Coffee Excellence",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Santo Antônio — Patricia Coelho Volcanic Fermentation",
        "producer": "Patricia Coelho",
        "location": "Espírito Santo do Pinhal, Mogiana, São Paulo, Brazil",
        "varieties": [
          "Mundo Novo"
        ],
        "process": {
          "ko": "화산형 더미 발효",
          "en": "Volcanic fermentation"
        },
        "flavorNotes": {
          "ko": [
            "럼과 건포도",
            "망고",
            "밀크초콜릿",
            "구운 아몬드"
          ],
          "en": [
            "Rum & raisin",
            "Mango",
            "Milk chocolate",
            "Toasted almond"
          ]
        },
        "harvest": "2025/26",
        "sources": [
          {
            "title": "Brazil Volcanic Fermentation Patricia",
            "url": "https://capitalcoffee.co.uk/products/brazil-volcanic-fermentation-patricia",
            "publisher": "Capital Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Sítio Siriema Arara Natural — Boxx",
        "producer": "Ivan & Rose dos Santos",
        "location": "Mogiana, Brazil",
        "varieties": [
          "Arara"
        ],
        "process": {
          "ko": "내추럴·36시간 휴지 후 건조",
          "en": "Natural; 36-hour rest before drying"
        },
        "flavorNotes": {
          "ko": [
            "붉은 자두",
            "로즈힙",
            "붉은 사과"
          ],
          "en": [
            "Red plum",
            "Rosehip",
            "Red apple"
          ]
        },
        "sources": [
          {
            "title": "Brazil — Sítio Siriema — Arara Natural",
            "url": "https://boxxcoffee.la/products/brazil-sitio-siriema",
            "publisher": "Boxx Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-bahia",
    "priority": "standard",
    "rationale": "서부 Barreiras의 Mimoso 디카페인과 Planalto Baiano의 Shekinah 2025년 7월 수확 워시드가 확인된다. 서로 다른 생산권역과 생산자의 구체적 상품을 보존한다.",
    "sources": [
      {
        "title": "Fazenda Mimoso – Ricardo Tavares – Decaf",
        "url": "https://www.allycoffee.com/coffees/fazenda-mimoso-ricardo-tavares-decaf/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Catuaí do Samuel",
        "url": "https://roastcafes.com/produto/catuai-do-samuel-2025/",
        "publisher": "ROAST Cafés",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Arara do Paulo Menezes",
        "url": "https://roastcafes.com/produto/arara-do-paulo-menezes-2024/",
        "publisher": "ROAST Cafés",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Fazenda Mimoso Arara–Yellow Catuai Decaf",
        "producer": "Ricardo Tavares",
        "location": "Barreiras, Oeste Baiano, Bahia",
        "varieties": [
          "Arara",
          "Yellow Catuai"
        ],
        "process": {
          "ko": "워시드·스위스워터 디카페인",
          "en": "Washed; Swiss Water decaffeination"
        },
        "flavorNotes": {
          "ko": [
            "캐러멜",
            "구운 헤이즐넛",
            "말린 오렌지"
          ],
          "en": [
            "Caramel",
            "Roasted hazelnut",
            "Dried orange"
          ]
        },
        "sources": [
          {
            "title": "Fazenda Mimoso – Ricardo Tavares – Decaf",
            "url": "https://www.allycoffee.com/coffees/fazenda-mimoso-ricardo-tavares-decaf/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Shekinah — Catuaí do Samuel",
        "producer": "Samuel Costa Brito",
        "location": "Barra do Choça, Planalto Baiano, Bahia, Brazil",
        "varieties": [
          "Yellow Catuai",
          "Red Catuai"
        ],
        "process": {
          "ko": "풀리 워시드",
          "en": "Fully washed"
        },
        "flavorNotes": {
          "ko": [
            "라파두라",
            "복숭아",
            "살구",
            "자스민"
          ],
          "en": [
            "Rapadura",
            "Peach",
            "Apricot",
            "Jasmine"
          ]
        },
        "harvest": "2025-07",
        "sources": [
          {
            "title": "Catuaí do Samuel",
            "url": "https://roastcafes.com/produto/catuai-do-samuel-2025/",
            "publisher": "ROAST Cafés",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Fazenda Moeté — Arara do Paulo Menezes",
        "producer": "Paulo Lemos Menezes",
        "location": "Piatã, Chapada Diamantina, Bahia, Brazil",
        "varieties": [
          "Arara"
        ],
        "process": {
          "ko": "펄프드 내추럴",
          "en": "Pulped natural"
        },
        "flavorNotes": {
          "ko": [
            "라파두라",
            "패션프루트",
            "살구",
            "흰 꽃"
          ],
          "en": [
            "Rapadura",
            "Passion fruit",
            "Apricot",
            "White flowers"
          ]
        },
        "sources": [
          {
            "title": "Arara do Paulo Menezes",
            "url": "https://roastcafes.com/produto/arara-do-paulo-menezes-2024/",
            "publisher": "ROAST Cafés",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2024-08"
      }
    ]
  },
  {
    "regionId": "brazil-mantiqueira-de-minas",
    "priority": "focus",
    "rationale": "원산지호칭 산지 안의 Natércia·Lambari 농장과 Santo Antônio의 2025/26 수확분이 확인된다. 세 생산자의 내추럴과 무산소 발효 내추럴 로트를 구분한다.",
    "sources": [
      {
        "title": "Regiões Brasileiras de Café: Mantiqueira de Minas",
        "url": "https://acave.com.br/images/Cartilha-reg-brasileiras.pdf",
        "publisher": "ACAVE / regional producer associations",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Sitio Engenho Red Catuai",
        "url": "https://www.allycoffee.com/coffees/sitio-engenho-red-catuai/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Sitio Tres Barras",
        "url": "https://www.allycoffee.com/coffees/sitio-tres-barras/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Arara, Natural Anaerobic, Santo Antônio, Brazil",
        "url": "https://www.sumocoffeeroasters.com/product-page/arara-natural-anaerobic-santo-ant%C3%B4nio-brazil-1",
        "publisher": "SUMO Coffee Roasters",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Brazil — Irmãs Pereira (2025)",
        "url": "https://www.partnerscoffee.com/blogs/education/brazil-irmas-pereira-2025",
        "publisher": "Partners Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Santo Antônio Arara Natural Anaerobic — Carolina Alckmin",
        "producer": "Carolina Alckmin",
        "location": "Mantiqueira de Minas, Minas Gerais, Brazil",
        "varieties": [
          "Arara"
        ],
        "process": {
          "ko": "무산소 발효 내추럴",
          "en": "Anaerobic natural"
        },
        "flavorNotes": {
          "ko": [
            "붉은 과일",
            "자두",
            "다크초콜릿",
            "말린 무화과"
          ],
          "en": [
            "Red fruit",
            "Plum",
            "Dark chocolate",
            "Dried fig"
          ]
        },
        "harvest": "2025/26",
        "sources": [
          {
            "title": "Arara, Natural Anaerobic, Santo Antônio, Brazil",
            "url": "https://www.sumocoffeeroasters.com/product-page/arara-natural-anaerobic-santo-ant%C3%B4nio-brazil-1",
            "publisher": "SUMO Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Sítio Engenho Red Catuai Natural",
        "producer": "Vanderson Goulart Junho",
        "location": "São Bernardo, Natércia, Mantiqueira de Minas",
        "varieties": [
          "Red Catuai"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "베리",
            "홍차",
            "정향",
            "풋사과",
            "꿀",
            "레몬"
          ],
          "en": [
            "Berries",
            "Black tea",
            "Clove",
            "Green apple",
            "Honey",
            "Lemon"
          ]
        },
        "sources": [
          {
            "title": "Sitio Engenho Red Catuai",
            "url": "https://www.allycoffee.com/coffees/sitio-engenho-red-catuai/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Sítio Três Barras Yellow Catuai Natural",
        "producer": "Regina de Fátima Bueno",
        "location": "Lambari, Mantiqueira de Minas",
        "varieties": [
          "Yellow Catuai"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "베리",
            "향신료",
            "잼 같은 풍미",
            "파파야"
          ],
          "en": [
            "Berries",
            "Brown spice",
            "Jammy",
            "Papaya"
          ]
        },
        "sources": [
          {
            "title": "Sitio Tres Barras",
            "url": "https://www.allycoffee.com/coffees/sitio-tres-barras/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Irmãs Pereira Yellow Bourbon — Partners",
        "producer": "Maria Valéria Pereira & Maria Rogéria Pereira",
        "location": "Carmo de Minas, Mantiqueira de Minas, Brazil",
        "varieties": [
          "Yellow Bourbon"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "밀크초콜릿",
            "살구",
            "피칸"
          ],
          "en": [
            "Milk chocolate",
            "Apricot",
            "Pecan"
          ]
        },
        "sources": [
          {
            "title": "Brazil — Irmãs Pereira (2025)",
            "url": "https://www.partnerscoffee.com/blogs/education/brazil-irmas-pereira-2025",
            "publisher": "Partners Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-carmo-de-minas",
    "priority": "focus",
    "rationale": "2025년 수확한 Sertão의 선별 생두 상품과 2021년 COE Irmãs Pereira 로트를 생산자·품종·가공별로 비교할 수 있다. 최근 전문 거래와 대회 기록이 함께 있어 심층 편집 대상으로 선정한다.",
    "sources": [
      {
        "title": "Fazenda Irmãs Pereira, Maria Rogéria Costa Pereira E Outros – Brazil 2021",
        "url": "https://farmdirectory.cupofexcellence.org/listing/27-fazenda-irmas-pereira-maria-rogeria-costa-pereira-e-outros-brazil-2021/",
        "publisher": "Cup of Excellence",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brazil 2021: competition results",
        "url": "https://allianceforcoffeeexcellence.org/brazil-2021/",
        "publisher": "Alliance for Coffee Excellence",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Café #SS110326",
        "url": "https://www.alemcoffee.cl/products/cafe-ss110326",
        "publisher": "Além Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Fazenda Sertão – Carmo de Minas – MG",
        "url": "https://www.carmocoffees.com.br/our-farms/fazenda-sertao/?lang=pt-br",
        "publisher": "CarmoCoffees",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brazil — Irmãs Pereira (2025)",
        "url": "https://www.partnerscoffee.com/blogs/education/brazil-irmas-pereira-2025",
        "publisher": "Partners Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Fazenda Sertão Yellow Catuai — SS110326",
        "producer": "Francisco Isidro Pereira — Fazenda Sertão",
        "location": "Carmo de Minas, Minas Gerais",
        "varieties": [
          "Yellow Catuai"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "복숭아",
            "망고",
            "패션프루트",
            "흑설탕",
            "밀크초콜릿"
          ],
          "en": [
            "Peach",
            "Mango",
            "Passion fruit",
            "Brown sugar",
            "Milk chocolate"
          ]
        },
        "harvest": "2025",
        "sources": [
          {
            "title": "Café #SS110326",
            "url": "https://www.alemcoffee.cl/products/cafe-ss110326",
            "publisher": "Além Coffee",
            "accessedAt": "2026-09-08"
          },
          {
            "title": "Fazenda Sertão – Carmo de Minas – MG",
            "url": "https://www.carmocoffees.com.br/our-farms/fazenda-sertao/?lang=pt-br",
            "publisher": "CarmoCoffees",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Irmãs Pereira Gesha — COE 2021",
        "producer": "Maria Rogéria Costa Pereira e outros",
        "location": "Carmo de Minas, Mantiqueira de Minas",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "펄프드 내추럴",
          "en": "Pulped natural"
        },
        "flavorNotes": {
          "ko": [
            "블랙체리",
            "꽃향",
            "밀크초콜릿"
          ],
          "en": [
            "Black cherry",
            "Floral",
            "Milk chocolate"
          ]
        },
        "sources": [
          {
            "title": "Fazenda Irmãs Pereira, Maria Rogéria Costa Pereira E Outros – Brazil 2021",
            "url": "https://farmdirectory.cupofexcellence.org/listing/27-fazenda-irmas-pereira-maria-rogeria-costa-pereira-e-outros-brazil-2021/",
            "publisher": "Cup of Excellence",
            "accessedAt": "2026-09-08"
          },
          {
            "title": "Brazil 2021: competition results",
            "url": "https://allianceforcoffeeexcellence.org/brazil-2021/",
            "publisher": "Alliance for Coffee Excellence",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Irmãs Pereira Yellow Bourbon — Partners",
        "producer": "Maria Valéria Pereira & Maria Rogéria Pereira",
        "location": "Carmo de Minas, Mantiqueira de Minas, Brazil",
        "varieties": [
          "Yellow Bourbon"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "밀크초콜릿",
            "살구",
            "피칸"
          ],
          "en": [
            "Milk chocolate",
            "Apricot",
            "Pecan"
          ]
        },
        "sources": [
          {
            "title": "Brazil — Irmãs Pereira (2025)",
            "url": "https://www.partnerscoffee.com/blogs/education/brazil-irmas-pereira-2025",
            "publisher": "Partners Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-alta-mogiana",
    "priority": "focus",
    "rationale": "지리적표시 산지의 Moscardini 농장별 선별품과 Capricornio의 Terra Preta 2025년 수확 수출 로트가 확인된다. 생산자와 실제 로트 추적번호를 함께 보존한다.",
    "sources": [
      {
        "title": "Região da Alta Mogiana: origin and traceability",
        "url": "https://www.amsc.com.br/",
        "publisher": "Associação dos Produtores de Cafés Especiais da Alta Mogiana",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Nossos Cafés: Caramelo and Frutado",
        "url": "https://www.cafemoscardini.com/",
        "publisher": "Família Moscardini",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Traceability Coffee System — Fazenda Terra Preta, 432593550254",
        "url": "https://capricorniotrace.com/traceability/432593550254",
        "publisher": "Capricornio Coffees",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Nossos Cafés — Cacau & Castanhas",
        "url": "https://www.cafemoscardini.com/en",
        "publisher": "Família Moscardini",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Caramelo — Fazenda São Cristóvão",
        "producer": "Elder Moscardini Filho",
        "location": "Cristais Paulista, Alta Mogiana, São Paulo",
        "varieties": [
          "Tupi"
        ],
        "process": {
          "ko": "내추럴·콘크리트 파티오 건조",
          "en": "Natural; concrete-patio drying"
        },
        "flavorNotes": {
          "ko": [
            "캐러멜",
            "둘세데레체",
            "시트러스"
          ],
          "en": [
            "Caramel",
            "Dulce de leche",
            "Citrus"
          ]
        },
        "sources": [
          {
            "title": "Nossos Cafés: Caramelo and Frutado",
            "url": "https://www.cafemoscardini.com/",
            "publisher": "Família Moscardini",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Frutado — Fazenda Boa Esperança",
        "producer": "Elder Moscardini Filho",
        "location": "Jeriquara, Alta Mogiana, São Paulo",
        "varieties": [
          "Yellow Obata"
        ],
        "process": {
          "ko": "자연 발효·콘크리트 파티오 가공",
          "en": "Wild fermentation on concrete patios"
        },
        "flavorNotes": {
          "ko": [
            "용과",
            "리치",
            "키위",
            "배",
            "코코아",
            "초콜릿"
          ],
          "en": [
            "Dragon fruit",
            "Lychee",
            "Kiwi",
            "Pear",
            "Cocoa",
            "Chocolate"
          ]
        },
        "sources": [
          {
            "title": "Nossos Cafés: Caramelo and Frutado",
            "url": "https://www.cafemoscardini.com/",
            "publisher": "Família Moscardini",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Terra Preta Arara — 432593550254",
        "producer": "Fernanda & Felipe Maciel",
        "location": "Pedregulho, Alta Mogiana, São Paulo, Brazil",
        "varieties": [
          "Arara"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "캐러멜",
            "토피",
            "아몬드",
            "호두",
            "허브"
          ],
          "en": [
            "Caramel",
            "Toffee",
            "Almond",
            "Walnut",
            "Herbal"
          ]
        },
        "harvest": "2025",
        "sources": [
          {
            "title": "Traceability Coffee System — Fazenda Terra Preta, 432593550254",
            "url": "https://capricorniotrace.com/traceability/432593550254",
            "publisher": "Capricornio Coffees",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Cacau & Castanhas — Sítio Santa Maria da Boa Vista",
        "producer": "Elder Moscardini Filho",
        "location": "Cristais Paulista, Alta Mogiana, São Paulo, Brazil",
        "varieties": [
          "Mundo Novo"
        ],
        "process": {
          "ko": "내추럴·콘크리트 파티오 건조",
          "en": "Natural; concrete-patio drying"
        },
        "flavorNotes": {
          "ko": [
            "카카오닙스",
            "견과류"
          ],
          "en": [
            "Cacao nibs",
            "Nuts"
          ]
        },
        "sources": [
          {
            "title": "Nossos Cafés — Cacau & Castanhas",
            "url": "https://www.cafemoscardini.com/en",
            "publisher": "Família Moscardini",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-chapada-diamantina",
    "priority": "focus",
    "rationale": "MCM의 장기간 소싱 기록과 Covoya의 2024/25 수확 로트가 확인된다. Tanque·Farinha Seca·Progresso의 세 농장과 펄프드 내추럴·내추럴 가공을 구분해 심층 편집 대상으로 선정한다.",
    "sources": [
      {
        "title": "Spotlight On: Chapada Diamantina",
        "url": "https://melbournecoffeemerchants.com.au/spotlight-on-chapada-diamantina/",
        "publisher": "Melbourne Coffee Merchants",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Sitio Tanque",
        "url": "https://melbournecoffeemerchants.com.au/coffee/sitio-tanque/",
        "publisher": "Melbourne Coffee Merchants",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Diamantina",
        "url": "https://melbournecoffeemerchants.com.au/coffee/diamantina/",
        "publisher": "Melbourne Coffee Merchants",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Brazil - Agenito de Oliveira Luz Single Estate Lot 2",
        "url": "https://www.covoyacoffee.com/p613504-2-brazil-agenito-lot2.html",
        "publisher": "Covoya Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Arara do Paulo Menezes",
        "url": "https://roastcafes.com/produto/arara-do-paulo-menezes-2024/",
        "publisher": "ROAST Cafés",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Sítio Tanque Pulped Natural",
        "producer": "Aleci Souza",
        "location": "Piatã, Chapada Diamantina, Bahia",
        "varieties": [
          "Catuai",
          "Mundo Novo"
        ],
        "process": {
          "ko": "펄프드 내추럴",
          "en": "Pulped natural"
        },
        "flavorNotes": {
          "ko": [
            "자두",
            "블랙체리",
            "헤이즐넛 누가",
            "홍차"
          ],
          "en": [
            "Plum",
            "Black cherry",
            "Hazelnut nougat",
            "Black tea"
          ]
        },
        "sources": [
          {
            "title": "Sitio Tanque",
            "url": "https://melbournecoffeemerchants.com.au/coffee/sitio-tanque/",
            "publisher": "Melbourne Coffee Merchants",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Farinha Seca — Agenito de Oliveira Luz Lot 2 / P613504-2",
        "producer": "Agenito de Oliveira Luz — Farinha Seca",
        "location": "Chapada Diamantina, Brazil",
        "varieties": [
          "Catuai"
        ],
        "process": {
          "ko": "내추럴 · 태양열 건조",
          "en": "Natural / dry processed — solar dryers"
        },
        "flavorNotes": {
          "ko": [
            "애플파이",
            "바닐라",
            "세미스위트 초콜릿"
          ],
          "en": [
            "Apple pie",
            "Vanilla",
            "Semisweet chocolate"
          ]
        },
        "harvest": "2024/25",
        "sources": [
          {
            "title": "Brazil - Agenito de Oliveira Luz Single Estate Lot 2",
            "url": "https://www.covoyacoffee.com/p613504-2-brazil-agenito-lot2.html",
            "publisher": "Covoya Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Diamantina — Fazenda Progresso",
        "producer": "Borré family",
        "location": "Near Mucugê, Chapada Diamantina, Bahia",
        "varieties": [
          "Catuai"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "말린 사과",
            "캐슈버터",
            "코코아"
          ],
          "en": [
            "Dried apple",
            "Cashew butter",
            "Cocoa"
          ]
        },
        "sources": [
          {
            "title": "Diamantina",
            "url": "https://melbournecoffeemerchants.com.au/coffee/diamantina/",
            "publisher": "Melbourne Coffee Merchants",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Fazenda Moeté — Arara do Paulo Menezes",
        "producer": "Paulo Lemos Menezes",
        "location": "Piatã, Chapada Diamantina, Bahia, Brazil",
        "varieties": [
          "Arara"
        ],
        "process": {
          "ko": "펄프드 내추럴",
          "en": "Pulped natural"
        },
        "flavorNotes": {
          "ko": [
            "라파두라",
            "패션프루트",
            "살구",
            "흰 꽃"
          ],
          "en": [
            "Rapadura",
            "Passion fruit",
            "Apricot",
            "White flowers"
          ]
        },
        "sources": [
          {
            "title": "Arara do Paulo Menezes",
            "url": "https://roastcafes.com/produto/arara-do-paulo-menezes-2024/",
            "publisher": "ROAST Cafés",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2024-08"
      }
    ]
  },
  {
    "regionId": "peru-cajamarca",
    "priority": "focus",
    "rationale": "Jaén·San Ignacio의 서로 다른 전문 거래망과 농장별 분리 로트가 확인된다. 하위 산지의 실제 로트를 광역 탐색에도 연결하되 동일 로트를 새 연구 건수로 세지 않는다.",
    "sources": [
      {
        "title": "Peru Los Quispe Gesha Anaerobic Washed",
        "url": "https://uk.covoyacoffee.com/peru-los-quispe-gesha-anaerobic-washed.html",
        "publisher": "Covoya Specialty Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Peru Finca La Perla Gesha Natural",
        "url": "https://uk.covoyacoffee.com/peru-la-perla-gesha-natural-uk.html",
        "publisher": "Covoya Specialty Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Efrain Carhuallocllo Yellow Caturra, El Corazon, Peru — Washed FSK-0053",
        "url": "https://korea.falcon-micro.com/products/efrain-carhuallocllo-yellow-caturra-el-corazon-peru-washed-fsk-0053",
        "publisher": "Falcon Micro Korea",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Peru San Ignacio",
        "url": "https://caffelab.com/peru-san-ignacio/",
        "publisher": "Caffèlab",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Los Quispe Gesha P8002546-1",
        "producer": "Roger Quispe & family",
        "location": "Agua Azul, Chontalí, Jaén, Cajamarca, Peru",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anaerobic washed"
        },
        "flavorNotes": {
          "ko": [
            "클라우디 레모네이드",
            "붉은 포도",
            "캔디 같은 단맛"
          ],
          "en": [
            "Cloudy lemonade",
            "Red grape",
            "Candied sweetness"
          ]
        },
        "sources": [
          {
            "title": "Peru Los Quispe Gesha Anaerobic Washed",
            "url": "https://uk.covoyacoffee.com/peru-los-quispe-gesha-anaerobic-washed.html",
            "publisher": "Covoya Specialty Coffee",
            "accessedAt": "2026-09-08"
          }
        ],
        "harvest": "2023/24"
      },
      {
        "name": "La Perla Gesha Natural P8002310-1",
        "producer": "Noé López",
        "location": "Chirinos, San Ignacio, Cajamarca, Peru",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "살구",
            "장미",
            "청포도",
            "보라색 과일"
          ],
          "en": [
            "Apricot",
            "Rose",
            "White grape",
            "Purple fruits"
          ]
        },
        "sources": [
          {
            "title": "Peru Finca La Perla Gesha Natural",
            "url": "https://uk.covoyacoffee.com/peru-la-perla-gesha-natural-uk.html",
            "publisher": "Covoya Specialty Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Efrain Carhuallocllo Yellow Caturra FSK-0053",
        "producer": "Efrain Carhuallocllo",
        "location": "El Corazón, Chirinos, San Ignacio, Cajamarca, Peru",
        "varieties": [
          "Yellow Caturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "레몬",
            "포도",
            "헤이즐넛",
            "흑설탕",
            "바닐라"
          ],
          "en": [
            "Lemon",
            "Grape",
            "Hazelnut",
            "Brown sugar",
            "Vanilla"
          ]
        },
        "sources": [
          {
            "title": "Efrain Carhuallocllo Yellow Caturra, El Corazon, Peru — Washed FSK-0053",
            "url": "https://korea.falcon-micro.com/products/efrain-carhuallocllo-yellow-caturra-el-corazon-peru-washed-fsk-0053",
            "publisher": "Falcon Micro Korea",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025"
      },
      {
        "name": "San Ignacio — Caffèlab",
        "producer": "Smallholders of San Francisco, Los Llanos, San Andres & El Sauce",
        "location": "San Ignacio, Cajamarca, Peru",
        "varieties": [
          "Caturra",
          "Catuai",
          "Bourbon",
          "Mundo Novo"
        ],
        "process": {
          "ko": "20~30시간 발효 워시드",
          "en": "Washed; 20–30-hour fermentation"
        },
        "flavorNotes": {
          "ko": [
            "초콜릿",
            "탠저린",
            "아몬드",
            "캐러멜"
          ],
          "en": [
            "Chocolate",
            "Tangerine",
            "Almond",
            "Caramel"
          ]
        },
        "sources": [
          {
            "title": "Peru San Ignacio",
            "url": "https://caffelab.com/peru-san-ignacio/",
            "publisher": "Caffèlab",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "peru-cusco",
    "priority": "focus",
    "rationale": "Inkawasi의 Amacho Huayco, Santa Teresa의 Nueva Alianza, Santa Ana의 Monte Verde가 확인된다. 2025년 11월 수확 Gesha와 다른 생산지·생산자의 선별 로트를 구분한다.",
    "sources": [
      {
        "title": "La Convención — Cusco: Finca Amacho Huayco",
        "url": "https://nitido.coffee/cusco/",
        "publisher": "Nítido Coffee Co.",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Nueva Alianza: Sidra Natural P43",
        "url": "https://projectorigin.coffee/wp-content/uploads/2026/03/PER_DwightAguilarMasias_NuevaAlianza__2025.pdf",
        "publisher": "Project Origin",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Perú 2021 — competition results",
        "url": "https://cupofexcellence.org/peru-2021/",
        "publisher": "Cup of Excellence",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "2026 Georgina Puma — Monte Verde, Peru",
        "url": "https://www.seycoffee.com/products/2026-georgina-puma-monte-verde-peru",
        "publisher": "SEY Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "San Sebastian — Julio Chavez — Washed SL9",
        "url": "https://moonwakecoffeeroasters.com/products/san-sebastian-julio-chavez-washed-sl9-peru",
        "publisher": "Moonwake Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Amacho Huayco",
        "producer": "Jesús Apolinario Oscco Bravo",
        "location": "Inkawasi, La Convención, Cusco, Peru",
        "varieties": [
          "Typica",
          "Caturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "붉은 사과",
            "황금빛 건포도",
            "알가로비나 시럽",
            "아몬드"
          ],
          "en": [
            "Red apple",
            "Golden raisin",
            "Algarrobina syrup",
            "Almond"
          ]
        },
        "sources": [
          {
            "title": "La Convención — Cusco: Finca Amacho Huayco",
            "url": "https://nitido.coffee/cusco/",
            "publisher": "Nítido Coffee Co.",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Nueva Alianza Sidra Natural P43",
        "producer": "Dwight Aguilar Masias",
        "location": "Santa Teresa, Cusco, Peru",
        "varieties": [
          "Sidra"
        ],
        "process": {
          "ko": "무산소 발효 내추럴",
          "en": "Anaerobic natural"
        },
        "flavorNotes": {
          "ko": [
            "베리",
            "체리"
          ],
          "en": [
            "Berry",
            "Cherry"
          ]
        },
        "sources": [
          {
            "title": "Nueva Alianza: Sidra Natural P43",
            "url": "https://projectorigin.coffee/wp-content/uploads/2026/03/PER_DwightAguilarMasias_NuevaAlianza__2025.pdf",
            "publisher": "Project Origin",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Monte Verde — Georgina Puma Gesha",
        "producer": "Georgina Puma",
        "location": "Santa Ana, Cusco, Peru",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "32시간 습식 발효 워시드",
          "en": "Washed with 32-hour wet fermentation"
        },
        "flavorNotes": {
          "ko": [
            "사과꽃",
            "만다린",
            "블루베리"
          ],
          "en": [
            "Apple blossom",
            "Mandarin",
            "Blueberry"
          ]
        },
        "harvest": "2025-11",
        "sources": [
          {
            "title": "2026 Georgina Puma — Monte Verde, Peru",
            "url": "https://www.seycoffee.com/products/2026-georgina-puma-monte-verde-peru",
            "publisher": "SEY Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "San Sebastian — Julio Chavez SL-9",
        "producer": "Julio Chavez",
        "location": "Inkawasi, Cusco, Peru",
        "varieties": [
          "SL-9"
        ],
        "process": {
          "ko": "워시드·14일 레이즈드 베드 건조",
          "en": "Washed; dried on raised beds for 14 days"
        },
        "flavorNotes": {
          "ko": [
            "자스민",
            "복숭아",
            "포멜로",
            "센차"
          ],
          "en": [
            "Jasmine",
            "Peach",
            "Pomelo",
            "Sencha"
          ]
        },
        "sources": [
          {
            "title": "San Sebastian — Julio Chavez — Washed SL9",
            "url": "https://moonwakecoffeeroasters.com/products/san-sebastian-julio-chavez-washed-sl9-peru",
            "publisher": "Moonwake Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "peru-junin",
    "priority": "standard",
    "rationale": "Sanchirio Palomar의 Llave de Oro, Satipo의 역사적 대회 로트와 Pichanaqui 협동조합의 2025년 수확분이 확인된다. 서로 다른 후닌 생산권역을 실제 로트로 연결한다.",
    "sources": [
      {
        "title": "Palomar, Peru — Andres Bazos",
        "url": "https://elephantcollective.co.uk/products/andres-bazos",
        "publisher": "Elephant Roastery",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Nueva Tierra de Canan — Peru 2018, rank 9",
        "url": "https://allianceforcoffeeexcellence.org/farm-directory/88-23-4/",
        "publisher": "Alliance for Coffee Excellence",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Peru — Seasonal Release",
        "url": "https://thoumayest.com/products/peru-seasonal-release",
        "publisher": "Thou Mayest Coffee Roasters",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Peru Highland Select Extended Fermentation Natural",
        "url": "https://www.redroostercoffee.com/products/peru-highland-select-natural",
        "publisher": "Red Rooster Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Palomar — Llave de Oro Red Caturra",
        "producer": "Andres Bazos",
        "location": "Sanchirio Palomar, Chanchamayo, Junín, Peru",
        "varieties": [
          "Red Caturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "오렌지",
            "캐러멜",
            "밀크초콜릿"
          ],
          "en": [
            "Orange citrus",
            "Caramel",
            "Milk chocolate"
          ]
        },
        "sources": [
          {
            "title": "Palomar, Peru — Andres Bazos",
            "url": "https://elephantcollective.co.uk/products/andres-bazos",
            "publisher": "Elephant Roastery",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Nueva Tierra de Canan — COE 2018",
        "producer": "Frank Gurvich Garcia Pariona",
        "location": "Teruriari, Río Negro, Satipo, Junín, Peru",
        "varieties": [
          "Bourbon",
          "Gesha",
          "Pache"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "자스민",
            "레몬그라스",
            "녹차",
            "복숭아"
          ],
          "en": [
            "Jasmine",
            "Lemongrass",
            "Green tea",
            "Peach"
          ]
        },
        "sources": [
          {
            "title": "Nueva Tierra de Canan — Peru 2018, rank 9",
            "url": "https://allianceforcoffeeexcellence.org/farm-directory/88-23-4/",
            "publisher": "Alliance for Coffee Excellence",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "ACPC Pichanaki — Peru Seasonal Release",
        "producer": "Cooperativa Agraria Cafetalera ACPC Pichanaki",
        "location": "Pichanaqui, Chanchamayo, Junín, Peru",
        "varieties": [
          "Typica",
          "Caturra",
          "Bourbon"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "캐러멜",
            "카카오",
            "베이킹 향신료"
          ],
          "en": [
            "Caramel",
            "Cacao",
            "Baking spices"
          ]
        },
        "harvest": "2025-04–2025-09",
        "sources": [
          {
            "title": "Peru — Seasonal Release",
            "url": "https://thoumayest.com/products/peru-seasonal-release",
            "publisher": "Thou Mayest Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Highland Select Extended Fermentation Natural",
        "producer": "COOPAGRY",
        "location": "Junín, Peru",
        "varieties": [
          "Caturra",
          "Catimor",
          "Catuai",
          "Obata",
          "Tupi"
        ],
        "process": {
          "ko": "장시간 발효 내추럴·48시간 파티오 발효",
          "en": "Extended fermentation natural; 48-hour patio fermentation"
        },
        "flavorNotes": {
          "ko": [
            "빙 체리 시럽",
            "말린 망고",
            "초콜릿 케이크",
            "딸기잼"
          ],
          "en": [
            "Bing cherry syrup",
            "Dried mango",
            "Devil’s food cake",
            "Strawberry preserves"
          ]
        },
        "sources": [
          {
            "title": "Peru Highland Select Extended Fermentation Natural",
            "url": "https://www.redroostercoffee.com/products/peru-highland-select-natural",
            "publisher": "Red Rooster Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "peru-jaen",
    "priority": "focus",
    "rationale": "Chontalí의 단일 농장 Gesha, El Eucalipto 생산자 로트와 Café del Futuro의 2025/26 수확 공동 로트가 확인된다. 생산자별 선별품과 협회 로트의 범위를 구분한다.",
    "sources": [
      {
        "title": "Peru Los Quispe Gesha Anaerobic Washed",
        "url": "https://uk.covoyacoffee.com/peru-los-quispe-gesha-anaerobic-washed.html",
        "publisher": "Covoya Specialty Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Elias Sanchez Gayoso AA [2025]",
        "url": "https://www.commonfolkcoffee.com.au/products/elias-sanchez-gayoso-aa",
        "publisher": "Commonfolk Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Café del Futuro — P11586",
        "url": "https://www.touton-specialty-coffee.com/en/p11586",
        "publisher": "Touton Specialty Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "El Diamante",
        "url": "https://beansmiths.com/en/product/el-diamante/",
        "publisher": "Beansmith’s",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Los Quispe Gesha P8002546-1",
        "producer": "Roger Quispe & family",
        "location": "Agua Azul, Chontalí, Jaén, Cajamarca, Peru",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anaerobic washed"
        },
        "flavorNotes": {
          "ko": [
            "클라우디 레모네이드",
            "붉은 포도",
            "캔디 같은 단맛"
          ],
          "en": [
            "Cloudy lemonade",
            "Red grape",
            "Candied sweetness"
          ]
        },
        "sources": [
          {
            "title": "Peru Los Quispe Gesha Anaerobic Washed",
            "url": "https://uk.covoyacoffee.com/peru-los-quispe-gesha-anaerobic-washed.html",
            "publisher": "Covoya Specialty Coffee",
            "accessedAt": "2026-09-08"
          }
        ],
        "harvest": "2023/24"
      },
      {
        "name": "El Eucalipto — Elias Sanchez Gayoso AA",
        "producer": "Elias Sanchez Gayoso",
        "location": "Jaén, Cajamarca, Peru",
        "varieties": [
          "Catimor"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "블랙베리",
            "바닐라 크림",
            "레몬 셔벗"
          ],
          "en": [
            "Blackberry",
            "Vanilla cream",
            "Lemon sherbet"
          ]
        },
        "sources": [
          {
            "title": "Elias Sanchez Gayoso AA [2025]",
            "url": "https://www.commonfolkcoffee.com.au/products/elias-sanchez-gayoso-aa",
            "publisher": "Commonfolk Coffee",
            "accessedAt": "2026-09-08"
          }
        ],
        "harvest": "2024-11"
      },
      {
        "name": "Café del Futuro Washed — P11586",
        "producer": "Asociación Café del Futuro",
        "location": "Jaén, Cajamarca, Peru",
        "varieties": [
          "Mundo Novo",
          "Bourbon",
          "Caturra",
          "Catimor"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "캐러멜",
            "다크초콜릿",
            "만다린",
            "오렌지",
            "코코아"
          ],
          "en": [
            "Caramel",
            "Dark chocolate",
            "Mandarin",
            "Orange",
            "Cocoa"
          ]
        },
        "harvest": "2025/26",
        "sources": [
          {
            "title": "Café del Futuro — P11586",
            "url": "https://www.touton-specialty-coffee.com/en/p11586",
            "publisher": "Touton Specialty Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "El Diamante — Beansmith’s",
        "producer": "El Diamante coffee-producing families",
        "location": "El Diamante, Jaén, Peru",
        "varieties": [
          "Caturra",
          "Pache"
        ],
        "process": {
          "ko": "24시간 발효 워시드",
          "en": "Washed; 24-hour fermentation"
        },
        "flavorNotes": {
          "ko": [
            "적포도",
            "꿀",
            "커런트 브라우니"
          ],
          "en": [
            "Red grape",
            "Honey",
            "Currant brownie"
          ]
        },
        "sources": [
          {
            "title": "El Diamante",
            "url": "https://beansmiths.com/en/product/el-diamante/",
            "publisher": "Beansmith’s",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "peru-san-ignacio",
    "priority": "focus",
    "rationale": "Chirinos의 La Perla와 El Corazón 생산자에게서 품종·가공·노트가 모두 추적되는 수입 로트가 확인된다. 지역 내 지속적 전문 재배와 대회 참여 기록을 함께 검토했다.",
    "sources": [
      {
        "title": "Peru Finca La Perla Gesha Natural",
        "url": "https://uk.covoyacoffee.com/peru-la-perla-gesha-natural-uk.html",
        "publisher": "Covoya Specialty Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Efrain Carhuallocllo Yellow Caturra, El Corazon, Peru — Washed FSK-0053",
        "url": "https://korea.falcon-micro.com/products/efrain-carhuallocllo-yellow-caturra-el-corazon-peru-washed-fsk-0053",
        "publisher": "Falcon Micro Korea",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Peru San Ignacio",
        "url": "https://caffelab.com/peru-san-ignacio/",
        "publisher": "Caffèlab",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "La Perla Gesha Natural P8002310-1",
        "producer": "Noé López",
        "location": "Chirinos, San Ignacio, Cajamarca, Peru",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "살구",
            "장미",
            "청포도",
            "보라색 과일"
          ],
          "en": [
            "Apricot",
            "Rose",
            "White grape",
            "Purple fruits"
          ]
        },
        "sources": [
          {
            "title": "Peru Finca La Perla Gesha Natural",
            "url": "https://uk.covoyacoffee.com/peru-la-perla-gesha-natural-uk.html",
            "publisher": "Covoya Specialty Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Efrain Carhuallocllo Yellow Caturra FSK-0053",
        "producer": "Efrain Carhuallocllo",
        "location": "El Corazón, Chirinos, San Ignacio, Cajamarca, Peru",
        "varieties": [
          "Yellow Caturra"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "레몬",
            "포도",
            "헤이즐넛",
            "흑설탕",
            "바닐라"
          ],
          "en": [
            "Lemon",
            "Grape",
            "Hazelnut",
            "Brown sugar",
            "Vanilla"
          ]
        },
        "sources": [
          {
            "title": "Efrain Carhuallocllo Yellow Caturra, El Corazon, Peru — Washed FSK-0053",
            "url": "https://korea.falcon-micro.com/products/efrain-carhuallocllo-yellow-caturra-el-corazon-peru-washed-fsk-0053",
            "publisher": "Falcon Micro Korea",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025"
      },
      {
        "name": "San Ignacio — Caffèlab",
        "producer": "Smallholders of San Francisco, Los Llanos, San Andres & El Sauce",
        "location": "San Ignacio, Cajamarca, Peru",
        "varieties": [
          "Caturra",
          "Catuai",
          "Bourbon",
          "Mundo Novo"
        ],
        "process": {
          "ko": "20~30시간 발효 워시드",
          "en": "Washed; 20–30-hour fermentation"
        },
        "flavorNotes": {
          "ko": [
            "초콜릿",
            "탠저린",
            "아몬드",
            "캐러멜"
          ],
          "en": [
            "Chocolate",
            "Tangerine",
            "Almond",
            "Caramel"
          ]
        },
        "sources": [
          {
            "title": "Peru San Ignacio",
            "url": "https://caffelab.com/peru-san-ignacio/",
            "publisher": "Caffèlab",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "colombia-quindio",
    "priority": "focus",
    "rationale": "Calarcá의 El Fénix와 La Tebaida의 El Eden 선별 생두가 확인된다. 2025년 수확한 과일 공동 발효 로트의 가공을 명시하여 Wush Wush·Tabi 로트와 구분한다.",
    "sources": [
      {
        "title": "[66] PLOT × Scenery: El Fénix Wush Wush, crop 24/25 archive",
        "url": "https://scenery.coffee/blogs/coffee-archive/66-plot-x-scenery-el-fenix-wush-wush-crop-24-25-archive",
        "publisher": "Scenery Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia El Fenix Tabi — Washed Anoxic",
        "url": "https://greencoffeecollective.com/products/colombia-el-fenix-tabi-washed-anoxic",
        "publisher": "Green Coffee Collective",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "El Fenix Info",
        "url": "https://rawmaterial.coffee/el-fenix-info",
        "publisher": "Raw Material",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Producer Focus: Sebastian Ramirez’s El Placer",
        "url": "https://darkwoodscoffee.co.uk/blogs/news/producer-focus-sebastian-ramirezs-el-placer",
        "publisher": "Dark Woods Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Strawberry Shake Green Coffee",
        "url": "https://boterocoffee.com/products/strawberry-shake-green-coffee",
        "publisher": "Botero Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Colombia Campo Hermoso Wush Wush Natural",
        "url": "https://passportcoffee.com.au/blogs/roastery-ramblings/colombia-campo-hermoso-wush-wush-natural",
        "publisher": "Passport Specialty Coffee",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Strawberry Shake — Finca El Eden",
        "producer": "Viviana Martínez",
        "location": "La Tebaida, Quindío, Colombia",
        "varieties": [
          "Pink Bourbon",
          "Castillo"
        ],
        "process": {
          "ko": "블랙 허니·과일 공동 발효",
          "en": "Black honey co-ferment with fruit"
        },
        "flavorNotes": {
          "ko": [
            "딸기",
            "열대과일",
            "와인 같은 풍미",
            "크리미한 질감"
          ],
          "en": [
            "Strawberries",
            "Tropical",
            "Winey",
            "Creamy body"
          ]
        },
        "harvest": "2025",
        "sources": [
          {
            "title": "Strawberry Shake Green Coffee",
            "url": "https://boterocoffee.com/products/strawberry-shake-green-coffee",
            "publisher": "Botero Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "El Fénix Wush Wush — Scenery Anoxic Natural",
        "producer": "Miguel Fajardo Mendoza",
        "location": "Calarcá, Quindío, Colombia",
        "varieties": [
          "Wush Wush"
        ],
        "process": {
          "ko": "무산소 내추럴",
          "en": "Anoxic natural"
        },
        "flavorNotes": {
          "ko": [
            "열대과일 펀치",
            "화이트초콜릿",
            "라이스밀크"
          ],
          "en": [
            "Tropical fruit punch",
            "White chocolate",
            "Rice milk"
          ]
        },
        "sources": [
          {
            "title": "[66] PLOT × Scenery: El Fénix Wush Wush, crop 24/25 archive",
            "url": "https://scenery.coffee/blogs/coffee-archive/66-plot-x-scenery-el-fenix-wush-wush-crop-24-25-archive",
            "publisher": "Scenery Coffee",
            "accessedAt": "2026-09-08"
          }
        ],
        "harvest": "2024-05–2024-08"
      },
      {
        "name": "El Fénix Tabi — Washed Anoxic",
        "producer": "El Fénix / Raw Material",
        "location": "Calarcá, Quindío, Colombia",
        "varieties": [
          "Tabi"
        ],
        "process": {
          "ko": "무산소 발효 워시드",
          "en": "Anoxic washed"
        },
        "flavorNotes": {
          "ko": [
            "석류",
            "레몬 캔디",
            "모히토"
          ],
          "en": [
            "Pomegranate",
            "Candied lemon",
            "Mojito"
          ]
        },
        "sources": [
          {
            "title": "Colombia El Fenix Tabi — Washed Anoxic",
            "url": "https://greencoffeecollective.com/products/colombia-el-fenix-tabi-washed-anoxic",
            "publisher": "Green Coffee Collective",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Campo Hermoso Wush Wush Natural — Passport",
        "producer": "Edwin Noreña",
        "location": "Quindío, Colombia",
        "varieties": [
          "Wush Wush"
        ],
        "process": {
          "ko": "16시간 무산소 발효 내추럴",
          "en": "Natural; 16-hour anaerobic fermentation"
        },
        "flavorNotes": {
          "ko": [
            "꽃향",
            "레몬",
            "리치",
            "밀크초콜릿"
          ],
          "en": [
            "Floral",
            "Lemon",
            "Lychee",
            "Milk chocolate"
          ]
        },
        "sources": [
          {
            "title": "Colombia Campo Hermoso Wush Wush Natural",
            "url": "https://passportcoffee.com.au/blogs/roastery-ramblings/colombia-campo-hermoso-wush-wush-natural",
            "publisher": "Passport Specialty Coffee",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "colombia-valle-del-cauca",
    "priority": "focus",
    "rationale": "Café Granja La Esperanza가 직접 공개한 품종별 로트와 전문 로스터의 반복 거래 및 2025 Cerro Azul 로트가 확인된다. Caicedonia와 Trujillo의 두 농장을 구분하고 동일 생산자 그룹의 가공 차이도 보존한다.",
    "sources": [
      {
        "title": "Sudan Rumé Hybrid Washed",
        "url": "https://cafegranjalaesperanza.com/products/sudan-rume-hybrid-washed",
        "publisher": "Café Granja La Esperanza",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Geisha Napoleón",
        "url": "https://cafegranjalaesperanza.com/products/geisha-napoleon",
        "publisher": "Café Granja La Esperanza",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Cerro Azul #00281 by CGLE",
        "url": "https://xliiicoffee.com/en/product/cerro-azul-00281-by-cgle/",
        "publisher": "XLIII Coffee",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Granja La Esperanza Sudan Rume Natural",
        "url": "https://ptscoffee.com/products/sudan-rume-natural",
        "publisher": "PT's Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Cafés vallecaucanos ganaron importante distinción internacional",
        "url": "https://valle.federaciondecafeteros.org/listado-noticias/cafes-vallecaucanos-ganaron-importante-distincion-internacional/?lang=en",
        "publisher": "Federación Nacional de Cafeteros — Valle del Cauca",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Colombia Lusitania",
        "url": "https://www.reframecoffee.com/shop/colombia-lusitania/",
        "publisher": "Reframe Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Las Margaritas Sudan Rumé Hybrid Washed",
        "producer": "Café Granja La Esperanza",
        "location": "Caicedonia, Valle del Cauca, Colombia",
        "varieties": [
          "Sudan Rume"
        ],
        "process": {
          "ko": "하이브리드 워시드",
          "en": "Hybrid washed"
        },
        "flavorNotes": {
          "ko": [
            "만다린",
            "복숭아",
            "생강",
            "민트"
          ],
          "en": [
            "Mandarin",
            "Peach",
            "Ginger",
            "Mint"
          ]
        },
        "sources": [
          {
            "title": "Sudan Rumé Hybrid Washed",
            "url": "https://cafegranjalaesperanza.com/products/sudan-rume-hybrid-washed",
            "publisher": "Café Granja La Esperanza",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Cerro Azul Geisha Napoleón Natural",
        "producer": "Café Granja La Esperanza",
        "location": "Trujillo, Valle del Cauca, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "파인애플",
            "복숭아",
            "레몬그라스",
            "럼"
          ],
          "en": [
            "Pineapple",
            "Peach",
            "Lemongrass",
            "Rum"
          ]
        },
        "sources": [
          {
            "title": "Geisha Napoleón",
            "url": "https://cafegranjalaesperanza.com/products/geisha-napoleon",
            "publisher": "Café Granja La Esperanza",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Cerro Azul Gesha #00281",
        "producer": "Café Granja La Esperanza",
        "location": "Trujillo, Valle del Cauca, Colombia",
        "varieties": [
          "Gesha"
        ],
        "process": {
          "ko": "하이브리드 워시드",
          "en": "Hybrid washed"
        },
        "flavorNotes": {
          "ko": [
            "골드키위",
            "칸탈루프 멜론",
            "자스민"
          ],
          "en": [
            "Yellow kiwi",
            "Rock melon",
            "Jasmine"
          ]
        },
        "sources": [
          {
            "title": "Cerro Azul #00281 by CGLE",
            "url": "https://xliiicoffee.com/en/product/cerro-azul-00281-by-cgle/",
            "publisher": "XLIII Coffee",
            "accessedAt": "2026-09-09"
          }
        ],
        "harvest": "2025"
      },
      {
        "name": "Lusitania Castillo Natural — Reframe",
        "producer": "Consuelo Marín & Javier Macias",
        "location": "San Gerardo Alto, Caicedonia, Valle del Cauca, Colombia",
        "varieties": [
          "Castillo"
        ],
        "process": {
          "ko": "내추럴",
          "en": "Natural"
        },
        "flavorNotes": {
          "ko": [
            "망고",
            "럼",
            "라임 주스"
          ],
          "en": [
            "Mango",
            "Rum",
            "Lime juice"
          ]
        },
        "sources": [
          {
            "title": "Colombia Lusitania",
            "url": "https://www.reframecoffee.com/shop/colombia-lusitania/",
            "publisher": "Reframe Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  },
  {
    "regionId": "brazil-espirito-santo",
    "priority": "focus",
    "rationale": "Castelo·Afonso Cláudio의 수입사 농장별 로트와 Itarana의 2025년 9월 수확 Sivanius Kutz 로트가 확인된다. 주 전체의 아라비카·코닐론 일반론과 개별 아라비카 상품을 구분한다.",
    "sources": [
      {
        "title": "Cafeicultura",
        "url": "https://incaper.es.gov.br/cafeicultura",
        "publisher": "Instituto Capixaba de Pesquisa, Assistência Técnica e Extensão Rural (Incaper)",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Centro de Cafés Especiais do Espírito Santo – Cecafes",
        "url": "https://incaper.es.gov.br/centro-de-cafes-especiais-do-espirito-santo-cecafes",
        "publisher": "Instituto Capixaba de Pesquisa, Assistência Técnica e Extensão Rural (Incaper)",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Sitio Bela Vista Red Catuai",
        "url": "https://www.allycoffee.com/coffees/sitio-bela-vista-red-catuai/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "Sítio Alto Lagoa – Délio Sering – Catucai Washed",
        "url": "https://www.allycoffee.com/coffees/sitio-alto-lagoa-delio-sering-catucai-washed/",
        "publisher": "Ally Coffee",
        "accessedAt": "2026-09-08"
      },
      {
        "title": "ROTA DO LAGARTO - ALTO SANTA ROSA (BR-943)",
        "url": "https://www.algrano.com/en/products/8822-brazil-rota-do-lagarto-alto-santa-rosa-arabica-fully-washed-sep-2025",
        "publisher": "Farmers Coffee / Algrano",
        "accessedAt": "2026-09-09"
      },
      {
        "title": "Black Tucano Single Origin — Sítio Bom Destino",
        "url": "https://www.blacktucanocoffee.com/products/assinatura-cafe-black-tucano-single-origin-torrado-e-em-graos-250g",
        "publisher": "Black Tucano Coffee Roasters",
        "accessedAt": "2026-09-09"
      }
    ],
    "lots": [
      {
        "name": "Sitio Bela Vista Red Catuai",
        "producer": "José Leandro Romão — Sitio Bela Vista",
        "location": "Castelo, Espírito Santo, Brazil",
        "varieties": [
          "Red Catuai"
        ],
        "process": {
          "ko": "펄프드 내추럴",
          "en": "Pulped Natural"
        },
        "flavorNotes": {
          "ko": [
            "시트러스",
            "초콜릿",
            "단맛",
            "버터",
            "아몬드"
          ],
          "en": [
            "Citrus",
            "Chocolate",
            "Sweet",
            "Butter",
            "Almond"
          ]
        },
        "sources": [
          {
            "title": "Sitio Bela Vista Red Catuai",
            "url": "https://www.allycoffee.com/coffees/sitio-bela-vista-red-catuai/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Sítio Alto Lagoa Catucai Washed",
        "producer": "Délio Sering — Sítio Alto Lagoa",
        "location": "Afonso Cláudio, Espírito Santo, Brazil",
        "varieties": [
          "Catucai"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "블랙베리",
            "캐러멜",
            "다크 초콜릿",
            "시트러스"
          ],
          "en": [
            "Blackberry",
            "Caramel",
            "Dark Chocolate",
            "Citrus"
          ]
        },
        "sources": [
          {
            "title": "Sítio Alto Lagoa – Délio Sering – Catucai Washed",
            "url": "https://www.allycoffee.com/coffees/sitio-alto-lagoa-delio-sering-catucai-washed/",
            "publisher": "Ally Coffee",
            "accessedAt": "2026-09-08"
          }
        ]
      },
      {
        "name": "Rota do Lagarto — Alto Santa Rosa BR-943-202509-05f3edddeb",
        "producer": "Sivanius Kutz",
        "location": "Itarana, Espírito Santo, Brazil",
        "varieties": [
          "Catucai 785"
        ],
        "process": {
          "ko": "풀리 워시드",
          "en": "Fully washed"
        },
        "flavorNotes": {
          "ko": [
            "아몬드",
            "카카오"
          ],
          "en": [
            "Almond",
            "Cacao"
          ]
        },
        "harvest": "2025-09",
        "sources": [
          {
            "title": "ROTA DO LAGARTO - ALTO SANTA ROSA (BR-943)",
            "url": "https://www.algrano.com/en/products/8822-brazil-rota-do-lagarto-alto-santa-rosa-arabica-fully-washed-sep-2025",
            "publisher": "Farmers Coffee / Algrano",
            "accessedAt": "2026-09-09"
          }
        ]
      },
      {
        "name": "Sítio Bom Destino — Black Tucano Single Origin",
        "producer": "Josiane Lima Bissoli",
        "location": "Afonso Cláudio, Espírito Santo, Brazil",
        "varieties": [
          "Yellow Catucai 2SL"
        ],
        "process": {
          "ko": "워시드",
          "en": "Washed"
        },
        "flavorNotes": {
          "ko": [
            "꽃향",
            "꿀",
            "라파두라",
            "복숭아"
          ],
          "en": [
            "Floral",
            "Honey",
            "Rapadura",
            "Peach"
          ]
        },
        "sources": [
          {
            "title": "Black Tucano Single Origin — Sítio Bom Destino",
            "url": "https://www.blacktucanocoffee.com/products/assinatura-cafe-black-tucano-single-origin-torrado-e-em-graos-250g",
            "publisher": "Black Tucano Coffee Roasters",
            "accessedAt": "2026-09-09"
          }
        ]
      }
    ]
  }
];
