# 남미 산지 로스터 원문 재조사 — 2026-09-09

대상은 `specialty-research/south.ts`의 25개 지역 전부다. 각 지역을 새로 검색하고 로스터의 제품 페이지·제품 아카이브를 직접 열어 품종, 가공, 노트, 생산지를 대조했다. 결과 집계는 신규 25개 지역별 연결(20개 고유 제품), 67 → 92개 지역별 로트다. 국가별 일반 향미로 대신 채우지 않았다. 상세 원문 URL과 판정은 JSON에도 보존한다.

## 지역별 확인

| regionId | 실제 검색어 | 직접 읽은 로스터 URL | 결과 |
|---|---|---|---|
| colombia-huila | "Papayo" "Huila" coffee roaster notes | https://ineffablecoffee.com/products/betania-farm-papayo | 채택: Betania / Linarco Rodríguez / Papayo / anaerobic washed / cherimoya·apricot·vanilla / harvest 2026. |
| colombia-narino | coffee roaster Narino Obraje Caturra tasting notes | https://caffegoriziana.it/en/product/colombia-finca-el-obraje-2/ | 채택: El Obraje / Caturra / natural / mango·jasmine·honey. 기존 Ally Caturra 로트와 동일 로트라고 간주하지 않음. |
| colombia-antioquia | coffee roaster Antioquia Chiroso tasting notes | https://flowerchildcoffee.com/products/edgar-gonzalez-chiroso | 채택: Edgar Gonzalez / Urrao / Chiroso / washed double fermentation / dried berries·cascara·geranium / harvest March 2026. |
| colombia-cauca | "Cauca" coffee roaster "notes" "washed"; "Inza" "coffee" "roaster" "variety" | https://theangryroaster.com/products/colombia-gesha-inza | 채택: La Colina / Rafael Velasquéz & Andrés Martinez / Inzá, Cauca / Gesha / washed / bergamot·clementine·lavender·blueberries. |
| colombia-inza | "Inza" "coffee" "roaster" "variety" | https://theangryroaster.com/products/colombia-gesha-inza | 채택: La Colina의 동일 제품. Cauca 상위 지역에도 연결하되 고유 로트는 한 개. |
| colombia-pitalito | "Pitalito" "roasters" "Aji" | https://onyxcoffeelab.com/en-int/products/colombia-yadimir-quiguanas-perez-bourbon-aji | 채택: Los Yarumos / Yadimir Quiguanas Pérez / Bourbon Aji / washed / hibiscus·vanilla·ruby red grapefruit·apple / Early 2024. 본문 인터뷰 Ombligón 노트는 혼입하지 않음. |
| colombia-san-agustin | "San Agustin" site:seycoffee.com "Aruzi" | https://www.seycoffee.com/products/2025-victor-alfonso-bonilla-la-chorrera-end-of-season-colombia | 채택: La Chorrera / Victor Alfonso Bonilla / Aruzi / washed / chamomile·honeydew·peach / Jan 2025. 유전적 계통 불확정. |
| colombia-tolima | coffee roaster Tolima Jorge Rojas tasting notes; "Tolima" "roasters" "Bourbon"; "Planadas" coffee roaster variety tasting | https://patiocoffee.com.au/shop/colombia-planadas/ | 채택: Patio의 Planadas / Typica·Castillo·Caturra / natural fermented / red apple·honey·nougat. 생산자 실명·수확연도 미공개. |
| colombia-planadas | "Planadas" coffee roaster variety tasting | https://patiocoffee.com.au/shop/colombia-planadas/ | 채택: Patio Planadas 제품. Tolima 상위 연결은 같은 로트를 재사용. 농장 이름 추정하지 않음. |
| brazil-cerrado | "Cerrado" coffee roaster tasting notes variety; "Cerrado" "roasters" "Arara" | https://www.blackwhiteroasters.com/products/r-daterra-our-plot-project-jan-25 | 채택: Daterra Our Plot / Luis N. Pascoal / Yellow Arara / 서로 다른 효모로 발효한 3개 anaerobic natural 혼합 / praline pecan·crème brûléed citrus·aged rum·milk chocolate. URL Jan25를 수확연도로 사용하지 않음. |
| brazil-sul-de-minas | "Sul de Minas" coffee roaster tasting notes variety | https://www.parlor.coffee/products/santa-luzia-brazil | 채택: Santa Luzia / 여성 생산자 공동 로트 / Catuai·Catucai·Mundo Novo·Acaia·Arara / natural / almond·brown sugar·caramel·yellow fruit. |
| brazil-bahia | "Bahia" coffee roaster tasting notes variety; "Chapada Diamantina" coffee roaster tasting variety | https://roastcafes.com/produto/arara-do-paulo-menezes-2024/ | 채택: Fazenda Moeté / Paulo Lemos Menezes / Piatã, Chapada Diamantina / Arara / cereja descascado / rapadura·passion fruit·apricot·white flowers / Aug 2024. |
| brazil-chapada-diamantina | "Chapada Diamantina" coffee roaster tasting variety | https://roastcafes.com/produto/arara-do-paulo-menezes-2024/ | 채택: Moeté Arara. Bahia에도 같은 underlying lot 연결. 2024 표기를 최근 연도로 바꾸지 않음. |
| brazil-carmo-de-minas | "Carmo de Minas" coffee roaster tasting notes variety | https://www.partnerscoffee.com/blogs/education/brazil-irmas-pereira-2025 | 채택: Irmãs Pereira / Maria Valéria & Maria Rogéria Pereira / Yellow Bourbon / natural / milk chocolate·apricot·pecan. 글 제목 2025는 수확연도 아님. |
| brazil-mantiqueira-de-minas | "Mantiqueira" coffee roaster tasting notes variety; "Carmo de Minas" coffee roaster tasting notes variety | https://www.partnerscoffee.com/blogs/education/brazil-irmas-pereira-2025 | 채택: Partners가 Carmo de Minas를 Mantiqueira range에 명시. Irmãs Pereira 같은 로트를 상위 연결. SUMO 기존 Arara 2025/26도 재대조 일치. |
| brazil-alta-mogiana | "Alta Mogiana" coffee roaster "variety" | https://www.cafemoscardini.com/en | 채택: Cacau & Castanhas / Sítio Santa Maria da Boa Vista / Elder Moscardini Filho / Mundo Novo / natural / cacao nibs·nuts. 기존 Tupi와 Yellow Obata 제품과 구분. |
| peru-jaen | "Jaen" coffee roaster notes varietal | https://beansmiths.com/en/product/el-diamante/ | 채택: El Diamante / 여러 생산 가족 / Caturra·Pache / washed 24h / red grape·honey·currant brownie. 지역 일반 품종을 이 로트에 추가하지 않음. |
| peru-cajamarca | "Cajamarca" coffee roaster tasting variety; "Cajamarca" "roaster" "Marshell"; "San Ignacio" coffee roaster notes variety | https://caffelab.com/peru-san-ignacio/ | 채택: Caffèlab San Ignacio 제품을 Cajamarca 상위에 연결. 품종·가공·노트 정확히 같은 사례. |
| peru-san-ignacio | "San Ignacio" coffee roaster notes variety | https://caffelab.com/peru-san-ignacio/ | 채택: San Francisco·Los Llanos·San Andres·El Sauce 소농 / Caturra·Catuai·Bourbon·Mundo Novo / washed 20–30h / chocolate·tangerine·almond·caramel. |
| peru-cusco | "Cusco" coffee roaster tasting variety; "Cusco" "roaster" "SL9"; site:moonwakecoffeeroasters.com "San Sebastian" | https://moonwakecoffeeroasters.com/products/san-sebastian-julio-chavez-washed-sl9-peru | 채택: San Sebastian / Julio Chavez / Inkawasi / SL-9 / washed / jasmine·peach·pomelo·sencha. 수확연도 없음. India Selection9와 통합하지 않음. |
| peru-junin | "Junin" coffee roaster notes varietal | https://www.redroostercoffee.com/products/peru-highland-select-natural | 채택: Highland Select / COOPAGRY / Caturra·Catimor·Catuai·Obata·Tupi / extended fermentation natural / bing cherry syrup·dried mango·devil’s food cake·strawberry preserves. 48h 산소제한 patio를 밀폐탱크라고 바꾸지 않음. |
| colombia-quindio | "Quindio" coffee roaster notes variety | https://passportcoffee.com.au/blogs/roastery-ramblings/colombia-campo-hermoso-wush-wush-natural | 채택: Campo Hermoso / Edwin Noreña / Wush Wush / natural 16h anaerobic / floral·lemon·lychee·milk chocolate. |
| colombia-valle-del-cauca | "Valle del Cauca" coffee roaster notes variety | https://www.reframecoffee.com/shop/colombia-lusitania/ | 채택: Lusitania / Consuelo Marín & Javier Macias / Caicedonia / Castillo / natural / mango·rum·lime juice. 같은 페이지 관련상품 Los Nogales 정보는 배제. |
| brazil-espirito-santo | "Espirito Santo" coffee roaster notes variety; "Espirito Santo" "roasters" "Catucai" | https://www.blacktucanocoffee.com/products/assinatura-cafe-black-tucano-single-origin-torrado-e-em-graos-250g | 채택: Bom Destino / Josiane Lima Bissoli / Afonso Cláudio / Catucaí 2SL Amarelo / washed / floral·honey·rapadura·peach. |
| brazil-mogiana | "Mogiana" coffee roaster tasting notes variety; "Mogiana" "roasters" "Bourbon" "farm" | https://boxxcoffee.la/products/brazil-sitio-siriema<br>https://reykjavikroasters.is/en/portfolio-posts/mogiana-en/ | 채택: Boxx Sítio Siriema / Ivan & Rose dos Santos / Arara / natural / red plum·rosehip·red apple. Reykjavík regional Yellow Bourbon은 생산자 불명이라 별도 로트 보류. |

