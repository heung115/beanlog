import type { OriginGuideSource, OriginVarietyEvidence } from "../types.ts";

const source = (title: string, url: string, publisher: string): OriginGuideSource => ({
  title, url, publisher, accessedAt: "2026-09-08",
});

const evidence = (
  regionId: string,
  producer: string,
  varieties: string[],
  sources: OriginGuideSource[],
): OriginVarietyEvidence[] => varieties.map((variety) => ({ regionId, variety, producer, sources }));

const kayumas = source(
  "Java Kayumas",
  "https://drwakefield.com/coffees/java-kayumas/",
  "DRWakefield",
);
const degayo = source(
  "Gayo Arabica specialty coffee producer by Degayo Group",
  "https://degayotour.com/gayo-arabica-specialty-coffee-producer-by-degayo-group/",
  "Degayo Group",
);
const lintong = source(
  "Indonesia Sumatra Lintong Wet-Hulled — P612744-2",
  "https://www.covoyacoffee.com/p612744-2-indonesia-sumatra-lintong-wethulled.html",
  "Covoya Coffee",
);
const frinsaCultivars = source(
  "Indonesia — Java Frinsa Estate sourcing and cultivars",
  "https://www.nordicapproach.no/origin/indonesia",
  "Nordic Approach",
);
const frinsaProducer = source(
  "What makes our Indonesian Coffee so Special?",
  "https://www.nordicapproach.no/post/what-makes-our-indonesian-coffee-so-special",
  "Nordic Approach",
);
const sulotco = source(
  "Produk — Sulotco Rantekarua Toraja",
  "https://toraja.coffee/id/produk/",
  "PT. Sulotco Jaya Abadi",
);
const lagaLizu = source(
  "Flores Laga Lizu Anaerobic Honey",
  "https://sucafina.com/na/offerings/flores-laga-lizu-anaerobic-honey",
  "Sucafina",
);
const konkua = source(
  "Konkua Washed Organic",
  "https://sucafina.com/emea/offerings/konkua-washed-organic",
  "Sucafina",
);
const mong = source(
  "Mong Coffee — Western Highlands producer profile",
  "https://www.croptocup.com/community/mong-coffee/?community=161735",
  "Crop to Cup",
);
const kerehaklu = source(
  "Kerehaklu Estate",
  "https://bluetokaicoffee.com/pages/kerehaklu-estate",
  "Blue Tokai Coffee Roasters",
);
const ratnagiri = source(
  "India Ratnagiri Estate Vacuum Process Cauvery Natural",
  "https://uk.covoyacoffee.com/india-ratnagiri-vacuum-process-nano.html",
  "Covoya Coffee",
);
const kogilahalla = source(
  "Kent Microlot — Kogilahalla Estate, North Coorg",
  "https://www.agastyacoffee.com/product-page/kent-microlot",
  "Agastya Coffee",
);
const selection6 = source(
  "Selection 6 — Farms growing this variety",
  "https://southindiacoffeeco.com/germplasm/selection-6/",
  "South India Coffee Company",
);
const sandalkad = source(
  "Flavour of India Fine Cup Award 2019 — Sandalkad Estate, page 17",
  "https://hcikl.gov.in/pdf/Winning_Coffees_Brochure.pdf",
  "Coffee Board of India / High Commission of India, Kuala Lumpur",
);
const kho = source(
  "Our Coffee — K’Ho Coffee",
  "https://www.khocoffee.com/new-page",
  "K’Ho Coffee",
);
const radar = source(
  "96B Coffee Roasters: Giving you a taste of Vietnam’s finest coffees",
  "https://thecoffeevine.com/blog/giving-you-a-taste-of-vietnams-finest-coffees/",
  "The Coffeevine",
);
const marriedBeansCauDat = source(
  "Specialty coffee — Arabica Cau Dat G1 green beans — Fully washed",
  "https://www.themarriedbeans.com/en/products/ca-phe-nhan-xanh-cau-dat",
  "The Married Beans",
);
const marriedBeansProducer = source(
  "Introducing The Married Beans",
  "https://www.themarriedbeans.com/en/pages/about",
  "The Married Beans",
);
const dam = source(
  "Đạm Coffee Farm — Vietnam specialty coffee competition entry",
  "https://caphedacsanvietnam.vn/products/dam-coffee-farm-1",
  "Buon Ma Thuot Coffee Association",
);
const buonMaThuotGi = source(
  "Amendment of geographical indication registration certificate ‘Buon Ma Thuot’ for coffee products",
  "https://www.ipvietnam.gov.vn/vi/web/english/domestic-ip-activities/-/asset_publisher/ZMuTgR44COLR/content/amendment-of-geographical-indication-registration-certificate-buon-ma-thuot-for-coffee-products?inheritRedirect=false",
  "Intellectual Property Office of Vietnam",
);
const sharqiHaraz = source(
  "Crown Jewel Yemen Anaerobic Natural Sharqi Haraz Cooperative CJ1645",
  "https://cdn.royalcoffee.com/wp-content/uploads/2025/10/20193140/Crown-Jewel-Yemen-Anaerobic-Natural-Sharqi-Haraz-Cooperative-CJ1645.pdf",
  "Royal Coffee",
);
const alMatari = source(
  "Yemen Udaini Ameer Al-Matari Lot 205",
  "https://www.coffee-tech.co.nz/product/yemen-udaini-ameer-al-matari-lot-205/",
  "Coffee Tech",
);

