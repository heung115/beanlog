# 지역 재배 품종 보강

확인일: 2026-09-09. 대상은 `regional.ts`의 18개 항목이다. 기존 core 23개와 specialty 16개, `originRegionGuides`의 실제 품종 표기를 대조했다. 이 작업에서는 두 신규 파일만 작성했으며 인덱스는 수정하지 않았다.

## 선정과 매칭 범위

128개 산지의 188개 고유 표기, 산지별로 중복 제거한 780개 산지×품종 표기를 기준으로 검사했다. 기존 39개 가이드는 41개 표기·426개 조합에 매칭되었고, 신규 18개를 함께 인덱싱하면 60개 표기·504개 조합에 매칭된다. 증분은 19개 표기·78개 조합이다. 이는 표기 연결 수이며 실제 재배 면적이나 유전적 다양성의 수치가 아니다.

| 신규 항목 | 해당 산지 수 | 선정 이유 |
|---|---:|---|
| Catimor | 14 | 여러 국가에서 반복되며 단일 품종과 계통군의 구분이 필요 |
| S795 | 11 | 인도·인도네시아의 빈번한 재배 품종 |
| Tabi | 8 | 콜롬비아·에콰도르, 키 큰 복합 품종의 배경 |
| Castillo | 7 | 콜롬비아의 복합 육성 품종 |
| Colombia | 6 | 구성 계통이 바뀌는 복합 품종 |
| Cauvery / Selection 9 / Chandragiri | 각 4 | 인도 산지의 주요 재배 품종 |
| Kent / Selection 6 / Milenio | 각 3 | 인도 육종 부모·되돌이교배·F1 구분 |
| Timor Hybrid / USDA 762 / Typica Mejorado | 각 2 | 자연 교잡·에티오피아 수집 재료·생산자 명칭 구분 |
| Sarchimor / Ethiosar / Starmaya | 각 1 | 계통군 및 다른 증식 방식의 설명 가치 |
| Cenicafé 1 | 0 | 요청된 주요 육성 품종이며 Castillo·Colombia와 혼동 방지 |

산지 수는 한 가이드에 여러 표기가 있어도 한 번만 센다. Cenicafé 1을 추가했다는 이유로 확인되지 않은 재배 산지에 이 품종을 넣지 않았다. 색상별 Bourbon·Catuai·Caturra, 브라질 육성종, 에티오피아 지역 집단명과 인도네시아의 여러 지역 명칭은 이번 18개 범위 밖이다.

## 직접 읽은 근거

