# 추가 품종 검증 — 2026-09-09

대상: `extended.ts`의 21개 항목. 품종 사전과 기존 산지의 실제 품종 문자열 사이의 빈 부분을 보강했다. 상위 계통명과 세부 선발종을 자동 동의어로 합치지 않는다. 이 문서는 내부 기록이다.

## 필드별 근거

| 항목 | 채택한 내용 | 원문 근거 |
| --- | --- | --- |
| JARC 74158 | Jimma 선발종; compact canopy; Elto의 실제 향미 | [EIAR/JARC·IITA 저자의 2020 연구](https://biblio.iita.org/documents/U20ArtAlemsegedCoffeeNothomDev.pdf-7dd1e70e8729e046e2cc75adb578af81.pdf), Table 4와 [September Elto](https://september.coffee/en-us/products/elto-natural-2026) |
| Catiope | Laderas del Tapias·El Mirador에서 쓰는 명칭; Neira 1,900m; Five Senses 로트의 사과·누가·허브 | [생산자 명의 KunDe LDT-001](https://www.kundecoffee.com/shop/ldt-001/), [Five Senses](https://fivesenses.com.au/products/el-mirador-colombia) |
| Yellow Catuai | 황색 열매 계통군; Mundo Novo × Yellow Caturra; 낮은 수고·1972년부터 보급 | [IAC O Agronômico 59(1)](https://www.iac.sp.gov.br/media/publicacoes/oagronomico_volume_59.pdf), 인쇄 14쪽; [IAC Coffee Program](https://www.iac.sp.gov.br/produtoseservicos/orgulhonacional/programa_cafe.php?lang=en) |
| Yellow Caturra | 황색·낮은 수고; Bourbon 또는 Red Caturra의 자연 변이; IAC 476 녹병 감수성 | 같은 IAC 59(1) 14쪽 및 Coffee Program. 부모 대안을 하나로 단정하지 않음 |
| Yellow Bourbon | 황색 재료와 복수 IAC 선발 계통; 품질용 J2/J9/J10/J19/J20/J22/J24 | IAC Coffee Program. 유전적 기원은 변이/교잡 설명이 병존하므로 계보 필드 생략 |
| Arara | 황색; Sarchimor 1669-20 재배지 발견; 제안된 다른 부모 Icatu 2944; Sul de Minas·Cerrado | [Procafé 연구 회보](https://www.fundacaoprocafe.com.br/en/_files/ugd/782db7_ba4c6b37e37c4916be3c2ad961a4d627.pdf), [Procafé 카탈로그](https://cultivares.fundacaoprocafe.com.br/) |
| Anacafe 14 | 2014 보급; Catimor × Pacamara 추정; 큰 생두·만숙·가뭄 내성 | [WCR](https://varieties.worldcoffeeresearch.org/varieties/anacafe-14), History·Agronomics |
| Catigua | 서로 다른 이름 MG2/MGS Catiguá 3가 존재하는 계통명 | [EPAMIG의 주정부 종자 공고](https://www.mg.gov.br/agricultura/noticias/epamig-comercializa-sementes-de-cafe-da-safra-20232024). MG2 특성을 일반 Catigua로 확대하지 않음 |
| Catiguá MG2 | IAC 86 × HT UFV 440-10; 붉은 열매·낮은 수고·작은 생두·녹병 저항·단기 건조 내성 | [EPAMIG Circular Técnica 353](https://livrariaepamig.com.br/wp-content/uploads/2023/02/ct-353.pdf), 2쪽 |
| Topázio MG 1190 | 황색·낮은 수고·비교적 균일 숙성·강한 생장·녹병 감수성; 교잡 후 되돌이교배 | [EPAMIG CT33](https://livrariaepamig.com.br/wp-content/uploads/2023/03/CT-33.pdf), [CT353](https://livrariaepamig.com.br/wp-content/uploads/2023/02/ct-353.pdf), 3쪽 |
| Acauã | 낮은 수고·녹병 저항; Mundo Novo IAC 388-17 × Sarchimor | [IAC 시험 Table 1](https://www.iac.sp.gov.br/areadoinstituto/ciiciac/resumo2014/RE14107.pdf), Procafé 회보 |
| Tupi | IAC 낮은 수고·녹병 저항; Villa Sarchi × HT832/2 | IAC Coffee Program와 같은 IAC 시험 Table 1 |
| K7 | French Mission/Bourbon 배경·Kenya/Tanzania·키 큼·큰 생두·CBD 내성 | [WCR K7](https://varieties.worldcoffeeresearch.org/varieties/k7) |
| Mibirizi | Rwanda/Burundi·Typica 추정·큰 키·가뭄 내성·주요 질병 감수성 | [WCR Mibirizi](https://varieties.worldcoffeeresearch.org/varieties/mibirizi) |
| Jackson | Mysore에서 동아프리카로 전래; Bourbon 유전 그룹 | [WCR Jackson History](https://varieties.worldcoffeeresearch.org/varieties/jackson-2-1257) |
| Jackson 2/1257 | RAB가 Jackson에서 선발; 높은 키·활력·수량; 큰 생두·녹병/CBD 감수성 | 같은 WCR의 해당 선발종 필드 |
| N39 | Bourbon 선발 계통; Songwe Mimba 단일 품종 워시드 | [Covoya Mimba](https://uk.covoyacoffee.com/tanzania-ab-mimba.html). N39-1…N39-12 개량종의 수량·저항성을 전용하지 않음 |
| Blue Mountain | Typica 관련 명칭; Mugaya 재배 사례 | [WCR Typica names](https://varieties.worldcoffeeresearch.org/varieties/typica), [Sucafina Mugaya](https://sucafina.com/na/offerings/mugaya-pb) |
| Sudan Rume | F1 육종 부모; CGLE 재배; PT's 내추럴의 실제 향미 | [WCR Milenio](https://varieties.worldcoffeeresearch.org/varieties/milenio), [PT's Coffee](https://ptscoffee.com/products/sudan-rume-natural) |
| KP423 | Kent 선발·Lyamungu 보급·Uganda·높은 키·가뭄 내성·CBD 감수성 | [WCR KP423](https://varieties.worldcoffeeresearch.org/varieties/kp423) |
| Nyasaland | Malawi→Uganda/Elgon; Typica 추정·큰 키·저투입 적응·질병 감수성 | [WCR Nyasaland](https://varieties.worldcoffeeresearch.org/varieties/nyasaland) |

## 접근·판단 기록

- WCR, IAC, EPAMIG PDF, IITA PDF, Covoya, KunDe, Five Senses, PT's, September, Sucafina는 원문 열기로 확인했다. WCR KP423은 직접 열기가 반복 타임아웃됐지만 검색 도구가 전체 필드와 History를 반환해 이를 확인했다.
- Procafé의 현재 카탈로그는 동적 문서로 원문 추출 결과가 비어 있었다. 검색 색인의 품종별 전문을 확인했다. 2024 회보도 직접 열기에 실패해 검색 도구가 반환한 해당 논고 본문을 사용했다. 검증 방식을 원문 열기 성공으로 기록하지 않는다.
- Arara의 Icatu 2944 부모는 연구기관 원문 자체가 `provavelmente`로 표현하므로 추정으로 유지한다.
- Catiguá MG2는 IAC의 오래된 시험 표에서 HT UFV446로 적힌 반면 EPAMIG 육성기관의 CT353는 UFV440-10으로 명시한다. 최신 육성기관의 명시 계보를 사용했다. EPAMIG 웹 종자 목록의 검색 발췌에 섞인 IAC30 × UFV445-46은 MGS Paraíso 2 설명이므로 MG2에 사용하지 않았다.
- 74158의 도입/보급 연도는 자료의 1974·1979·1987이 서로 다른 사건을 가리키거나 혼용된다. 연도를 쓰지 않았다. IITA 보관 연구 Table 4의 수관형 분류만 채택했다. September의 내추럴 공정 설명에 pulped 표현이 섞여 있어 공정 해설을 가져오지 않고 상품의 명시된 내추럴·향미만 채택했다.
- Catiope는 Caturra × Ethiopian, Castillo × Ethiopian 등 상이한 설명이 있어 계보를 확정하지 않았다. 생산자 등록 상품과 로스터의 직접 취급 로트로 존재·재배 위치·향미를 확인했다. 공발효 과일 향미를 고유 품종 향미로 옮기지 않았으며 Five Senses의 워시드 로트를 특정했다.
- Blue Mountain은 WCR가 Typica의 다른 이름으로 다루고 Sucafina는 변이로 설명한다. `trade-name`으로 보존하며 Typica의 자동 별칭에 병합하지 않았다. Sucafina의 하와이/Kona 지리 표현과 CBD 저항 주장도 채택하지 않았다. 자메이카 산지 인증과 동일시하지 않는다.
- Jackson과 Jackson 2/1257을 별개로 두었다. Tupi RN, Acauã Novo, Catiguá MG2를 일반 Tupi/Acauã/Catigua의 alias로 합치지 않았다. Yellow Catuai 세부 IAC 계통도 하나의 동일 유전형으로 간주하지 않는다.
- Sudan Rume의 자생지·희귀성·전 품종 향미를 일반화하지 않았다. WCR와 로스터는 역할이 다르다: WCR는 육종 부모, PT's는 실제 로트 재배/향미 근거다.

## 검사

기존 71개와 신규 21개를 합친 인덱스 생성 성공: 92개, 상충하는 정규화 별칭 없음. 공용 `index.ts`와 UI는 수정하지 않았으며 최종 통합은 상위 작업에서 수행한다.
