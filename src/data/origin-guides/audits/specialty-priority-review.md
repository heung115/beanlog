# 스페셜티 산지 우선순위·탐색 정렬 독립 감사

검토일: 2026-09-09. 검토 대상은 128개 `OriginSpecialtyProfile`의 전체 `priority`·`rationale`, 연결 로트·부모 관계, 국가·산지 탐색 정렬 코드다. 데이터와 코드는 수정하지 않았다. 이 문서는 내부 감사이며 공개 안내 문구가 아니다.

## 판정

생산자와 로트를 산지·하위 산지에 연결한 데이터는 사용자의 탐색 목적에 부합한다. 그러나 **현재 focus 91개·standard 37개를 같은 기준으로 재현할 근거는 충분하지 않다.** 기록된 생산 사례의 수, 편집자가 알고 있던 명성, 대회 이력, 최근 자료 보강 여부가 서로 다른 비중으로 섞여 있다. 특히 국가 순서는 실제 스페셜티 생산·거래 규모 대신 등록된 focus 산지 ID 개수에 영향을 받는다.

91/128이라는 비율 자체가 오류는 아니다. 실제 스페셜티 사례를 모두 확보했다면 background가 0개인 것도 가능하다. focus를 일정 비율 이하로 줄이거나 모든 standard를 올리는 방식으로 해결할 문제는 아니다. **로트 최소 2개는 설명 자료의 충실도를 확인하는 조건으로만 유지할 수 있다. 품질, 지역 대표성, 반복 거래, 생산량의 증거로 사용할 수 없다.**

사용자의 “스페셜티 원두가 많이 나는 곳”에는 생산량과 선택 가능한 생산 사례가 함께 포함될 수 있다. 현 데이터에는 같은 기간·단위로 비교할 지역별 스페셜티 생산량이 없다. 따라서 “스페셜티를 많이 생산하는 산지 순위”라고 해석하거나, 일반 커피 생산량·국가 수출량으로 빈칸을 채우면 안 된다. 기존 자료로 가능한 것은 **추적 가능한 사례의 폭과 거래 지속성이 확인되는 산지를 먼저 탐색하게 하는 편집 기준**이다.

## 범위와 확인 수준

- 5개 연구 모듈의 128개 rationale를 전부 읽고 현재 로트·출처 메타데이터와 비교했다. 국가는 26개이며 모든 ID와 당시 분류는 문서 끝에 보존했다.
- `specialty-research/model.ts`, `types.ts`, 지역 데이터 통합, `RegionGuideList`, origins의 목록·국가·산지 페이지 및 관련 테스트를 정적으로 읽었다. 정렬 담당 독립 검토자가 같은 결과를 교차 확인했다.
- 1차 자료 본문을 이번 감사에서 다시 연 항목은 아래의 Bensa, Hambela, Planadas, Samaipata, New Oriente, Burundi 2019 대회, SCA CVA다. 나머지 사례 비교는 **저장된 데이터의 판단 일관성 감사**이며, 모든 연결 웹페이지를 이번에 새로 검증했다는 뜻이 아니다.
- 동시 보강 작업 중 취한 128개 스냅숏을 기준으로 한다. 이후 데이터가 바뀌면 아래의 현재 분류·개수는 감사 당시 기록으로 취급해야 한다. 브라우저 실행과 전체 앱 테스트는 이번 읽기 전용 감사에서 수행하지 않았다.

## 확인된 정렬 동작과 사용자 목적의 차이

