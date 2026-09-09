import type { CoffeeVarietyGuide } from "./types.ts";

const t = (ko: string, en: string) => ({ ko, en });
const s = (title: string, publisher: string, url: string) => ({ title, publisher, url, accessedAt: "2026-09-09" });
const wcr = (slug: string, title: string) => s(`Arabica varieties: ${title}`, "World Coffee Research", `https://varieties.worldcoffeeresearch.org/varieties/${slug}`);
const iacProgram = s("Coffee Program — cultivars", "Instituto Agronômico (IAC)", "https://www.iac.sp.gov.br/produtoseservicos/orgulhonacional/programa_cafe.php?lang=en");
const iac59 = s("Cultivares de café arábica do IAC — O Agronômico 59(1), pp. 12–15", "Instituto Agronômico (IAC)", "https://www.iac.sp.gov.br/media/publicacoes/oagronomico_volume_59.pdf");
const iacTrial = s("Qualidade intrínseca de cultivares de cafeeiro arábica resistentes à ferrugem — Table 1", "Instituto Agronômico (IAC)", "https://www.iac.sp.gov.br/areadoinstituto/ciiciac/resumo2014/RE14107.pdf");
const epamig353 = s("Conheça algumas cultivares de café Arábica da EPAMIG — Circular Técnica 353", "EPAMIG", "https://livrariaepamig.com.br/wp-content/uploads/2023/02/ct-353.pdf");
const epamig33 = s("Cultivares de café — Circular Técnica 33", "EPAMIG", "https://livrariaepamig.com.br/wp-content/uploads/2023/03/CT-33.pdf");
const procafe = s("Catálogo de Cultivares de Café Arábica", "Fundação Procafé", "https://cultivares.fundacaoprocafe.com.br/");
const procafeResearch = s("Folha Técnica 2024 — Arara: origem e produtividade; seleções de Acauã", "Fundação Procafé", "https://www.fundacaoprocafe.com.br/en/_files/ugd/782db7_ba4c6b37e37c4916be3c2ad961a4d627.pdf");

