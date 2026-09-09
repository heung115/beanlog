# 아프리카 스페셜티 로트 조사

확인일: 2026-09-08. 기존 26개 전부와 추가 Bench Maji 1개, 총 **27개 산지·52개 고유 로트·58개 고유 출처 URL**을 반영했다. 우선순위는 focus 19개, standard 8개다. 확인한 실제 상품이 모든 산지에 있어 빈 배열이나 background를 억지로 만들지 않았다. 이는 품질·생산량 순위가 아닌 내부 편집 판단이다. focus에는 대표 로트가 최소 두 개 있는지 추가 확인했다.

변경 파일은 `specialty-research/africa.ts`, `specialty-research/new-africa-guides.ts`, 이 감사 문서뿐이다. 기존 산지 가이드·품종 자료·화면 코드는 수정하지 않았다.

## 산지별 확인 범위

| 산지 ID | 우선순위 | 로트 수 | 실제 상품 출처 | 선택·검증 범위 |
| --- | --- | ---: | --- | --- |
| ethiopia-yirgacheffe | focus | 2 | [Idido Washed Fairtrade](https://www.allycoffee.com/coffees/idido-washed/)<br>[Adado Yirgacheffe Natural](https://sucafina.com/na/offerings/adado-yirgacheffe-natural) | Idido 2019 워시드와 Adado 내추럴. Gedeb·Kochere 로트 미재사용. |
| ethiopia-guji | focus | 2 | [Tima Shakiso Guji FW Gr.1](https://sucafina.com/na/offerings/tima-shakiso-guji-fw-gr-1)<br>[Suke Quto — Partners Coffee Washed](https://www.partnerscoffee.com/products/ethiopia-suke-quto) | Tima 농가 그룹과 Suke Quto의 별도 상품. Suke Quto는 Partners 자체 로스팅 상품 노트. |
| ethiopia-sidama | focus | 2 | [Elora — Lot #156](https://www.seycoffee.com/products/2025-elora-lot-156-ethiopia)<br>[Taferi Kela — Fully Washed Grade 2](https://www.allycoffee.com/coffees/sidamo-taferi-kela-fully-washed-grade-2/) | Arbegona Elora #156, Taferi Kela의 Bette Buna. Bensa 이외 생산지로 구성. |
| ethiopia-limu | focus | 2 | [Limmu Kossa Galeh — Special Roast Natural](https://thissideup.coffee/coffee-passport-special-roast-ethiopia)<br>[Duromina — Counter Culture Washed](https://counterculturecoffee.com/products/duromina) | Galeh 내추럴과 Duromina 워시드. Duromina 실제 소재지는 Agaro/Jimma이며 Limu는 별도 수입 거래 분류. |
| ethiopia-harrar | standard | 1 | [Queen City Harrar — Paper Plane Natural](https://www.paperplanecoffee.com/products/queen-of-harrar-natural-ethiopian) | Queen City 선별 생산 주체 확인. 농장 단일 구획이나 수확연도는 확인하지 못함. 다른 Queen City 판매 페이지를 두 번째 생산자로 중복하지 않음. |
| ethiopia-kochere | focus | 2 | [Boji Kochere Fully Washed](https://sucafina.com/na/offerings/boji-kochere-fully-washed)<br>[Adisu Halchaye — Natural Gr. 1](https://sucafina.com/na/offerings/adisu-halchaye-kochere-natural-gr-1) | Boji 스테이션과 Adisu Halchaye의 Fisiha Genet 농장. 품종은 각 상품 필드만 반영. |
| ethiopia-gedeb | focus | 2 | [Tariku Mengesha Banko Chelchele — CJ1246](https://cdn.royalcoffee.com/wp-content/uploads/2018/10/21123013/CJ1246_Ethiopia-Banko-Chelchele-Tariku-Mengesha-Raised-Bed-Natural-Crown-Jewel.pdf)<br>[Chelbesa Washing Station — P11556](https://www.touton-specialty-coffee.com/en/p11556) | CJ1246의 2017년 수확과 Chelbesa P11556의 2025년 crop을 분리. Royal PDF 도입부의 주된 노트만 사용. |
| ethiopia-bensa | focus | 2 | [Kanura Kayeso — Lalisaa Natural Gr. 1](https://www.sucafina.com/emea/offerings/kanura-kayeso-sidamo-natural-gr-1-lalisaa)<br>[Keramo — Luna Washed 2021/22](https://enjoylunacoffee.com/products/jarc-landrace-varieties-from-keramo-village-in-bensa-sidama-ethiopia-2022) | Kanura Kayeso의 Dembi 농장과 Keramo 마을 분리 로트. Keramo는 Shantawene 스테이션 가공, 2021/22 수확. |
| ethiopia-hambela | focus | 2 | [Deri Fahmi — SOMA Project Natural Premium](https://sucafina.com/na/offerings/deri-fahmi-guji-hambela-natural-premium-soma-project)<br>[Buku Sayisa — Washed](https://www.allycoffee.com/coffees/guji-buku-sayisa-washed/) | Testi Deri Fahmi 내추럴과 SNAP Buku Sayisa 워시드. 상세 소재지에서 Hambela 확인. |
| ethiopia-uraga | focus | 2 | [Wolichu Sodu Guji — Fully Washed](https://sucafina.com/na/offerings/wolichu-sodu-guji-fw)<br>[Zelalem Alemu — Guji Uraga Natural Special Prep](https://www.allycoffee.com/coffees/guji-uraga-natural/) | Wolichu Sodu 워시드와 Zelalem Alemu 내추럴. 구지 전체 설명의 꽃향을 전자 로트에 추가하지 않음. |
| rwanda-nyamasheke | focus | 2 | [Kanzu — No. 1341](https://camelliacoffeeroasters.com/shop/coffee/rwanda-kanzu-no1341/)<br>[Macuba Dry Process — 8168, City+](https://www.sweetmarias.com/products/rwanda-dry-process-macuba-8168) | Kanzu #1341과 Macuba 8168. Kanzu의 Karambi community를 별도 Karambi 스테이션과 동일시하지 않음. Macuba는 City+ 시음 노트만 채택. |
| rwanda-huye | focus | 2 | [Huye Mountain Peaberry Natural — P612865-2](https://www.covoyacoffee.com/p612865-2-rwanda-natural-huye-mountain.html)<br>[Huye Mountain — Stumptown Washed](https://www.stumptowncoffee.com/products/rwanda-huye-mountain) | Covoya 피베리 내추럴 2023/24와 Stumptown 워시드. Stumptown 상품에서 연결된 동일 생산자 페이지로 워시드·Bourbon 보강. |
| rwanda-gakenke | focus | 2 | [Muzo — Fully Washed](https://sucafina.com/na/offerings/muzo-fully-washed)<br>[Muhondo Natural — P11583](https://www.touton-specialty-coffee.com/en/p11583) | Muzo 워시드와 Muhondo P11583 2025 내추럴. Muhondo는 일반 Cup Profile만 사용하며 Espresso Profile을 혼합하지 않음. |
| rwanda-cyato | standard | 2 | [Abadatezuka Coop — PT's Washed](https://ptscoffee.com/products/abadatezuka-coop-washed)<br>[Cyato — Anaerobic Natural](https://sucafina.com/emea/offerings/cyato-nyamasheke-anaerobic-natural) | PT’s Abadatezuka 워시드와 Tropic Cyato 무산소 내추럴. 후자는 구체적 과일명이 없어 밝은 과일향 하나만 채택. |
| burundi-kayanza | focus | 2 | [Kibingo — Fully Washed](https://sucafina.com/na/offerings/burundi-kibingo-fully-washed)<br>[Kibingo — Natural](https://sucafina.com/emea/offerings/kibingo-natural) | Kibingo의 서로 다른 워시드·내추럴 상품. 같은 생산시설이라는 점을 유지. |
| burundi-ngozi | standard | 2 | [Ngozi — Fully Washed](https://sucafina.com/na/offerings/ngozi-fully-washed)<br>[Rama Women of Ngozi — Ascension Natural](https://ascension.coffee/products/rama-women-of-ngozi) | Bugestal Ngozi 스테이션과 RAMA 여성 농가 그룹. 전자는 질감·산미만 명시되어 그대로 유지. |
| burundi-gatara | focus | 2 | [Gakenke — Fully Washed](https://sucafina.com/na/offerings/gakenke-fully-washed)<br>[Gakenke — Natural](https://sucafina.com/na/offerings/gakenke-natural) | Gakenke 스테이션 워시드·내추럴. 우선순위에는 별도 Gitwenge의 공식 2019년 2위 기록도 사용, 해당 점수·향미를 Gakenke에 이전하지 않음. |
| burundi-gatukuza | standard | 1 | [Gatukuza — Long Miles Coffee Scr15+](https://www.list-beisler.coffee/media/pdf/BUR_FW_Scr15_Long_Miles_Coffee_Washed_Gatukuza_POSTCARD.pdf) | List + Beisler의 Long Miles 워시드 1개. 공식 2019년 우승 내추럴은 향미 미확인으로 대표 로트 배열에서 제외. 별도 작황·가공 로트 두 개가 확인되지 않아 standard로 조정. |
| kenya-nyeri | focus | 2 | [Kiandu AA](https://www.coffeekilimanjaro.com/kenya-kiandu-aa.html)<br>[Gichathaini Nyeri AA](https://sucafina.com/apac/offerings/gichathaini-nyeri-aa) | Tetu Kiandu와 Mathira Gichathaini. Othaya·Karatina의 팩토리와 중복 없음. |
| kenya-kirinyaga | focus | 2 | [Kiangothe Kirinyaga AA](https://sucafina.com/na/offerings/kiangothe-kirinyaga-aa)<br>[Koirara Kirinyaga AA](https://sucafina.com/apac/offerings/koirara-kirinyaga-aa) | 조합 팩토리 Kiangothe와 Koirara 에스테이트. Kiangothe는 본문 Kabare 조합명 채택. |
| kenya-kiambu | standard | 2 | [Ibonia Estate AA](https://sucafina.com/emea/offerings/ibonia-estate-aa)<br>[Wamuguma PB](https://www.coffeekilimanjaro.com/kenya-wamuguma-pb.html) | Ibonia 에스테이트와 Wamuguma PB. Wamuguma 2020/21 수확을 현재 상품으로 오인하지 않도록 연도 유지. |
| kenya-muranga | standard | 2 | [Murarandia PB](https://www.coffeekilimanjaro.com/kenia-murarandia-pb.html)<br>[Gondo Triple Washed — CJ1536](https://royalcoffee.com/product/3427097000022727039/) | Murarandia PB 2021/22와 Gondo CJ1536. Royal의 출시 시기를 Gondo 수확연도로 전환하지 않음. |
| kenya-othaya | focus | 2 | [Kagere Nyeri AB](https://sucafina.com/na/offerings/kagere-nyeri-ab)<br>[Rukira Triple Washed Peaberry — CJ1376](https://cdn.royalcoffee.com/wp-content/uploads/2020/08/28155822/47253-CJ1376-Kenya-Nyeri-Rukira-PB-14TY0005-30kg-Vacuum-Pack-.pdf) | Kagere AB와 Rukira CJ1376. Rukira의 모든 로트 필드는 동일 Royal PDF, Sucafina는 Othaya 소재지만 보강. |
| kenya-karatina | focus | 2 | [Ichuga Nyeri AA](https://sucafina.com/emea/offerings/ichuga-nyeri-aa)<br>[Karatina AB](https://www.coffeekilimanjaro.com/kenya-karatina-ab.html) | Ichuga AA와 Karatina AB 2025/26. 둘 모두 Karatina 소재 확인. |
| tanzania-kilimanjaro | standard | 2 | [Kilimanjaro Plantation Peaberry — P114771](https://www.ictcoffee.com/wp-content/uploads/2023/06/Tanzania-Kilimanjaro-Peaberry-P114771.pdf)<br>[Lyamungo Peaberry Washed — Light Roast](https://www.redroostercoffee.com/products/tanzania-lyamungo-peaberry-washed) | ICT Plantation PB와 Red Rooster Lyamungo 피베리. 후자는 Light Roast 상품명 조건 유지. |
| tanzania-mbeya | standard | 2 | [Utengule Estate AB — Washed](https://www.bodhileafcoffee.com/collections/coffee/products/tanzania-utengule-estate-ab-green)<br>[Utengule Estate Natural 2026 — GEN26TZG](https://www.genuineorigin.com/tanzania-utengule-estate-natural-2026) | Utengule의 두 가공 상품. 서로 다른 농장 수로 세지 않음. Natural 2026은 상품명이며 미확인 수확연도 미기입. |
| ethiopia-bench-maji | focus | 2 | [Gesha Village Oma — 26/116](https://www.geshavillage.com/product/lot-number-26-116/)<br>[Gesha Village Narsha — 26/063](https://www.geshavillage.com/product/lot-number-26-063/) | Gesha Village 생산자 자체 Oma 26/116 허니·Narsha 26/063 워시드. Bench Maji 거래 산지와 현재 West Omo 소재지 구분. |

## 출처와 로트 경계

- 생산자·수입사의 생두 자료를 우선했다. 직접 거래 로스터나 로스터 자체 상품을 사용하는 경우 그 상품명 또는 판매자 이름을 로트명에 남겼다. 해당 업체의 향미 기록이며 독립적인 재시음 결과로 취급하지 않는다.
- 웹 검색과 Tavily 검색을 사용했다. 채택한 자료는 페이지 또는 PDF 본문을 읽었다. Ascension RAMA 페이지는 기본 웹 열기가 실패했지만 Tavily가 반환한 동일 URL의 **Raw Content**에서 생산 주체·Ngozi·Red Bourbon·Natural·상품 노트를 모두 읽었다. Little Waves 검색 문구를 대신 끼워 넣지 않았다.
- 상위·하위 산지에 같은 로트를 반복 배정하지 않았다. 워시드·내추럴처럼 동일 스테이션의 다른 가공 상품은 별도 로트이며 독립 농장 두 곳이라는 뜻은 아니다. 총수는 고유 로트명과 출처를 확인한 값이다.
- 생산자명이 제품의 선별·가공 주체인 경우 이를 단일 자가 농장으로 확대하지 않았다. Queen City는 Abdirashid Abdullahi가 담당하는 상품이며 ECX 선별 원료를 포함하는 출처 설명을 보존한다. 개별 농가 이름이 없다는 이유로 품질이 낮다고 분류하지 않았다.
- 등급 AA·AB·PB·Scr15+·Gr.1과 판매 계열 Rarities를 품종 배열에 넣지 않았다. Heirloom·landrace처럼 원문이 포괄적으로 적은 상품은 다른 자료의 세부 품종을 끌어와 분해하지 않았다.
- Royal Tariku CJ1246은 도입부 세 가지 주요 노트만 선택했다. 같은 문서의 서로 다른 로스팅 실험 노트를 합쳐 목록을 늘리지 않았다. Macuba는 City+ 조건, Muhondo는 일반 컵 프로필, Chelbesa는 HTML 상품의 컵 프로필을 사용했다.

## 연도 처리

수확·crop이라고 명시된 경우만 `harvest`를 채웠다. 명시된 14개는 Idido 2019, Elora January 2025, Taferi Kela 2024–2025, Duromina November 2025–January 2026, Tariku October–December 2017, Chelbesa 2025, Keramo December 2021–January 2022, Huye Mountain natural 2023/24, Muhondo 2025, Kiandu 2025/26, Wamuguma 2020/21, Murarandia 2021/22, Rukira October–November 2019, Karatina 2025/26다. 구조 검사에서 14개 필드를 확인했다.

Macuba의 December 2024 입고, Abadatezuka의 May 2024 추천 상품, PDF 경로·게시일, Utengule Natural 상품명 2026, Gesha Village 로트 번호 26/는 수확연도로 바꾸지 않았다. 판매 중·품절 표시는 과거 대표 로트를 제외할 이유로 사용하지 않았고 현재 재고를 보장하지 않는다.

## 제외·대체한 자료

- Sucafina Bensa anaerobic natural: 스테이션·지역 필드와 소유자 설명의 Worka Chelichele가 충돌해 새 대표 로트에 사용하지 않았다. Sidama는 Elora와 Taferi Kela, Bensa는 Kanura와 Keramo로 대체했다.
- Sucafina Kayon Mountain natural: 제목·가공과 Fully Washed 등급 필드 충돌. Guji는 별도 Tima 및 Partners Suke Quto 상품을 채택했다.
- Ally의 다른 Taferi Kela community/extended natural 페이지: 제목 Sidamo와 Guji 요약·지역 블록이 충돌한다. 새 데이터는 전체 본문이 Sidama 소재로 일치하는 Fully Washed Grade 2 페이지만 사용한다.
- Sucafina Karambi FW의 전체 노트 목록은 여러 로트·수확분의 통상 프로필로 명시되어 있어 새 실제 로트용으로 채택하지 않았다. Nyamasheke는 번호가 있는 Kanzu #1341과 Macuba 8168로 대체했다.
- Sucafina Macuba Natural·RAMA Natural: 품종·가공은 확인되지만 구체적인 상품 향미가 없어 각각 Sweet Maria’s와 Ascension의 실제 시음 상품으로 대체했다. Sucafina의 품종을 대체 상품에 이식하지 않았다.
- Sucafina Theri PB는 Murang’a/Embu 소재지가 충돌한다. Kimabara·Ndaro-ini·Rukira AA 등 구체 향미가 부족한 후보는 더 완전한 로트 자료로 바꾸었다. Rukira의 다른 상품에 적힌 SL24를 임의로 SL28로 수정하지 않았다.
- Covoya의 옛 Gatukuza 상품은 URL Natural, 제목/필드 Washed, 본문 Natural이 충돌하여 제외했다. ACE 2019 우승 자료는 우선순위 근거로만 쓰고 그 내추럴의 미확인 향미를 생성하지 않았다.
- [Small Planes Gatukuza Lot 20 PDF](https://static1.squarespace.com/static/57a4cd746a496311f31cf815/t/5e96fd98b990fc5b6c5a5246/1586953624898/Gatukuza%2BLot%2B20.pdf)에서도 생산지·Bourbon·워시드와 자체 상품 노트를 읽었다. 다만 기존 Long Miles 워시드와 서로 다른 작황·가공분인지 확인되지 않아 로트 수를 늘리는 데 쓰지 않았다. Gatukuza는 2019년 대회 이력과 별개로 standard로 조정했다.
- Harrar의 Micheta나 일반 Longberry 상품은 이번 조사에서 서로 다른 실명 생산자 둘로 분리할 충분한 근거가 없었다. Queen City 판매처 여러 곳을 다른 생산자로 세지 않았다.
- Machare 수입사 페이지는 본문 시간 초과였고 생산자 일반 페이지의 향미를 특정 로트로 변환하지 않았다. Kilimanjaro는 Plantation·Lyamungo의 실제 상품으로 구성했다.

## Bench Maji 추가 가이드

Gesha Village의 농장 조성 설명에는 Bench Maji, 현재 소재지 표에는 West Omo가 적혀 있다. 동일 행정구역의 동의어로 저장하지 않았다. 해당 농장의 고도를 Bench Maji 전체 고도로 확대하지 않아 새 가이드 `altitude`는 생략했다. 구획 추적·품종·재배 환경은 생산자 `The Village`, 향미는 두 개별 로트 페이지에 한정한다. Gori Gesha나 Illubabor Forest라는 재배명으로 다른 산지 귀속을 추론하지 않았다.

## 검증

필수 필드, 양언어 노트 길이, 날짜, 기존 26개 및 신규 1개 ID 커버리지, 프로필별 출처 포함, 로트명 중복, 수확연도 필드를 검사했다. 27/27 커버리지, 고유 로트명 52개, 수확 필드 14개를 확인했다. 대상 두 TypeScript 파일의 ESLint와 직접 가져오기 검증을 통과했다. 앱 전체 통합 검사는 상위 작업에서 진행한다.