| 항목 | 현재 동작 | 영향과 권고 |
| --- | --- | --- |
| 첫 `/origins` 화면 | 권역별 국가 카드. 검색은 접혀 있고 기본 산지 행은 0개 | 현재 국가→산지 흐름이다. 사용자 요청을 보충한 통합 작업의 범위에 따라 이 흐름은 유지한다. 스페셜티 정보 확대를 위해 근거 없는 국가·산지 순위를 덧붙일 필요는 없음 |
| 국가 순서 | 아프리카→아메리카→아시아·태평양 고정. 권역 안에서는 전체 데이터의 국가별 focus 수 내림차순 | 세분화한 국가일수록 유리하다. 검색 중에도 검색 결과가 아닌 전체 focus 수를 사용. 지역 스페셜티 규모의 대리 지표로 사용하지 말고 국가 순서는 중립적으로 고정 |
| 산지 순서 | `focus → standard → background`; 동률은 원래 배열 순서 유지 | 91개 focus 내부 순서는 현재 근거의 강도·이름·검색 일치도가 아니라 자료 입력 순서. 검색 결과에서는 정확한 지명·생산자 일치도를 먼저 적용하고 동률 규칙을 명시 |
| 국가 상세 | `parentId`가 없는 항목만 기본 목록에 표시 | 하위 산지는 부모 상세에서 확인 가능. “주요 산지”는 focus가 아니라 부모 없는 항목이라는 뜻. 현재 지리 탐색 흐름과 스페셜티 tier를 분리하면 됨 |
| 검색 | 산지의 모든 로트·지역 필드를 합친 공백 단위 AND 검색 | 생산자 A와 향미 B가 서로 다른 로트에서 맞아도 지역 결과가 된다. 현재 기능은 산지 검색으로 이해해야 하며 같은 로트의 조합 검색을 보장하지 않는다. 수확연도는 검색 필드에 없음 |
| 랜딩 등 다른 화면 | 랜딩은 원본 국가·산지 배열 앞부분, 기록 지도는 기록 수, Explore는 기록의 점수·이름·음용일 | 서로 다른 목적의 정렬을 합쳐 하나의 스페셜티 순위라고 설명하면 안 됨 |

코드 근거: `src/app/[locale]/origins/page.tsx:39,55,103,149,174`, `src/app/[locale]/origins/[country]/page.tsx:40,97`, `src/app/[locale]/origins/[country]/[region]/page.tsx:122`, `src/components/origins/region-guide-list.tsx:20,35`, `src/data/origin-guides/specialty-research/model.ts:14,22`, `src/components/landing/landing-page.tsx:181`. 기본 국가 진입·산지 0행은 `tests/qa/origin-specialty.spec.ts:23–30`, focus 최소 로트 수는 `tests/origin-specialty.test.mjs:19`에 있다. 이 테스트들은 시장의 거래빈도를 입증하지 않는다.

### 부모·하위 산지 중복

현재 로트명과 출처 URL 집합이 완전히 같은 조합은 Sulawesi/Toraja, Flores/Bajawa, Kerala/Wayanad, Da Lat/Cau Dat다. Sumatra/Gayo도 일부 로트를 공유한다. 이는 동일 커피를 큰 권역과 세부 지역에서 찾아볼 수 있게 하는 데에는 유용하지만, 별개 생산·거래 증거로 더하면 안 된다.

인도네시아 focus 7개는 루트 3개와 하위 4개다. 에티오피아 focus 11개는 루트 5개와 하위 6개, 파나마 focus 6개는 루트 3개와 하위 3개다. 새로운 하위 산지 ID를 추가하면 새 생산자나 거래가 없어도 국가 순서에 쓰이는 수치가 올라갈 수 있다. **국가별 focus 합계는 등록 항목 수이며 독립 생산 단위 수가 아니다.** `parentId` 역시 타입 주석상 탐색 관계이므로 행정 구역으로 자동 해석할 수 없다.

## 우선 수정·재판단이 필요한 근거

아래는 현재 분류가 반드시 틀렸다는 단정이 아니라, 지금 기록된 이유로는 분류 차이를 재현하기 어렵거나 문구가 사실 범위를 넘는 사례다. 별도 지시 없이 데이터를 바꾸지 않았다.

