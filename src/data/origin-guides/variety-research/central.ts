import type { OriginGuideSource, OriginVarietyEvidence } from "../types.ts";

const source = (title: string, url: string, publisher: string): OriginGuideSource => ({
  title,
  url,
  publisher,
  accessedAt: "2026-09-08",
});

const records = (
  regionId: string,
  varieties: string[],
  producer: string,
  sources: OriginGuideSource[],
): OriginVarietyEvidence[] => varieties.map((variety) => ({ regionId, variety, producer, sources }));

const scap = "Specialty Coffee Association of Panama";
const exclusiveTarrazu = source(
  "Tarrazú — producer relationships",
  "https://exclusivecoffeecr.com/relationships_tarrazu.html",
  "Exclusive Coffees",
);

/** Producer cultivation evidence; geography and source limitations are recorded in audits/varieties-central.md. */
export const centralVarietyEvidence: OriginVarietyEvidence[] = [
  ...records("panama-boquete", ["SL28", "Wush Wush", "Laurina", "Caturra", "Pacamara"], "Bonita Springs — Miró family", [
    source("Finca Bonita Springs", "https://www.panamavarietals.coffee/copy-of-finca-la-aurora", "Panama Varietals"),
  ]),
  ...records("panama-volcan", ["Geisha", "Caturra", "Pacamara"], "Janson Coffee Farm", [
    source("Janson Coffee Farm", "https://scap-panama.com/janson/", scap),
  ]),
  ...records("panama-jaramillo", ["Geisha"], "Hacienda La Esmeralda — Mario plot", [
    source("Hacienda La Esmeralda — Mario #5", "https://www.offshootcoffee.com.au/products/hacienda-la-esmeralda-mario-5-rare", "Offshoot Coffee"),
  ]),
  ...records("panama-jaramillo", ["Caturra", "Catuai", "Typica"], "Anselmito Estate", [
    source("Panama Anselmito Estate — Fact Sheet", "https://interamericancoffee.de/wp-content/uploads/2024/12/FactSheet_Panama_Anselmito_Estate.pdf", "InterAmerican Coffee"),
  ]),
  ...records("panama-alto-quiel", ["Geisha", "Catuai", "Typica"], "Elida Estate — Lamastus family", [
    source("Lamastus Family Estates", "https://scap-panama.com/lamastus-coffees/", scap),
  ]),
  ...records("panama-alto-quiel", ["Chiroso"], "Black Moon Farm — Hunter Tedman", [
    source("Black Moon Chiroso — Lot 49", "https://braveroasters.com/products/panama-blackmoon-chiroso-n49-100g", "Brave Roasters"),
  ]),
  ...records("panama-alto-quiel", ["Laurina"], "Hacienda La Esmeralda — El Velo", [
    source("Best of Panama 2025 auction report", "https://scap-panama.com/cafe-geisha-de-panama-sacude-al-mundo-con-impresionantes-records-mundiales/", scap),
  ]),
  ...records("panama-bambito", ["Geisha", "Yellow Catuai", "Red Bourbon"], "Bambito Estate Coffee", [
    source("Bambito Estate Coffee", "https://scap-panama.com/bambito-estate-coffee/", scap),
  ]),
  ...records("guatemala-antigua", ["Geisha", "Pacamara", "Catuai"], "Finca Gascón — Contreras family", [
    source("Finca Gascón — Our History and Varieties", "https://fincagascon.com/", "Finca Gascón"),
  ]),
  ...records("guatemala-atitlan", ["Java", "Geisha", "Pacamara", "SL28"], "San Isidro Chacaya & Los Lirios", [
    source("Our Farms and Varietals", "https://chacaya.com/", "San Isidro Chacaya S.A."),
  ]),
  ...records("guatemala-coban", ["Geisha"], "Santa Irene — Carlos Estrada", [
    source("Santa Irene", "https://manhattan.coffee/catalog/coffee/santa-irene", "Manhattan Coffee Roasters"),
  ]),
  ...records("guatemala-coban", ["Maragogype", "Pacamara", "SL28"], "Aurora Farm — Aldo", [
    source("Guatemala Cobán Aurora Farm — Geisha Natural", "https://cafe-sucre.tokyo/en/products/guatemala_coban", "Un Cafe Sucre"),
  ]),
  ...records("guatemala-san-pedro-necta", ["Pacamara", "Geisha", "Anacafe 14", "Villa Sarchi"], "La Unión — Carlos & Javier Rivas", [
    source("Huehuetenango La Union Pacamara FW", "https://www.sucafina.com/na/offerings/huehuetenango-la-union-pacamara-fw", "Sucafina"),
  ]),
  ...records("costa-rica-tarrazu", ["Villa Sarchi", "Geisha", "Typica", "Mokka", "Bourbon", "SL28"], "Santa Rosa 1900 — Naranjo family", [exclusiveTarrazu]),
  ...records("costa-rica-dota", ["Pacamara", "Villa Lobos", "Sudan Rume", "Typica", "Bourbon"], "Santa Teresa 2000 — Roger Umaña Hidalgo", [exclusiveTarrazu]),
  ...records("costa-rica-dota", ["SL28"], "Agropecuaria La Florida — Leiva Hermanos", [exclusiveTarrazu]),
  ...records("costa-rica-dota", ["Centroamericano"], "Finca Higueronal — Oscar Antonio Ureña Ureña", [
    source("Solis & Cordero Higueronal F1", "https://sucafina.com/emea/offerings/solis-cordero-higueronal-f1-anaerobic-natural", "Sucafina"),
  ]),
  ...records("costa-rica-naranjo", ["SL28", "Geisha", "Sudan Rume", "Milenio"], "Los Cipreses — Salazar family", [
    source("Familia Salazar — Los Cipreses", "https://www.changeoftone.coffee/farms/familia-salazar-los-cipreses", "Change of Tone"),
  ]),
  ...records("costa-rica-naranjo", ["Villa Sarchi", "Villa Lobos"], "Aguilera brothers", [
    source("Los Coyotes Natural", "https://www.allycoffee.com/coffees/los-coyotes-natural/", "Ally Coffee"),
    source("Aguilera Brothers", "https://www.horshamcoffeeroaster.co.uk/pages/coffee-producer/aguilera-brothers", "Horsham Coffee Roaster"),
  ]),
  ...records("costa-rica-naranjo", ["Catigua"], "La Isla — Luis Roberto Jiménez Padilla", [
    source("La Isla Micromill — Catigua", "https://www.allycoffee.com/coffees/la-isla-micromill-catigua-semi-washed/", "Ally Coffee"),
  ]),
  ...records("costa-rica-central-valley", ["Milenio"], "Las Lajas — Francisca & Oscar Chacón", [
    source("Las Lajas — Carrizal", "https://www.touton-specialty-coffee.com/en/p11379", "Touton Specialty Coffee"),
  ]),
  ...records("costa-rica-central-valley", ["Typica Lima"], "Las Lajas — Finca Carrizal", [
    source("Las Lajas — Carrizal", "https://www.touton-specialty-coffee.com/en/p11379", "Touton Specialty Coffee"),
  ]),
  ...records("costa-rica-central-valley", ["Starmaya"], "Las Lajas — Finca El Cerro", [
    source("Costa Rica Las Lajas — Finca El Cerro", "https://friedrichscoffee.com/product/costa-rica-las-lajas-finca-el-cerro/", "Friedrichs Coffee"),
  ]),
  ...records("honduras-marcala", ["Geisha", "Pacamara", "Typica", "Yellow Catuai"], "Finca Villa Gloria (La Fortuna)", [
    source("Villa Gloria", "https://www.lafortunafincasycafe.com/", "La Fortuna"),
  ]),
  ...records("honduras-copan", ["Catuai", "Obata"], "Katia Duke — San Isidro", [
    source("San Isidro Triple Fermentation", "https://www.allycoffee.com/coffees/san-isidro-triple-fermentation/", "Ally Coffee"),
  ]),
  ...records("honduras-copan", ["Parainema"], "Mauricio Salazar & family — Finca El Meson", [
    source("Mauricio Salazar El Meson Parainema", "https://sucafina.com/na/offerings/mauricio-salazar-el-meson-parainema-fw-organic", "Sucafina"),
  ]),
  ...records("honduras-comayagua", ["Parainema"], "Deyvin Arnaldo Romero Hernandez — Los Romero", [
    source("Los Romero — Honduras 2026", "https://farmdirectory.cupofexcellence.org/listing/10-los-romero-honduras-2026-parainema-catracha/", "Cup of Excellence"),
  ]),
  ...records("honduras-comayagua", ["Caturra"], "DLF Comayagua — La Esmeralda", [
    source("La Esmeralda: Washed", "https://www.delafincacoffee.com/honduran-coffee/la-esmeralda-washed-de-la-finca-coffee-importers", "De La Finca Coffee Importers"),
  ]),
  ...records("honduras-santa-barbara", ["SL28"], "Evin Joel Moreno Reyes — El Mango", [
    source("El Mango — Honduras 2026", "https://farmdirectory.cupofexcellence.org/listing/5-el-mango-honduras-2026-honduras-exotic/", "Cup of Excellence"),
  ]),
  ...records("honduras-santa-barbara", ["Geisha"], "Benjamin Paz Muñoz — La Salsa", [
    source("La Salsa — Honduras 2026", "https://farmdirectory.cupofexcellence.org/listing/2-la-salsa-honduras-2026-honduras-exotic/", "Cup of Excellence"),
  ]),
  ...records("honduras-santa-barbara", ["Pacamara"], "Jairo — Finca El Niño", [
    source("Finca El Niño", "https://88graines.com/pl/producer/finca-el-nino/", "88 Graines"),
  ]),
  ...records("el-salvador-santa-ana", ["Pacas", "Pacamara", "Bernardina", "Orange Bourbon"], "Familia Pacas — La Esperanza", [
    source("La Esperanza", "https://regiones.cafedeelsalvador.com/finca.php?id=82", "Café de El Salvador"),
  ]),
  ...records("el-salvador-chalatenango", ["Pacas"], "Luis Hernandez — Finca Cerro Negro", [
    source("Luis Hernandez — Cerro Negro — Pacas 26504", "https://www.cafeimports.com/north-america/offerings?view=beanology.view.luis-hernandez-finca-cerro-negro-pacas-washed-26504", "Cafe Imports"),
  ]),
  ...records("el-salvador-chalatenango", ["Pacamara"], "Efrain Solis — Finca El Amoton", [
    source("Efrain Solis — El Amoton — Pacamara 26496", "https://www.cafeimports.com/north-america/offerings?view=beanology.view.efrain-solis-finca-el-amoton-pacamara-washed-26496", "Cafe Imports"),
  ]),
  ...records("el-salvador-chalatenango", ["Bourbon"], "Rafael Antonio Salguero Chacón — Bella Vista (2007)", [
    source("Bella Vista — El Salvador 2007", "https://allianceforcoffeeexcellence.org/farm-directory/87-48-2/", "Alliance for Coffee Excellence"),
  ]),
  ...records("nicaragua-jinotega", ["Java", "Pacamara"], "Tom & Matt Hills — Hacienda Sajonia", [
    source("Hacienda Sajonia — The Estate", "https://www.haciendasajonia.com/the-estate/", "Hacienda Sajonia"),
  ]),
  ...records("nicaragua-jinotega", ["Maragogype"], "José Edilberto Úbeda Zeledón — La Laguna", [
    source("La Laguna — Nicaragua 2026", "https://farmdirectory.cupofexcellence.org/listing/8-la-laguna-nicaragua-2026-wet/", "Cup of Excellence"),
  ]),
  ...records("nicaragua-matagalpa", ["Java", "Ethiosar", "Yellow Pacamara"], "Fincas Mierisch — Los Placeres", [
    source("Finca Los Placeres", "https://www.laminita.com/farms-mills/placeres", "Hacienda La Minita"),
  ]),
  ...records("nicaragua-nueva-segovia", ["Java"], "Ashlyn Sarela Acuña Jimenez — El Rosario", [
    source("El Rosario — Nicaragua 2026", "https://farmdirectory.cupofexcellence.org/listing/6-el-rosario-nicaragua-2026-dry/", "Cup of Excellence"),
  ]),
  ...records("nicaragua-nueva-segovia", ["Maracaturra"], "Luis Alberto Balladarez Moncada — Un Regalo De Dios", [
    source("Un Regalo De Dios — Nicaragua 2026", "https://farmdirectory.cupofexcellence.org/listing/8-un-regalo-de-dios-nicaragua-2026-dry/", "Cup of Excellence"),
  ]),
  ...records("nicaragua-dipilto", ["Maracaturra"], "Mario Gonzales — Los Suyates", [
    source("Los Suyates", "https://www.thegoodsourcing.com/suyates", "The Good Sourcing"),
  ]),
  ...records("nicaragua-dipilto", ["Maragogype", "Pacamara"], "Guillermo Montenegro Ayestas — El Poste", [
    source("El Poste — Nicaragua 2026", "https://farmdirectory.cupofexcellence.org/listing/5-el-poste-nicaragua-2026-wet/", "Cup of Excellence"),
  ]),
  ...records("nicaragua-dipilto", ["Caturra"], "Cafetalera Buenos Aires — Ojo de Agua", [
    source("Nicaragua Ojo de Agua", "https://www.sweetmarias.com/nicaragua-ojo-de-agua-8445.html", "Sweet Maria's"),
  ]),
  ...records("mexico-chiapas", ["Geisha"], "José Argüello — Finca Santa Cruz", [
    source("Finca Santa Cruz Geisha", "https://sucafina.com/emea/offerings/finca-santa-cruz-geisha-fw", "Sucafina"),
  ]),
  ...records("mexico-chiapas", ["Marsellesa"], "Jesús & Pablo Salazar — Cafeología La Finca", [
    source("Cafeología — La Finca — Marsellesa", "https://www.allycoffee.com/coffees/cafeologia-la-finca-marsellesa-honey/", "Ally Coffee"),
  ]),
  ...records("mexico-oaxaca", ["Marsellesa"], "Edgar David García García — Finca El Encino", [
    source("Finca El Encino — Mexico 2026", "https://farmdirectory.cupofexcellence.org/listing/4-finca-el-encino-mexico-2026-experimenta/", "Cup of Excellence"),
  ]),
  ...records("mexico-veracruz", ["Marsellesa", "Garnica", "Geisha"], "Givette Pérez Orea — Finca Fátima", [
    source("CJ1636 — Finca Fátima", "https://cdn.royalcoffee.com/wp-content/uploads/2025/09/23081035/Crown-Jewel-Mexico-Washed-Marsellesa-Givette-Perez-Orea-CJ1636.pdf", "Royal Coffee"),
  ]),
  ...records("mexico-pluma-hidalgo", ["Typica"], "Unión de Productores de Café de Especialidad Pluma", [
    source("Café Pluma México", "https://www.cafepluma.com.mx/", "Unión de Productores de Café de Especialidad Pluma"),
  ]),
];
