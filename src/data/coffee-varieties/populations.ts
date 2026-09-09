import type { CoffeeVarietyGuide } from "./types.ts";

const t = (ko: string, en: string) => ({ ko, en });
const source = (title: string, publisher: string, url: string) => ({ title, publisher, url, accessedAt: "2026-09-09" });
const india = source("Coffee Regions — India: Important Varieties", "Coffee Board of India", "https://coffeeboard.gov.in/coffee-regions-india.html?page=CoffeeRegionsIndia");
const robusta = source("Genetic improvement of robusta coffee in the 20th and 21st centuries", "WCR / CCRI / WASI and partner breeding institutes", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12852393/");
const yemen = source("Vernacular Names and Genetics of Cultivated Coffee (Coffea arabica) in Yemen — Table 3", "Montagnon et al. / Agronomy", "https://mdpi-res.com/d_attachment/agronomy/agronomy-12-01970/article_deploy/agronomy-12-01970.pdf");
const catucai = source("Catucai amarelo 785-15 na cafeicultura de montanha", "J. B. Matiello / Fundação Procafé; Ubiratan V. Barros", "https://cccmg.com.br/noticias/folha-tecnica-cafeeiros-da-variedade-catucai-amarelo-785-15-apresentam-bom-comportamento-na-cafeicultura-de-montanha/");

export const populationVarietyGuides: CoffeeVarietyGuide[] = [
  {
    id: "ethiopian-heirloom", name: "Ethiopian heirloom", nameKo: "에티오피아 재래종", aliases: ["Ethiopian heirloom (unspecified)"], classification: "trade-name",
    summary: t("에티오피아의 다양한 커피 재배 집단을 포괄하는 유통 명칭입니다.", "A collective trade term encompassing diverse Ethiopian coffee populations."),
    sources: [source("Heirloom Varietals", "Keffa Coffee", "https://keffacoffee.com/glossary/heirloom")],
  },
  {
    id: "red-bourbon", name: "Red Bourbon", nameKo: "레드 버번", aliases: [], classification: "population",
    summary: t("열매가 붉게 익는 Bourbon 계열입니다.", "Red-fruited forms of Bourbon."),
    growing: t("르완다 Nyamasheke의 Kanyege와 과테말라 Antigua의 San Agustin 등에서 재배됩니다.", "Grown at Kanyege in Rwanda's Nyamasheke and San Agustin in Guatemala's Antigua, among other origins."),
    sources: [source("Kanyege Anaerobic Natural", "Sucafina / RWACOF", "https://sucafina.com/apac/offerings/kanyege-anaerobic-natural-beyond-flagship"), source("Maria Hegel San Agustin FW", "Sucafina", "https://sucafina.com/emea/offerings/maria-hegel-san-agustin-fw")],
  },
  {
    id: "s274", name: "S274", nameKo: "S274", aliases: ["S.274", "S 274", "S274 (Robusta)"], classification: "selection",
    summary: t("인도에서 선발한 로부스타로 Kerala와 Karnataka에서 재배됩니다.", "An Indian Robusta selection grown in Kerala and Karnataka."),
    lineage: t("CCRI의 초기 로부스타 선발에서 생산성이 높은 모주로 선정됐습니다.", "Selected as a high-yielding mother tree in CCRI's early Robusta improvement work."),
    sources: [india, source("Sln.1R — History", "World Coffee Research", "https://varieties.worldcoffeeresearch.org/varieties/sln-1-r")],
  },
  {
    id: "cxr", name: "CxR", nameKo: "CxR", aliases: ["C × R", "C x R", "CxR (Robusta)", "Sln.3R"], classification: "cultivar",
    summary: t("인도 CCRI가 육성한 종간 교잡 로부스타 계열입니다.", "An interspecific Robusta breeding line developed by India's CCRI."),
    lineage: t("Coffea congensis와 C. canephora를 교배한 뒤 C. canephora로 되돌이교배했습니다.", "Coffea congensis crossed with C. canephora, followed by backcrossing to C. canephora."),
    traits: t("작은 수관과 비교적 이르고 균일한 결실이 특징입니다.", "Characterized by compact bushes and relatively early, uniform bearing."),
    sources: [robusta],
  },
  {
    id: "peridenia", name: "Peridenia", nameKo: "페리데니아", aliases: ["Peridenia (Robusta)"], classification: "population",
    summary: t("인도 Coffee Board가 소개하는 전통적인 로부스타 재배 집단입니다.", "A traditional Robusta population listed by the Coffee Board of India."),
    growing: t("Wayanad·Nilgiris·Chikmagalur의 주요 재배 품종 목록에 포함됩니다.", "Listed among the principal varieties of Wayanad, Nilgiris and Chikmagalur."),
    sources: [india],
  },
  {
    id: "tr4", name: "TR4", nameKo: "TR4", aliases: ["TR 4", "TR4 (Robusta)"], classification: "selection",
    summary: t("베트남 WASI가 Đắk Lắk 농가의 모주에서 선발한 로부스타 클론입니다.", "A Robusta clone selected by Vietnam's WASI from a mother tree on a Đắk Lắk farm."),
    growing: t("2006년 보급 승인을 받았으며 접목으로 증식합니다.", "Approved for release in 2006 and propagated by grafting."),
    traits: t("높은 생산성과 넓은 재배 적응성을 지닙니다.", "Offers high yield potential and broad adaptation."),
    sources: [source("Robusta varieties: TR4", "World Coffee Research", "https://varieties.worldcoffeeresearch.org/varieties/tr4")],
  },
  {
    id: "udaini", name: "Udaini", nameKo: "우다이니", aliases: [], classification: "trade-name",
    summary: t("예멘의 Al Udaini 지역에서 이름을 딴 재배 커피 명칭입니다.", "A Yemeni coffee name derived from the Al Udaini region."),
    sources: [yemen],
  },
  {
    id: "dawairi", name: "Dawairi", nameKo: "다와이리", aliases: [], classification: "trade-name",
    summary: t("둥글다는 뜻의 아랍어에서 유래한 예멘 커피 명칭으로 수형을 가리킵니다.", "A Yemeni coffee name referring to tree shape, from Arabic for rounded."),
    sources: [yemen],
  },
  {
    id: "tufahi", name: "Tufahi", nameKo: "투파히", aliases: [], classification: "trade-name",
    summary: t("사과를 닮은 열매 모양에서 유래한 예멘의 재배 커피 명칭입니다.", "A Yemeni coffee name derived from apple-shaped cherries."),
    sources: [yemen],
  },
  {
    id: "jaadi", name: "Jaadi", nameKo: "자아디", aliases: ["Jadi"], classification: "trade-name",
    summary: t("예멘에서 촘촘한 열매 무리나 곱슬거리는 잎을 가리키는 재배 명칭입니다.", "A Yemeni name referring to dense cherry clusters or curly leaves."),
    sources: [yemen],
  },
  {
    id: "jufaini", name: "Jufaini", nameKo: "주파이니", aliases: [], classification: "trade-name",
    summary: t("예멘에서 길쭉한 열매와 연관해 쓰는 재배 커피 명칭입니다.", "A Yemeni coffee name associated with elongated cherries."),
    sources: [yemen],
  },
  {
    id: "red-catuai", name: "Red Catuai", nameKo: "레드 카투아이", aliases: ["Red Catuaí", "Catuaí Vermelho", "Catuai Vermelho"], classification: "population",
    summary: t("브라질 IAC가 1972년 보급한 붉은 열매의 Catuaí 품종군입니다.", "A group of red-fruited Catuaí cultivars released by Brazil's IAC in 1972."),
    lineage: t("Caturra Amarelo와 Mundo Novo의 교배에서 유래합니다.", "Derived from Caturra Amarelo crossed with Mundo Novo."),
    traits: t("키가 작습니다.", "Compact stature."),
    sources: [source("Cultivares de café arábica validadas para o Espírito Santo — Catuaí", "Incaper", "https://biblioteca.incaper.es.gov.br/digital/bitstream/item/1087/1/BRT-cultivaresdecafearabica2edicao-Incaper.pdf"), source("Cultivares — Catuaí Vermelho", "Instituto Agronômico (IAC)", "https://www.iac.sp.gov.br/cultivares/inicio/resultados.php")],
  },
  {
    id: "catucai", name: "Catucai", nameKo: "카투카이", aliases: ["Catucaí"], classification: "population",
    summary: t("Icatu와 Catuaí의 교잡에서 유래한 브라질의 선발 계열입니다.", "Brazilian selections originating from Icatu–Catuaí hybridization."),
    growing: t("785-15 계열은 Minas Gerais와 Espírito Santo의 산악 재배지에 보급됐습니다.", "The 785-15 lineage spread through mountain coffee areas in Minas Gerais and Espírito Santo."),
    sources: [catucai],
  },
  {
    id: "catucai-785", name: "Catucai 785", nameKo: "카투카이 785", aliases: ["Catucaí 785"], classification: "population",
    summary: t("Icatu 4782-785와 Catuaí의 자연 교잡에서 이어진 선발 계열입니다.", "A selection lineage from natural hybridization of Icatu 4782-785 and Catuaí."),
    lineage: t("785-15의 붉은 열매 재배 집단에서 2001년 노란 열매 개체가 발견돼 별도로 선발됐습니다.", "A yellow-fruited plant found in a red-fruited 785-15 planting in 2001 underwent separate selection."),
    sources: [catucai],
  },
];