| 대상·현재 분류 | 확인한 불일치 | 필요한 조치 |
| --- | --- | --- |
| **New Oriente / standard** | rationale는 생산자 구체성이 핵심 산지보다 약하다고 하지만, 현재 El Morito의 José Roberto Monterroso가 두 판매 로트에 실명으로 연결됨. MCM 본문은 농장·소유주·Oriente 위치·품종·워시드를 명시 | “생산자 구체성 약함”은 현재 증거와 맞지 않으므로 제거. 반복 거래·지역 범위 등 실제 미확인 항목으로 다시 판정 |
| **Bensa / focus** | rationale의 “다섯 해 연속”은 Hedge의 “fifth year”보다 강함. 본문은 다섯 번째 해 취급과 2025/26 수확을 명시하지만 매년 연속인지는 별도 명시하지 않음 | “다섯 번째 해 취급”으로 한정. 반복 취급 증거로는 사용 가능 |
| **Planadas / focus** | September의 세 번째 소개를 rationale에서 세 번째 “구매”로 표현. 본문은 “third time featuring”이며 세 개 작황을 뜻하지 않음 | 세 번째 소개·취급으로 한정. 정확한 연속 작황 수로 변환하지 않음 |
| **Samaipata / standard** | “relatively recent”와 기존 중심지 뒤라는 판단만으로 하향. MCM은 특수 마이크로로트, 현지 여러 농장과 2012년 확장을 명시. 생산자 관계는 since 2009지만 지역 진출보다 앞선 가족 관계임 | 신생이라는 이유만으로 배제하지 말고 같은 반복 거래·특별 산지 기준 적용. 2009년을 Samaipata 거래 시작으로 전이하지 않음 |
| **Fraijanes, Mount Elgon, Pu’er, Brunca / standard** | “strongest core”, “long-established core”, “less established in this catalog”, “core regions receive first priority”가 핵심 비교 이유. 비교 기간·대상·증거가 없음 | 기존에 먼저 정한 focus를 다시 근거로 삼는 순환 판단 제거. 실제 사례·지속성·대회·생산 범위로 치환 |
| **Ermera, Aileu, Chiang Rai / standard** | emerging 자체가 하향 이유로 작동. Chiang Rai는 최근 서로 다른 두 생산자 사례로 보강됐지만 기존 단수 중심 설명이 남음 | 새 산지·낮은 유명도와 근거 부족을 분리. 보강 후 rationale 재평가 |
| **Gatukuza / standard 대 Gatara / focus** | 이전 `specialty-africa.md:28`은 2개 로트 미확보를 standard 이유로 명시. 현재 Gatukuza에 2019·2024/25의 별도 작황 2개가 있음. 두 프로필 모두 같은 2019 공식 대회 자료를 연결 | 과거의 로트 수 판단을 계승하지 말고 새 기준 적용. 공식 대회 이력과 판매 로트의 향미는 계속 분리 |
| **Flores / standard 대 Sulawesi·Da Lat / focus** | Flores는 사례가 Bajawa에 한정된다는 이유로 standard. Sulawesi 사례도 Toraja, Da Lat 사례도 Cau Dat에 한정되며 각각 자식과 로트 집합이 동일 | 권역 대표성을 tier 기준으로 삼을지 통일. 부모는 탐색 집계로 다루거나 근거 범위를 기록하고, 부모 ID 자체를 추가 시장 증거로 세지 않음 |
| **Orosi / standard 대 Turrialba / focus** | Orosi는 Zalmari 한 농장 집중을 하향 이유로 삼음. Turrialba도 Aquiares 한 농장의 두 품종·가공이 중심 | 한 농장이라도 특별 탐색 대상으로 삼는 경로를 일관되게 허용하거나, 반복 거래 등 차이를 출처와 함께 명시 |
| **Mbeya / standard 대 Nariño / focus** | Mbeya는 Utengule 한 농장의 두 가공이며 대표성 한계. Nariño도 El Obraje 한 농장의 세 품종이 중심 | 품종 수나 로트 수 대신 생산 단위·지속성·특별한 농장 가치의 증거를 구분 |
| **Kiambu·Murang’a / standard 대 Embu·Gakenke / focus** | 저장 자료에는 standard 쪽도 복수의 실명 생산자·팩토리와 최근 수확 사례가 있음. rationale만으로 등급 차이를 설명하기 어려움 | 더 많은 로트가 있다고 자동 승격하지 말고, focus 쪽과 같은 기간·거래·생산 단위 기준으로 재심사 |
| **Sul de Minas·Mogiana·Junín / standard 대 Carmo de Minas 등 / focus** | standard 쪽에도 개별 대회 이력·복수 생산 사례·최근 작황이 기록됨. 같은 요소가 다른 산지에서는 focus 근거 | 대회 종류·연도·생산자 범위를 분리해 같은 판정 규칙 적용. 국가·지역 전체 품질로 확대하지 않음 |
| **Acatenango / focus 대 Fraijanes·San Marcos / standard** | 공식 커피 산지 인정과 실명 로트가 모두 존재. 공식 지리 구분 자체는 스페셜티 거래 규모나 상대 우선순위 근거가 아님 | 공식 산지는 지리 근거로만 유지하고 차등 우선순위에는 별도 조건 필요 |
| **다수의 전체 128개 rationale** | “추가·교체·확인했다”, “가공을 혼합하지 않는다”, “판매 노트만 반영” 등 편집·검증 이력이 분류 이유를 대신함 | 과정 기록은 기존 감사 문서에 유지하고, rationale에는 실제로 충족한 선별 조건과 증거 범위만 저장 |