## 경계와 보류

- Harvest가 없는 제품에 판매·게시·입고 연도를 이식하지 않았다. Partners 글 제목 2025, Daterra URL jan-25, Moonwake COE 수상연도, Red Rooster 첫 수출 2025는 수확연도로 쓰지 않는다.
- Onyx Bourbon Ají 상단 품종·가공·향미 및 Early 2024 수확을 채택했다. 후반 Fernando 인터뷰의 Ombligón 언급은 다른 로트가 섞인 편집 흔적으로 판단해 해당 인터뷰 노트를 배제했다. 0mg caffeine 같은 기본 템플릿 필드도 무시했다. 농장 위치는 Los Yarumos/Pitalito 생산자 본문으로 확인했다.
- Novel Jorge Rojas Tabi Honey는 검색 인덱스에 상세표가 있지만 직접 열기 실패, 농장 소개 품종과 제품표가 달랐다. 별도 채택하지 않았다. Boxcar Jorge Rojas는 직접 열기 404. 대신 원문 정상인 Patio Planadas를 채택했다.
- Ethos Planadas, Whittard San Agustin, Sidewalk Bahia는 검색에서 세부 정보가 노출되지만 직접 열기 실패로 미채택. Paper Bag Pitalito는 검색 제품과 직접 읽은 페이지 범위가 일치하지 않아 미채택.
- 일반 로스터 목록·BeanHoard·The Press·리뷰 커뮤니티는 발견 경로로만 사용했다. 데이터에 옮긴 필드는 최종 공식 로스터 제품 원문에서 직접 읽었다.
- Reykjavík Mogiana는 Yellow Bourbon/pulped natural/노트를 확인했지만 생산자 미공개. 농장 추적이 가능한 Boxx Sítio Siriema를 추가했고 Reykjavík는 profile source 비교 자료로만 보존했다.
- Caffèlab 제목 설명에서 Cajamarca를 province라 부르는 부분은 사용하지 않고 제품표 San Ignacio, Cajamarca 및 생산 마을 목록만 채택했다.
- Aruzi는 SEY 자체가 소수 유전자 표본 결과 불균일을 밝힌다. SL-9는 Moonwake의 제품상 명칭이다. 이 둘을 기존 품종 계통과 억지로 합치지 않는다.
- 기존 단일 수입사 원두에 새 로스터의 다른 배치 향미를 덮어쓰지 않았다. 같은 농장이라도 품종·가공·배치가 다르면 새 제품 사례다. 상위 지역 재사용은 Cauca/Inzá, Tolima/Planadas, Bahia/Chapada Diamantina, Mantiqueira/Carmo de Minas, Cajamarca/San Ignacio 5쌍이다.

## 신규 세부 산지 후보

- Urrao → Antioquia: Flower Child Edgar Gonzalez Chiroso에 직접 표기.
- Piatã → Chapada Diamantina: ROAST Moeté Arara에 직접 표기.
- Inkawasi → Cusco: Moonwake San Sebastian SL-9에 직접 표기.
- Afonso Cláudio → Espírito Santo: Black Tucano Bom Destino Catucaí 2SL Amarelo에 직접 표기.
- Caicedonia → Valle del Cauca: Reframe Lusitania Castillo에 직접 표기.
- El Diamante → Jaén: Beansmith’s 제품의 지역 필드·생산 가족 설명에 직접 표기.

공개 페이지에는 사용법·자료 해설·검증 과정·주의 문구를 추가하지 않았다.