export const extendedVarietyGuides: CoffeeVarietyGuide[] = [
  {
    id: "jarc-74158", name: "JARC 74158", nameKo: "JARC 74158", aliases: ["74158"], classification: "selection",
    summary: t("에티오피아 Jimma 연구소가 보급한 아라비카 선발 계통입니다.", "An Arabica selection released by Ethiopia's Jimma research centre."),
    growing: t("연구 시험에서 수관이 작은 그룹으로 분류됐습니다.", "Classified in the compact-canopy group in research trials."),
    traits: t("September의 Elto 내추럴 로트는 블랙베리·라즈베리와 가벼운 바디를 보입니다.", "September's Elto natural lot shows blackberry, raspberry and a light body."),
    sources: [s("Coffee peaberry as a potential seed source for production — Table 4", "EIAR / IITA research authors", "https://biblio.iita.org/documents/U20ArtAlemsegedCoffeeNothomDev.pdf-7dd1e70e8729e046e2cc75adb578af81.pdf"), s("Elto — Natural 74158", "September Coffee", "https://september.coffee/en-us/products/elto-natural-2026")],
  },
  {
    id: "catiope", name: "Catiope", nameKo: "카티오페", aliases: ["Catíope"], classification: "trade-name",
    summary: t("콜롬비아 Laderas del Tapias와 El Mirador에서 재배하는 커피 명칭입니다.", "A coffee name used at Colombia's Laderas del Tapias and El Mirador farms."),
    growing: t("Laderas del Tapias는 네이라의 해발 1,900m에서 워시드 로트를 생산합니다.", "Laderas del Tapias produces a washed lot at 1,900 metres in Neira."),
    traits: t("Five Senses의 El Mirador 워시드 로트는 붉은 사과·누가·허브 향미를 보입니다.", "Five Senses' El Mirador washed lot shows red apple, nougat and herbal notes."),
    sources: [s("Catiope Washed Bioreactor Manantial Vivo — Laderas del Tapias", "KunDe Coffee / Laderas del Tapias", "https://www.kundecoffee.com/shop/ldt-001/"), s("El Mirador — Colombia", "Five Senses Coffee", "https://fivesenses.com.au/products/el-mirador-colombia")],
  },
  {
    id: "yellow-catuai", name: "Yellow Catuai", nameKo: "옐로 카투아이", aliases: ["Yellow Catuaí", "Catuaí Amarelo", "Catuai Amarelo"], classification: "population",
    summary: t("노란 열매가 익는 카투아이 계통군입니다.", "A group of yellow-fruited Catuai cultivars."),
    lineage: t("Mundo Novo와 Yellow Caturra의 교배에서 유래했습니다.", "Derived from Mundo Novo crossed with Yellow Caturra."),
    growing: t("키가 작으며 IAC가 1972년부터 여러 선발 계통을 보급했습니다.", "Compact selections released by IAC from 1972 onward."),
    sources: [iac59, iacProgram],
  },
  {
    id: "yellow-caturra", name: "Yellow Caturra", nameKo: "옐로 카투라", aliases: ["Caturra Amarelo"], classification: "selection",
    summary: t("노란 열매를 맺는 키 작은 카투라입니다.", "A compact, yellow-fruited Caturra."),
    lineage: t("브라질에서 Bourbon 또는 Red Caturra의 자연 돌연변이로 나타났습니다.", "A natural mutation of Bourbon or Red Caturra found in Brazil."),
    traits: t("IAC의 Yellow Caturra 476은 녹병 감수성으로 분류됩니다.", "IAC classifies its Yellow Caturra 476 as rust-susceptible."),
    sources: [iac59, iacProgram],
  },
  {
    id: "yellow-bourbon", name: "Yellow Bourbon", nameKo: "옐로 버번", aliases: ["Bourbon Amarelo", "Bourbon Amarillo"], classification: "population",
    summary: t("노란 열매를 맺는 버번 계통으로, 브라질 IAC가 여러 계통을 선발했습니다.", "Yellow-fruited Bourbon material with several selections maintained by Brazil's IAC."),
    traits: t("IAC는 J2·J9·J10·J19·J20·J22·J24를 우수한 음료 품질의 선발 계통으로 소개합니다.", "IAC lists J2, J9, J10, J19, J20, J22 and J24 among its high cup-quality selections."),
    sources: [iacProgram],
  },
  {
    id: "arara", name: "Arara", nameKo: "아라라", aliases: [], classification: "cultivar",
    summary: t("브라질에서 선발한 노란 열매의 다수성 품종입니다.", "A productive, yellow-fruited cultivar selected in Brazil."),
    lineage: t("Sarchimor 1669-20 재배지에서 발견됐으며 다른 부모는 Icatu 2944로 추정됩니다.", "Found among Sarchimor 1669-20 plants; Icatu 2944 is the proposed other parent."),
    growing: t("술 지 미나스와 세하두 미네이루에서 널리 재배됩니다.", "Widely planted in Sul de Minas and Cerrado Mineiro."),
    sources: [procafeResearch, procafe],
  },
  {
    id: "anacafe-14", name: "Anacafe 14", nameKo: "아나카페 14", aliases: ["Anacafé 14", "Anacafe14"], classification: "cultivar",
    summary: t("과테말라 ANACAFÉ가 2014년 보급한 키 작은 품종입니다.", "A compact cultivar released by Guatemala's ANACAFÉ in 2014."),
    lineage: t("Catimor와 Pacamara의 자연 교배에서 유래한 것으로 추정됩니다.", "Believed to originate from a natural Catimor–Pacamara cross."),
    growing: t("생두가 매우 크고 열매가 늦게 익으며 가뭄 내성이 있습니다.", "Very large beans, late ripening and drought tolerance."),
    sources: [wcr("anacafe-14", "Anacafe 14")],
  },
  {
    id: "catigua", name: "Catigua", nameKo: "카티구아", aliases: ["Catiguá"], classification: "population",
    summary: t("EPAMIG의 Catiguá MG2·MGS Catiguá 3 등 여러 선발 품종에 쓰이는 계통명입니다.", "A name shared by distinct EPAMIG selections including Catiguá MG2 and MGS Catiguá 3."),
    sources: [s("Epamig comercializa sementes de café da safra 2023/2024", "Governo de Minas Gerais / EPAMIG", "https://www.mg.gov.br/agricultura/noticias/epamig-comercializa-sementes-de-cafe-da-safra-20232024")],
  },
  {
    id: "catigua-mg2", name: "Catiguá MG2", nameKo: "카티구아 MG2", aliases: ["Catigua MG2", "Catiguá MG 2", "Catigua MG 2", "Catiguá-MG2"], classification: "cultivar",
    summary: t("EPAMIG가 육성한 붉은 열매의 키 작은 품종입니다.", "A compact, red-fruited cultivar bred by EPAMIG."),
    lineage: t("Yellow Catuai IAC 86 × Timor Hybrid UFV 440-10.", "Yellow Catuai IAC 86 × Timor Hybrid UFV 440-10."),
    traits: t("생두가 작고 중간 시기에 익으며, 녹병 저항성과 짧은 가뭄에 대한 내성이 있습니다.", "Small beans, intermediate ripening, rust resistance and tolerance of short dry periods."),
    sources: [epamig353],
  },
  {
    id: "topazio", name: "Topázio MG 1190", nameKo: "토파지오 MG 1190", aliases: ["Topazio", "Topázio", "Topazio MG 1190"], classification: "cultivar",
    summary: t("노란 열매가 비교적 고르게 익는 키 작은 브라질 품종입니다.", "A compact Brazilian cultivar with relatively uniform yellow-fruit ripening."),
    lineage: t("Mundo Novo × Yellow Catuai 후대에서 선발하고 Catuai로 되돌이교배했습니다.", "Selected from Mundo Novo × Yellow Catuai progenies, with backcrossing to Catuai."),
    traits: t("생장력이 강하고 녹병에 약합니다.", "Vigorous growth and susceptibility to rust."),
    sources: [epamig33, epamig353],
  },
  {
    id: "acaua", name: "Acauã", nameKo: "아카우아", aliases: ["Acaua"], classification: "cultivar",
    summary: t("브라질에서 육성한 키 작은 녹병 저항성 품종입니다.", "A compact, rust-resistant cultivar bred in Brazil."),
    lineage: t("Mundo Novo IAC 388-17 × Sarchimor.", "Mundo Novo IAC 388-17 × Sarchimor."),
    sources: [iacTrial, procafeResearch],
  },
  {
    id: "tupi", name: "Tupi", nameKo: "투피", aliases: ["Tupi IAC 1669-33"], classification: "cultivar",
    summary: t("브라질 IAC가 육성한 키 작은 녹병 저항성 품종입니다.", "A compact, rust-resistant cultivar bred by Brazil's IAC."),
    lineage: t("Villa Sarchi × Timor Hybrid 832/2.", "Villa Sarchi × Timor Hybrid 832/2."),
    sources: [iacProgram, iacTrial],
  },
  {
    id: "k7", name: "K7", nameKo: "K7", aliases: ["K 7", "K-7"], classification: "selection",
    summary: t("케냐와 탄자니아에서 재배되는 키 큰 선발 품종입니다.", "A tall selection grown in Kenya and Tanzania."),
    lineage: t("French Mission에서 선발했으며 Bourbon 계통과 유전적으로 가깝습니다.", "Selected from French Mission with a Bourbon-related genetic background."),
    traits: t("생두가 크고 커피열매병에 내성이 있습니다.", "Large beans and tolerance to coffee berry disease."),
    sources: [wcr("k7", "K7")],
  },
  {
    id: "mibirizi", name: "Mibirizi", nameKo: "미비리지", aliases: [], classification: "population",
    summary: t("르완다와 부룬디 소규모 농가에서 오래 재배한 키 큰 아라비카입니다.", "A tall Arabica long cultivated by smallholders in Rwanda and Burundi."),
    lineage: t("Typica 계통으로 추정됩니다.", "Likely related to Typica."),
    traits: t("가뭄을 견디며 고지대 품질 잠재력이 높지만 녹병과 커피열매병에 약합니다.", "Drought-tolerant with high quality potential at altitude, but susceptible to rust and coffee berry disease."),
    sources: [wcr("mibirizi", "Mibirizi")],
  },
  {
    id: "jackson", name: "Jackson", nameKo: "잭슨", aliases: [], classification: "population",
    summary: t("인도 마이소르 농장에서 동아프리카로 전해진 아라비카 계통입니다.", "An Arabica lineage introduced to East Africa from a farm in Mysore, India."),
    lineage: t("유전 분석에서 Bourbon 계통과의 연관성이 확인됐습니다.", "Genetic testing places it in the Bourbon-related group."),
    sources: [wcr("jackson-2-1257", "Jackson — history")],
  },
  {
    id: "jackson-2-1257", name: "Jackson 2/1257", nameKo: "잭슨 2/1257", aliases: ["Jackson2/1257"], classification: "selection",
    summary: t("르완다 농업위원회가 Jackson에서 선발한 품종입니다.", "A selection from Jackson maintained by the Rwanda Agriculture Board."),
    growing: t("키가 크고 생장력이 강하며 생산 잠재력이 높습니다.", "Tall and vigorous, with high yield potential."),
    traits: t("생두가 크며 녹병과 커피열매병에 약합니다.", "Large beans; susceptible to rust and coffee berry disease."),
    sources: [wcr("jackson-2-1257", "Jackson 2/1257")],
  },
  {
    id: "n39", name: "N39", nameKo: "N39", aliases: ["N 39", "N-39"], classification: "selection",
    summary: t("탄자니아에서 재배되는 Bourbon 계통의 선발종입니다.", "A Bourbon-line selection cultivated in Tanzania."),
    growing: t("송웨의 Mimba 농장은 N39를 단일 품종 워시드 로트로 생산합니다.", "Mimba Farm in Songwe produces N39 as a single-variety washed lot."),
    sources: [s("Tanzania AB Mimba Farm Fully Washed", "Covoya", "https://uk.covoyacoffee.com/tanzania-ab-mimba.html")],
  },
  {
    id: "blue-mountain", name: "Blue Mountain", nameKo: "블루마운틴", aliases: [], classification: "trade-name",
    summary: t("Typica 계통의 이름으로, 동아프리카에서도 재배됩니다.", "A name associated with Typica material, also cultivated in East Africa."),
    growing: t("케냐 키리냐가의 Mugaya 생산 농가에서 재배하는 품종 중 하나입니다.", "Among the varieties cultivated by growers supplying Mugaya in Kirinyaga, Kenya."),
    sources: [wcr("typica", "Typica — names"), s("Mugaya PB — cultivation", "Sucafina", "https://sucafina.com/na/offerings/mugaya-pb")],
  },
  {
    id: "sudan-rume", name: "Sudan Rume", nameKo: "수단 루메", aliases: ["Rume Sudan", "Sudán Rume"], classification: "population",
    summary: t("Milenio 등 F1 품종의 육종 부모로 사용된 아라비카 계통입니다.", "An Arabica lineage used as a breeding parent of F1 cultivars including Milenio."),
    growing: t("콜롬비아 Café Granja La Esperanza에서도 별도 로트로 재배합니다.", "Also grown as separate lots by Café Granja La Esperanza in Colombia."),
    traits: t("PT's의 Granja La Esperanza 내추럴 로트는 포도·당밀·자몽 껍질 향미를 보입니다.", "PT's Granja La Esperanza natural lot shows grape, molasses and grapefruit-zest notes."),
    sources: [wcr("milenio", "Milenio — Rume Sudan parentage"), s("Sudan Rume Natural", "PT's Coffee", "https://ptscoffee.com/products/sudan-rume-natural")],
  },
  {
    id: "kp423", name: "KP423", nameKo: "KP423", aliases: ["KP 423", "KP-423"], classification: "selection",
    summary: t("탄자니아 Lyamungu 연구소에서 Kent를 선발해 보급한 품종입니다.", "A Kent selection released by Tanzania's Lyamungu Research Station."),
    growing: t("키가 크며 우간다 아라비카 재배지에서도 중요하게 쓰입니다.", "Tall trees, also important in Uganda's Arabica-growing areas."),
    traits: t("가뭄 내성이 있지만 커피열매병에 약합니다.", "Drought-tolerant but susceptible to coffee berry disease."),
    sources: [wcr("kp423", "KP423")],
  },
  {
    id: "nyasaland", name: "Nyasaland", nameKo: "냐사랜드", aliases: ["Nyasa", "Bugisu local"], classification: "population",
    summary: t("말라위를 거쳐 우간다 엘곤산 농가에 전해진 오래된 아라비카 계통입니다.", "An old Arabica lineage brought through Malawi to smallholders on Uganda's Mount Elgon."),
    lineage: t("Typica 계통으로 추정됩니다.", "Likely related to Typica."),
    growing: t("키가 크고 적은 영양 투입에도 적응하지만 녹병과 커피열매병에는 약합니다.", "Tall and adapted to low-input conditions, but susceptible to rust and coffee berry disease."),
    sources: [wcr("nyasaland", "Nyasaland")],
  },
];
