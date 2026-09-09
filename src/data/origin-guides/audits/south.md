# 남미 산지 22개 출처 재검증

검토일: 2026-09-08. 대상: `src/data/origin-guides/americas-south.ts` 전체 22개(콜롬비아 9, 브라질 8, 페루 5). 최종 데이터는 지역 프로필 7개, 생산자·상품·로트 기록 15개, 서로 다른 출처 URL 45개다.

`regional`은 기관·생산자 단체·수출업자의 지역 프로필이며 통계적으로 보장된 맛은 아니다. `lot`은 특정 농장·협동조합 상품이나 블렌드의 공개 시음 기록이다. 수확연도나 입고연도가 확인된 경우 `flavorContext`에 표시했다. 자료 확인일과 수확연도는 구분했다. 품종 목록도 확인한 지역 또는 농장 사례이며 지역 내 재배 비중을 뜻하지 않는다.

## 항목별 검토

아래의 맛 근거는 본문 또는 PDF 텍스트를 읽고 대조했다. 검색 결과만 확인한 보조 자료와 접근 실패 자료는 뒤에 따로 적었다. 브라질 8개는 별도 조사자가 재대조한 뒤 최종 반영 내용을 다시 검토했다.

| ID | 맛 근거 | 확인·변경 내용 |
| --- | --- | --- |
| colombia-huila | 지역 — [FNC 지역표](https://cafedecolombia.com/regiones-cafeteras/) | 지역표와 생산자 사례를 분리했다. 고도는 [원산지호칭 범위](https://cafedecolombia.com/denominacion-de-origen-regional/)로 한정했다. |
| colombia-narino | 지역 — [FNC 지역표](https://cafedecolombia.com/regiones-cafeteras/), [원산지호칭](https://cafedecolombia.com/denominacion-de-origen-regional/) | 두 자료의 산미 강도 표현 차이를 밝혔고 강도 태그를 제거했다. 품종·가공은 확인된 Buesaco 2023 입고 사례로 정리했다. |
| colombia-antioquia | 지역 — [FNC 지역표](https://cafedecolombia.com/regiones-cafeteras/) | 지역 향미와 La Reserva의 별도 가공 사례를 분리했다. 지역 고도는 추가하지 않았다. |
| colombia-tolima | 지역 — [FNC 지역표](https://cafedecolombia.com/regiones-cafeteras/), [원산지호칭](https://cafedecolombia.com/denominacion-de-origen-regional/) | 향미와 지역 환경을 대조했다. 표시 고도는 원산지호칭 설명 범위로 한정했다. SIC 접근 제한은 아래 기록했다. |
| colombia-cauca | 지역 — [FNC 지역표](https://cafedecolombia.com/regiones-cafeteras/) | [Manos Juntas](https://olisipo.coffee/product/manos-juntas/) 위치를 Popayán에서 Sotará로 수정했다. ASMUCAFE의 El Tambo 사례도 재확인했다. |
| colombia-pitalito | 로트 — [Franky Peña](https://www.sweetmarias.com/products/colombia-pitalito-franky-pena-8587) | 2026년 1월 입고 기록을 명시했다. 실패하는 쿼리 문자열을 URL에서 제거했다. El Bombo를 동의어로 합치지 않는다. |
| colombia-san-agustin | 로트 — [Jaime Burbano](https://duluthcoffeecompany.com/pages/producers/jaime-burbano), [Faiber Bolaños](https://silverbirdcoffee.com/products/faiber-bolanos-colombia-gold-label-reserve) | 두 생산자 설명의 향미 출처를 각각 표시했다. 이 지역 사례로 확인되지 않은 품종과 잘못 필터링된 판매목록을 제거했다. |
| colombia-inza | 로트 — [MCM 2024 목록](https://melbournecoffeemerchants.com.au/wp-content/uploads/2024/01/MCM-Web-List-18.01.24.pdf) | Belén의 2023년 8월 입고 기록을 명시했다. El Tabor의 별도 시음 노트와 섞지 않았다. Tierradentro를 정확한 동의어로 쓰지 않는다. |
| colombia-planadas | 로트 — [Covoya Seleccion Planadas](https://eu.covoyacoffee.com/seleccion-planadas-organic-eu.html) | 2025/26 수확 기록으로 특정했다. [Belco](https://www.belco.fr/en/cafes/012000303700000/yuppie)에서 Gaitania 공동체 관계도 확인했다. |
| brazil-cerrado | 지역 — [세하도 생산자 연맹](https://www.cafedocerrado.org/index.php?pg=nossoterroir) | 지역 범위·고도를 확인했다. Oeiras 내추럴과 Topazio 발효 내추럴을 구분하고 실패한 2025 자료를 2026년 목록으로 교체했다. |
| brazil-sul-de-minas | 로트 — [Casa Brasil 블렌드](https://casabrasilcoffees.com/product/sul-de-minas/), [COOPERVITAE 카드](https://www.list-beisler.coffee/media/pdf/BRA_Pulped-Natural_Sul_de_Minas_Arara_Coopervitae_POSTCARD.pdf) | 두 기록의 향미를 각각 연결했고 Arara 기록의 2020년 대회 시점을 표시했다. 다른 품종은 별도 농장 사례로 구분했다. |
| brazil-mogiana | 로트 — [Cafe Imports 2018 목록](https://cdn.cafeimports.com/images/Cafe-Imports-EUR-Spot-1.pdf) | 11498번의 과거 기록을 명시했다. 품종은 지역 자료에서 온 목록으로 분리했다. 범위가 좁은 별칭과 읽지 못한 논문을 제거했다. |
| brazil-bahia | 로트 — [Diamantina](https://melbournecoffeemerchants.com.au/coffee/diamantina/) | 캐슈넛을 캐슈버터로 수정했다. 맛은 Mucugê 상품, 다른 품종·가공은 별도 사례임을 밝혔다. |
| brazil-mantiqueira-de-minas | 로트 — [Sítio Engenho](https://www.allycoffee.com/coffees/sitio-engenho-arara/) | 농장 재배 품종과 상품 품종을 구분했다. 넓은 산맥 이름을 별칭에서 제거했다. 고도는 [생산자 협회 안내서](https://acave.com.br/images/Cartilha-reg-brasileiras.pdf)로 재검증했다. |
| brazil-carmo-de-minas | 로트 — [Cafe Imports 2018 목록](https://cdn.cafeimports.com/images/Cafe-Imports-EUR-Spot-1.pdf) | 11366번 기록에 맞게 향미를 고치고 근거 없는 클로브를 제거했다. 실패 자료 대신 [ACE 농장 기록](https://allianceforcoffeeexcellence.org/farm-directory/87-63/)으로 상위 산지 관계를 확인했다. |
| brazil-alta-mogiana | 지역 — [ProCafé 지역 설명](https://procafe.com.br/en/nossas-regioes/) | [2026년 수출업자 설명](https://bourboncoffees.com.br/en/the-alta-mogiana-region/)에 따라 지리를 두 주에 걸쳐 수정했다. 정확하지 않은 별칭과 발효 방식의 과도한 해석을 수정했다. |
| brazil-chapada-diamantina | 로트 — [Sítio Tanque](https://melbournecoffeemerchants.com.au/coffee/sitio-tanque/) | Aleci Souza의 상품 기록으로 특정했다. Piatã·Mucugê를 같은 지명이나 별칭으로 취급하지 않는다. |
| peru-cajamarca | 로트 — [David Guevara 25270](https://www.cafeimports.com/europe/offerings?view=beanology.view.david-guevara-finca-flor-de-montana-chirinos-caturra-cbc-pe-bio-178-25270) | 변동된 목록에서 현재 확인되는 항목으로 향미·품종을 교체했다. 검토 월과 로트 번호를 표시했다. |
| peru-cusco | 로트 — [Nítido Amacho Huayco](https://nitido.coffee/cusco/) | 농장·생산자·품종·가공과 노트를 재대조했다. Cusco 도시, 생산 권역, 거래 거점을 구분했다. |
| peru-junin | 로트 — [Elephant Palomar](https://elephantcollective.co.uk/products/andres-bazos) | 제한적으로만 읽히던 협동조합 페이지 대신 고정 상품 기록으로 맛·품종을 교체했다. 같은 농장의 다른 재배 품종은 로트 구성과 구분했다. |
| peru-jaen | 로트 — [Coffee’s Jaén](https://www.coffeesjaen.com/cafe.php) | Geisha 항목의 노트임을 명시하고 품종 목록에 Gesha를 추가했다. 별도 Bourbon·Catimor 노트와 섞지 않았다. 수확연도·로트번호는 미표시임을 밝혔다. |
| peru-san-ignacio | 로트 — [DRWakefield Frontera](https://drwakefield.com/coffees/peru-frontera-san-ignacio/) | 협동조합 상품 기록으로 특정했다. 실패한 UNICAFEC 첫 화면은 읽을 수 있는 [협동조합 소개](https://unicafec.com/la-cooperativa/)로 교체했다. |

## 접근 상태와 자료의 한계

- FNC의 일부 원래 주소는 시간 초과였다. `www`가 붙은 스페인어 페이지를 통해 본문을 읽었으며 정규 URL로 리디렉션됨을 확인했다. 영어 원산지호칭 URL은 읽힌 스페인어 주소로 교체했다.
- [SIC Tolima](https://sedeelectronica.sic.gov.co/temas/propiedad-industrial/direccion-de-signos-distintivos/denominaciones-de-origen/cafe-de-tolima)는 직접 요청이 403이었다. 공식 페이지의 검색 색인에 나온 범위 설명을 읽은 보조 근거이며 페이지 직접 열람 완료로 계산하지 않는다. 향미 근거는 직접 읽힌 FNC 자료다.
- [Ally La Reserva](https://www.allycoffee.com/coffees/la-reserva-caturra-chiroso-anaerobic-honey/)는 직접 열기가 실패했으나 검색 도구가 제공한 본문과 상품 명세를 읽었다. 이를 품종·가공의 보조 사례로만 남겼다. 지역 향미는 FNC에서 가져왔다. 품종 계통에 대한 검증되지 않은 설명은 옮기지 않았다.
- 동적으로 바뀌는 Cafe Imports 목록은 과거 URL이 같은 내용으로 유지되지 않았다. Cajamarca는 검토 시점에 실제 표시된 25270번으로 교체했다. Mogiana·Carmo는 날짜가 적힌 2018년 PDF를 사용하여 과거 기록임을 드러냈다. 이 기록을 현재 재고나 최근 수확으로 표현하지 않는다.
- PDF는 추출된 텍스트를 읽었다. MCM 목록의 추가 화면 캡처는 실패하여 시각적 교차 검증을 했다고 주장하지 않는다.
- Sebrae Mantiqueira 페이지, 2025 Ally 목록, 기존 List + Beisler 경로, BSCA 2024 PDF는 실패하여 각각 읽을 수 있는 생산자 안내서·2026 목록·공식 PDF 경로·ACE 농장 기록으로 바꿨다.
- Coltro Coffee Science 논문은 원문·뷰어·저장소 접근이 실패하여 출처에서 제거했다. INPI의 2023년 자료도 검색 색인만 확인되므로 법적 변경 일자를 데이터에 추가하지 않았다. Alta Mogiana의 현재 지리 설명은 직접 읽은 2026년 수출업자 자료를 사용했다.
- Sanchirio 협동조합 첫 화면은 전체 열람이 되지 않았다. Junín의 맛 근거로 사용하지 않고 직접 읽힌 Palomar 상품으로 교체했다. Falcon의 실패하는 HTML 소개는 실제 읽힌 [생산자·수출업자 PDF](https://falconcoffees.com/wp-content/uploads/2024/12/Exporter_Bio_039_s_Peru_compressed_1.pdf)로 교체했다.
- 알려지지 않은 지역 고도를 농장 고도로 채우지 않았다. ACE 농장 기록의 비정상 고도 값도 사용하지 않았다. 생산량 순위, 지역 전체의 스페셜티 등급, 품종 우점 비율을 새로 주장하지 않았다.

## 데이터 확인

22개 항목 모두 `verification`을 갖는다. 각 `flavorSourceUrls`는 해당 항목의 `sources` 안에 존재하며 양언어 맥락을 제공한다. ID 중복, 존재하지 않는 부모 ID, 잘못된 검토일은 없다. 부모 연결은 커피 거래 지리의 탐색 관계이며 모든 행정구역·지리적표시 경계가 일치한다는 의미가 아니다.

최종 검사: 담당 데이터 파일 ESLint 통과, `types.ts`와 담당 파일의 엄격 TypeScript 검사 통과. 데이터 적재 검사에서도 22개/22개 검토 완료, 지역 7개·로트 15개, 출처 URL 45개를 확인했다. 브라질 8개에 대한 별도 최종 사실 검토에서도 추가 수정 사항은 발견되지 않았다.
