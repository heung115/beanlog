import type { CoffeeVarietyGuide } from "./types.ts";

const t = (ko: string, en: string) => ({ ko, en });
const source = (title: string, publisher: string, url: string) => ({ title, publisher, url, accessedAt: "2026-09-09" });
const wcr = (slug: string, title: string) => source(`Arabica varieties: ${title}`, "World Coffee Research", `https://varieties.worldcoffeeresearch.org/varieties/${slug}`);
const india = source("Coffee Regions — India: Important Varieties", "Coffee Board of India", "https://coffeeboard.gov.in/coffee-regions-india.html?page=CoffeeRegionsIndia");
const cenicafe = (title: string, url: string) => source(title, "Centro Nacional de Investigaciones de Café (Cenicafé)", url);

export const regionalVarietyGuides: CoffeeVarietyGuide[] = [
  {
    id: "castillo", name: "Castillo", nameKo: "카스티요", aliases: ["Castillo®", "Variedad Castillo"], classification: "cultivar",
    summary: t("Cenicafé가 콜롬비아 재배 환경에 맞춰 개발한 복합 품종입니다.", "A composite cultivar developed by Cenicafé for Colombian growing conditions."),
    lineage: t("Caturra × Timor Hybrid CIFC 1343의 후대에서 여러 계통을 선발해 구성했습니다.", "Composed of selected lines descended from Caturra × Timor Hybrid CIFC 1343."),
    growing: t("키가 작은 계통을 콜롬비아 여러 재배 지역에서 평가했습니다.", "Compact lines were evaluated across several Colombian coffee-growing regions."),
    traits: t("녹병 저항성, 생산성, 큰 생두를 목표로 선발했습니다.", "Selected for rust resistance, productivity and large beans."),
    sources: [cenicafe("Castillo: Nueva variedad de café con resistencia a la roya", "https://biblioteca.cenicafe.org/bitstream/10778/401/1/avt0337.pdf")],
  },
  {
    id: "colombia", name: "Colombia", nameKo: "콜롬비아", aliases: ["Variedad Colombia"], classification: "cultivar",
    summary: t("녹병 저항성의 유전적 다양성을 유지하도록 여러 선발 계통을 혼합한 복합 품종입니다.", "A composite cultivar combining selected lines to maintain genetic diversity for rust resistance."),
    lineage: t("Caturra × Timor Hybrid 1343에서 유래하며 개량 과정에서 구성 계통을 바꿔 왔습니다.", "Derived from Caturra × Timor Hybrid 1343, with component lines changed through continued breeding."),
    growing: t("낮은 수고와 생산성, 콜롬비아 재배 환경에 대한 적응성을 기준으로 선발했습니다.", "Selected for compact stature, productivity and adaptation to Colombian growing conditions."),
    sources: [cenicafe("Mejoramiento de las características agronómicas de la variedad Colombia mediante la modificación de su composición", "https://publicaciones.cenicafe.org/index.php/avances_tecnicos/article/download/1784/5181/3914")],
  },
  {
    id: "tabi", name: "Tabi", nameKo: "타비", aliases: ["Variedad Tabi"], classification: "cultivar",
    summary: t("Typica·Bourbon 재배 농가를 위해 개발한 키가 큰 복합 품종입니다.", "A tall composite cultivar developed for farms traditionally growing Typica and Bourbon."),
    lineage: t("Timor Hybrid를 Typica 및 Bourbon과 각각 교배한 후대에서 여러 계통을 선발했습니다.", "Composed of selected progenies from Timor Hybrid crossed with Typica and with Bourbon."),
    growing: t("그늘과 양지에서 평가했으며, Typica·Bourbon과 비슷한 재식 밀도를 사용합니다.", "Evaluated under shade and full sun, using planting densities similar to Typica and Bourbon."),
    traits: t("강한 생장, 큰 생두, 녹병 저항성이 주요 선발 특성입니다.", "Selected for vigorous growth, large beans and rust resistance."),
    sources: [cenicafe("Tabi: variedad de café de porte alto con resistencia a la roya", "https://biblioteca.cenicafe.org/bitstream/10778/4185/1/avt0300.pdf")],
  },
  {
    id: "cenicafe-1", name: "Cenicafé 1", nameKo: "세니카페 1", aliases: ["Cenicafe 1", "Cenicafé1", "Cenicafe1"], classification: "cultivar",
    summary: t("낮은 수고와 생산성, 녹병 저항성을 함께 고려해 개발한 복합 품종입니다.", "A composite cultivar developed for compact stature, productivity and rust resistance."),
    lineage: t("Caturra × Timor Hybrid 1343의 후대에서 선발한 8개 계통으로 구성됩니다.", "Composed of eight selected progenies descended from Caturra × Timor Hybrid 1343."),
    growing: t("Caturra와 비슷한 낮은 수고를 목표로 선발했습니다.", "Selected for a Caturra-like compact habit."),
    traits: t("큰 생두를 선발했으며 커피열매병 저항성과 관련된 분자 표지도 활용했습니다.", "Selection included large beans and molecular markers associated with coffee berry disease resistance."),
    sources: [cenicafe("Cenicafé 1: Nueva variedad de porte bajo, altamente productiva, resistente a la roya y al CBD, con mayor calidad física del grano", "https://biblioteca.cenicafe.org/bitstream/10778/4178/1/AVT0469.pdf")],
  },
  {
    id: "catimor", name: "Catimor", nameKo: "카티모르", aliases: ["카티모어"], classification: "population",
    summary: t("비슷한 교배 배경을 공유하는 여러 육성 품종의 계통군입니다.", "A group of distinct bred varieties sharing similar parentage."),
    lineage: t("Caturra와 녹병 저항성 Timor Hybrid 계통을 교배해 만들었습니다.", "Developed by crossing Caturra with rust-resistant Timor Hybrid lines."),
    growing: t("각국에서 후대 선발과 포장 시험을 거쳐 서로 다른 품종으로 보급됐습니다.", "Successive selection and field trials produced distinct varieties in different countries."),
    sources: [wcr("t8667", "T8667 — Catimor history")],
  },
  {
    id: "sarchimor", name: "Sarchimor", nameKo: "사르치모르", aliases: ["사치모르"], classification: "population",
    summary: t("Villa Sarchi를 부모로 사용한 녹병 저항성 육종 계통군입니다.", "A rust-resistance breeding group with Villa Sarchi parentage."),
    lineage: t("CIFC에서 Timor Hybrid 832/2와 Villa Sarchi를 교배해 만든 H361에서 이어집니다.", "Traces to H361, a CIFC cross of Timor Hybrid 832/2 and Villa Sarchi."),
    traits: t("녹병 저항성과 밀식에 맞는 작은 키를 함께 목표로 육성했습니다.", "Breeding combined rust resistance with compact stature for denser planting."),
    sources: [wcr("villa-sarchi", "Villa Sarchi — Sarchimor history")],
  },
  {
    id: "timor-hybrid", name: "Timor Hybrid", nameKo: "티모르 하이브리드", aliases: ["Híbrido de Timor", "Hibrido de Timor"], classification: "population",
    summary: t("1920년대 티모르섬에서 나타난 아라비카와 로부스타의 자연 교잡 계통입니다.", "A natural Arabica–Robusta hybrid lineage that appeared on Timor in the 1920s."),
    traits: t("녹병 저항성 선발 재료가 Catimor 등 후속 육종에 사용됐습니다.", "Rust-resistant selections supplied parent material for subsequent breeding, including Catimors."),
    sources: [wcr("t8667", "T8667 — Timor Hybrid history")],
  },
  {
    id: "s795", name: "S795", nameKo: "S795", aliases: ["S.795", "S 795", "Selection 3"], classification: "cultivar",
    summary: t("인도에서 널리 재배되는 CCRI의 다수성 아라비카 품종입니다.", "A productive CCRI Arabica cultivar widely grown in India."),
    lineage: t("리베리카 유전자가 도입된 S288과 Kent의 교배에서 선발했습니다.", "Selected from S288, a Liberica-introgressed line, crossed with Kent."),
    growing: t("키가 크고 생두가 큰 편입니다.", "Tall trees with large beans."),
    traits: t("WCR 국제 시험에서는 녹병 저항성이 높았지만 인도에서는 감수성 품종으로 평가됩니다.", "Rust resistance was high in WCR's global trials, while the variety is considered susceptible in India."),
    sources: [wcr("s795", "S795")],
  },
  {
    id: "kent", name: "Kent", nameKo: "켄트", aliases: ["Kents"], classification: "selection",
    summary: t("1920년대 인도에서 Kent라는 농장주가 선발한 아라비카입니다.", "An Arabica selected in India during the 1920s by a planter named Kent."),
    traits: t("당시 비교적 낮은 녹병 감수성으로 보급됐으며 S795의 육종 부모로 쓰였습니다.", "Historically adopted for lower rust susceptibility and used as a parent of S795."),
    sources: [india, wcr("s795", "S795 — Kent parentage")],
  },
  {
    id: "cauvery", name: "Cauvery", nameKo: "코베리", aliases: [], classification: "cultivar",
    summary: t("인도에서 재배되는 Catimor 계통의 아라비카 품종입니다.", "An Arabica cultivar of the Catimor group grown in India."),
    lineage: t("Caturra와 Timor Hybrid의 교배 후대입니다.", "Descended from Caturra crossed with Timor Hybrid."),
    sources: [india],
  },
  {
    id: "selection-9", name: "Selection 9", nameKo: "셀렉션 9", aliases: ["Sln.9", "Sln. 9"], classification: "cultivar",
    summary: t("인도 Coffee Board가 소개하는 아라비카 육성 품종입니다.", "An Arabica breeding selection described by the Coffee Board of India."),
    lineage: t("에티오피아 수집종 Tafarikela와 Timor Hybrid의 교배에서 유래했습니다.", "Derived from an Ethiopian Tafarikela collection crossed with Timor Hybrid."),
    sources: [india],
  },
  {
    id: "chandragiri", name: "Chandragiri", nameKo: "찬드라기리", aliases: [], classification: "cultivar",
    summary: t("인도 Coffee Board가 2007년 보급한 아라비카 품종입니다.", "An Arabica cultivar released by the Coffee Board of India in 2007."),
    traits: t("연구기관은 높은 생산성과 큰 생두 비율, 시험에서의 녹병 내성을 보고했습니다.", "The institute reported high yields, a high proportion of large beans and rust tolerance in its evaluations."),
    sources: [source("Coffee Research in India — Important Research Findings", "Coffee Board of India", "https://coffeeboard.gov.in/research.aspx")],
  },
  {
    id: "selection-6", name: "Selection 6", nameKo: "셀렉션 6", aliases: ["Sln.6", "Sln. 6", "S.2828"], classification: "cultivar",
    summary: t("인도 CCRI가 개발해 1970년대 농가에 보급한 품종입니다.", "Developed by India's CCRI and distributed to farmers in the 1970s."),
    lineage: t("Kent와 로부스타 S274를 교배한 뒤 Kent로 되돌이교배했습니다.", "Kent crossed with Robusta S274, followed by backcrossing to Kent."),
    growing: t("키가 크며 혼농임업 재배에 적응합니다.", "Tall trees adapted to agroforestry cultivation."),
    traits: t("WCR 국제 시험의 녹병 저항성과 달리 인도에서는 감수성으로 평가됩니다.", "Despite rust resistance in WCR's global trials, it is considered susceptible in India."),
    sources: [wcr("sln-6", "Sln.6")],
  },
  {
    id: "usda-762", name: "USDA 762", nameKo: "USDA 762", aliases: ["USDA762", "USDA-762"], classification: "selection",
    summary: t("USDA가 에티오피아에서 수집한 아라비카 집단의 모주 선발에서 유래했습니다.", "Derived from mother-tree selection in Arabica material collected in Ethiopia by the USDA."),
    growing: t("키가 크고 수관이 다소 넓으며, 익은 열매는 붉은색입니다.", "Tall trees with a somewhat spreading canopy and red ripe fruit."),
    traits: t("인도네시아 품종 안내서는 기생성 선충에 약하고 척박한 토양에 민감하다고 설명합니다.", "Indonesia's variety handbook describes susceptibility to parasitic nematodes and sensitivity to poor soils."),
    sources: [source("Pengenalan Varietas Unggul Kopi — USDA 762, pp. 57–58", "Indonesian Agency for Agricultural Research and Development / IAARD Press", "https://repository.pertanian.go.id/server/api/core/bitstreams/8ac5edc0-bd86-4c2c-81c5-46f62a83db98/content")],
  },
  {
    id: "typica-mejorado", name: "Typica Mejorado", nameKo: "티피카 메호라도", aliases: ["Mejorado"], classification: "trade-name",
    summary: t("에콰도르 스페셜티 재배에 쓰이며 CafExporto가 별도 모주 집단을 보존하는 명칭입니다.", "An Ecuadorian specialty coffee name for which CafExporto maintains a separate mother-plant collection."),
    lineage: t("CafExporto는 자체 보존 재료를 Bourbon과 에티오피아 재래종의 교배로 설명합니다.", "CafExporto describes its preserved material as a Bourbon–Ethiopian landrace hybrid."),
    growing: t("생산자는 La Papaya·Yacuri·Yunguilla 농장에 이 재료를 재배합니다.", "The producer grows this material at La Papaya, Yacuri and Yunguilla."),
    sources: [source("Genetic Bank — Typica Mejorado", "CafExporto", "https://cafexporto.com/genetic-bank")],
  },
  {
    id: "ethiosar", name: "Ethiosar", nameKo: "에티오사르", aliases: [], classification: "trade-name",
    summary: t("Fincas Mierisch가 니카라과와 온두라스의 여러 농장에서 재배하는 커피 명칭입니다.", "A coffee name used by Fincas Mierisch across farms in Nicaragua and Honduras."),
    growing: t("생산자는 여러 미기후에 적응하고 자사 Caturra보다 생산량이 많다고 보고합니다.", "The producer reports adaptation to several microclimates and higher yields than its Caturra."),
    traits: t("이 생산자의 재배 경험에서 녹병 저항성이 보고됐습니다.", "Rust resistance is reported from this producer's cultivation experience."),
    sources: [source("Varieties — Ethiosar", "Fincas Mierisch", "https://www.fincasmierisch.com/varieties")],
  },
  {
    id: "milenio", name: "Milenio", nameKo: "밀레니오", aliases: ["H10", "H-10"], classification: "cultivar",
    summary: t("중미 공동 육종 프로그램에서 개발한 키 작은 F1 품종입니다.", "A compact F1 cultivar developed through a Central American breeding collaboration."),
    lineage: t("T5296과 Rume Sudan의 교배종입니다.", "A cross of T5296 and Rume Sudan."),
    growing: t("생두가 크고 생산 잠재력이 높으며 영양번식으로 증식합니다.", "Large beans and high yield potential; propagated clonally."),
    traits: t("수확한 종자를 다시 심으면 후대에서 형질이 분리됩니다.", "Seed saved from the hybrid produces segregating offspring."),
    sources: [wcr("milenio", "Milenio")],
  },
  {
    id: "starmaya", name: "Starmaya", nameKo: "스타마야", aliases: [], classification: "cultivar",
    summary: t("CIRAD와 ECOM이 개발한 F1 교배 품종입니다.", "An F1 hybrid cultivar developed by CIRAD and ECOM."),
    lineage: t("Marsellesa와 꽃가루를 만들지 못하는 에티오피아·수단 수집 재료를 교배했습니다.", "Crossed Marsellesa with male-sterile material from an Ethiopian–Sudanese collection."),
    traits: t("전문 채종원이 부모 계통을 교배해 F1 종자로 공급할 수 있습니다.", "Professional seed producers can supply F1 seed by crossing the parental lines."),
    sources: [wcr("starmaya", "Starmaya")],
  },
];
