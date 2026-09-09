# 아프리카 산지별 품종 근거 조사

검토일: 2026-09-08. 기존 26개 산지를 모두 훑고 생산자·농장·스테이션과 품종이 함께 확인되는 근거를 별도 파일 `../variety-research/africa.ts`에 저장했다. 기존 산지 데이터는 수정하지 않았다.

결과: 생산자–품종 기록 56개, 직접 연결 산지 22개, 1차 출처 23개. 예가체프·시다마·니에리의 상위 집계를 포함하면 25개 산지에 구체적 근거가 연결된다. 하라르는 이번에 확인한 자료가 Heirloom 수준에 그쳐 세부 품종을 추가하지 않았다. 동일 사실을 상위 산지와 하위 산지에 중복 생성하지 않았다.

## 26개 산지별 스캔

| 산지 | 확인한 생산 단위·출처 | 결과 |
| --- | --- | --- |
| Ethiopia / Yirgacheffe | [예가체프 유통명·Gedeb 생산지 명시](https://www.touton-specialty-coffee.com/en/p11556), Kochere·Gedeb 근거 | 하위 산지로 기록. 상위에서 집계할 대상이며 별도 중복 없음. |
| Ethiopia / Guji | [Suke Quto / Tesfaye Bekele](https://www.trabocca.com/our-coffees/ethiopia/guji/suke-quto-farm/) | Kurume, Welicho. 함벨라·우라가 기록은 하위에 유지. |
| Ethiopia / Sidama | [Alemayehu Barasa](https://sucafina.com/na/offerings/alemayehu-barasa-sidamo-natural-gr-1-lalisaa) | 실제 지역 Dembi/Bensa가 명시되어 Bensa에 기록. |
| Ethiopia / Limu | [Limmu Kossa Family Estate](https://thissideup.coffee/coffee-passport-special-roast-ethiopia) | 74110, 74112, 74165. 농장 소재·품종을 함께 확인. |
| Ethiopia / Harrar | [Keffa Harrar Gr 1](https://keffacoffee.com/coffees/ethiopia-harrar-gr-1), [Vournas Harrar Longberry](https://www.vournascoffee.com/product/ethiopia-harrar-longberry-natural/) | 구체 품종 미확보. Longberry·Gr 4를 품종으로 생성하지 않음. |
| Ethiopia / Kochere | [Adisu Halchaye / Fisiha Genet](https://sucafina.com/na/offerings/adisu-halchaye-kochere-natural-gr-1) | JARC 74110, 74112. 미특정 landraces는 추가 분해하지 않음. |
| Ethiopia / Gedeb | [Tariku Mengesha / Banko Chelchele](https://cdn.royalcoffee.com/wp-content/uploads/2018/10/21123013/CJ1246_Ethiopia-Banko-Chelchele-Tariku-Mengesha-Raised-Bed-Natural-Crown-Jewel.pdf), [SNAP / Chelbesa](https://www.touton-specialty-coffee.com/en/p11556) | Kurume, Wolisho, 74110, 74112와 Dega. 첫 자료는 2017 수확 기록임을 출처 제목에 남김. |
| Ethiopia / Bensa | [Alemayehu Barasa / Dembi](https://sucafina.com/na/offerings/alemayehu-barasa-sidamo-natural-gr-1-lalisaa) | JARC 74110, 74112. 생산자명으로 확인. |
| Ethiopia / Hambela | [Kebede Genale / Buku](https://sucafina.com/na/offerings/kebede-genale-hambela-natural-gr-1) | JARC 74110, 74112, 74158. |
| Ethiopia / Uraga | [Zelalem Alemu Washing Station](https://www.allycoffee.com/coffees/guji-uraga-natural/) | 74110, 74112. 가공명이 아닌 품종 항목·본문으로 확인. |
| Kenya / Nyeri | [Kagere](https://sucafina.com/na/offerings/kagere-nyeri-ab), [Kimabara](https://sucafina.com/na/offerings/kimabara-nyeri-aa) | Othaya·Karatina로 좁혀 기록. |
| Kenya / Kirinyaga | [Kiangothe Factory](https://sucafina.com/na/offerings/kiangothe-kirinyaga-aa) | SL28, SL34, Ruiru 11, Batian을 생산자 단위로 확인. |
| Kenya / Kiambu | [Wamuguma Factory / Ritho FCS](https://www.sucafina.com/emea/offerings/wamuguma-kiambu-pb) | 기존 이보니아 사례에 없던 Ruiru 11·Batian 근거 확보. SL28·SL34도 명시. |
| Kenya / Muranga | [Murarandia Factory](https://sucafina.com/na/offerings/murarandia-muranga-aa) | SL28, SL34, Ruiru 11, Batian 확인. 지명 충돌이 있던 Theri 대신 사용. |
| Kenya / Othaya | [Kagere Factory / Othaya FCS](https://sucafina.com/na/offerings/kagere-nyeri-ab) | 네 품종 확인. 직접 연결은 Othaya. |
| Kenya / Karatina | [Kimabara Factory / Mugaga FCS](https://sucafina.com/na/offerings/kimabara-nyeri-aa) | 네 품종 확인. 표의 Kiambara와 본문·제목 Kimabara 차이는 제목·본문 표기로 유지. |
| Rwanda / Nyamasheke | [Macuba Washing Station](https://sucafina.com/na/offerings/macuba-natural) | Bourbon, Jackson 확인. Cyato는 하위 기록. |
| Rwanda / Huye | [Gift Coffee / Shyembe, Maraba](https://www.njdouek.com/fr/product/default?id=0Pm8AUfrl9B8Y1q2SM79) | Red Bourbon, Jackson 2/1257, Mibirizi, Catuai. Catuai의 색상 계통은 미특정. |
| Rwanda / Gakenke | [Abakundakawa / Rushashi](https://thissideup.coffee/rushashi) | French Mission, Jackson 추가. 원문의 계보 분류는 옮기지 않음. |
| Rwanda / Cyato | [Cyato Washing Station](https://sucafina.com/emea/offerings/cyato-nyamasheke-anaerobic-natural) | Red Bourbon 확인. |
| Burundi / Kayanza | [Kibingo Washing Station](https://sucafina.com/emea/offerings/kibingo-natural) | Red Bourbon 확인. 국가 개괄의 다른 품종을 덧붙이지 않음. |
| Burundi / Ngozi | [Rama Women's Association](https://sucafina.com/apac/offerings/rama-women-association-ngozi-natural) | Red Bourbon 확인. Gatukuza는 하위 기록. |
| Burundi / Gatara | [Gakenke Washing Station](https://sucafina.com/na/offerings/gakenke-fully-washed) | Red Bourbon 확인. 르완다 Gakenke와 분리. |
| Burundi / Gatukuza | [Gatukuza / Therence Nduwayezu](https://www.list-beisler.coffee/media/pdf/BUR_FW_Scr15_Long_Miles_Coffee_Washed_Gatukuza_POSTCARD.pdf) | Bourbon 확인. 색상 계통을 추정하지 않음. |
| Tanzania / Kilimanjaro | [Kilimanjaro Plantation 자체 자료](https://kilimanjaro-plantation.com/?page_id=25) | N39, Batian. 농장 위치와 품종이 같은 사이트에 명시. |
| Tanzania / Mbeya | [Idiwili AMCOS](https://www.atlascoffee.com/coffees/idiwili-amcos/) | N39, KT 423. 품종 비율과 계보 설명은 데이터에 옮기지 않음. |

## 채택하지 않은 정보와 표기 원칙

- 원두 등급 AA·AB·PB·Gr 1·Gr 3 및 Longberry 상품명을 별도 품종으로 등록하지 않았다.
- 국별 안내의 품종 목록만으로 특정 산지·생산자에 배정하지 않았다. 특히 Tanzania Aviv Estate의 compact 자료는 기존 Kilimanjaro·Mbeya 두 지역의 근거로 쓰지 않았다.
- Kilimanjaro Plantation의 `N:39`는 구두점만 정리해 `N39`로 기록했다. 같은 페이지의 `KP`를 Kent 또는 KP423으로 임의 확장하지 않았다. 수입사 상품의 Arusha 표기와 농장명만으로 다른 위치를 단정하지 않고 생산자 자체 자료를 택했다.
- Atlas의 `KT 423`는 그 표기를 유지했다. `KP423`과 동의어로 연결하거나 계보를 추정하지 않았다.
- `Welicho`와 `Wolisho`는 각각 원 출처 표기를 보존했다. 지역별 통칭이나 유전적 동의어를 새로 단정하지 않았다.
- This Side Up의 Rushashi 자료에는 `Mbirizi`와 `Pop 3303/21`도 있으나, 표기·식별을 충분히 추가 대조하지 못해 이번 기록에는 넣지 않았다. Huye의 Mibirizi는 별도의 생산자 자료로 확인했다.
- `JARC 74110`·`JARC 74112`는 기존 데이터의 표시 형식과 맞췄다. 74165는 확인한 출처의 숫자 표기를 유지했다. Limmu Kossa 자료의 나머지 숫자들은 추가 대조 없이 확대하지 않았다.
- Opal Chelbesa PDF와 Touton PDF 경로는 본문 접근이 실패했다. Gedeb은 읽을 수 있는 Royal PDF와 Touton 상품 본문으로 대체했다. Mengeshe Gumi 관련 자료는 조사했지만 중복 기록을 만들지 않았다.
- 유통 자료의 품종 표시는 해당 생산자·공급 농가 사례에 대한 근거다. 유전자 검사 결과, 모든 농가의 품종 전수 통계 또는 2026년 재고를 뜻하지 않는다. 이 설명은 감사 문서에만 보관한다.

## 파일 검증

56개 기록의 regionId를 기존 26개 지역과 대조했다. 빈 생산자·품종·출처, 동일 산지·생산자·품종 중복, 잘못된 출처 날짜가 없음을 확인했다. 상위 집계를 포함한 커버리지는 25개이며 미확보 지역은 Harrar 1개다. 해당 TypeScript 파일의 ESLint 검사도 통과했다. 원본 파일 변경 없이 이 증거 모듈만 통합할 수 있다.
