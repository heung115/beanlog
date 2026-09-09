# 중미·멕시코 품종 근거 검토

검토일: 2026-09-08. 범위는 `americas-central.ts`의 29개 산지다. 결과는 별도 `variety-research/central.ts`에 저장했으며 기존 산지 가이드는 변경하지 않았다.

완료 결과: 지역–품종 관계 96개, 품종 표기 34개, 고유 출처 URL 46개. 직접 연결은 27개 산지이며 Huehuetenango와 West Valley는 각각 San Pedro Necta·Naranjo의 근거를 상위 집계하도록 남겨 29개 전체를 포괄한다. 기존 가이드의 문자열 목록과 비교한 직접 신규 관계는 75개이며, 이 숫자는 계보나 별칭을 판정한 품종 수가 아니다. 지역 ID·관계 중복·출처 필수 항목·확인일·URL 검사와 해당 파일의 ESLint 검사를 통과했다.

재배 품종을 명시하는 생산자·산지협회·수출입사·해당 원두 판매 로스터의 본문을 사용했다. 하나의 레코드는 하나의 품종과 하나의 지역을 연결한다. 한 생산자가 여러 농장을 운영하며 품종을 통합 공개한 경우 생산자 단위로 남기고 특정 농장에 임의로 배분하지 않았다. 세부 산지가 확인되면 그 ID를 사용했으며 상위 지역에 같은 근거를 복제하지 않았다. 품종 이름 표기는 정리하되 계보·교배·등급·향미를 추정해 추가하지 않았다.

## 파나마·과테말라·코스타리카 15개