New Oriente의 구체적 생산자 확인은 [MCM El Morito](https://melbournecoffeemerchants.com.au/coffee/el-morito/)를 직접 읽었다. 같은 본문의 대회 이력은 수입사 설명이며 이번 감사에서는 해당 농장의 모든 공식 연도별 결과까지 재검증하지 않았다. [MCM Floripondio Java Coco Natural](https://melbournecoffeemerchants.com.au/coffee/floripondio-java-coco-natural/)의 가족 거래 관계 연도와 Samaipata 진출 연도는 서로 다른 사건이다. 두 자료 확인일: 2026-09-09.

[ACE Burundi 2019 공식 결과](https://allianceforcoffeeexcellence.org/burundi-2019/)에서 Gatukuza는 NGOZI, GASHIKANWA의 내추럴 우승 로트(분할 1a·1b)이며, 2위 Gitwenge는 KAYANZA, GATARA 소재다. 이 사실은 그 해 특정 로트의 대회 실적이다. 현재 등록된 Gatukuza 워시드나 Gatara의 Gakenke·Masha 로트가 그 수상 로트라고 바꾸면 안 된다. 확인일: 2026-09-09.

## 기존 근거에서 유지할 수 있는 판단의 예

현재 값 91개 전체를 이미 객관적으로 입증한 목록은 만들 수 없다. 다만 아래처럼 **정확한 대상에 연결된 반복 취급**은 단순 명성보다 재사용 가능한 선별 근거다.

| 산지 | 이번에 다시 읽은 1차 근거 | 허용되는 해석 | 허용되지 않는 해석 |
| --- | --- | --- | --- |
| Bensa | [Hedge Shantawene](https://www.hedge.coffee/store/p/shantawene): 해당 스테이션 커피 취급 다섯 번째 해와 명시 수확 2025/26 | 구매자가 반복해서 소개하는 실제 생산망 사례 | 5년 연속의 단정, Bensa 전체 생산량 순위 |
| Hambela | [SEY Benti Nenka 2025](https://www.seycoffee.com/products/2025-benti-nenka-ethiopia): Guduba를 여러 해 구매, Hambela Wamena 소재, January 2025 수확 | 이름 있는 지역 가공장에 대한 다년 거래 증거 | 모든 Hambela 커피의 품질 보장, 현재 구매 가능하다는 단정(본문은 판매 종료) |
| Planadas | [September Jorge Rojas](https://september.coffee/en-us/products/jorge-rojas-2025): Finca La Roca와 Planadas, 세 번째 소개 | 정확한 생산자의 반복 취급. 지역의 다른 생산 그룹 자료와 별개로 관리 가능 | 세 개 수확연도·세 차례 직접 수입 거래로 단정 |

확인일은 모두 2026-09-09. Bensa·Hambela는 현재 focus를 지속성 기준으로 검토하기 좋은 사례다. Planadas의 취급 횟수는 연도를 대신하지 않으므로 기간까지 요구하는 규칙에서는 추가 확인이 필요하다. 저장된 rationale의 Santa Ana(Proud Mary/Pacas 장기 관계), Matagalpa(Mierisch/Ozone 관계), San Agustín·Shakiso 등의 장기 소싱 및 Veracruz의 연도별 대회 자료도 같은 방식의 검토 후보이며, 이번 표본 대조에서 해당 웹본문까지 새로 확인한 것으로 표시하지 않았다.

SCA의 [Coffee Value Assessment](https://sca.coffee/value-assessment)는 물리·감각 묘사·평가자의 품질 인상·외적 정보를 구분한다. 이는 산지 순위 규칙을 제공하는 자료는 아니지만, 원산지 추적성·공급 정보·특정 컵 평가를 하나의 품질 순위로 합치지 않는 원칙과 일치한다. 아래 제안은 SCA 공식 기준이 아니라 이 프로젝트를 위한 편집 규칙이다.

## 재현 가능한 선별 기준 제안

### 먼저 증거를 분리한다

1. **추적 가능성**: 특정 지역과 농장·생산자·협동조합·가공장, 실제 로트의 가공·향미를 1차 자료로 연결한다. 현재 로트 모델이 이 부분을 대체로 담당한다.
2. **거래 지속성**: 같은 생산 단위에 대한 명시된 여러 작황, 또는 구매자가 설명한 다년 관계를 기록한다. “세 번째 소개”와 “3년 연속 구매”는 다른 증거다. 출처 URL·대상·기간을 각각 저장한다.
3. **생산 사례의 폭**: 표준화한 생산 단위와 실제 원산지를 센다. 한 농장의 품종 세 개, 한 로트의 판매자 두 곳, 부모·하위 산지 재등장은 새 생산 단위가 아니다. 생산자 문자열이 다르다고 독립 농장으로 자동 집계하지 않는다.
4. **공식 성과**: 대회·경매의 이름, 연도, 생산자/로트, 소재지를 따로 기록한다. 고가 낙찰·한 번의 수상은 그 사건의 증거이지 지역 전체 생산량의 증거가 아니다. 특별한 농장 탐색 근거로는 쓸 수 있다.
5. **최근 확인 상태**: 수확일, 게시/입고일, 열람일, 판매 상태를 섞지 않는다. 수확연도 미표시는 미확인이지 오래된 커피 또는 낮은 품질이라는 뜻이 아니다.
6. **지리 범위**: 근거가 지역 여러 곳인지, 한 하위 산지인지, 한 생산자 특징인지 표시한다. 부모의 넓은 이름으로 근거 범위를 확대하지 않는다.

내부 기록의 최소 단위는 `regionId + criterion + subject + period + sourceURL + scope + reviewedAt + ruleVersion`으로 제안한다. 자동 점수 합산보다 조건 충족과 미확인을 명시하는 편이 현재 자료에 맞다. 수치 비교가 필요해지면 동일 정의·동일 작황·동일 단위의 별도 통계가 있어야 한다.

### focus에는 목적이 다른 두 경로를 둔다

| 내부 경로 | 조건 제안 | 이유 |
| --- | --- | --- |
| 반복 소싱이 확인되는 지역 | 추적 가능한 실제 사례 + 명시된 다년 거래 + 서로 다른 생산 단위나 다수 생산자 프로그램의 지역 범위 확인 | 사용자가 여러 스페셜티 생산 사례를 찾아보기 좋음. 로트 개수만으로 이 경로를 충족시키지 않음 |
| 특별한 세부 산지·생산자 | 추적 가능한 실제 사례 + 정확한 대상의 반복 거래 또는 공식 대회·경매 성과 + 한 생산자/하위 산지라는 범위 기록 | 사용자가 요청한 “특별한 산지 지역”을 포함. 한 농장·신생 산지·희소 품종이라는 이유만으로 탈락시키지 않음 |

`standard`는 실제 사례는 있으나 위 두 경로의 근거가 아직 충분히 구조화되지 않은 상태로 정의한다. 품질이 더 낮다는 뜻으로 사용하지 않는다. `background`는 일반 상업·국가 설명만 있고 해당 지역의 구체적 스페셜티 사례가 아직 확인되지 않은 항목에만 적용한다. 언어 장벽·공개 자료 부족은 내부 조사 미완료로 기록하며 그 지역에 스페셜티가 없다는 결론으로 바꾸지 않는다.

지역 크기가 다르므로 부모와 자식을 동일 순위표에서 독립 득점하게 하지 않는다. 부모는 탐색 그룹, 하위 지역은 구체 사례의 진입점으로 사용할 수 있다. 현재 연결 구조 자체를 버릴 필요는 없다. “다년”의 최소 기간이나 최근성 범위를 채택한다면 내부 운영 규칙으로 명시하고 전 지역에 같은 버전을 적용한다. 특정 산지를 원하는 등급으로 만들기 위해 임계치를 바꾸지 않는다.

### 단계별 안정화

1. **즉시 적용 권고**: 국가별 focus 개수와 산지 focus tier를 사용자 노출 정렬에서 모두 제외하고 기존 지리 그룹·국가·산지 순서를 유지한다. 사용자가 요청한 국가→산지 흐름과 실제 산지·생산자·품종·가공 정보는 유지한다. 정렬을 위해 즉석에서 128개를 다시 점수화하지 않는다. 공개 면책·검증 안내 문구를 추가할 필요는 없다.
2. **우선순위 재심사**: New Oriente의 낡은 이유, Bensa·Planadas의 과한 표현, emerging/core 비교 문구, 단일농장·부모하위 범위 불일치부터 위 조건으로 재평가한다. 나머지 128개에도 동일 기록 양식을 적용한다. 확인되지 않은 경우 기존 tier를 객관적 시장 순위로 취급하지 않는다.
3. **정렬 연결**: 같은 조건의 재심사가 끝나기 전에는 기존 priority를 임시 내부 값으로 보관하되 화면 순서와 연결하지 않는 것을 권고한다. 이후 실제로 탐색 우선순위가 필요할 때만 위 두 경로를 전체 산지에 같은 방식으로 검토해 재도입한다. 재심사된 항목만 적용할 때도 “미심사”를 낮은 품질로 취급하지 않는다. 모든 값을 standard로 덮거나 기존 91개를 객관적 순위로 일괄 유지할 필요가 없다. 정확한 지명·생산자 일치에 따른 검색 관련도는 향후 별도의 기능으로 검토할 수 있다.
4. **자료 확장**: 같은 생산자의 다른 가공만 반복 추가하는 작업과 독립 생산망·여러 작황 근거 확보를 구분한다. 국가별 동일 로트 수 할당이나 focus 비율 목표를 만들지 않는다.
5. **검사 개선**: 향후 테스트에는 부모·자식 재사용 및 동일 농장 별칭이 국가 순위를 높이지 않는지, 정확한 지명 검색이 tier에 밀리지 않는지, priority에 실제 조건과 출처가 연결되는지 추가한다. 최소 로트 수 검사는 품질 판정과 분리한다.

## 전체 128개 검토 기록

아래 표는 검토 범위와 당시 분류를 보존한 목록이다. 새로운 등급 판정표가 아니다. 배경 항목은 전 국가에서 0개다. 각 rationale의 전체 읽기 완료, 비교가 필요한 구체 사례와 1차 자료 재열람 범위는 위에 명시했다.

| 국가 | 총수 | focus (검토 당시) | standard (검토 당시) |
| --- | ---: | --- | --- |
| Ethiopia | 12 | `ethiopia-yirgacheffe`, `ethiopia-guji`, `ethiopia-sidama`, `ethiopia-limu`, `ethiopia-kochere`, `ethiopia-gedeb`, `ethiopia-bensa`, `ethiopia-hambela`, `ethiopia-uraga`, `ethiopia-bench-maji`, `ethiopia-shakiso` | `ethiopia-harrar` |
| Rwanda | 4 | `rwanda-nyamasheke`, `rwanda-huye`, `rwanda-gakenke` | `rwanda-cyato` |
| Burundi | 4 | `burundi-kayanza`, `burundi-gatara` | `burundi-ngozi`, `burundi-gatukuza` |
| Kenya | 7 | `kenya-nyeri`, `kenya-kirinyaga`, `kenya-othaya`, `kenya-karatina`, `kenya-embu` | `kenya-kiambu`, `kenya-muranga` |
| Tanzania | 2 | — | `tanzania-kilimanjaro`, `tanzania-mbeya` |
| Colombia | 11 | `colombia-huila`, `colombia-narino`, `colombia-antioquia`, `colombia-tolima`, `colombia-cauca`, `colombia-pitalito`, `colombia-san-agustin`, `colombia-inza`, `colombia-planadas`, `colombia-quindio`, `colombia-valle-del-cauca` | — |
| Brazil | 9 | `brazil-cerrado`, `brazil-mantiqueira-de-minas`, `brazil-carmo-de-minas`, `brazil-alta-mogiana`, `brazil-chapada-diamantina`, `brazil-espirito-santo` | `brazil-sul-de-minas`, `brazil-mogiana`, `brazil-bahia` |
| Peru | 6 | `peru-cajamarca`, `peru-cusco`, `peru-jaen`, `peru-san-ignacio`, `peru-puno` | `peru-junin` |
| Panama | 6 | `panama-boquete`, `panama-volcan`, `panama-jaramillo`, `panama-alto-quiel`, `panama-bambito`, `panama-renacimiento` | — |
| Guatemala | 9 | `guatemala-antigua`, `guatemala-huehuetenango`, `guatemala-atitlan`, `guatemala-san-pedro-necta`, `guatemala-acatenango` | `guatemala-coban`, `guatemala-fraijanes`, `guatemala-san-marcos`, `guatemala-new-oriente` |
| Costa Rica | 9 | `costa-rica-tarrazu`, `costa-rica-central-valley`, `costa-rica-dota`, `costa-rica-naranjo`, `costa-rica-turrialba` | `costa-rica-west-valley`, `costa-rica-orosi`, `costa-rica-tres-rios`, `costa-rica-brunca` |
| Honduras | 4 | `honduras-marcala`, `honduras-copan`, `honduras-comayagua`, `honduras-santa-barbara` | — |
| El Salvador | 2 | `el-salvador-santa-ana`, `el-salvador-chalatenango` | — |
| Nicaragua | 4 | `nicaragua-jinotega`, `nicaragua-matagalpa`, `nicaragua-nueva-segovia`, `nicaragua-dipilto` | — |
| Mexico | 4 | `mexico-chiapas`, `mexico-oaxaca`, `mexico-veracruz` | `mexico-pluma-hidalgo` |
| Indonesia | 10 | `indonesia-sumatra`, `indonesia-java`, `indonesia-sulawesi`, `indonesia-gayo`, `indonesia-lintong`, `indonesia-west-java`, `indonesia-toraja` | `indonesia-flores`, `indonesia-bajawa`, `indonesia-kintamani` |
| Papua New Guinea | 2 | `papua-new-guinea-eastern-highlands`, `papua-new-guinea-western-highlands` | — |
| India | 6 | `india-karnataka`, `india-chikmagalur`, `india-bababudangiri`, `india-coorg` | `india-kerala`, `india-wayanad` |
| Vietnam | 3 | `vietnam-da-lat`, `vietnam-cau-dat` | `vietnam-buon-ma-thuot` |
| Yemen | 2 | `yemen-haraaz` | `yemen-mattari` |
| Bolivia | 2 | `bolivia-caranavi` | `bolivia-samaipata` |
| Ecuador | 2 | `ecuador-loja`, `ecuador-pichincha` | — |
| Uganda | 2 | — | `uganda-rwenzori`, `uganda-mount-elgon` |
| China | 2 | — | `china-puer`, `china-baoshan` |
| Thailand | 2 | — | `thailand-chiang-rai`, `thailand-chiang-mai` |
| Timor-Leste | 2 | — | `timor-leste-ermera`, `timor-leste-aileu` |

## 남은 한계

- 지역별 실제 스페셜티 생산량, 거래 규모, 시장 점유율을 같은 기간으로 수집한 자료가 없어 “많이 나는 곳”을 양적 순위로 결론 내리지 않았다.
- 모든 로트의 생산 단위는 아직 정규화되지 않았다. 협동조합·농장·가공장·판매자 문자열의 중복을 단순 문자열 개수로 풀 수 없다.
- 웹 표본을 새로 읽은 범위는 위 7개 출처군에 한정된다. 다른 profile에 있는 대회·거래 지속성 문구는 재심사 후보이며 자동 승인한 사실 목록이 아니다.
- 이 감사에서 profile의 priority·rationale, 공개 문구, 정렬 코드, 테스트는 변경하지 않았다. 제안의 실제 적용 여부는 통합 작업에서 결정한다.

## 통합 결정

2026-09-09 root가 국가별focus집계 정렬과 산지tier 정렬을 공개 화면에서 제거했다. 국가→산지→세부산지의 기존 구조와 지리 순서를 유지하며, 생산자·품종·향미 검색으로 실제 로트에 접근한다. 내부priority/rationale는 과거 편집판단으로 보존하고 현재 품질·생산량·노출 순위에 사용하지 않는다. Bensa의 '연속'과 Planadas의 '구매'는 1차 원문 범위로 수정했다. New Oriente의 과거 '생산자 구체성이 약하다' 판단은 El Morito 추가로 더 이상 현재 결론으로 사용하지 않는다. 관련 브라우저 검증을 지리 순서·모든산지 유지 기준으로 변경했고Chromium/WebKit에서 통과했다.
