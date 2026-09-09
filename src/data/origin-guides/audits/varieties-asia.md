# 아시아·태평양 품종 근거 검토

검토일: 2026-09-08. 기존 22개 산지를 모두 검토했다. `variety-research/asia.ts`에는 지역·생산자·품종의 연결을 확인한 48건을 저장했다. 직접 연결되는 지역은 16개이며, 수마트라·술라웨시·플로레스·카르나타카는 하위 산지의 근거를 상위에 집계할 수 있다. 케랄라·와야나드는 이번 기준에 맞는 새 생산자별 품종 근거를 확보하지 못했다. 기존 산지 파일은 수정하지 않았다.

자료의 재배 품종·로트 품종란을 확인했으며 계보의 부모 품종, 가공법, 등급, 수종을 새로운 품종으로 만들지 않았다. 생산자 필드는 개별 농장뿐 아니라 출처에 명시된 협동조합·수집상·가공 생산자 그룹도 포함한다. 해당 경우 역할을 표시했다. 자료가 증명하는 범위는 그 생산자 또는 로트이며 산지 전체의 보급률이나 현재 판매 가능성을 뜻하지 않는다.

## 22개 산지별 결과

| 산지 ID | 직접 근거 수 | 검토·반영 내용 |
|---|---:|---|
| `indonesia-sumatra` | 0 | 가요·린통의 실제 생산자 근거를 해당 하위 ID에 저장. 국가·섬의 일반 품종 목록을 복제하지 않음. |
| `indonesia-java` | 2 | [DRWakefield Kayumas](https://drwakefield.com/coffees/java-kayumas/)의 Koperasi Surya Abada Kayumas: S795, USDA 762. Kayumas의 별도 ID가 없어 Java에 저장. |
| `indonesia-sulawesi` | 0 | Sulotco 근거를 Toraja에 저장. 불완전한 USDA 표기를 USDA 762로 확대하지 않음. |
| `indonesia-flores` | 0 | Wolo Wio/Laga Lizu 근거를 Bajawa에 저장. 다른 Flores 생산지로 전파하지 않음. |
| `indonesia-gayo` | 8 | [Degayo 자체 생산 소개](https://degayotour.com/gayo-arabica-specialty-coffee-producer-by-degayo-group/)에서 Gayo 소재 농장과 Abyssinia, Ateng, Gayo 1·2, Timtim, Bourbon, P88, Super Ateng 연결 확인. |
| `indonesia-lintong` | 3 | [Covoya P612744-2](https://www.covoyacoffee.com/p612744-2-indonesia-sumatra-lintong-wethulled.html): Lintong Nihuta 소농, 수집상 Rumani Hutasoit, Ateng·Jember·Sigararutang. 2023/24 로트. |
| `indonesia-west-java` | 7 | [Nordic Approach 생산자 공급 설명](https://www.nordicapproach.no/origin/indonesia)과 [Frinsa 기사](https://www.nordicapproach.no/post/what-makes-our-indonesian-coffee-so-special)를 함께 확인. Sigararutang·S795·Andungsari·Typica·Ateng Super·P88·Borbor. Frinsa는 자체 농장과 주변 소농의 가공도 담당하므로 모든 묘목을 단일 필지에 귀속시키지 않음. |
| `indonesia-toraja` | 2 | [Sulotco 자체 상품 자료](https://toraja.coffee/id/produk/)가 Rantekarua, Toraja와 S795·Catuai를 명시. USDA는 번호 미공개로 제외. |
| `indonesia-bajawa` | 1 | [Sucafina Laga Lizu](https://sucafina.com/na/offerings/flores-laga-lizu-anaerobic-honey): Wolo Wio 소농 그룹, Bajawa 문맥, Linie S-795/Jember 확인. Laga Lizu를 개인 농장명으로 해석하지 않음. |
| `papua-new-guinea-eastern-highlands` | 3 | [Sucafina Konkua](https://sucafina.com/emea/offerings/konkua-washed-organic): Konkua Cooperative, Kainantu/Obura Wonenara, Eastern Highlands 및 Arusha·Mundo Novo·Typica 확인. |
| `papua-new-guinea-western-highlands` | 3 | [Crop to Cup Mong 생산자 문서](https://www.croptocup.com/community/mong-coffee/?community=161735): Western Highlands, Mong Coffee/Rexson Raguni, Blue Mountain·Mundo Novo·Caturra 확인. |
| `india-karnataka` | 0 | Chikmagalur·Bababudangiri·Coorg에서 확인한 생산자 근거를 하위 ID에 저장. 다른 인도 지역의 품종 목록을 일괄 추가하지 않음. |
| `india-kerala` | 0 | Wayanad 지역 소개와 생산자 상품을 조사했으나 이번 생산자별 품종 기준을 충족하는 추가 자료 없음. Robusta를 품종으로 새로 만들지 않음. |
| `india-chikmagalur` | 4 | [Blue Tokai Kerehaklu](https://bluetokaicoffee.com/pages/kerehaklu-estate): Thipaiah 가족 농장의 Chandragiri·Selection 795·Selection 9·Selection 6. Anokhi Liberica는 수종/선발명 구분 자료 부족으로 제외. |
| `india-bababudangiri` | 1 | [Covoya Ratnagiri 2024/25](https://uk.covoyacoffee.com/india-ratnagiri-vacuum-process-nano.html): Ashok Patre, Line Patte 필지의 Cauvery, Bababudangiri. 공급사만 있는 지역 상품보다 구체적인 농장 로트 채택. |
| `india-coorg` | 3 | [Agastya Kogilahalla Kent](https://www.agastyacoffee.com/product-page/kent-microlot), [SICC Mooleh Manay Selection 6](https://southindiacoffeeco.com/germplasm/selection-6/), [Coffee Board 2019 Sandalkad CxR](https://hcikl.gov.in/pdf/Winning_Coffees_Brochure.pdf) 확인. 마지막 자료는 PDF 17쪽의 과거 출품 기록. |
| `india-wayanad` | 0 | [Coffee Board의 지역 자료](https://coffeeboard.gov.in/coffee-regions-india.html)는 품종 후보를 알려주지만 특정 생산자를 증명하지 않음. 아래 후보 제외 기록 참조. |
| `vietnam-da-lat` | 4 | [K’Ho 자체 자료](https://www.khocoffee.com/new-page)의 Langbiang 가족 협동조합 Typica·Bourbon·Yellow Bourbon과 [Coffeevine의 2024년 판매 로트/직접 인터뷰](https://thecoffeevine.com/blog/giving-you-a-taste-of-vietnams-finest-coffees/)의 Radar Farms THA1. |
| `vietnam-buon-ma-thuot` | 1 | [대회 운영 협회의 Đạm Coffee Farm 항목](https://caphedacsanvietnam.vn/products/dam-coffee-farm-1)은 실제 원료 재배지 Buôn Yao/Ea Tul과 Robusta TR4를 구분해 명시. [공식 GI 범위](https://www.ipvietnam.gov.vn/vi/web/english/domestic-ip-activities/-/asset_publisher/ZMuTgR44COLR/content/amendment-of-geographical-indication-registration-certificate-buon-ma-thuot-for-coffee-products?inheritRedirect=false)에 Ea Tul 포함 확인. 도시 사무실 주소를 재배지로 사용하지 않음. |
| `vietnam-cau-dat` | 1 | [The Married Beans 생두 상품](https://www.themarriedbeans.com/en/products/ca-phe-nhan-xanh-cau-dat)의 Catimor와 [자체 생산자 소개](https://www.themarriedbeans.com/en/pages/about)의 Cau Dat 협력 농가 관계 확인. 개별 농가 이름은 미공개이므로 생산자 그룹 단위로 저장. |
| `yemen-haraaz` | 4 | [Royal Coffee CJ1645](https://cdn.royalcoffee.com/wp-content/uploads/2025/10/20193140/Crown-Jewel-Yemen-Anaerobic-Natural-Sharqi-Haraz-Cooperative-CJ1645.pdf): Eastern Haraz, Sharqi Haraz/Pearl of Tehama의 Jadi·Dawaery·Tuffahi·Jufini. 유전자군을 확정한 값이 아닌 현지 농가 전통 명칭임을 문서가 직접 설명. |
| `yemen-mattari` | 1 | [Coffee Tech Lot 205](https://www.coffee-tech.co.nz/product/yemen-udaini-ameer-al-matari-lot-205/): Bani Matar의 Al-Qudamah, Ameer Al-Matari, Udaini. Mattari 자체를 품종으로 만들지 않음. |

## 표기와 지리 처리

- `S.795`, `S 795`, `Selection 795`, `Lini S795`, `Linie S-795`는 `S795`로 기록했다. Kayumas 자료의 `sln795`도 이 표기와 연결했다. `Selection 9`와 `Selection 6`은 자료의 명칭을 보존했으며 케냐 SL 품종으로 오인할 수 있는 `SL9`·`SL6`을 새 표준명으로 만들지 않았다.
- Bajawa 자료는 S795/Jember를 같은 항목으로 기재하므로 한 건만 저장했다. Lintong의 품종란은 Jember이므로 그대로 보존했다. 개별 계보의 부모 Kent·S288 등은 추가하지 않았다.
- `THA1`은 원문의 `Tha1`을 대문자로 표시한 것이다. `TH1`과 같은 것으로 합치지 않았다. 부온마투옷 TR4는 로부스타 품종이며 달랏의 아라비카 항목으로 옮기지 않았다.
- 예멘의 `Dawaery`·`Tuffahi`는 해당 로트 문서의 철자다. 요청 후보 Dawairi·Tufahi에 대응하는 표기 후보지만, 이름만으로 유전적 동일성이나 다른 지역의 재배를 추정하지 않는다. Udaini 역시 판매 로트의 전통 품종 표기 수준으로 보존한다.
- 기존 산지 ID는 커피 유통상의 지리를 사용한다. Buon Ma Thuot는 확인된 GI 재배 범위 연결이고, Mattari는 Bani Matar 생산지가 명시된 사례만 사용했다. 어느 경우도 도시나 유통 명칭을 행정구역 전체와 동일하다고 단정하지 않았다.

## 제외 후보와 확인 한계

- **와야나드/케랄라:** 지역 자료의 S274·CxR·Peridenia 후보를 조사했다. Black Baza의 Thomas/Luna 생산 사례는 Robusta 수종까지만 확인되어 품종을 추정하지 않았다. India Coffee Company의 [Wayanad 상품](https://indiacoffee.co/our-coffees/wayanad-robusta-natural/)과 관련 목록에 나타난 `Robusta (Kent)`는 수종/품종 혼선이 있어 새 Kent 근거로 채택하지 않았다. 이를 이유로 지역 내 Kent가 없다고 단정하지도 않는다.
- **인도 품종 계보:** Agastya의 Kent 기원 설명, SICC의 Selection 6 계보 설명은 이번 재배 근거에 필요하지 않아 옮기지 않았다. Coffee Board의 과거 수상 표는 Sandalkad CxR 연결에만 사용했으며 모든 출품 로트를 현재 재배·현행 수상 결과로 확대하지 않았다.
- **PNG 행정 경계:** 오래된 자료의 Madan/Banz/Kindeng를 Western Highlands에 일괄 넣지 않았다. Jiwaka 또는 Chimbu와 혼재하는 지역 표기 후보는 제외하고 현재 공급사 문서가 Western Highlands를 명시한 Mong을 채택했다. Bomai 자료의 Chimbu/Eastern Highlands 혼선도 이번 목록에서 제외했다.
- **인도네시아:** Sulotco의 번호 없는 `USDA`는 `USDA 762` 근거가 아니다. `Lini S`만 있는 경우도 번호를 생성하지 않고 별도 명시가 있는 Frinsa cultivar 목록을 함께 사용했다. Degayo의 Gayo 농장 소개에서 명시한 8개 품종은 모두 포함했다. `Super Ateng`은 해당 생산자 원문 철자를 보존했다.
- **베트남:** K’Ho의 `catura hybrid`는 정확한 이름이 불분명해 Caturra로 교정해 추가하지 않았다. [CQI Ray Rung 보고서](https://database.coffeeinstitute.org/api/coffee/146375/pdf)의 Catimor/TH1/THA1은 지역을 Da Lat로 확정할 근거가 부족하여 제외했다. Cau Dat Bourbon 로스터 상품은 확인했지만 해당 상품의 재배 생산자명이 확인되지 않아 새 생산자 근거로 쓰지 않았다. Ea Tan 협동조합이나 다른 Krong Nang 생산자의 TR4/TR9도 특정 농장의 GI 지역 연결이 부족하여 부온마투옷에 넣지 않았다.
- **접근 방식:** 최종 채택 자료는 웹 도구의 본문 또는 원본 PDF 텍스트를 읽었다. GI 영문 자료는 검색 결과가 제공한 본문의 지리 목록에서 Ea Tul을 확인했으며, 일부 직접 열기가 실패했던 사실을 숨기지 않는다. 초기 Dandy Mong 상품과 Sandalkad 상품의 직접 열기가 실패해 각각 Crop to Cup PDF와 Coffee Board 원본 브로슈어로 대체했다. 검색 제목만으로 새로운 품종을 채택하지 않았다.
- **범위:** 로트/생산자 공개 자료의 신고 품종을 검토한 것으로 현장 표본 수집이나 DNA 검증은 아니다. 새 목록은 문헌 근거의 보강이며 기존 각 지역의 품종 목록을 모두 제거하거나 대체하는 데이터는 아니다.

## 검증

지역 ID 존재 여부, 필수값·출처 누락, 지역/품종/생산자 조합 중복, 출처 날짜와 URL 형식을 검사했다. 결과: 48건, 직접 지역 16개, 고유 출처 URL 22개. 새 TypeScript 파일의 ESLint 검사 통과. 전체 앱 검사는 상위 통합 작업에서 수행한다.