// Evidence records describe the named farm, producer group or lot, not regional prevalence.
export const asiaVarietyEvidence: OriginVarietyEvidence[] = [
  ...evidence("indonesia-java", "Koperasi Surya Abada Kayumas", ["S795", "USDA 762"], [kayumas]),
  ...evidence("indonesia-gayo", "Degayo Group", ["Abyssinia", "Ateng", "Gayo 1", "Gayo 2", "Timtim", "Bourbon", "P88", "Super Ateng"], [degayo]),
  ...evidence("indonesia-lintong", "Lintong Nihuta smallholders / collector Rumani Hutasoit", ["Ateng", "Jember", "Sigararutang"], [lintong]),
  ...evidence("indonesia-west-java", "Java Frinsa Estate / Wildan Mustofa", ["Sigararutang", "S795", "Andungsari", "Typica", "Ateng Super", "P88", "Borbor"], [frinsaCultivars, frinsaProducer]),
  ...evidence("indonesia-toraja", "PT. Sulotco Jaya Abadi / Rantekarua", ["S795", "Catuai"], [sulotco]),
  ...evidence("indonesia-bajawa", "Wolo Wio smallholders / Laga Lizu", ["S795"], [lagaLizu]),
  ...evidence("papua-new-guinea-eastern-highlands", "Konkua Cooperative", ["Arusha", "Mundo Novo", "Typica"], [konkua]),
  ...evidence("papua-new-guinea-western-highlands", "Mong Coffee / Rexson Raguni", ["Blue Mountain", "Mundo Novo", "Caturra"], [mong]),
  ...evidence("india-chikmagalur", "Kerehaklu Estate / Thipaiah family", ["Chandragiri", "S795", "Selection 9", "Selection 6"], [kerehaklu]),
  ...evidence("india-bababudangiri", "Ratnagiri Estate / Ashok Patre", ["Cauvery"], [ratnagiri]),
  ...evidence("india-coorg", "Kogilahalla Estate", ["Kent"], [kogilahalla]),
  ...evidence("india-coorg", "Mooleh Manay Estate", ["Selection 6"], [selection6]),
  ...evidence("india-coorg", "Sandalkad Estate / Faisal Siddique", ["CxR"], [sandalkad]),
  ...evidence("vietnam-da-lat", "K’Ho Coffee / Langbiang family cooperative", ["Typica", "Bourbon", "Yellow Bourbon"], [kho]),
  ...evidence("vietnam-da-lat", "Radar Farms", ["THA1"], [radar]),
  ...evidence("vietnam-cau-dat", "The Married Beans / Cau Dat partner farmers", ["Catimor"], [marriedBeansCauDat, marriedBeansProducer]),
  // Ea Tul is in the documented coffee GI area; the farm's city office is not its growing location.
  ...evidence("vietnam-buon-ma-thuot", "Đạm Coffee Farm / Buôn Yao, Ea Tul", ["TR4"], [dam, buonMaThuotGi]),
  // Royal Coffee identifies these as farmer-used landrace labels, not confirmed genetic clusters.
  ...evidence("yemen-haraaz", "Sharqi Haraz Cooperative / Pearl of Tehama", ["Jadi", "Dawaery", "Tuffahi", "Jufini"], [sharqiHaraz]),
  ...evidence("yemen-mattari", "Ameer Al-Matari / Al-Qudamah village", ["Udaini"], [alMatari]),
];
