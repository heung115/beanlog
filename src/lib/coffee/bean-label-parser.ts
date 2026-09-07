import { originPresets } from "../../data/origin-presets.ts";
import { varietalPresets } from "../../data/varietal-presets.ts";
import { flavorPresets } from "../../data/flavor-wheel.ts";
import type { BlendComponent } from "../../types/database.ts";
import { normalizeLabelExtraction, type LabelExtraction, type LabelField } from "./bean-label.ts";

type ParserField = LabelField | "tasting_notes" | "ignore";
type Candidate = { value: string | number; evidence: string };

// Match spacing noise in labels, without correcting or completing printed values.
function spaced(value: string): string {
  return [...value.replace(/\s+/gu, "")].map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[ \\t]*");
}

const labels: [ParserField, string[]][] = [
  ["name", ["상품명", "제품명", "원두명", "커피명", "product name", "coffee name", "bean name", "product"]],
  ["roastery", ["로스터리", "로스터", "로스팅 업체", "roastery", "roaster", "roasters", "roasted by"]],
  ["origin_country", ["원산지", "생산국", "국가", "산지", "country of origin", "origin country", "country", "origin"]],
  ["origin_region", ["생산 지역", "산지 지역", "재배 지역", "지역", "origin region", "region"]],
  ["farm_producer", ["농장 및 생산자", "농장/생산자", "농장", "생산자", "프로듀서", "farm / producer", "farm", "producer", "produced by", "estate"]],
  ["varietal", ["품종", "varietal", "varietals", "variety", "varieties", "cultivar", "varietet"]],
  ["process_detail", ["가공 상세", "processing details", "processing detail", "process details", "process detail"]],
  ["process_method", ["가공 방식", "가공 방법", "가공법", "가공", "프로세싱", "processing method", "process method", "processing", "process", "proces"]],
  ["roast_date", ["로스팅 일자", "로스팅 날짜", "로스팅 일", "볶은 날", "roasting date", "roast date", "roasted date", "date roasted", "roasted on", "roasted"]],
  ["roast_level", ["로스팅 정도", "로스팅 레벨", "배전도", "roast level", "roast profile", "roasting", "roast"]],
  ["weight_g", ["내용량", "순중량", "중량", "net weight", "net wt.", "net wt", "net contents", "weight", "net"]],
  ["tasting_notes", ["tasting notes", "tasting note", "cup notes", "cup note", "flavor notes", "tastes like", "notes", "note", "컵 노트", "컵노트", "맛", "향미"]],
  // Recognize other headings only to keep their text out of adjacent fields.
  ["ignore", ["소비 기한", "유통 기한", "품질 유지 기한", "구매일", "수확일", "제조일", "포장일", "best before", "best by", "expiry date", "expiration date", "expires", "expiry", "purchased", "purchase date", "harvest date", "harvest", "packed on", "manufactured", "재배 고도", "고도", "altitude", "roastery address", "address", "주소", "dose", "dosage", "water", "추출량", "물", "투입량", "사용량", "품목 보고 번호", "식품 유형", "보관 방법", "제조원", "판매원", "제조 번호", "lot", "return to origin"]],
];

const labelEntries = labels.flatMap(([field, aliases]) => aliases.map((alias) => ({ field, alias, pattern: spaced(alias) })))
  .sort((left, right) => right.alias.replace(/\s+/gu, "").length - left.alias.replace(/\s+/gu, "").length);
