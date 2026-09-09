# 로스터 자료에서 찾은 신규 산지 — 2026-09-09

기존 등록 산지 외 Arbegona, Caldas, Gicumbi를 구별하고 8개 원두 상품의 산지·생산자·품종·가공·노트를 연결했다. 기존 국가 목록과 시다마 하위 구조를 사용한다. 로스터 자체 페이지 및 커피화의 공식 판매 상세 원문을 확인했다. 수확연도가 없어도 실제 산지 정보로 활용하며 날짜를 만들지 않는다.

| 산지 | 새 검색어 | 채택 자료 | 대조·제한 |
| --- | --- | --- | --- |
| Ethiopia Arbegona | Arbegona Ethiopia coffee roaster tasting notes 2025; Arbegona coffee 74158 washed natural roaster harvest Sidama | [Scenery Rumudamo](https://scenery.coffee/blogs/coffee-archive/102-ethiopia-rumudamo-natural-24-25), [커피화 Hure](https://www.unspecialty.com/product/detail.html?product_no=862), [Stitch Yaye](https://stitch.coffee/products/ethiopia-yaye-26) | 세 생산 단위의 독립 제품. Rumudamo 2024/25와 도착일을 분리. Hure는 검색 도구 본문 실패 후 승인된 공개 HTTP 원문에서 표 전체 확인. 74158, Degefu Mulugeta, Natural, 2400m 및 네 과일 노트. Yaye의 74148은 로스터 원문 표기 그대로이며 임의로 74110으로 고치지 않음. |
| Rwanda Gicumbi | Gicumbi Rwanda coffee roaster tasting notes | [BotaCoffee 32A](https://www.botacoffee.eu/rwanda-gicumbi/), [Fresh Roasted Rwamiko](https://www.freshroastedcoffee.com/blogs/roasters-choice/rwanda-washed-rwamiko-july-2026), [Teso Natural](https://teso.coffee/en/coffee/gicumbi-3/) | 모두 직접 본문 확인. Rwamiko 게시·선정은 2026년이나 명시 수확은 2025년 3–5월. Teso 2026-07-20은 로스팅 날짜이므로 수확으로 쓰지 않음. Bota 32A는 2025·Red Bourbon·Fully Washed, 대회 점수를 이 로트에 붙이지 않음. |
| Colombia Caldas | Caldas Colombia coffee roaster varietal tasting notes; Caldas roaster Castillo La Esperanza coffee notes; Laderas del Tapias Catiope roaster natural | [Café Berriondo](https://cafeberriondo.com/product/cafe-especial-finca-la-esperanza-lavado/), [The Roasted Record](https://www.roastedrecord.com/products/laderas-del-tapias-natural-catiope), [Timbertrain 지리](https://timbertraincoffeeroasters.com/shop/laderas-del-tapias-colombia/) | Aguadas La Esperanza는 원문 고도1720/1750 충돌로 고도 수치 생략. 로트 품종 Castillo, washed, 향기·컵 노트 채택. Catiope는 Roasted Record의 개별 원두 노트·Natural·Silo만 사용. Timbertrain은 Neira/Caldas·농장 구획 지리 근거만 사용. 하단 Honduras/Washed 잘못된 상품 속성을 해당 로트에 혼합하지 않음. |

## 보류·대조

- Bugan Arbegona와 Wadi Laderas는 검색 본문만 읽힘. Wadi 직접 상품 JSON은404. 새 원두의 상세 근거로 채택하지 않았다.
- La Mulita Caldas는 공개 상품 JSON에서 Manizales cooperative, Colombia/Castillo/Cenicafe1, washed 확인. 이번에는 이름 있는 두 농장의 비교로 충분하여 중복 사례를 늘리지 않았다.
- Caldas Coffee의 상품명 Colombia를 곧바로 품종 Colombia로 해석하지 않았다.
- Catiope의 부모 표기는 로스터간 Castillo 대 Caturra×ET41로 충돌한다. 본 작업에서 유전적 계통을 확정하지 않았다.
- Anaerobic Coffees Bursa의2026 수확·제품은 확인했지만 Arbegona 세 생산 단위를 먼저 채택했다. 보류는 그 지역에 정보가 없다는 의미가 아니다.

지역 상단 향미는 위 로트에서 선정한 노트이며 지역 전체의 고정 특성이 아니다. 이 연구 설명은 화면에 출력하지 않는다. 원두별 출처 접기와 로스터명 검색을 연결하여 실제 노트의 출처를 찾을 수 있도록 했다.

## 락즈엉 추가

The Married Beans의 Red Bourbon 워시드와 K’ho Catimor 워시드 2건을 별도 산지 락즈엉으로 추가했다. 구조화 근거는 `lac-duong-proposal.json`. 달랏이나 꺼우닷 하위로 추정하지 않았다. K’ho는 공동체·상품 이름이므로 지역 자체의 alias에서 제거했고 원두명·생산자 검색으로만 찾는다. 원두의 1500m를 지역 고도 범위로 확장하지 않았다. 로스터 제품·생두 페이지의 일치 필드와 본문을 직접 확인했다.
