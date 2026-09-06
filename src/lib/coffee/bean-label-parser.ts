import { originPresets } from "../../data/origin-presets.ts";
import { varietalPresets } from "../../data/varietal-presets.ts";
import { flavorPresets } from "../../data/flavor-wheel.ts";
import type { BlendComponent } from "../../types/database.ts";
import { normalizeLabelExtraction, type LabelExtraction, type LabelField } from "./bean-label.ts";

type ParserField = LabelField | "ignore";
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
  ["farm_producer", ["농장 및 생산자", "농장/생산자", "농장", "생산자", "프로듀서", "farm / producer", "farm", "producer", "estate"]],
  ["varietal", ["품종", "varietal", "varietals", "variety", "varieties", "cultivar"]],
  ["process_detail", ["가공 상세", "processing details", "processing detail", "process details", "process detail"]],
  ["process_method", ["가공 방식", "가공 방법", "가공법", "가공", "프로세싱", "processing method", "process method", "processing", "process"]],
  ["roast_date", ["로스팅 일자", "로스팅 날짜", "로스팅 일", "볶은 날", "roasting date", "roast date", "roasted date", "date roasted", "roasted on", "roasted"]],
  ["roast_level", ["로스팅 정도", "로스팅 레벨", "배전도", "roast level", "roast profile", "roast"]],
  ["weight_g", ["내용량", "순중량", "중량", "net weight", "net wt.", "net wt", "net contents", "weight", "net"]],
  // Recognize other headings only to keep their text out of adjacent fields.
  ["ignore", ["소비 기한", "유통 기한", "품질 유지 기한", "구매일", "수확일", "제조일", "포장일", "best before", "best by", "expiry date", "expiration date", "expires", "expiry", "purchased", "purchase date", "harvest date", "harvest", "packed on", "manufactured", "tasting notes", "cup notes", "컵 노트", "맛", "향미", "고도", "altitude", "roastery address", "address", "주소", "dose", "dosage", "water", "추출량", "물", "투입량", "사용량"]],
];

const labelEntries = labels.flatMap(([field, aliases]) => aliases.map((alias) => ({ field, alias, pattern: spaced(alias) })))
  .sort((left, right) => right.alias.replace(/\s+/gu, "").length - left.alias.replace(/\s+/gu, "").length);
const labelFields = new Map(labelEntries.map(({ field, alias }) => [key(alias), field]));
const labelPattern = labelEntries.map(({ pattern }) => pattern).join("|");
const firstLabel = new RegExp(`^(?:[-•]\\s*)?(${labelPattern})(?:\\s*[:：=]\\s*|\\s+|$)`, "iu");
const nextLabel = new RegExp(`(?:\\s+|\\s*[/,|¦;]\\s*)(${labelPattern})\\s*[:：=]\\s*`, "giu");
const recipePattern = /\b(?:brew(?:ing)?|recipe|dose|dosage|dosing|water|yield|ratio)\b|레\s*시\s*피|추\s*출|도\s*징|투\s*입|사\s*용\s*량|물\s*[:：=]/iu;
const blendPattern = new RegExp(`(?:\\b${spaced("blend")}s?\\b|${spaced("블렌드")}|${spaced("블렌딩")}|${spaced("혼합")})`, "iu");
const singlePattern = new RegExp(`(?:\\b${spaced("single origin")}\\b|${spaced("싱글 오리진")}|${spaced("단일 산지")})`, "iu");
const nutritionPattern = /\b(?:nutrition(?:al)?|per serving|protein|fat|sodium|carbohydrate|calories|ingredients)\b|영양|단백질|지방|나트륨|탄수화물|원재료|성분/iu;

function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, "");
}

const countries = originPresets.map((preset) => ({
  preset,
  aliases: [preset.country, preset.countryKo],
  patterns: [preset.country, preset.countryKo].map((alias) => new RegExp(`(?<![\\p{L}\\p{N}])${spaced(alias)}(?![\\p{L}\\p{N}])`, "giu")),
}));