const labelFields = new Map(labelEntries.map(({ field, alias }) => [key(alias), field]));
const labelPattern = labelEntries.map(({ pattern }) => pattern).join("|");
const firstLabel = new RegExp(`^(?:[-•]\\s*)?(${labelPattern})(?:\\s*[:：=]\\s*|\\s+[-–—]\\s+|\\s+|$)`, "iu");
const nextLabel = new RegExp(`(?:\\s+|\\s*[/,|¦;]\\s*)(${labelPattern})\\s*[:：=]\\s*`, "giu");
const bilingualLabel = new RegExp(`^(?:[-•]\\s*)?(${labelPattern})\\s*\\(([^)]+)\\)\\s*[:：=]?\\s*`, "iu");
const recipePattern = /\b(?:brew(?:ing)?|recipe|dose|dosage|dosing|water|yield|ratio)\b|레\s*시\s*피|추\s*출|도\s*징|투\s*입|사\s*용\s*량|물\s*[:：=]/iu;
const blendPattern = new RegExp(`(?:\\b${spaced("blend")}s?\\b|${spaced("블렌드")}|${spaced("블렌딩")}|${spaced("혼합")})`, "iu");
const singlePattern = new RegExp(`(?:\\b${spaced("single origin")}\\b|${spaced("싱글 오리진")}|${spaced("단일 산지")})`, "iu");
const nutritionPattern = /\b(?:nutrition(?:al)?|per serving|protein|fat|sodium|carbohydrate|calories|ingredients)\b|영양|단백질|지방|나트륨|탄수화물|원재료|성분/iu;
const categoryPattern = /^(?:(?:specialty|whole\s*bean|ground|roasted)\s+)*(?:coffee|coffee\s+beans?)$|^(?:whole\s*beans?|원두\s*커피|볶은\s*커피|커피\s*원두|식품\s*유형\s*[:：]?\s*볶은\s*커피)$/iu;
const originCategoryPattern = /^(?:single\s*origin|blend|싱글\s*오리진|단일\s*산지|블렌드|블렌딩|혼합|(?:(?:latin|north|south|central)\s*)?america|(?:(?:east|west|north|south|central)\s*)?(?:africa|asia|europe)|oceania|(?:라틴|북|남|중앙)?\s*아메리카|(?:동|서|북|남|중앙)?\s*아프리카|아시아|유럽|오세아니아)$/iu;
const metadataPattern = /^(?:품\s*목\s*보\s*고\s*번\s*호|제조\s*번호|식품\s*유형|보관\s*방법|제조원|판매원)|^(?:batch|lot|sku|barcode|packed\s+(?:on|in)|roasted\s+at|return\s+to\s+origin)(?:\b|[:：#])|^(?:open|seasonal|direct\s+trade|hand\s+roasted|store\s+in\b.*|https?:\/\/\S+|www\.\S+)$/iu;
const promotionalPattern = /^(?:enjoy|discover|experience|visit|follow|scan|our|we|this\s+coffee|the\s+(?:more|best))\b|(?:어우러지|느껴지|즐겨|즐기|입니다|습니다)|(?:향미가|커피)\s*$/iu;
const serialNumber = /^(?:n[o0]\s*[.:#-]?|number\s*[:#-]?|serial(?:\s*(?:no\.?|number))?\s*[:#-]?)\s*\d(?:[\d ./-]*\d)?$/iu;

/** Package categories and administrative text are boundaries, not bean names. */
export function isLabelMetadataLine(value: string): boolean {
  return categoryPattern.test(value.trim()) || originCategoryPattern.test(value.trim()) || metadataPattern.test(value.trim()) || serialNumber.test(value.trim())
    || /^(?:(?:light|medium|dark)\s+roast(?:\s+(?:blend|coffee))?|(?:washing|워싱)\s*(?:station|스테이션)\s*[:：]?)$/iu.test(value.trim())
    || /^(?:nutrition(?:al)?\s+(?:facts|information)|ingredients\b|(?:brew(?:ing)?\s+)?recipe\b|영양|원재료|레시피)|^(?:dose|dosage|water|yield|ratio|추출량|투입량|물)\s*[:：=]/iu.test(value.trim());
}
const knownNotes = new Set([
  ...flavorPresets.flatMap((flavor) => [flavor.tag.replaceAll("-", " "), flavor.tagKo]),
  "green apple", "red apple", "yellow apple", "candy", "sugar", "nuts", "black tea", "milk chocolate",
  "maple syrup", "tangerine peel", "cacao", "peony", "white nectarine", "earl grey",
  "berry", "berries", "white chocolate", "청사과", "풋사과", "빨간사과", "적사과", "캔디", "사탕", "블랙티", "밀크초콜릿", "견과류",
].map(key));
const trailingWeight = /(?:^|\s)(0,\d{1,3}\s*(?:kg|k\s*g|㎏|킬로그램)|[1-9]\d{0,2}(?:,\d{3})+\s*(?:kg|g|그램)|\d+(?:\.\d+)?\s*(?:kg|k\s*g|g|㎏|그램|킬로그램))\.?$/iu;
const weightQuantity = "(0,\\d{1,3}|[1-9]\\d{0,2}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k\\s*g|g|㎏|그램|킬로그램|o\\s*z|0\\s*z)\\.?";
const wrappedWeight = `(?:${weightQuantity}|\\(${weightQuantity}\\)|\\[${weightQuantity}\\])`;
const weightValuePattern = new RegExp(`^${wrappedWeight}(?:(?:\\s+|\\s*/\\s*|(?=[(\\[]))${wrappedWeight})?(?:\\s+NET)?$`, "iu");
const weightQuantitiesPattern = new RegExp(weightQuantity, "giu");

function noteTokens(value: string): string[] {
  return value.split(/[,，;；|¦•·/]+|\s+(?:and|[&+])\s+|\.\s+/iu).map((note) => note.trim())
    .filter((note) => note.length <= 80 && /^[\p{L}][\p{L}\s'’()\-]*$/u.test(note)
      && (/[가-힣]/u.test(note) || note.replace(/[^a-z]/giu, "").length >= 2)
      && note.split(/\s+/u).length <= 6);
}

function isFlavorPhrase(value: string): boolean {
  if (knownNotes.has(key(value))) return true;
  // Descriptive words classify a printed flavor phrase; the stored wording is
  // untouched. They cannot turn a full marketing sentence into a flavor list.
  const flavor = value.replace(/^(?:sweet|creamy|ripe|dried|juicy|fresh|tart)\s+/iu, "")
    .replace(/\s+(?:juice|jam|mousse)$/iu, "");
  return knownNotes.has(key(flavor));
}

/** Exact sensory vocabulary can anchor printed lists; it never rewrites text. */
export function isKnownLabelFlavor(value: string): boolean {
  return isFlavorPhrase(value);
}

function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, "");
}

const countries = originPresets.map((preset) => ({
  preset,
  aliases: [preset.country, preset.countryKo],
  patterns: [preset.country, preset.countryKo].map((alias, index) => new RegExp(`(?<![\\p{L}\\p{N}])${spaced(alias)}${index === 1 ? "(?=$|[^\\p{L}\\p{N}]|(?:산)?\\s*\\d+(?:\\.\\d+)?\\s*%)" : "(?![\\p{L}\\p{N}])"}`, "giu")),
}));
const originPlaceNames = new Set(originPresets.flatMap((preset) => [
  preset.country, preset.countryKo, ...preset.regions.flatMap((region) => [region.name, region.nameKo]),
]).map(key));

function countriesIn(value: string) {
  return countries.filter(({ patterns }) => patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }));
}

function parseCountry(value: string): string | undefined {
  // Remove only complete origin qualifiers. This permits Korean typography
  // without spaces while a country-prefixed product title still is not a value.
  const countryValue = value.replace(singlePattern, " ").replace(/100\s*%/gu, " ");
  const matches = countriesIn(countryValue);
  if (matches.length !== 1) return undefined;
  let remainder = countryValue;
  for (const pattern of matches[0].patterns) {
    pattern.lastIndex = 0;
    remainder = remainder.replace(pattern, "");
  }
  // A bilingual duplicate or explicit 100% still denotes the same country.
  if (!/^[\s(),/]*$/u.test(remainder)) return undefined;
  return matches[0].preset.country;
}

function parseOriginLocation(value: string) {
  const parts = value.split(",").map(part => part.trim());
  if (parts.length !== 2) return undefined;
  for (const [countryValue, regionValue] of [[parts[1], parts[0]], [parts[0], parts[1]]]) {
    const country = parseCountry(countryValue);
    const preset = originPresets.find(entry => entry.country === country);
    const region = preset?.regions.find(entry => key(entry.name) === key(regionValue) || key(entry.nameKo) === key(regionValue));
    if (country && region) return { country, region: region.name };
  }
  return undefined;
}

function hasOriginShare(value: string): boolean {
  if (countriesIn(value).length !== 1) return false;
  const share = /(\d+(?:\.\d+)?)\s*%/u.exec(value);
  return Boolean(share && Number(share[1]) >= 0 && Number(share[1]) < 100);
}

function parseBlendComponent(value: string): BlendComponent | undefined {
  const share = /^(.*?)\s+(\d+(?:\.\d+)?)\s*%$/u.exec(value.trim());
  if (!share) return undefined;
  const countryMatches = countriesIn(share[1]);
  const percentage = Number(share[2]);
  if (countryMatches.length !== 1 || percentage <= 0 || percentage >= 100) return undefined;
  const country = countryMatches[0];
  const prefix = new RegExp(`^(?:${country.aliases.map(spaced).join("|")})(?:\\s+|$)`, "iu").exec(share[1]);
  if (!prefix) return undefined;
  const component: BlendComponent = { origin_country: country.preset.country, percentage };
  let detail = share[1].slice(prefix[0].length).trim();
  const processing = new RegExp(`(?:^|\\s)(${componentProcessPattern})$`, "iu").exec(detail);
  if (processing) {
    component.process_method = parseProcess(processing[1]) as BlendComponent["process_method"];
    component.process_detail = processing[1];
    detail = detail.slice(0, processing.index).trim();
  }
  const variety = new RegExp(`(?:^|\\s)(${componentVarietyPattern}(?:\\s*[,/&+]\\s*${componentVarietyPattern})*)$`, "iu").exec(detail);
  if (variety && !/\b(?:lot|batch|crop|harvest)\s*$/iu.test(detail.slice(0, variety.index))) {
    component.varietal = variety[1].replace(/\s*[,/&+]\s*/gu, ", ");
    detail = detail.slice(0, variety.index).trim();
  }
  // Gedeb is already a canonical Ethiopia region in 00010_normalize_origin_regions.sql.
  const regions = [...country.preset.regions, ...(country.preset.country === "Ethiopia" ? [{ name: "Gedeb", nameKo: "게데브" }] : [])]
    .sort((left, right) => right.name.length - left.name.length);
  for (const region of regions) {
    const match = new RegExp(`^(?:${spaced(region.name)}|${spaced(region.nameKo)})(?:\\s+|$)`, "iu").exec(detail);
    if (!match) continue;
    component.origin_region = region.name;
    detail = detail.slice(match[0].length).trim();
    break;
  }
  // A facility/farm marker identifies the whole printed name; unknown place tokens stay in evidence.
  if (detail && (/\b(?:station|mill|estate|farm|cooperative)\b\.?$/iu.test(detail) || /^(?:finca|hacienda|farm|producer)\s+/iu.test(detail)
    || /(?:농장|가공소|조합)$/u.test(detail))) component.farm_producer = detail;
  return component;
}

function parseWeight(value: string): number | undefined {
  // A paired metric declaration is independently readable when the ounce glyph
  // is damaged. Never reinterpret a digit as grams or derive a missing metric.
  const content = value.trim();
  if (!weightValuePattern.test(content)) return undefined;
  const quantities = [...content.matchAll(weightQuantitiesPattern)].map(match => ({
    amount: Number(match[1].startsWith("0,") ? match[1].replace(",", ".") : match[1].replaceAll(",", "")), unit: key(match[2]),
  }));
  const metric = quantities.filter(({ unit }) => unit !== "oz" && unit !== "0z").map(({ amount, unit }) =>
    amount * (["kg", "㎏", "킬로그램"].includes(unit) ? 1000 : 1));
  if (!metric.length || metric.some(grams => !Number.isInteger(grams) || grams <= 0 || grams > 100_000 || grams !== metric[0])) return undefined;
  if (quantities.some(({ amount, unit }) => unit === "oz" && Math.abs(amount * 28.349523125 - metric[0]) > 1)) return undefined;
  return metric[0];
}

function parseDate(value: string): string | undefined {
  const match = /^(\d{4})\s*(?:[-./]\s*|년\s*)(\d{1,2})\s*(?:[-./]\s*|월\s*)(\d{1,2})\s*일?\.?$/u.exec(value.trim())
    ?? /^(\d{4})(\d{2})(\d{2})$/u.exec(value.trim());
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : undefined;
}

const processAliases: Record<string, string[]> = {
  washed: ["washed", "fully washed", "wet process", "water washed", "워시드", "수세식", "수세", "vasket"],
  natural: ["natural", "dry process", "sun dried", "내추럴", "네추럴", "건식", "비수세식"],
  honey: ["honey", "black honey", "red honey", "yellow honey", "white honey", "허니", "블랙 허니", "레드 허니", "옐로우 허니", "화이트 허니"],
  anaerobic: ["anaerobic", "anaerobic fermentation", "anaerobic natural", "anaerobic washed", "무산소", "무산소 발효", "무산소 내추럴", "무산소 워시드"],
  carbonic: ["carbonic", "carbonic maceration", "카보닉", "카보닉 매서레이션", "탄소 침용"],
  decaf: ["decaf", "decaffeinated", "decaf coffee", "decaffeinated coffee", "swiss water decaf", "sugarcane decaf", "디카페인", "디카페인 커피"],
};
const processes = new Map(Object.entries(processAliases).flatMap(([method, aliases]) => aliases.map((alias) => [key(alias), method])));
const componentProcessPattern = Object.values(processAliases).flat().sort((left, right) => right.length - left.length).map(spaced).join("|");

/** Literal vocabulary for rejecting conflicting title aliases, never for
 * assigning product facts from a title alone. Longest process aliases win. */
export function labelTitleClassifiers(value: string): { countries: string[]; processes: string[] } {
  const pattern = new RegExp(`(?<![a-z])(${componentProcessPattern})(?![a-z])`, "giu");
  return {
    countries: countriesIn(value).map(({ preset }) => preset.country),
    processes: [...new Set([...value.matchAll(pattern)].map(match => processes.get(key(match[1]))!).filter(Boolean))],
  };
}
// These printed coffee accession names are vocabulary, not a rule that any five-digit number is a variety.
const componentVarietyPattern = `(?:${[...varietalPresets.flatMap((preset) => [preset.en, preset.ko]), "74110", "74158", "local landraces"]
  .sort((left, right) => right.length - left.length).map(spaced).join("|")})`;
const knownVarietyValue = new RegExp(`^${componentVarietyPattern}$`, "iu");
const knownVarietyList = new RegExp(`^${componentVarietyPattern}(?:\\s*[,/&+]\\s*${componentVarietyPattern})*$`, "iu");

/** A complete printed variety phrase, without accepting partial matches. */
export function isKnownLabelVariety(value: string): boolean {
  return knownVarietyValue.test(value.trim());
}
const roastLevels = new Map(Object.entries({
  light: ["light", "light roast", "라이트", "라이트 로스트", "약배전"],
  medium: ["medium", "medium roast", "미디엄", "미디엄 로스트", "중배전"],
  dark: ["dark", "dark roast", "다크", "다크 로스트", "강배전"],
}).flatMap(([level, aliases]) => aliases.map((alias) => [key(alias), level])));

function parseProcess(value: string): string | undefined {
  const clean = value.replace(/\s+(?:process(?:ed|ing)?|프로세스)$/iu, "");
  const direct = processes.get(key(clean));
  if (direct) return direct;
  // Bilingual duplicate names denote one method; competing methods do not.
  const bilingual = clean.split(/\s*[/()]\s*/u).filter(Boolean);
  if (bilingual.length > 1) {
    const methods = bilingual.map(part => processes.get(key(part)));
    if (methods.every(method => method && method === methods[0])) return methods[0];
  }
  // A printed duration qualifies the exact recognized process, without guessing
  // arbitrary experimental terminology or altering its display detail.
  const timed = /^(?:\d{1,3}(?:\.\d+)?\s*(?:h|hrs?|hours?|시간)\s+)(.+)$|^(.+?)\s+\d{1,3}(?:\.\d+)?\s*(?:h|hrs?|hours?|시간)$/iu.exec(clean);
  return timed ? processes.get(key(timed[1] ?? timed[2])) : undefined;
}

const genericProcessNames = new Set([
  "washed", "natural", "honey", "anaerobic", "anaerobic fermentation", "carbonic", "carbonic maceration", "decaf", "decaffeinated", "decaf coffee", "decaffeinated coffee", "디카페인 커피",
  "워시드", "수세식", "수세", "내추럴", "네추럴", "건식", "비수세식", "허니", "무산소", "무산소 발효", "카보닉", "카보닉 매서레이션", "탄소 침용", "디카페인",
].map(key));

function hasSpecificProcessDetail(value: string) {
  const names = value.replace(/\s+(?:process(?:ed|ing)?|프로세스)$/iu, "").split(/\s*[/()]\s*/u).filter(Boolean);
  return !names.length || !names.every(name => genericProcessNames.has(key(name)));
}

const processDetailVocabulary = new RegExp(`(?<![\\p{L}\\p{N}])(?:${componentProcessPattern}|ferment(?:ed|ation|ing)?|maceration|pulp(?:ed|ing)|drying|experimental|processing|inoculation|thermal\\s+shock)(?![\\p{L}\\p{N}])|발효|건조|침용|탈각|효모|열\\s*충격`, "iu");
const processDuration = /(?<!\d)\d{1,3}(?:\.\d+)?\s*(?:h(?:rs?|ours?)?|days?|시간|일)(?![\p{L}\p{N}])/iu;
const sensoryNarrative = /\b(?:flavou?rs?|aroma|acidity|sweetness|finish|body|tasting|notes?)\b|향미|산미|단맛|달콤|상큼|여운/iu;

function hasProcessDetailEvidence(value: string): boolean {
  if (parseProcess(value)) return true;
  if (parseDate(value) || isLabelMetadataLine(value) || promotionalPattern.test(value) || sensoryNarrative.test(value)) return false;
  const flavors = noteTokens(value);
  if (flavors.length > 1 && flavors.every(isFlavorPhrase)) return false;
  // A processing heading can sit next to a sensory column in OCR order. An
  // unrecognized string is not itself evidence of a special processing method.
  return processDetailVocabulary.test(value) || processDuration.test(value);
}

function headingStart(line: string): { field: ParserField; end: number } | undefined {
  const wrapped = /^(?:[-•]\s*)?(?:\[([^\]]+)\]|【([^】]+)】|\(([^)]+)\))\s*[:：=]?\s*/u.exec(line);
  const bilingual = bilingualLabel.exec(line);
  const decorated = wrapped ?? bilingual;
  if (decorated) {
    const aliases = wrapped ? (wrapped[1] ?? wrapped[2] ?? wrapped[3]).split(/\s*[/|]\s*/u) : [bilingual![1], bilingual![2]];
    const fields = aliases.map(alias => labelFields.get(key(alias)));
    if (fields.length && fields.every(field => field && field === fields[0])) return { field: fields[0]!, end: decorated[0].length };
    return undefined;
  }
  const first = firstLabel.exec(line);
  return first ? { field: labelFields.get(key(first[1]))!, end: first[0].length } : undefined;
}

