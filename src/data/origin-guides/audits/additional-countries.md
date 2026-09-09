# 추가 국가 산지 검증 기록

검토일: 2026-09-08. 대상: `src/data/origin-guides/additional-countries.ts`의 6개국 12개 산지.

기존 참고자료의 고유 URL 23개를 모두 웹으로 다시 열어 관련 본문·상품 사양·PDF를 읽었다. 향미에 직접 연결한 고유 URL은 12개이며, 해당 URL은 모두 각 항목의 `sources`에도 포함된다. 분류는 특정 상품·로트 11개(`lot`), 지역 설명과 로트 기록을 함께 사용하는 항목 1개(`mixed`)다. 국가 전체의 인상이나 품질 등급만으로 지역 향미를 채운 항목은 없다.

`reviewedAt`은 자료를 읽고 대조한 날짜다. 직접 커핑한 날짜나 수확연도가 아니다. 생산자·수입사·로스터의 상품 설명을 검증한 것이며, 동일 산지의 모든 커피가 그 맛을 낸다는 의미가 아니다. 상품 페이지가 이후 다른 수확분으로 바뀔 수 있어 확인 가능한 상품 코드·생산자·로스팅 조건을 함께 기록했다.

## 항목별 결과

| 산지 / 판정 | 향미 근거와 확인 사항 | 수정 및 제한 |
| --- | --- | --- |
| **Caranavi / lot** | [Juana Mamani 상품](https://melbournecoffeemerchants.com.au/coffee/juana-mamani/)에서 Uchumachi, Finca Llana, Caturra 워시드와 배·만다린·구운 헤이즐넛·밀크초콜릿을 확인했다. [La Linda Java](https://melbournecoffeemerchants.com.au/coffee/la-linda-java/)는 Bolinda의 별도 Java 워시드 사례다. | 헤이즐넛을 **구운 헤이즐넛**으로 구체화했다. Juana 페이지는 상단에 72시간, 본문에 48시간 발효를 기재해 서로 맞지 않는다. 시간은 채택하지 않고 워시드/발효 관리 수준만 유지했다. 농장 고도는 지역 전체의 범위로 옮기지 않았다. |
| **Samaipata / lot** | [Floripondio Java Coco Natural](https://melbournecoffeemerchants.com.au/coffee/floripondio-java-coco-natural/)은 Santa Cruz의 Samaipata, Java, 해당 향미와 stationary box 건조를 함께 명시한다. [2025 수확 보고](https://melbournecoffeemerchants.com.au/harvest-update-bolivia/)는 2026-01-27 발행이며 Gesha·Java 중심의 농장 운영 변화를 설명한다. | 수확 보고 제목과 발행 시점을 구분했다. Coco를 코코넛 첨가로 해석하지 않았다. 건조하고 덜 열대성인 지역 설명과 Floripondio의 개별 미기후가 다를 수 있음을 전제로 한다. 단일 농장 고도를 확장하지 않았다. |
| **Loja / lot** | [PT's Coffee의 La Papaya Gesha Washed](https://ptscoffee.com/products/la-papaya-gesha-washed)는 Juan Peña, Loja, Gesha, 워시드, Light-Medium 로스트와 구체적인 컵 설명을 함께 제공한다. [농장 원문](https://cafexporto.com/hacienda-la-papaya/)은 Saraguro·Loja 및 관개·건조 관리를 뒷받침한다. | 향미를 **캐러멜·샴페인 포도·캐모마일·홍차**로 교체하고 로스팅 조건을 명시했다. 기존 [Ref.19](https://cafexporto.com/lots/ref-19-la-papaya-typica-mejorado)는 상품 페이지 안에서 Typica Mejorado 품종 설명을 여러 가공 상품에 공통 사용한다. 이를 특정 무산소 로트의 독립 시음값으로 단정하지 않고 품종·가공 사례 출처로만 유지했다. |
| **Pichincha / mixed** | [Caravela 지역 페이지](https://origin.caravela.coffee/ec_loja-copy)의 실제 제목·본문은 Pichincha이며 노란 과일·꿀을 명시한다. [TYPICA Carlos Realpe](https://typica.coffee/en/lots/ec-2023-009-carlos-realpe-sidra-bourbon-washed)는 Nanegal, Sidra·Bourbon, 워시드와 2023-11-01 꽃향·청사과 시음 기록을 제공한다. | 노트별 출처를 나눠 설명했다. URL의 `ec_loja-copy` 문자열 때문에 Loja 출처로 오인하지 않도록 실제 본문을 확인했다. Carlos Realpe의 1,350m와 2023 로트를 지역 전체의 고도·현재 판매분으로 해석하지 않았다. |
| **Mount Elgon / lot** | [GEN24UGB 상품](https://www.genuineorigin.com/uganda-mt-elgon-aa-washed-2024)에서 Mbale 소농·Kyagalanyi Coffee, SL14·SL28, 워시드, 2024년 9월 커핑과 다섯 향미를 확인했다. | 상품 코드와 커핑 시점을 추가했다. AA는 향미나 품질 보증으로 사용하지 않았다. 상품의 1,600–1,800m를 엘곤산 전체 고도로 확장하지 않았다. |
| **Rwenzori / lot** | [GEN20UGA 내추럴 PDF](https://www.genuineorigin.com/site/images/factsheets/factsheet-GEN20UGA.pdf)에서 Kisinga·Bukonzo Farmers Group·Kasese, SL14·SL28과 포도·베리·잼 같은 산미·중간 바디를 확인했다. [GEN21UGA 워시드 PDF](https://www.genuineorigin.com/site/images/factsheets/factsheet-GEN21UGA.pdf)는 동일 그룹의 별도 공정이다. | 향미 출처는 내추럴 자료 하나로 제한했다. 파일명에서 수확연도를 추정하지 않았다. 자료의 단일 고도 2,100m를 산맥 전체 재배 범위로 사용하지 않았다. |
| **Pu’er / lot** | [John Burton CHI01 PDF](https://johnburton.co.nz/wp-content/uploads/2025/08/CHI01-China-SIMAO-G1.pdf)의 China Simao G1 워시드 상품은 초콜릿·사과 껍질·향신료·둥근 바디를 명시한다. | 농장·수확연도가 없는 **지역 선별 상품**임을 밝혔다. Catimor·Bourbon·Typica는 문서에서 확인된다. 추가 표기 `SACHIMOR`는 문서 그대로만 확인됐으므로 별도 품종의 표준명으로 정규화해 추가하지 않았다. 700–1,600m 역시 상품 범위다. |
| **Baoshan / lot** | [Harmony Red Sparrow](https://www.harmonycoffee.co.uk/products/red-sparrow-1)는 Lao Wang·Red Dragon Estate·Baoshan·Yun Catimor·무산소 내추럴 및 해당 향미를 명시한다. [FAO Xinzhai 사례](https://www.fao.org/one-country-one-priority-product/asia-pacific/good-practices/detail/coffee-xinzhai-baoshan-yunnan-china/en)는 지리적 표시·계곡 환경·Catimor/Typica를, [TAKA Zuoyuan](https://www.specialtycoffee.jp/beans/3159.html)는 별도 농장의 2023/24 Catimor 워시드를 뒷받침한다. | 멜론을 **허니듀 멜론**으로 구체화했다. FAO의 GI 요건과 Red Sparrow의 상품 향미를 혼합하지 않았다. 생산자와 농장을 향미 설명에 추가했다. 서로 다른 농장·GI 고도를 합쳐 지역 범위를 만들지 않았다. |
| **Chiang Rai / lot** | [ITDF 2026 수확 목록](https://itdfinternational.org/green-bean-buyers/)의 Mae Suai MAM-W는 Chiang Rai, Catimor, 워시드와 풋사과·자스민·꿀을 명시한다. [Sirinya](https://indochinacoffee.com/coffee/thailand-sirinya-natural-2024/)는 Mae Suai, Bourbon/Caturra/Catimor, 무산소 내추럴 및 농가 교육의 별도 사례다. | MAM-W와 Sirinya의 향미·품종·가공을 구분했다. [ACE 2023 결과](https://allianceforcoffeeexcellence.org/thailand-2023/)에서 Phala Akha의 Chiang Rai·수상 이력을 재확인했지만 그 대회 점수는 지역 품질로 옮기지 않았다. |
| **Chiang Mai / lot** | [ITDF 2026 목록](https://itdfinternational.org/green-bean-buyers/)의 DOI-W는 Doi Intanon 표기의 Catimor 워시드와 레몬 제스트·홍차·아몬드를 명시한다. Chiang Dao의 허니·내추럴 및 Catuai는 다른 로트다. [Mae Toey](https://ceresiacoffeeroasters.com/product/mae-toey/)는 Chiang Mai의 경사지·큰 그늘나무 재배를 설명한다. | DOI-W만 향미 근거로 연결했다. [Indochina의 북부 아라비카 소개](https://indochinacoffee.com/coffees/thailand_origins/)와 [ACE 2023 결과](https://allianceforcoffeeexcellence.org/thailand-2023/)의 Soft Coffee Farm 소재지·수상은 배경 출처로만 유지했다. 마을별 고도는 주 전체로 확장하지 않았다. |
| **Ermera / lot** | [Royal Coffee CJ1603 PDF](https://cdn.royalcoffee.com/wp-content/uploads/2025/03/07102427/Crown-Jewel-Timor-Leste-Organic-Ducurai-Cafe-Brisa-Serena-Washed-CJ1603.pdf)는 Ducurai 마을의 Sabelo 농가 그룹, Letefoho·Ermera, 2024 수확, Timor Hybrid·Typica, 워시드 및 향미를 명시한다. | 문서 표지에 맞춰 **Sabelo** 그룹을 제목·설명에 추가했다. Ducurai는 마을명으로 보존했다. 건조대 건조는 별도 가공법 항목에서 빼고 공정 설명에 배치했다. 다양한 로스팅·추출 실험의 향미이며 지역 전형으로 해석하지 않는다. |
| **Aileu / lot** | [Project Origin Aileu PDF](https://projectorigin.coffee/wp-content/uploads/2022/07/TIM_Aileu_2023.pdf) 5쪽의 AL1 항목은 Typica·Catimor 워시드와 해당 노트를 명시한다. 앞쪽은 CTRA·Kape Diem 지원과 Orijem Timor 가공장을 설명한다. | **Regional Aileu AL1** 상품을 구체적으로 명시하고 다음 쪽 Laclo 5D 무산소 내추럴과 분리했다. 건조대 건조는 공정 설명에 배치했다. URL에 연도가 있어도 AL1의 수확연도라고 단정하지 않았다. 1,000–1,100m는 문서의 공급 대상 지역 정보이며 Aileu 전역의 경계값으로 쓰지 않았다. |

## 구조 및 검증 범위

- 12개 항목 모두 기존 국가·산지 식별자를 유지했다. 모두 `region`이며 새 부모 관계나 광역·하위 지명 별칭을 만들지 않았다.
- 단일 로트·농장·마을·규정 범위밖에 확인할 수 없는 고도를 공통 `altitude` 값으로 승격하지 않았다. 이번 대상의 해당 필드는 계속 생략한다.
- 모든 `verification.flavorSourceUrls`가 해당 `sources`의 URL 집합 안에 있는지 확인했다. 검토일과 출처 접근일은 모두 2026-09-08이다.
- 웹 추출에서 상품 본문이 한 번에 노출되지 않은 경우 같은 페이지의 관련 구간을 추가로 열어 읽었다. 최종적으로 읽지 못한 채 검증 완료로 분류한 출처는 없다.
- 출처 내부의 모순·한계는 위 표에 남겼다. 이번 검토는 현재 재고, 최신 가격, 농장의 모든 품종, 모든 수확분의 향미 또는 원산지 인증의 현재 유효성을 보증하지 않는다.