| 항목 | 본문 근거 | 반영 범위 |
|---|---|---|
| Castillo | [Cenicafé, Avances Técnicos 337](https://biblioteca.cenicafe.org/bitstream/10778/401/1/avt0337.pdf), pp. 4–5 | 복합 품종, 교배 부모, 선발 목표. 지역별 Castillo 구성품종은 별칭에서 제외 |
| Colombia | [Cenicafé, 구성 개량 연구](https://publicaciones.cenicafe.org/index.php/avances_tecnicos/article/download/1784/5181/3914), pp. 2–3 | 구성 계통의 추가·제거를 포함하는 동적인 복합 품종. 고정 계통 수를 적지 않음 |
| Tabi | [Cenicafé, Avances Técnicos 300](https://biblioteca.cenicafe.org/bitstream/10778/4185/1/avt0300.pdf), p. 8 및 개발 설명 | 서로 다른 교배 후대의 혼합. 단순 삼원교배 공식으로 줄이지 않음 |
| Cenicafé 1 | [Cenicafé, Avances Técnicos 469](https://biblioteca.cenicafe.org/bitstream/10778/4178/1/AVT0469.pdf), pp. 2, 5–6 | 8개 후대 구성. CBD 분자 표지 선발을 현장 병원균 시험 결과로 바꾸지 않음 |
| Catimor / Timor Hybrid | [WCR, T8667의 History](https://varieties.worldcoffeeresearch.org/varieties/t8667) | 계통군, 자연 교잡의 배경, 후속 선발. T8667의 고도·병해·맛을 전체 계통군으로 확대하지 않음 |
| Sarchimor | [WCR, Villa Sarchi의 History](https://varieties.worldcoffeeresearch.org/varieties/villa-sarchi) | H361의 부모 및 육종 목표 |
| S795 | [WCR, S795](https://varieties.worldcoffeeresearch.org/varieties/s795) | 영문 본문의 S288 × Kent와 국제 시험·인도 현지 감수성의 차이를 반영 |
| Kent / Cauvery / Selection 9 | [Coffee Board of India, Important Varieties](https://coffeeboard.gov.in/coffee-regions-india.html?page=CoffeeRegionsIndia) | 선발 역사·부모 관계만 사용. 홍보성 품질 표현과 향미 문장은 옮기지 않음 |
| Chandragiri | [Coffee Board of India, Research](https://coffeeboard.gov.in/research.aspx) | 2007년 보급, 기관이 보고한 생산·물리적 품질·녹병 반응. 영구적인 전 병원형 저항성을 주장하지 않음 |
| Selection 6 | [WCR, Sln.6](https://varieties.worldcoffeeresearch.org/varieties/sln-6) | Kent × S274 이후 되돌이교배, 보급, 혼농임업 적응. 인도 현지 감수성을 함께 반영 |
| USDA 762 | [IAARD, Pengenalan Varietas Unggul Kopi](https://repository.pertanian.go.id/server/api/core/bitstreams/8ac5edc0-bd86-4c2c-81c5-46f62a83db98/content), 인쇄 pp. 57–58, PDF pp. 68–69 | 에티오피아 수집 집단의 모주 선발, 수형, 열매색, 선충·토양 반응 |
| Typica Mejorado | [CafExporto, Genetic Bank](https://cafexporto.com/genetic-bank) | 자체 보존 재료에 관한 생산자의 설명으로 한정. WCR 원검사 보고서나 모든 유통 재료의 유전적 동일성을 확인했다는 뜻이 아님 |
| Ethiosar | [Fincas Mierisch, Varieties의 Ethiosar 절](https://www.fincasmierisch.com/varieties) | 생산자의 재배 경험으로 한정. 직접 확인되지 않은 복잡한 교배식은 생략 |
| Milenio | [WCR, Milenio](https://varieties.worldcoffeeresearch.org/varieties/milenio) | H10 표기, 부모, 수형·생두, 영양번식과 후대 분리 |
| Starmaya | [WCR, Starmaya](https://varieties.worldcoffeeresearch.org/varieties/starmaya) | 웅성불임 부모를 이용하는 전문 채종. 수확한 자가 종자의 동일성 보장과 구분 |

모든 출처의 `accessedAt`은 2026-09-09다. 특정 로트의 맛·점수나 생산자의 품종 홍보 향미를 품종 전체의 고정 특성으로 넣지 않았다. 같은 URL을 여러 항목에 사용한 경우에도 설명과 감사 기록의 파생 문량을 합산해 200단어 이내로 유지했다.

## 이름과 분류 판단

- `population`은 현재 타입에서 Catimor·Sarchimor 같은 계통군과 Timor Hybrid 계통을 구별하기 위해 사용했다. 세 항목을 하나의 균일한 품종으로 제시하지 않는다.
- Colombia·Castillo·Tabi·Cenicafé 1은 복합 구성이라는 이유로 서로 별칭 처리하지 않았다. 지역별 Castillo 명칭, `Columbia`도 추가하지 않았다.
- Typica Mejorado·Ethiosar는 공식 등록 품종 및 모든 유통 표본의 유전적 동일성이 확정되었다는 의미를 피하도록 `trade-name`으로 기록했다. 품종 설명의 생산자 경험을 다른 생산자 재료에 자동 확장하지 않는다.
- `S.795`, `Selection 3`, `Kents`, `Sln.6`, `S.2828`, `H10` 등은 읽은 기관 본문의 표기다. `USDA762`, 하이픈·공백 차이는 번호를 보존하는 표기 변형이다.
- `Jember`, `Djember`, `Lini S`, `S795 (Jember)`, `Jember (S795)`를 S795에, `Timtim`·`Timor`를 Timor Hybrid에, `USDA`를 USDA 762에 자동 연결하지 않았다. 농장·지역 명칭으로 쓰인 재료의 동일성을 별도로 확인해야 한다.
- `Typica Mejorada`를 Typica Mejorado에, `Ethiostar`를 Ethiosar에 연결하지 않았다. 표기가 비슷하다는 이유만으로 흡수하지 않았다.
- Centroamericano/H1은 core에 이미 있다. 이 파일은 중복 항목을 만들지 않는다. 기존 산지 표기 `H1 Centroamericano`와 `Centroamericano (H1)`의 별칭 매칭은 core 소유자에게 별도 전달했다.

## 접근 한계와 검증

WCR T5296 본문은 반복 요청에서 시간 초과가 발생해 채택하지 않았고, Sarchimor 설명은 직접 열린 Villa Sarchi 본문으로 대체했다. 독립된 Mejorado 유전자 검사 원자료와 Ethiosar 공식 육종 기록은 확보하지 못했다. 두 항목은 생산자 공개 설명의 범위로 작성했다.

18개 ID 중복, 한·영 필수 문장, 출처·확인일, core+specialty+regional의 별칭 충돌을 실제 데이터로 검사했다. `buildVarietyGuideIndex` 실행 및 `npm run typecheck`가 통과했다. root 인덱스 반영은 이 작업에 포함하지 않았다.

통합 시 root가 [KunDe RUIZ-018](https://www.kundecoffee.com/shop/ruiz-018/)의 Alejandro Ruiz / Finca La Esperanza 재배 근거로 Cenicafé 1을 Huila에 연결했다. 상품표 Bruselas–El Rocío와 생산자 소개 Acevedo가 달라 세부 지역으로 전파하지 않고 두 표기에 공통으로 확인되는 Huila까지만 연결했다. 수확연도는 없으며 이 근거로 최근 작황을 주장하지 않는다.