function hasHeading(line: string): boolean {
  return Boolean(headingStart(line));
}

function segments(line: string): { field: ParserField; value: string }[] {
  // A complete package category can prefix an explicit net-weight declaration.
  // Keep the original line as evidence; only its grammatical prefix is skipped.
  line = line.replace(/^(?:whole\s*bean|ground|roasted)\s+coffee\s+(?=net\s*(?:wt\.?|weight)\b)/iu, "");
  const roastFirst = /^(light|medium|dark)\s+roast\s+level(?:\s*[-:：]\s*(.+))?$/iu.exec(line);
  if (roastFirst) return [{ field: "roast_level", value: roastFirst[1] },
    ...(roastFirst[2] ? [{ field: "tasting_notes" as const, value: roastFirst[2] }] : [])];
  // The literal provenance construction separates producer from growing place.
  // A missing preposition is not repaired from a familiar producer's name.
  const provenance = /^produceret\s+af\s+(.+?)\s+i\s+([^,]+),\s*(.+)$/iu.exec(line);
  if (provenance && parseCountry(provenance[3])) return [
    { field: "farm_producer", value: provenance[1] }, { field: "origin_region", value: provenance[2] },
    { field: "origin_country", value: provenance[3] },
  ];
  const first = headingStart(line);
  if (!first) return [];
  const found: { field: ParserField; value: string }[] = [];
  let field = first.field;
  let start = first.end;
  nextLabel.lastIndex = start;
  for (const match of line.matchAll(nextLabel)) {
    found.push({ field, value: line.slice(start, match.index).trim() });
    field = labelFields.get(key(match[1]))!;
    start = match.index! + match[0].length;
  }
  found.push({ field, value: line.slice(start).trim() });
  return found;
}