| 산지 | 검토한 생산자·자료와 처리 |
| --- | --- |
| Boquete | [Panama Varietals의 Bonita Springs](https://www.panamavarietals.coffee/copy-of-finca-la-aurora)에서 Alto Lino 위치와 품종 표를 읽었다. Alto Lino 별도 ID가 없으므로 Boquete로 연결했다. 다른 하위 산지의 품종을 이곳에 중복 기록하지 않았다. |
| Volcán | [SCAP Janson](https://scap-panama.com/janson/)의 재배 품종 재확인. 이 조사에서 읽은 Laurina 근거는 Volcán이 아니므로 배정하지 않았다. |
| Jaramillo | [InterAmerican Anselmito](https://interamericancoffee.de/wp-content/uploads/2024/12/FactSheet_Panama_Anselmito_Estate.pdf)의 Jaramillo 주소와 Caturra·Catuai·Typica 목록, [Mario #5](https://www.offshootcoffee.com.au/products/hacienda-la-esmeralda-mario-5-rare)의 지역·구획·품종을 대조했다. Agricola의 여러 농장 통합 목록에 쓰인 `Paca`를 임의로 Pacas로 확정하거나 특정 농장에 배분하지 않았다. |
| Alto Quiel | [SCAP Elida](https://scap-panama.com/lamastus-coffees/) 품종 표, [Black Moon Lot 49](https://braveroasters.com/products/panama-blackmoon-chiroso-n49-100g), [SCAP El Velo 보도](https://scap-panama.com/cafe-geisha-de-panama-sacude-al-mundo-con-impresionantes-records-mundiales/)를 각각 대조했다. 향후 계획으로만 나온 Black Moon의 다른 후보는 제외했다. |
| Bambito | [SCAP Bambito](https://scap-panama.com/bambito-estate-coffee/)의 품종·주소를 확인했다. 검색에서 다른 농장 문구가 함께 나온 Pacamara는 Bambito 근거로 사용하지 않았다. |
| Antigua | [Finca Gascón 공식 사이트](https://fincagascon.com/)의 농장 위치와 자사 품종을 확인했다. 직접 열기는 403이었으나 검색 도구가 반환한 해당 페이지 본문을 읽었다. |
| Huehuetenango | La Unión의 범위를 검토한 결과 San Pedro Necta가 명확해 하위 ID에만 기록했다. 국가 전체의 품종표를 Huehuetenango 근거로 가져오지 않았다. |
| Atitlán | [Chacaya 생산자](https://chacaya.com/)가 함께 공개한 두 농장의 위치·품종을 확인했다. 생산자 표기는 두 농장 공동이며 품종을 어느 한 농장에 임의 배분하지 않았다. `Ethiopia`는 구체적인 품종 식별이 부족해 제외했다. |
| Cobán | [Manhattan Santa Irene](https://manhattan.coffee/catalog/coffee/santa-irene)의 생산자·지역·품종 일치 확인. [Aurora Farm](https://cafe-sucre.tokyo/en/products/guatemala_coban)의 Santa Cruz Verapaz 위치와 시험구 재배 품종 세 가지도 채택했다. 이는 각 품종이 모두 상시 판매된다는 근거는 아니다. Baja Verapaz를 Cobán과 인접하다고만 설명한 별도 상품은 근거로 편입하지 않았다. |
| San Pedro Necta | [Sucafina La Unión](https://www.sucafina.com/na/offerings/huehuetenango-la-union-pacamara-fw)의 Chichime 위치와 재배 목록을 확인했다. 상품의 Natural/Fully washed 설명이 섞인 부분은 이번 품종 자료에 사용하지 않았다. 직접 열기는 실패했으며 검색 도구가 반환한 상세 본문을 사용했다. |
| Tarrazú | [Exclusive Coffees](https://exclusivecoffeecr.com/relationships_tarrazu.html)의 Santa Rosa 1900 관계 자료를 확인했다. 상위 커피권 명칭과 micro-region을 구분했다. `Fully Washed`가 품종 칸에 잘못 들어간 다른 행은 수집하지 않았다. |
| West Valley | Naranjo 생산자들과 La Isla를 검토했다. 실제 세부 위치가 확인된 결과는 Naranjo에만 연결하고 광역 목록에 복제하지 않았다. |
| Central Valley | [Touton Las Lajas](https://www.touton-specialty-coffee.com/en/p11379)의 농장군 품종과 Carrizal 개별 품종을 구분했다. [Friedrichs El Cerro](https://friedrichscoffee.com/product/costa-rica-las-lajas-finca-el-cerro/)에서 Starmaya 확인. `H1`을 설명 없이 Centroamericano로 바꾸지 않았다. |
| Dota | [Exclusive Coffees](https://exclusivecoffeecr.com/relationships_tarrazu.html)의 Santa Teresa 2000·La Florida와 [Sucafina Higueronal](https://sucafina.com/emea/offerings/solis-cordero-higueronal-f1-anaerobic-natural)의 세부 위치를 확인했다. `Beto`, `Ethiopia 41`처럼 동일성을 더 검토해야 하는 표기는 제외했다. |
| Naranjo | [Los Cipreses](https://www.changeoftone.coffee/farms/familia-salazar-los-cipreses), Aguilera의 재배 목록·위치, [La Isla](https://www.allycoffee.com/coffees/la-isla-micromill-catigua-semi-washed/)를 대조했다. La Isla는 직접 열기가 실패했으나 검색에 반환된 본문이 Naranjo 농장 매입과 품종을 모두 명시했다. |

## 공통 제한과 제외 기준

- Chicho Gallo는 [Guarumo](https://www.panamavarietals.coffee/copy-of-finca-bernardina)와 [Hartmann 상품](https://pagacoffee.com/pages/finca-hartmann-chico-gallo)에서 확인했으나 실제 위치가 이번 29개 밖의 Renacimiento라 담당자에게 전달했다. 이를 Boquete나 Volcán으로 옮기지 않았다. 알려지지 않은 계보 설명도 복사하지 않았다.
- Black Moon의 미래 수확 예정 품종과 모호한 품종 묶음은 재배·출하가 확인된 로트와 구별했다. 품종명처럼 보이는 상품명·가공명은 제외했다.
- `SL-28/SL 28→SL28`, `Gesha→Geisha`, `Rume Sudan/Rume Sudán→Sudan Rume`, `Villalobos→Villa Lobos`, `Anacafé 14→Anacafe 14`는 표시 통일이다. 이 조사는 유전자 검사에 의한 품종 인증을 수행한 것이 아니다.
- `Typica Lima`는 Touton의 해당 상품 품종 표기를 보존했다. 일반 Typica와 동일하다고 단정하거나 별도 계보를 만들지 않았다.
- 카탈로그·생산자 소개의 접근일은 확인한 날을 뜻한다. 출하 예정·품절·지난 수확 자료를 현재 구매 가능성으로 해석하지 않았다. 품종별 생산량·지역 점유율은 자료에 없으므로 추가하지 않았다.
- 모든 근거는 기존 산지의 설명·고도·향미를 다시 작성하는 데 사용하지 않았다. 화면 안내·검증 설명도 추가하지 않았다.

## 온두라스·엘살바도르·니카라과·멕시코 14개

검토일: 2026-09-08. 원본 데이터는 수정하지 않았습니다. 통합한 38개 관계는 지역·생산자·품종을 함께 지지하며 출처는 25개입니다. 기존에 빠진 품종을 우선했으며, 기존 품종 전체를 빠짐없이 재검증한 목록은 아닙니다. 아래 건수는 고유한 지역–품종 관계 수입니다.

| 지역 ID | 건수 | 검토 범위와 채택 판단 |
| --- | ---: | --- |
| honduras-marcala | 4 | Villa Gloria의 농장별 재배 목록. 다른 소유 농장 Las Marinas의 소재지는 Chinacla이므로 그 농장의 Tupi를 Marcala에 옮기지 않았습니다. |
| honduras-copan | 3 | San Isidro와 El Meson의 수입업자 로트 명세를 각각 확인했습니다. |
| honduras-comayagua | 2 | Los Romero의 2026 대회 로트와 La Esmeralda의 실제 워시드 판매 로트를 채택했습니다. 후자의 향후 수확 예정 품종은 제외했습니다. |
| honduras-santa-barbara | 3 | El Mango·La Salsa의 2026 공식 로트, El Niño의 생산자 소개를 채택했습니다. |
| el-salvador-santa-ana | 4 | Café de El Salvador의 La Esperanza 농장 등록 내용을 확인했습니다. 일반명 Kenya·Heirloom은 구체 품종으로 추가하지 않았습니다. |
| el-salvador-chalatenango | 3 | Cafe Imports 26504·26496의 생산자와 지역 표시를 확인했습니다. Bella Vista의 Bourbon은 2007년 기록이며 생산자 문자열에도 연도를 보존했습니다. |
| nicaragua-jinotega | 3 | Hacienda Sajonia의 직접 재배 목록과 La Laguna의 2026 공식 로트를 채택했습니다. |
| nicaragua-matagalpa | 3 | La Minita가 명시한 Los Placeres의 품종 중 기존에 없던 항목을 채택했습니다. 자료 날짜는 2020년입니다. |
| nicaragua-nueva-segovia | 2 | Mozonte의 El Rosario·Un Regalo De Dios를 사용했습니다. Dipilto 농장 근거를 부모 항목에 중복 배치하지 않았습니다. |
| nicaragua-dipilto | 4 | Los Suyates·El Poste·Ojo de Agua의 구체 품종만 채택했습니다. Dipilto–Jalapa 혼합 지역 블렌드는 사용하지 않았습니다. |
| mexico-chiapas | 2 | Santa Cruz·Cafeología La Finca의 수입업자 명세를 확인했습니다. |
| mexico-oaxaca | 1 | El Encino 생산자 설명의 Marsellesa를 채택했습니다. 같은 페이지의 대회 로트는 Gesha이나 재배 목록에는 빠져 있어, 이번 관계 파일에는 Gesha를 추가하지 않았습니다. |
| mexico-veracruz | 3 | Royal Coffee CJ1636의 Fátima 재배 목록을 확인했습니다. 원자료의 Gesha는 통합 시 Geisha로 표시만 통일했습니다. |
| mexico-pluma-hidalgo | 1 | 생산자 조합이 지역과 함께 직접 표기한 Typica를 채택했습니다. 지리적 명칭만 보고 별도 품종이나 Bourbon을 추가하지 않았습니다. |

### 접근 방식과 제외 후보

- 88 Graines의 El Niño 페이지는 직접 열기에서 오류가 났습니다. 검색 도구가 반환한 전체 색인 본문에서 농장·La Leona, Santa Barbara·품종 목록을 읽어 확인했습니다. 직접 페이지 열람 성공으로 표시하지 않습니다.
- Cafe Imports는 개별 상품 링크를 열어도 전체 판매 목록이 표시됩니다. 해당 ID의 실제 행에서 품종·생산자·Chalatenango를 확인했습니다.
- 그 밖의 채택 출처는 웹 도구로 페이지 또는 PDF를 열었습니다. 일부는 검색 본문으로 먼저 읽고, 직접 열기로 주소와 문서 존재를 추가 확인했습니다.
- Don Jaime 2026의 농장 설명은 San Ignacio, Chalatenango라고 쓰지만 위치 필드는 Metapán, Santa Ana라고 되어 있습니다. 다른 로스터 자료에서는 Chalatenango로 확인되지만, 이번 JSON에는 해당 농장의 Geisha·SL28·Laurina·Sidra를 넣지 않았습니다. [원문](https://farmdirectory.cupofexcellence.org/listing/6-don-jaime-el-salvador-2026-wet/)
- Un Regalo De Dios 2026의 설명문에는 다른 농장명 Bendición de Dios도 등장합니다. 농장명·생산자·품종·Mozonte 위치는 개별 문서의 구조화 필드와 [공식 결과표](https://allianceforcoffeeexcellence.org/nicaragua-2026/)가 일치하는 범위만 사용했습니다. 설명문에 있는 다른 농장의 재배 이력은 채택하지 않았습니다.
- Rancho la Sirena 2013의 품종 필드는 서로 다른 혼합 비율이 붙어 있어 이번 근거에서 제외했습니다. [원문](https://allianceforcoffeeexcellence.org/farm-directory/85-19-7/)
- 산지 중간에 있다고만 소개한 San José de las Nubes의 Maragogype는 특정 행정지역으로 확정하지 않았습니다. Jinotega의 대체 근거는 La Laguna입니다.
- 재배 목록은 특정 생산자의 재배 사례를 의미합니다. 지역 전체의 보급률·유전형 보증·모든 농장에서의 재배를 주장하지 않습니다. 가공명과 종명은 품종으로 넣지 않았습니다.

### 채택 출처

1. [Villa Gloria](https://www.lafortunafincasycafe.com/) — La Fortuna
2. [San Isidro Triple Fermentation](https://www.allycoffee.com/coffees/san-isidro-triple-fermentation/) — Ally Coffee
3. [Mauricio Salazar El Meson Parainema](https://sucafina.com/na/offerings/mauricio-salazar-el-meson-parainema-fw-organic) — Sucafina
4. [Los Romero — Honduras 2026](https://farmdirectory.cupofexcellence.org/listing/10-los-romero-honduras-2026-parainema-catracha/) — Cup of Excellence
5. [La Esmeralda: Washed](https://www.delafincacoffee.com/honduran-coffee/la-esmeralda-washed-de-la-finca-coffee-importers) — De La Finca Coffee Importers
6. [El Mango — Honduras 2026](https://farmdirectory.cupofexcellence.org/listing/5-el-mango-honduras-2026-honduras-exotic/) — Cup of Excellence
7. [La Salsa — Honduras 2026](https://farmdirectory.cupofexcellence.org/listing/2-la-salsa-honduras-2026-honduras-exotic/) — Cup of Excellence
8. [Finca El Niño](https://88graines.com/pl/producer/finca-el-nino/) — 88 Graines
9. [La Esperanza](https://regiones.cafedeelsalvador.com/finca.php?id=82) — Café de El Salvador
10. [Luis Hernandez — Cerro Negro — Pacas 26504](https://www.cafeimports.com/north-america/offerings?view=beanology.view.luis-hernandez-finca-cerro-negro-pacas-washed-26504) — Cafe Imports
11. [Efrain Solis — El Amoton — Pacamara 26496](https://www.cafeimports.com/north-america/offerings?view=beanology.view.efrain-solis-finca-el-amoton-pacamara-washed-26496) — Cafe Imports
12. [Bella Vista — El Salvador 2007](https://allianceforcoffeeexcellence.org/farm-directory/87-48-2/) — Alliance for Coffee Excellence
13. [Hacienda Sajonia — The Estate](https://www.haciendasajonia.com/the-estate/) — Hacienda Sajonia
14. [La Laguna — Nicaragua 2026](https://farmdirectory.cupofexcellence.org/listing/8-la-laguna-nicaragua-2026-wet/) — Cup of Excellence
15. [Finca Los Placeres](https://www.laminita.com/farms-mills/placeres) — Hacienda La Minita
16. [El Rosario — Nicaragua 2026](https://farmdirectory.cupofexcellence.org/listing/6-el-rosario-nicaragua-2026-dry/) — Cup of Excellence
17. [Un Regalo De Dios — Nicaragua 2026](https://farmdirectory.cupofexcellence.org/listing/8-un-regalo-de-dios-nicaragua-2026-dry/) — Cup of Excellence
18. [Los Suyates](https://www.thegoodsourcing.com/suyates) — The Good Sourcing
19. [El Poste — Nicaragua 2026](https://farmdirectory.cupofexcellence.org/listing/5-el-poste-nicaragua-2026-wet/) — Cup of Excellence
20. [Nicaragua Ojo de Agua](https://www.sweetmarias.com/nicaragua-ojo-de-agua-8445.html) — Sweet Maria's
21. [Finca Santa Cruz Geisha](https://sucafina.com/emea/offerings/finca-santa-cruz-geisha-fw) — Sucafina
22. [Cafeología — La Finca — Marsellesa](https://www.allycoffee.com/coffees/cafeologia-la-finca-marsellesa-honey/) — Ally Coffee
23. [Finca El Encino — Mexico 2026](https://farmdirectory.cupofexcellence.org/listing/4-finca-el-encino-mexico-2026-experimenta/) — Cup of Excellence
24. [CJ1636 — Finca Fátima](https://cdn.royalcoffee.com/wp-content/uploads/2025/09/23081035/Crown-Jewel-Mexico-Washed-Marsellesa-Givette-Perez-Orea-CJ1636.pdf) — Royal Coffee
25. [Café Pluma México](https://www.cafepluma.com.mx/) — Unión de Productores de Café de Especialidad Pluma
