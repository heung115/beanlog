import type { CoffeeVarietyGuide } from "./types.ts";

const t = (ko: string, en: string) => ({ ko, en });
const source = (title: string, publisher: string, url: string) => ({ title, publisher, url, accessedAt: "2026-09-09" });
const village = source("The Village: coffee varieties", "Gesha Village", "https://www.geshavillage.com/the-village/");
const ethiopianGlossary = source("Coffee Variety Glossary", "Café Imports", "https://www.cafeimports.com/north-america/blog/coffee-variety-glossary/");
const royalSelections = source("CJ1246: Tariku Mengesha, green analysis", "Royal Coffee", "https://cdn.royalcoffee.com/wp-content/uploads/2018/10/21123013/CJ1246_Ethiopia-Banko-Chelchele-Tariku-Mengesha-Raised-Bed-Natural-Crown-Jewel.pdf");
const jarcTrial = source("Evaluation of Coffee Cultivars to Coffee Berry Borer Infestation in Southwestern Ethiopia", "Journal of Entomology", "https://scialert.net/fulltext/?doi=je.2019.74.81");

export const specialtyVarietyGuides: CoffeeVarietyGuide[] = [
  {
    id: "sidra", name: "Sidra", nameKo: "시드라", aliases: ["Bourbon Sidra"], classification: "population",
    summary: t("에콰도르 스페셜티 생산에 쓰이는 이름으로, 서로 가까운 에티오피아 유래 유전형들이 확인됩니다.", "Used in Ecuadorian specialty production for closely related Ethiopian-derived genetic material."),
    lineage: t("2026년 VINKA 농장 연구에서 Sidra로 확인된 두 형태형은 Core Ethiopia 유전군에 속했습니다.", "Two Sidra morphotypes in the 2026 VINKA farm study belonged to the Core Ethiopia genetic group."),
    traits: t("동일 농장에서도 형태 차이가 관찰됐으며 하나의 균일한 순계로 정리되지 않습니다.", "The study observed morphological variation rather than a single uniform line."),
    sources: [source("What you plant may not be what you bought: morphological and genetic discordance in specialty Coffea arabica L. cultivars from Ecuador", "Frontiers in Plant Science", "https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2026.1868034/full")],
  },
  {
    id: "pink-bourbon", name: "Pink Bourbon", nameKo: "핑크 부르봉", aliases: ["Bourbon Rosado", "Pink Borbon", "핑크 버번", "핑크 버본"], classification: "trade-name",
    summary: t("분홍빛 열매의 커피에 쓰이는 이름으로, 검사된 표본에서 에티오피아 유래 유전형이 확인됐습니다.", "A name for pink-fruited coffee; tested samples have included Ethiopian-derived genetic material."),
    lineage: t("Café Imports의 2023년 검사에서는 해당 유전형 단독 표본과 Bourbon·Catimor가 섞인 표본이 함께 나왔습니다.", "Café Imports' 2023 testing found both an unmixed sample and samples containing Bourbon or Catimor alongside it."),
    sources: [source("Pink…Bourbon?: Cryptozoology and Genetics in Specialty Coffee", "Café Imports", "https://www.cafeimports.com/north-america/blog/2023/09/26/pink-bourbon-cryptozoology-and-genetics-in-specialty-coffee/")],
  },
  {
    id: "chiroso", name: "Chiroso", nameKo: "치로소", aliases: ["Caturra Chiroso", "Caturro Chiroso"], classification: "population",
    summary: t("콜롬비아 우라오에서 재배되는 지역 명칭입니다.", "A regional coffee name associated with cultivation in Urrao, Colombia."),
    lineage: t("2021년 유전 연구의 Chiroso 표본은 에티오피아 재래 계통과 연결됐습니다.", "The Chiroso material in a 2021 genetic study grouped with Ethiopian landraces."),
    sources: [source("Unveiling a unique genetic diversity of cultivated Coffea arabica L. in its main domestication center: Yemen", "Genetic Resources and Crop Evolution", "https://link.springer.com/article/10.1007/s10722-021-01139-y"), source("Café Colombiano Caturro Chiroso de Urrao", "Pana Café", "https://www.panacafe.com.co/")],
  },
  {
    id: "wush-wush", name: "Wush Wush", nameKo: "우슈우슈", aliases: ["Wushwush", "Wush-Wush", "우쉬우쉬", "우시우시"], classification: "trade-name",
    summary: t("콜롬비아 El Zafiro 농장의 Oscar·Nancy Maca가 생산하는 희소 커피로도 알려져 있습니다.", "Known through rare coffees grown by Oscar and Nancy Maca at Colombia's El Zafiro farm."),
    traits: t("이 농장 재배목은 길고 끝이 뾰족한 열매를 맺습니다.", "The material grown at this farm has elongated, pointed cherries."),
    growing: t("2017년 이 농장 커피가 워시드·허니·내추럴 세 가공으로 함께 소개됐습니다.", "In 2017, this farm's coffee was released in washed, honey and natural versions."),
    sources: [source("Producer: Oscar and Nancy Maca, Popayan, Cauca, Colombia", "Proud Mary Coffee", "https://www.proudmaryacademy.com/en/articles/6986547-producer-oscar-and-nancy-maca-popayan-cauca-colombia")],
  },
  {
    id: "ombligon", name: "Ombligon", nameKo: "옴블리곤", aliases: ["Ombligón"], classification: "trade-name",
    summary: t("콜롬비아 우일라 El Diviso의 Nestor·Adrian Lasso가 재배하는 커피 명칭입니다.", "A coffee name used for material cultivated by Nestor and Adrian Lasso at El Diviso, Huila."),
    traits: t("열매의 배꼽을 닮은 형태에서 이름이 붙었습니다.", "Named for the cherry's distinctive navel-like shape."),
    sources: [source("Finca El Diviso Ombligon Natural 2024", "Genuine Origin", "https://www.genuineorigin.com/colombia-finca-el-diviso-natural-2024")],
  },
  {
    id: "bernardina", name: "Bernardina", nameKo: "베르나르디나", aliases: [], classification: "selection",
    summary: t("엘살바도르 Los Bellotos 농장에서 발견해 Café Pacas가 이름 붙인 선발종입니다.", "A selection discovered at Los Bellotos in El Salvador and named by Café Pacas."),
    lineage: t("특이한 나무를 찾아낸 농장 관리자 Ruperto Bernardino Merche의 이름을 따랐습니다.", "Named after farm manager Ruperto Bernardino Merche, who noticed the unusual trees."),
    growing: t("발견 농장은 이살코 화산 서쪽의 해발 1,400~1,600m에 있습니다.", "Its discovery farm lies west of Izalco volcano at 1,400–1,600 metres."),
    sources: [source("Historia del Café Variedad Bernardina", "Café Pacas", "https://cafepacas.com/website/?p=172")],
  },
  {
    id: "pacas", name: "Pacas", nameKo: "파카스", aliases: [], classification: "cultivar",
    summary: t("1949년 엘살바도르 산타아나의 Pacas 가족 농장에서 발견됐습니다.", "Discovered in 1949 on the Pacas family's farm in Santa Ana, El Salvador."),
    lineage: t("Bourbon의 자연 왜성 돌연변이로 ISIC가 1960년부터 계통 선발했습니다.", "A natural compact Bourbon mutation selected by ISIC from 1960."),
    growing: t("키가 작아 밀식에 적합합니다.", "Compact stature supports dense planting."),
    sources: [source("Arabica varieties: Pacas", "World Coffee Research", "https://varieties.worldcoffeeresearch.org/varieties/pacas")],
  },
  {
    id: "villa-sarchi", name: "Villa Sarchi", nameKo: "비야 사르치", aliases: ["Villa Sarchí", "비야사르치", "빌라 사르치"], classification: "cultivar",
    summary: t("코스타리카 알라후엘라에서 발견된 키 작은 품종입니다.", "A compact variety discovered in Costa Rica's Alajuela province."),
    lineage: t("Bourbon 개체군의 자연 돌연변이에서 선발했습니다.", "Selected from a natural mutation in a Bourbon population."),
    growing: t("고지대에 적응하며 강한 바람에 내성을 보입니다.", "Adapted to high elevations and tolerant of strong winds."),
    traits: t("Sarchimor 계통을 만드는 데 쓰인 부모 품종입니다.", "A parent used in developing the Sarchimor group."),
    sources: [source("Arabica varieties: Villa Sarchi", "World Coffee Research", "https://varieties.worldcoffeeresearch.org/varieties/villa-sarchi")],
  },
  {
    id: "maracaturra", name: "Maracaturra", nameKo: "마라카투라", aliases: [], classification: "cultivar",
    summary: t("니카라과와 중미 생산자들이 선발해 온 대립 계통입니다.", "A large-bean lineage selected by producers in Nicaragua and Central America."),
    lineage: t("Caturra와 Maragogipe의 자연 교배에서 유래한 것으로 추정됩니다.", "Thought to originate from a natural Caturra–Maragogipe cross."),
    traits: t("INTA가 1976년 시작한 선발 이후에도 형질이 완전히 고정되지 않았습니다.", "Traits remain unstabilized following selection begun by INTA in 1976."),
    sources: [source("Arabica varieties: Pacamara — Maracaturra history", "World Coffee Research", "https://varieties.worldcoffeeresearch.org/varieties/pacamara")],
  },
  {
    id: "gesha-1931", name: "Gesha 1931", nameKo: "게샤 1931", aliases: ["Geisha 1931", "Gesha1931"], classification: "selection",
    summary: t("Gesha Village가 Gori Gesha 숲 개체군에서 선발한 계통입니다.", "A Gesha Village selection from the Gori Gesha forest population."),
    traits: t("파나마 Geisha와 닮은 나무 형태·종자 크기·컵 특성을 기준으로 선발했습니다.", "Selected for plant form, seed dimensions and cup traits resembling Panamanian Geisha."),
    sources: [village],
  },
  {
    id: "gori-gesha", name: "Gori Gesha", nameKo: "고리 게샤", aliases: ["Gori Geisha"], classification: "population",
    summary: t("Gesha Village가 2011년 Gori Gesha 숲에서 수집한 종자 집단입니다.", "A seed population collected by Gesha Village from Gori Gesha forest in 2011."),
    traits: t("숲 개체군의 다양한 유전적 배경을 유지하는 재배 집단입니다.", "Cultivated as a population retaining the forest's genetic diversity."),
    sources: [village],
  },
  {
    id: "illubabor-forest", name: "Illubabor Forest", nameKo: "일루바보르 포레스트", aliases: ["Illubabor Forest 1974"], classification: "selection",
    summary: t("1974년 Illubabor 숲 수집종에서 선발한 에티오피아 연구기관 계통입니다.", "An Ethiopian research selection from material collected in Illubabor forest in 1974."),
    growing: t("Gesha Village가 재배하는 세 계통 중 하나입니다.", "One of the three coffee types cultivated at Gesha Village."),
    sources: [village],
  },
  {
    id: "74110", name: "74110", nameKo: "74110", aliases: ["JARC 74110"], classification: "selection",
    summary: t("짐마농업연구센터가 커피열매병 저항성을 바탕으로 선발한 계통입니다.", "A Jimma Agricultural Research Center selection for coffee berry disease resistance."),
    lineage: t("1974년 야생 개체군에서 선발해 1979년 보급 승인됐습니다.", "Selected from wild populations in 1974 and approved for release in 1979."),
    growing: t("키와 열매가 작은 형태가 특징입니다.", "Characterized by compact trees and small cherries."),
    sources: [royalSelections, jarcTrial],
  },
  {
    id: "74112", name: "74112", nameKo: "74112", aliases: ["JARC 74112"], classification: "selection",
    summary: t("짐마농업연구센터의 커피열매병 저항성 선발종입니다.", "A coffee berry disease-resistant selection from Jimma Agricultural Research Center."),
    lineage: t("1974년 수집·선발 프로그램에서 이어져 1979년 보급 승인됐습니다.", "Developed through the 1974 collection and selection program, with release approved in 1979."),
    growing: t("작은 키와 작은 열매를 가진 재배 계통입니다.", "A cultivated selection with compact stature and small cherries."),
    sources: [royalSelections, jarcTrial],
  },
  {
    id: "kurume", name: "Kurume", nameKo: "쿠루메", aliases: ["Kudhume", "Kudhumi"], classification: "population",
    summary: t("에티오피아에서 재배되는 작은 형태의 재래 커피 명칭입니다.", "A name for small-form Ethiopian landrace coffee."),
    traits: t("현지 재래종을 가리키며 JARC 번호 선발종과 별도로 기록됩니다.", "Recorded as local landrace material separately from numbered JARC selections."),
    sources: [ethiopianGlossary, royalSelections],
  },
  {
    id: "wolisho", name: "Wolisho", nameKo: "월리쇼", aliases: ["Walichu"], classification: "population",
    summary: t("에티오피아 게데오에서 흔히 재배되는 재래 커피 명칭입니다.", "A landrace coffee name commonly encountered in Ethiopia's Gedeo zone."),
    growing: t("수관이 높고 열매가 큰 형태로 알려져 있습니다.", "Known for a tall canopy and large fruit."),
    sources: [ethiopianGlossary],
  },
];