/** A typed heading cannot make adjacent sensory prose a processing value. */
export function isLabelProcessProse(heading: string, value: string): boolean {
  const parts = segments(heading);
  if (parts.length !== 1 || parts[0].value || !["process_method", "process_detail"].includes(parts[0].field)
    || hasProcessDetailEvidence(value)) return false;
  const flavors = noteTokens(value);
  return sensoryNarrative.test(value) || promotionalPattern.test(value) || isFlavorPhrase(value)
    || flavors.length > 1 && flavors.every(isFlavorPhrase) || value.trim().split(/\s+/u).length >= 5;
}

/** A failed printed weight is eligible for another pixel reading, never a guessed unit. */
export function hasUnreadableLabelWeight(text: string): boolean {
  return text.split(/\r?\n/u).some((line) => segments(line.trim())
    .some(({ field, value }) => field === "weight_g" && /^\d/u.test(value) && parseWeight(value) === undefined));
}

/** Parse printed facts locally. OCR text is data; no instructions or code in it are executed. */
export function parseBeanLabelText(text: string): LabelExtraction {
  const candidates = new Map<LabelField, Map<string, Candidate>>();
  const blocked = new Set<LabelField>();
  const standalone: { text: string; evidence: string; lineIndex: number }[] = [];
  const impliedProcessDetails: Candidate[] = [];
  const componentRows: { value: BlendComponent; evidence: string; printedText: string }[] = [];
  const tastingNotes: { en: string[]; ko: string[] } = { en: [], ko: [] };
  const tastingEvidence: string[] = [];
  let invalidComponents = false;
  let blend = false;
  let single = false;
  let excludedSection = false;
  let nutritionSection = false;
  let notesContext = false;
  let notesListComplete = false;
  const lines = text.slice(0, 100_000).split(/\r?\n/u).map((line) => line.trim());

  function add(field: LabelField, value: string | number | undefined, evidence: string) {
    if (value === undefined || value === "") return;
    const values = candidates.get(field) ?? new Map<string, Candidate>();
    const valueKey = typeof value === "number" ? String(value) : value.trim().toLowerCase().replace(/\s+/gu, " ");
    if (!values.has(valueKey)) values.set(valueKey, { value, evidence });
    candidates.set(field, values);
  }

  function read(field: ParserField, value: string, evidence: string) {
    if (!value || field === "ignore" || field === "tasting_notes") return;
    if (field === "origin_country") {
      // A table rule can be read as an extra delimiter immediately after this
      // heading. Only this country's prefix is tolerated; evidence stays printed.
      const originValue = value.replace(/^(?:[:：=]\s*){1,2}/u, "");
      readComponents(originValue, evidence, true);
      if (countriesIn(originValue).length > 1 || hasOriginShare(originValue) || blendPattern.test(originValue)) {
        blend = true;
        blocked.add("origin_country");
      }
      const country = parseCountry(originValue);
      if (!country) blocked.add("origin_country");
      add(field, country, evidence);
    } else if (field === "weight_g") {
      const weight = parseWeight(value);
      if (weight === undefined) blocked.add(field);
      add(field, weight, evidence);
    } else if (field === "roast_date") {
      const date = parseDate(value);
      if (!date) blocked.add(field);
      add(field, date, evidence);
    } else if (field === "roast_level") {
      const roast = roastLevels.get(key(value));
      if (!roast) blocked.add(field);
      add(field, roast, evidence);
    } else if (field === "process_method") {
      const method = parseProcess(value);
      if (!method) blocked.add(field);
      add(field, method, evidence);
      if (hasSpecificProcessDetail(value) && hasProcessDetailEvidence(value)) impliedProcessDetails.push({ value, evidence });
    } else if (field === "process_detail") {
      if (hasProcessDetailEvidence(value)) add(field, value, evidence);
    } else if (field === "varietal" && (parseProcess(value) || roastLevels.has(key(value)) || isLabelMetadataLine(value))) {
      // A neighboring processing or roast column cannot become a cultivar.
      blocked.add(field);
    } else if (field === "name" && isLabelMetadataLine(value)) {
      blocked.add(field);
    } else {
      add(field, value, evidence);
    }
  }

  function readComponents(value: string, evidence: string, labelled = false) {
    if (!value.includes("%")) {
      if (!labelled && parseCountry(value)) invalidComponents = true;
      return;
    }
    if (countriesIn(value).length === 0) {
      if (/%\s*$/u.test(value) && /\p{L}/u.test(value) && !/^(?:arabica|robusta|아라비카|로부스타)\s*100\s*%$/iu.test(value)) invalidComponents = true;
      return;
    }
    const rows = value.split(/\s*%\s*(?:(?:[/,;+|&]|\band\b)\s*)?(?=\p{L})/iu);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] + (index < rows.length - 1 ? "%" : "");
      const parsed = parseBlendComponent(row);
      if (!parsed) invalidComponents = true;
      else componentRows.push({ value: parsed, evidence, printedText: row.trim() });
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    if (!line) {
      excludedSection = false;
      notesContext = false;
      continue;
    }
    // Evidence must remain a short, readable original line, including OCR spacing.
    if (line.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(line)) continue;
    const roastCategory = /^(light|medium|dark)\s+roast(?:\s+(blend|coffee))?$/iu.exec(line);
    if (roastCategory) {
      add("roast_level", roastCategory[1].toLowerCase(), line);
      blend ||= roastCategory[2]?.toLowerCase() === "blend";
      excludedSection = false;
      notesContext = false;
      continue;
    }
    // OCR can put a heading on its own line. One extra blank needs either a
    // following heading or a complete known value under an explicit variety
    // heading. Neither path skips prose or guesses a missing label.
    const heading = segments(line);
    let valueIndex = index + 1;
    if (lines[valueIndex] === "") {
      const nextHeading = lines[valueIndex + 2] || lines[valueIndex + 3] || "";
      const adjacentVariety = heading.length === 1 && heading[0].field === "varietal" && !heading[0].value
        && knownVarietyValue.test(lines[valueIndex + 1] ?? "");
      if (hasHeading(nextHeading) || adjacentVariety) valueIndex += 1;
    }
    const following = lines[valueIndex] ?? "";
    if (heading.length === 1 && heading[0].field !== "ignore" && !heading[0].value
      && following && !hasHeading(following) && !recipePattern.test(following) && !nutritionPattern.test(following)
      && !isLabelMetadataLine(following)
      && (!["process_method", "process_detail"].includes(heading[0].field) || hasProcessDetailEvidence(following))
      && (heading[0].field !== "roastery" || following.replace(/\s/gu, "").length >= 2)
      && line.length + following.length < 500
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(following)) {
      line = `${line} ${following}`;
      index = valueIndex;
    }
    // Join only an actual wrapped list: every continuation must be a complete
    // vocabulary value and the previous row must print its separator. A broken
    // list blocks a misleading suffix-only varietal rather than completing it.
    const varietyHeading = segments(line);
    const varietyStart = varietyHeading.length === 1 && varietyHeading[0].field === "varietal"
      ? varietyHeading[0].value : !varietyHeading.length ? line : "";
    if (!excludedSection && /[,/&+]\s*$/u.test(varietyStart)
      && knownVarietyList.test(varietyStart.replace(/[,/&+]\s*$/u, ""))) {
      let value = varietyStart;
      let evidence = line;
      let cursor = index;
      let valid = true;
      while (/[,/&+]\s*$/u.test(value) && cursor < index + 8) {
        const followingValue = lines[cursor + 1] ?? "";
        if (!knownVarietyList.test(followingValue.replace(/[,/&+]\s*$/u, ""))) { valid = false; break; }
        value += ` ${followingValue}`;
        evidence += `\n${followingValue}`;
        cursor++;
      }
      if (valid && knownVarietyList.test(value)) {
        add("varietal", value.replace(/\s*[,/&+]\s*/gu, ", "), evidence);
        index = cursor;
        continue;
      }
      blocked.add("varietal");
    }
    // Unlabelled fragments after a heading remain in that heading's value.
    const parts = hasHeading(line) ? [line] : line.split(/[|¦;]/u).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const labelled = segments(part);
      if (nutritionPattern.test(part)) nutritionSection = true;
      if (recipePattern.test(part)) excludedSection = true;
      if (!labelled.length && notesContext && (parseCountry(part) || parseWeight(part) !== undefined
        || isLabelMetadataLine(part) || (notesListComplete && (parseProcess(part) || roastLevels.has(key(part)) || knownVarietyList.test(part))))) {
        notesContext = false;
        excludedSection = false;
      }
      if (!labelled.length && (excludedSection || nutritionSection)) continue;
      // A product title can explicitly identify a blend; a tasting note cannot.
      if (!labelled.length || labelled.some(({ field }) => field === "name" || field === "origin_country")) {
        blend ||= blendPattern.test(part);
        single ||= singlePattern.test(part);
      }
      if (labelled.length) {
        for (const { field, value } of labelled) {
          excludedSection = field === "ignore" || field === "tasting_notes";
          notesContext = field === "tasting_notes";
          notesListComplete = notesContext && noteTokens(value).length >= 2;
          nutritionSection = false;
          read(field, value, line);
        }
        continue;
      }
      const countryMatches = countriesIn(part);
      readComponents(part, line);
      if ((countryMatches.length > 1 && /[/,+&%]|\band\b|\bblend\b|혼합/iu.test(part)) || hasOriginShare(part)) {
        blend = true;
        blocked.add("origin_country");
      }
      const country = parseCountry(part);
      add("origin_country", country, line);
      // An exact region/country pair identifies the growing place. Do not
      // assign an unfamiliar word in a product title a farm or region role.
      const location = parseOriginLocation(part);
      if (location) {
        add("origin_country", location.country, line);
        add("origin_region", location.region, line);
      }
      const excludedNearby = [lines[index - 1] ?? "", lines[index + 1] ?? ""]
        .some(line => recipePattern.test(line) || nutritionPattern.test(line));
      if (!excludedNearby) add("weight_g", parseWeight(part), line);
      if (isLabelMetadataLine(part)) continue;
      const method = parseProcess(part);
      add("process_method", method, line);
      if (method && hasSpecificProcessDetail(part)) impliedProcessDetails.push({ value: part, evidence: line });
      add("roast_level", roastLevels.get(key(part)), line);
      if (!country) standalone.push({ text: part, evidence: line, lineIndex: index });
    }
  }

  const columnShares = standalone.flatMap(item => {
    const match = /^(\d+(?:\.\d+)?)\s*%\s+\p{L}/u.exec(item.text);
    const share = match ? Number(match[1]) : 0;
    return share > 0 && share < 100 && !/\b(?:off|discount|sale)\b|할인/iu.test(item.text) ? [share] : [];
  });
  if (columnShares.length >= 2 && columnShares.length <= 10 && columnShares.reduce((sum, value) => sum + value, 0) <= 100
    && (candidates.has("origin_country") || standalone.some(item => countriesIn(item.text).length > 0))
    && candidates.has("process_method")) {
    blend = true;
    // In a column layout each processing label belongs to one lot. A readable
    // first lot cannot establish a processing method for the entire blend.
    blocked.add("process_method");
    blocked.add("process_detail");
  }

  if (componentRows.length > 0) {
    const firstComponent = lines.indexOf(componentRows[0].evidence);
    const titles = standalone.filter((item) => {
      const index = lines.indexOf(item.evidence);
      return index >= 0 && index < firstComponent && lines.slice(index, firstComponent).filter(Boolean).length <= 3 && item.text.length <= 200
        && blendPattern.test(item.text) && !/[:：=]/u.test(item.text)
        && !/^(?:blend|blends|블렌드|블렌딩|혼합)$/iu.test(item.text.trim())
        && !recipePattern.test(item.text) && countriesIn(item.text).length === 0;
    });
    if (titles.length === 1) {
      const title = titles[0];
      if (!candidates.has("name")) add("name", title.text, title.evidence);
    }
  }

  // A printed roaster descriptor identifies its brand independently of whether
  // the product is a blend. Excluded sections never enter the standalone list.
  if (!candidates.has("roastery")) {
    const descriptor = /^(?:(.+?)\s+)?(coffee\s+roasters?|커피\s*로스터스)$/iu;
    const brandReadable = (brand: string) => Boolean(brand && brand.length <= 80 && !hasHeading(brand) && !isLabelMetadataLine(brand)
      && countriesIn(brand).length === 0 && !originPlaceNames.has(key(brand))
      && !blendPattern.test(brand) && !singlePattern.test(brand) && !parseProcess(brand)
      && !roastLevels.has(key(brand)) && parseWeight(brand) === undefined && !/^from(?:\b|[.：:\-])/iu.test(brand)
      && !/\b(?:finca|hacienda|farms?|farmers?|source|origin|station|estate|cooperative|region|province|city|village|district|street|avenue|road|address)\b|농장|생산지|산지|주소/iu.test(brand)
      && !brand.split(/[\s.&'’\-]+/u).every(word => /^(?:coffee|coffees|specialty|roaster|roasters|roastery|company|co|cafe|beans?|커피|스페셜티|로스터스)$/iu.test(word))
      && ![...(candidates.get("name")?.values() ?? [])].some(candidate => typeof candidate.value === "string" && key(candidate.value) === key(brand))
      && /\p{L}/u.test(brand) && /^[\p{L}\p{N} .&'’\-]+$/u.test(brand));
    for (let index = 0; index < standalone.length; index += 1) {
      const item = standalone[index];
      const wordmark = descriptor.exec(item.text);
      if (!wordmark) continue;
      const previous = standalone[index - 1];
      const adjacent = previous && previous.lineIndex < item.lineIndex
        && lines.slice(previous.lineIndex + 1, item.lineIndex).every((line) => !line);
      const brand = wordmark[1] ?? (adjacent ? previous.text : "");
      if (!brandReadable(brand)) continue;
      add("roastery", brand, wordmark[1] ? item.evidence : `${previous.evidence} / ${item.evidence}`);
    }

    // FROM is weaker evidence than an explicit wordmark. Require a nearby named
    // product, printed composition and coffee text; source places stay excluded.
    const name = candidates.get("name");
    if (!candidates.has("roastery") && name?.size === 1 && componentRows.length > 0) {
      const titleIndex = lines.indexOf([...name.values()][0].evidence);
      const context = standalone.filter((item) => item.lineIndex < titleIndex).slice(-5);
      const coffeeContext = context.filter((item) => /\bcoffee\b|커피/iu.test(item.text));
      if (titleIndex >= 0 && coffeeContext.length > 0) {
        for (const item of context) {
          const mark = /^from[.：:\-\s]+(.+)$/iu.exec(item.text);
          if (!mark || !brandReadable(mark[1]) || /[a-z]/u.test(mark[1])
            || /^(?:our|the|your|their|a|an|fresh|selected|local|best|beans?)\b/iu.test(mark[1])
            || /\b(?:farms?|farmers?|source|origin|station|estate|cooperative|region|province|city|village|district)\b|농장|생산지|산지/iu.test(mark[1])) continue;
          add("roastery", mark[1], [...coffeeContext.map((entry) => entry.evidence), item.evidence].join(" / "));
        }
      }
    }
  }

  // Keep printed cup notes separate from the drinker's own impressions. Known
  // vocabulary anchors an unlabelled list; spelling stays exactly as read.
  function readNotes(value: string, evidence: string, explicit: boolean): boolean {
    if (isLabelMetadataLine(value) || hasHeading(value) || promotionalPattern.test(value) || parseCountry(value)) return false;
    const weight = trailingWeight.exec(value);
    const content = weight ? value.slice(0, weight.index).trim() : value;
    let tokens = noteTokens(content);
    if (!explicit) {
      // A Korean list can contain Latin OCR noise. Its Korean vocabulary is
      // evidence only for Korean notes, not for unrelated Latin fragments.
      const anchored = (language: "en" | "ko") => tokens.filter(note => (/[가-힣]/u.test(note) ? "ko" : "en") === language)
        .filter(isFlavorPhrase).length >= 2;
      const en = anchored("en");
      const ko = anchored("ko");
      tokens = tokens.filter(note => /[가-힣]/u.test(note) ? ko : en);
    }
    if (!tokens.length) return false;
    if (!explicit && (blendPattern.test(content) || /[:：=%]/u.test(content))) return false;
    for (const token of tokens) {
      const language = /[가-힣]/u.test(token) ? "ko" : "en";
      if (tastingNotes[language].length < 20 && !tastingNotes[language].some(note => key(note) === key(token))) tastingNotes[language].push(token);
    }
    if (tastingEvidence.length < 10 && !tastingEvidence.includes(evidence)) tastingEvidence.push(evidence);
    if (weight) add("weight_g", parseWeight(weight[1]), evidence);
    return true;
  }
  let notesSection = false;
  let notesStarted = false;
  let notesWrapped = false;
  let excludedNotesSection = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) { notesSection = false; notesStarted = false; excludedNotesSection = false; continue; }
    if (line.length > 500) continue;
    if (recipePattern.test(line) || nutritionPattern.test(line)) {
      notesSection = false;
      excludedNotesSection = true;
      continue;
    }
    const labelled = segments(line);
    if (labelled.length) {
      for (const { field, value } of labelled) {
        notesSection = field === "tasting_notes";
        notesStarted = false;
        notesWrapped = /[,，;；|¦/]+\s*$/u.test(value);
        excludedNotesSection = field === "ignore";
        if (notesSection && value) notesStarted = readNotes(value, line, true);
      }
      continue;
    }
    if (excludedNotesSection || recipePattern.test(lines[index - 1] ?? "") || recipePattern.test(lines[index + 1] ?? "")) continue;
    // A printed serial is one metadata row, not a heading that owns every
    // following row. Do not suppress a later independent flavor list.
    if (serialNumber.test(line)) {
      notesSection = false;
      notesStarted = false;
      notesWrapped = false;
      continue;
    }
    if (isLabelMetadataLine(line) || promotionalPattern.test(line)) {
      notesSection = false;
      excludedNotesSection = true;
      continue;
    }
    const weight = parseWeight(line);
    if (notesSection && weight !== undefined) {
      add("weight_g", weight, line);
      notesSection = false;
      continue;
    }
    let noteLine = line;
    let noteEvidence = line;
    // A trailing list separator can wrap a printed cup-note list across OCR
    // blocks. Join only another list, never an unrelated following heading.
    if (/[,，;；|¦/]+\s*$/u.test(line)) {
      let next = index + 1;
      while (next < lines.length && !lines[next] && next <= index + 3) next++;
      const continuation = lines[next] ?? "";
      const continuationTokens = noteTokens(continuation);
      const listContinuation = /[,，;；|¦/]/u.test(continuation) && continuationTokens.length >= 2;
      const finalFlavor = continuationTokens.length === 1 && isFlavorPhrase(continuationTokens[0]) && noteTokens(line).some(isFlavorPhrase);
      if (next <= index + 3 && (listContinuation || finalFlavor) && !segments(continuation).length
        && !recipePattern.test(continuation) && !nutritionPattern.test(continuation)
        && !/[:：=%\d]/u.test(continuation)) {
        noteLine += ` ${continuation}`;
        noteEvidence += `\n${continuation}`;
        index = next;
      }
    }
    const continuation = noteTokens(noteLine);
    const anchoredContinuation = continuation.length >= 2 && continuation.some(isFlavorPhrase);
    const wrappedContinuation = notesWrapped && continuation.length > 0 && continuation.every(isFlavorPhrase);
    const explicit = notesSection && (!notesStarted || anchoredContinuation || wrappedContinuation);
    if (!explicit) notesSection = false;
    if (readNotes(noteLine, noteEvidence, explicit)) notesStarted = true;
    else notesSection = false;
    notesWrapped = /[,，;；|¦/]+\s*$/u.test(noteLine);
  }

  const origin = candidates.get("origin_country");
  if (!blend && !blocked.has("origin_country") && origin?.size === 1) {
    const country = [...origin.values()][0].value;
    const preset = originPresets.find((entry) => entry.country === country);
    for (const item of standalone) {
      const region = preset?.regions.find((entry) => key(entry.name) === key(item.text) || key(entry.nameKo) === key(item.text));
      if (region) add("origin_region", region.name, item.evidence);
    }
  }
  for (const item of standalone) {
    if (/[,/&+]/u.test(item.text) && knownVarietyList.test(item.text)) {
      add("varietal", item.text, item.evidence);
      continue;
    }
    const varietal = varietalPresets.find((entry) => key(entry.en) === key(item.text) || key(entry.ko) === key(item.text));
    // Java is also a place name; its unlabelled appearance cannot establish a variety.
    if (varietal && varietal.en !== "Java" && varietal.en !== "Colombia") add("varietal", varietal.en, item.evidence);
  }
  if (!candidates.has("process_detail")) {
    for (const candidate of impliedProcessDetails) add("process_detail", candidate.value, candidate.evidence);
  }
  if ((candidates.get("process_method")?.size ?? 0) > 1) blocked.add("process_detail");
  if (blend) {
    for (const field of ["origin_country", "origin_region", "farm_producer", "varietal"] as const) blocked.add(field);
  }
  const fields = Object.fromEntries([...candidates].filter(([field, values]) => !blocked.has(field) && values.size === 1)
    .map(([field, values]) => [field, [...values.values()][0]]));
  const componentEvidence = [...new Set(componentRows.map((row) => row.evidence))].join(" / ");
  const validComponents = !invalidComponents && componentRows.length >= 2 && componentRows.length <= 10 && componentEvidence.length <= 500
    && componentRows.every(({ value }) => Math.abs(value.percentage * 100 - Math.round(value.percentage * 100)) <= 0.000001)
    && Math.abs(componentRows.reduce((sum, row) => sum + row.value.percentage, 0) - 100) <= 0.005;
  const mixedProcessing = validComponents && !candidates.has("process_method") && !blocked.has("process_method")
    && componentRows.every(({ value }) => Boolean(value.process_method))
    && new Set(componentRows.map(({ value }) => value.process_method)).size > 1;
  if (mixedProcessing) {
    fields.process_method = { value: "other", evidence: componentEvidence };
    if (!candidates.has("process_detail") && !blocked.has("process_detail")) fields.process_detail = {
      value: componentRows.map(({ value }) => `${value.process_detail ?? value.process_method} ${value.percentage}%`).join(" / "),
      evidence: componentEvidence,
    };
  }
  return normalizeLabelExtraction({
    bean_type: blend ? "blend" : single ? "single_origin" : "unknown",
    composition_lines: validComponents ? componentRows.map(row => row.printedText) : undefined,
    tasting_notes: tastingNotes,
    tasting_notes_evidence: tastingEvidence,
    fields: {
      ...fields,
      ...(validComponents ? { blend_components: {
        value: componentRows.map((row) => row.value),
        evidence: componentEvidence,
      } } : {}),
    },
  });
}