function countriesIn(value: string) {
  return countries.filter(({ patterns }) => patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }));
}

function parseCountry(value: string): string | undefined {
  const matches = countriesIn(value);
  if (matches.length !== 1) return undefined;
  let remainder = value;
  for (const pattern of matches[0].patterns) {
    pattern.lastIndex = 0;
    remainder = remainder.replace(pattern, "");
  }
  // A bilingual duplicate or explicit 100% still denotes the same country.
  if (!/^[\s(),/]*$/u.test(remainder.replace(/100\s*%/gu, ""))) return undefined;
  return matches[0].preset.country;
}

function hasOriginShare(value: string): boolean {
  if (countriesIn(value).length !== 1) return false;
  const share = /(?:^|\s)(\d+(?:\.\d+)?)\s*%/u.exec(value);
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
  const match = /^([1-9]\d{0,2}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(kg|k\s*g|g|㎏|㎎|그램|킬로그램)\.?$/iu.exec(value.trim());
  if (!match || match[2] === "㎎") return undefined;
  const unit = key(match[2]);
  const grams = Number(match[1].replaceAll(",", "")) * (unit === "kg" || unit === "㎏" || unit === "킬로그램" ? 1000 : 1);
  return Number.isInteger(grams) && grams > 0 && grams <= 100_000 ? grams : undefined;
}

function parseDate(value: string): string | undefined {
  const match = /^(\d{4})\s*(?:[-./]\s*|년\s*)(\d{1,2})\s*(?:[-./]\s*|월\s*)(\d{1,2})\s*일?\.?$/u.exec(value.trim())
    ?? /^(\d{4})(\d{2})(\d{2})$/u.exec(value.trim());
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : undefined;
}

const processAliases: Record<string, string[]> = {
  washed: ["washed", "fully washed", "wet process", "water washed", "워시드", "수세식", "수세"],
  natural: ["natural", "dry process", "sun dried", "내추럴", "네추럴", "건식", "비수세식"],
  honey: ["honey", "black honey", "red honey", "yellow honey", "white honey", "허니", "블랙 허니", "레드 허니", "옐로우 허니", "화이트 허니"],
  anaerobic: ["anaerobic", "anaerobic fermentation", "anaerobic natural", "anaerobic washed", "무산소", "무산소 발효", "무산소 내추럴", "무산소 워시드"],
  carbonic: ["carbonic", "carbonic maceration", "카보닉", "카보닉 매서레이션", "탄소 침용"],
  decaf: ["decaf", "decaffeinated", "swiss water decaf", "sugarcane decaf", "디카페인"],
};
const processes = new Map(Object.entries(processAliases).flatMap(([method, aliases]) => aliases.map((alias) => [key(alias), method])));
const componentProcessPattern = Object.values(processAliases).flat().sort((left, right) => right.length - left.length).map(spaced).join("|");
// These printed coffee accession names are vocabulary, not a rule that any five-digit number is a variety.
const componentVarietyPattern = `(?:${[...varietalPresets.flatMap((preset) => [preset.en, preset.ko]), "74110", "74158"]
  .sort((left, right) => right.length - left.length).map(spaced).join("|")})`;
const roastLevels = new Map(Object.entries({
  light: ["light", "light roast", "라이트", "라이트 로스트", "약배전"],
  medium: ["medium", "medium roast", "미디엄", "미디엄 로스트", "중배전"],
  dark: ["dark", "dark roast", "다크", "다크 로스트", "강배전"],
}).flatMap(([level, aliases]) => aliases.map((alias) => [key(alias), level])));

function parseProcess(value: string): string | undefined {
  return processes.get(key(value.replace(/\s+(?:process(?:ed|ing)?|프로세스)$/iu, "")));
}

const genericProcessNames = new Set([
  "washed", "natural", "honey", "anaerobic", "anaerobic fermentation", "carbonic", "carbonic maceration", "decaf", "decaffeinated",
  "워시드", "수세식", "수세", "내추럴", "네추럴", "건식", "비수세식", "허니", "무산소", "무산소 발효", "카보닉", "카보닉 매서레이션", "탄소 침용", "디카페인",
].map(key));

function hasSpecificProcessDetail(value: string) {
  return !genericProcessNames.has(key(value.replace(/\s+(?:process(?:ed|ing)?|프로세스)$/iu, "")));
}

function segments(line: string): { field: ParserField; value: string }[] {
  const first = firstLabel.exec(line);
  if (!first) return [];
  const found: { field: ParserField; value: string }[] = [];
  let field = labelFields.get(key(first[1]))!;
  let start = first[0].length;
  nextLabel.lastIndex = start;
  for (const match of line.matchAll(nextLabel)) {
    found.push({ field, value: line.slice(start, match.index).trim() });
    field = labelFields.get(key(match[1]))!;
    start = match.index! + match[0].length;
  }
  found.push({ field, value: line.slice(start).trim() });
  return found;
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
  const standalone: { text: string; evidence: string }[] = [];
  const impliedProcessDetails: Candidate[] = [];
  const componentRows: { value: BlendComponent; evidence: string }[] = [];
  let invalidComponents = false;
  let blend = false;
  let single = false;
  let excludedSection = false;
  const lines = text.slice(0, 100_000).split(/\r?\n/u).map((line) => line.trim());

  function add(field: LabelField, value: string | number | undefined, evidence: string) {
    if (value === undefined || value === "") return;
    const values = candidates.get(field) ?? new Map<string, Candidate>();
    const valueKey = typeof value === "number" ? String(value) : value.trim().toLowerCase().replace(/\s+/gu, " ");
    if (!values.has(valueKey)) values.set(valueKey, { value, evidence });
    candidates.set(field, values);
  }

  function read(field: ParserField, value: string, evidence: string) {
    if (!value || field === "ignore") return;
    if (field === "origin_country") {
      readComponents(value, evidence, true);
      if (countriesIn(value).length > 1 || hasOriginShare(value) || blendPattern.test(value)) {
        blend = true;
        blocked.add("origin_country");
      }
      const country = parseCountry(value);
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
      if (hasSpecificProcessDetail(value)) impliedProcessDetails.push({ value, evidence });
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
      else componentRows.push({ value: parsed, evidence });
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    if (!line) {
      excludedSection = false;
      continue;
    }
    // Evidence must remain a short, readable original line, including OCR spacing.
    if (line.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(line)) continue;
    // OCR can put a heading on its own line. A single extra OCR blank is
    // crossed only when the next heading bounds this value as a label column.
    const heading = segments(line);
    let valueIndex = index + 1;
    if (lines[valueIndex] === "") {
      const nextHeading = lines[valueIndex + 2] || lines[valueIndex + 3] || "";
      if (firstLabel.test(nextHeading)) valueIndex += 1;
    }
    const following = lines[valueIndex] ?? "";
    if (heading.length === 1 && heading[0].field !== "ignore" && !heading[0].value
      && following && !firstLabel.test(following) && !recipePattern.test(following) && !nutritionPattern.test(following)
      && line.length + following.length < 500
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(following)) {
      line = `${line} ${following}`;
      index = valueIndex;
    }
    // Unlabelled fragments after a heading remain in that heading's value.
    const parts = firstLabel.test(line) ? [line] : line.split(/[|¦;]/u).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const labelled = segments(part);
      const recipe = recipePattern.test(part);
      if (recipe) excludedSection = true;
      if (!labelled.length && excludedSection) continue;
      // A product title can explicitly identify a blend; a tasting note cannot.
      if (!labelled.length || labelled.some(({ field }) => field === "name" || field === "origin_country")) {
        blend ||= blendPattern.test(part);
        single ||= singlePattern.test(part);
      }
      if (labelled.length) {
        for (const { field, value } of labelled) {
          excludedSection = field === "ignore";
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
      const recipeNearby = recipePattern.test(lines[index - 1] ?? "") || recipePattern.test(lines[index + 1] ?? "");
      if (!recipeNearby) add("weight_g", parseWeight(part), line);
      const method = parseProcess(part);
      add("process_method", method, line);
      if (method && hasSpecificProcessDetail(part)) impliedProcessDetails.push({ value: part, evidence: line });
      add("roast_level", roastLevels.get(key(part)), line);
      if (!country) standalone.push({ text: part, evidence: line });
    }
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
      const titleIndex = lines.indexOf(title.evidence);
      const context = lines.slice(0, titleIndex).filter(Boolean).slice(-5);
      const descriptor = /^(?:(.+?)\s+)?(coffee\s+roasters?|커피\s*로스터스)$/iu;
      const brandReadable = (brand: string) => Boolean(brand && brand.length <= 80 && !firstLabel.test(brand) && countriesIn(brand).length === 0
        && !blendPattern.test(brand) && /^[\p{L}\p{N} .&'’\-]+$/u.test(brand));
      const fromMarks = context.map((line) => ({ line, match: /^from[.：:\-\s]+(.+)$/iu.exec(line) }))
        .filter((item) => item.match && brandReadable(item.match[1]) && !/[a-z]/u.test(item.match[1])
          && !/^(?:our|the|your|their|a|an|fresh|selected|local|best|farms?|farmers|source|origin|beans?)\b/iu.test(item.match[1]));
      const coffeeContext = context.filter((line) => /\bcoffee\b|커피/iu.test(line));
      if (fromMarks.length && (coffeeContext.length >= 2 || context.some((line) => descriptor.test(line)))) {
        for (const item of fromMarks) add("roastery", item.match![1], [...coffeeContext, item.line].join(" / "));
      }
      for (let index = 0; !fromMarks.length && index < context.length; index += 1) {
        const wordmark = descriptor.exec(context[index]);
        if (!wordmark) continue;
        const brand = wordmark[1] ?? context[index - 1] ?? "";
        if (!brandReadable(brand)) continue;
        const evidence = wordmark[1] ? context[index] : `${brand} / ${context[index]}`;
        add("roastery", brand, evidence);
      }
    }
  }

  // A unit-bearing package weight can share a printed line with cup notes.
  if (componentRows.length > 0 || candidates.has("origin_country")) {
    let recipe = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) recipe = false;
      if (recipePattern.test(line)) recipe = true;
      else if (segments(line).some(({ field }) => field !== "ignore")) recipe = false;
      if (recipe || recipePattern.test(lines[index - 1] ?? "") || recipePattern.test(lines[index + 1] ?? "")) continue;
      if (nutritionPattern.test(line) || segments(line).some(({ field }) => field !== "ignore")) continue;
      const labelledNotes = /(?:tasting|cup)\s*notes|향미|컵\s*노트/iu.test(line);
      const flavors = flavorPresets.filter((flavor) => new RegExp(`\\b${spaced(flavor.tag.replaceAll("-", " "))}\\b|${spaced(flavor.tagKo)}`, "iu").test(line));
      if (!labelledNotes && (!/[,，]/u.test(line) || flavors.length < 2)) continue;
      const trailing = /(?:^|\s)(\d+(?:\.\d+)?\s*(?:kg|k\s*g|g|㎏|그램|킬로그램))\.?$/iu.exec(line);
      if (trailing) add("weight_g", parseWeight(trailing[1]), line);
    }
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
    fields: {
      ...fields,
      ...(validComponents ? { blend_components: {
        value: componentRows.map((row) => row.value),
        evidence: componentEvidence,
      } } : {}),
    },
  });
}
