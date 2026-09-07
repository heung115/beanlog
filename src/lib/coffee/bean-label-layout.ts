import type { LabelExtraction } from "./bean-label.ts";
import { originPresets } from "../../data/origin-presets.ts";
import { flavorPresets } from "../../data/flavor-wheel.ts";
import { isLabelMetadataLine, parseBeanLabelText } from "./bean-label-parser.ts";

type Box = { x0: number; y0: number; x1: number; y1: number };
type Line = { text: string; box: Box; height: number; orientation: "horizontal" | "vertical"; confidence: number; wordConfidence: number; excluded: boolean; country?: string; printedCountryPrefix?: string };
type Title = { lines: Line[]; text: string; box: Box; height: number };
type Brand = { lines: Line[]; text: string; descriptor: Line };
const compact = (text: string) => text.toLowerCase().replace(/[\s-]+/gu, "");
const countryNames = new Set(originPresets.flatMap(entry => [entry.country, entry.countryKo]).map(compact));
const placeNames = new Set(originPresets.flatMap((entry) => [entry.country, entry.countryKo,
  ...entry.regions.flatMap((region) => [region.name, region.nameKo])]).map(compact));
const flavorNames = new Set(flavorPresets.flatMap((entry) => [entry.tag, entry.tagKo]).map(compact));
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const explicitName = /^(?:[-•]\s*)?(?:상\s*품\s*명|제\s*품\s*명|원\s*두\s*명|커\s*피\s*명|p\s*r\s*o\s*d\s*u\s*c\s*t(?:\s*n\s*a\s*m\s*e)?|coffee\s*name|bean\s*name)(?:\s*[:：=]|\s+|$)/iu;
const explicitRoastery = /^(?:roaster(?:y|s)?|roasted\s*by|로\s*스\s*터\s*리|로\s*스\s*터)(?:\s*[:：=]|\s+|$)/iu;
const metadata = /^(?:country|origin|region|farm|producer|varietals?|variet(?:y|ies)|cultivar|process(?:ing)?|roast(?:ed|ing)?|net|weight|altitude|harvest|packed|best\s*before|expiry|원산지|생산국|국가|(?:생산|산지|재배)?\s*지역|농장|생산자|품종|가공(?:\s*방식|\s*방법|법)?|로스팅|내용량|중량|(?:재배)?\s*고도|수확|소비기한|유통기한)(?:\b|\s|[:：]|$)/iu;
const countryHeading = /^(?:country(?:\s+of\s+origin)?|origin(?:\s+country)?|원\s*산\s*지|생\s*산\s*국|국\s*가|산\s*지)(?:\s*[:：=]|\s+|$)/iu;
const countryPrefixes = originPresets.map(({ country, countryKo }) => ({ country,
  pattern: new RegExp(`^(?:${[country, countryKo].map(alias => [...alias.replace(/\s+/gu, "")]
    .map(character => character.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("[ \\t]*")).join("|")})(?![\\p{L}\\p{N}])`, "iu"),
}));
const titleCountry = (text: string) => countryPrefixes.find(({ pattern }) => pattern.test(text))?.country
  ?? originPresets.find(({ countryKo }) => text.replace(/\s+/gu, "").startsWith(countryKo.replace(/\s+/gu, "")))?.country;
const korean = (text: string) => /[가-힣]/u.test(text);
const broadGeography = /^(?:(?:(?:latin|north|south|central)\s*)?america|(?:(?:east|west|north|south|central)\s*)?(?:africa|asia|europe)|oceania|(?:라틴|북|남|중앙)?\s*아메리카|(?:동|서|북|남|중앙)?\s*아프리카|아시아|유럽|오세아니아)$/iu;
const excludedSection = /^(?:tasting(?:\s*notes?)?|cup\s*notes?|flavo[u]?r\s*notes?|tastes\s*like|notes?|nutrition|ingredients|brew(?:ing)?|recipe|(?:roastery\s*)?address|컵\s*노트|향미|영양|원재료|레시피|추출|주소)(?:\b|\s|[:：])/iu;
const roaster = /\broasters?\b|\broastery\b|로스터스|로스터리/iu;
const promotion = /\b(?:business|price|sale|discount|wholesale|shipping|subscribe|enjoy|favorite|favourite|freshly|delicious|perfect|crafted|quality|our|your|instructions|ignore)\b|\bfor\s+you\b|\bevery\s+(?:day|cup)\b|특가|할인|무료배송|추천|즐기|신선한/iu;
const coffeeProduct = /espresso|에스프레소|\b\w*blend\b|블렌드|decaf(?:feinated)?|디카페인/iu;
const coffeeContext = /\bcoffee\b|커피|espresso|에스프레소|\bblend\b|블렌드|decaf|디카페인|\b(?:country|origin|varietal|variety|process(?:ing)?)\b|원산지|생산국|품종|가공/iu;
const usageCategory = /^(?:milk[\s-]*based|filter|espresso)$/iu;
const sensoryDescription = /\b(?:sweet|creamy|juicy|smooth|floral|fruity)\b.*\b(?:chocolate|berries|fruit|caramel|nuts|citrus)\b|달콤|고소|향미/iu;
const generic = /^(?:coffee|coffee\s*beans?|coffee\s*blend|roasted\s*coffee|natural\s*coffee|specialty\s*coffee|single\s*origin|blend|milk[\s-]*based|filter|whole\s*beans?|ground\s*coffee|natural|washed|honey|white\s*honey|anaerobic|light\s*roast|medium\s*roast|dark\s*roast|커피|원두|블렌드|싱글\s*오리진|내추럴|워시드|허니)$/iu;
const packageCategory = /^(?:(?:specialty|speciality|roasted|fresh|whole\s*beans?|ground)\s+)+coffee$|^(?:seasonal|direct\s*trade|fair\s*trade|organic|limited\s*edition|(?:summer|winter|spring|autumn|fall)\s+collection|시즌\s*한정|한정\s*판매)$/iu;
const roastCategory = /^(?:light|medium|dark)(?:[ -](?:medium|dark))?(?:\s+roast(?:\s+level)?)?(?:\s+(?:coffee\s+)?blend)?$/iu;
const administrative = /(?:품\s*목\s*(?:제\s*조\s*)?보\s*고\s*번\s*호|사업자\s*등록|제조원|판매원|영수증|거래명세|주문번호)|\b(?:receipt|invoice|subtotal|total\s*due|order\s*(?:number|no)|batch\s*(?:number|no)|product\s*code)\b/iu;
const coffeeDescriptor = /^(?:(?:specialty|speciality)\s+)?(?:coffee|커피)(?:\s+roasters?)?$/iu;
const coffeeWordmark = (text: string) => /^(?:coffee|커피)\s+[\p{L}][\p{L} &'’\-]{2,60}$/iu.test(text)
  && !coffeeProduct.test(text) && !generic.test(text) && !sensoryDescription.test(text);
const packageWeight = /(?:(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:kg|g|oz|lb)\b|\bnet\s*(?:wt|weight)\b|중량|내용량)/iu;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundingBox(value: unknown): Box | undefined {
  if (!record(value)) return undefined;
  const { x0, y0, x1, y1 } = value;
  if (typeof x0 !== "number" || typeof y0 !== "number" || typeof x1 !== "number" || typeof y1 !== "number"
    || ![x0, y0, x1, y1].every(Number.isFinite) || x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0 || x1 > 100_000 || y1 > 100_000) return undefined;
  return { x0, y0, x1, y1 };
}

function printedCountryPrefix(text: string, words: Record<string, unknown>[]): string | undefined {
  const country = countryPrefixes.find(({ pattern }) => pattern.test(text))?.country;
  if (!country) return undefined;
  const prefix: string[] = [];
  for (const word of words.slice(0, 4)) {
    if (typeof word.text !== "string" || typeof word.confidence !== "number" || !Number.isFinite(word.confidence)
      || word.confidence < 95 || word.confidence > 100 || !boundingBox(word.bbox)) return undefined;
    prefix.push(word.text);
    if (countryPrefixes.find(({ pattern }) => pattern.test(prefix.join(" ")))?.country === country) return country;
  }
  return undefined;
}

function readLines(blocks: unknown): { lines: Line[]; hasExplicitName: boolean; hasExplicitRoastery: boolean } {
  const lines: Line[] = [];
  if (!Array.isArray(blocks)) return { lines, hasExplicitName: false, hasExplicitRoastery: false };
  let count = 0;
  let hasExplicitName = false;
  let hasExplicitRoastery = false;
  outer: for (const block of blocks.slice(0, 100)) {
    if (!record(block) || !Array.isArray(block.paragraphs)) continue;
    for (const paragraph of block.paragraphs.slice(0, 100)) {
      if (!record(paragraph) || !Array.isArray(paragraph.lines)) continue;
      for (const value of paragraph.lines.slice(0, 100)) {
        if (++count > 300) break outer;
        if (!record(value) || typeof value.text !== "string") continue;
        const text = value.text.trim();
        hasExplicitName ||= explicitName.test(text);
        hasExplicitRoastery ||= explicitRoastery.test(text);
        const box = boundingBox(value.bbox);
        if (!text || text.length > 500 || controls.test(text) || !box || typeof value.confidence !== "number"
          || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 100) continue;
        const words = Array.isArray(value.words) ? value.words.slice(0, 100).filter((word): word is Record<string, unknown> => record(word)
          && typeof word.text === "string" && /\p{L}/u.test(word.text)) : [];
        const confidences = words.map((word) => typeof word.confidence === "number" && Number.isFinite(word.confidence)
          && word.confidence >= 0 && word.confidence <= 100 ? word.confidence : 0);
        const heights = words.flatMap((word) => {
          const wordBox = boundingBox(word.bbox);
          return wordBox ? [wordBox.y1 - wordBox.y0] : [];
        }).sort((left, right) => left - right);
        const orientation = value.orientation === "vertical" ? "vertical" : "horizontal";
        if (orientation === "vertical" && (typeof value.fontSize !== "number" || !Number.isFinite(value.fontSize)
          || value.fontSize <= 0 || value.fontSize > Math.min(box.x1 - box.x0, box.y1 - box.y0) * 1.1)) continue;
        const height = orientation === "vertical" ? value.fontSize as number
          : heights.length ? heights[Math.floor(heights.length / 2)] : box.y1 - box.y0;
        const wordConfidence = confidences.length ? Math.min(...confidences) : 0;
        lines.push({ text, box, height, orientation, confidence: value.confidence,
          wordConfidence, excluded: false,
          printedCountryPrefix: printedCountryPrefix(text, words),
          country: value.confidence >= 85 && wordConfidence >= 80 ? parseBeanLabelText(text).fields.origin_country : undefined });
      }
    }
  }
  // OCR containers need not follow page order. A notes column must not hide a
  // product in another column, nor be reopened by that column's metadata.
  for (const heading of lines.filter(line => excludedSection.test(line.text))) {
    heading.excluded = true;
    for (const line of lines) {
      if (line === heading || line.box.y0 < heading.box.y0 || overlap(heading.box, line.box) < 0.3
        || line.box.y0 - heading.box.y1 > heading.height * 12 + line.height * 2) continue;
      const reset = lines.some(other => other !== heading && (metadata.test(other.text) || packageWeight.test(other.text) || packageCategory.test(other.text) || other.country)
        && overlap(heading.box, other.box) >= 0.3 && overlap(line.box, other.box) >= 0.3
        && other.box.y0 > heading.box.y0 && other.box.y0 <= line.box.y0);
      if (!reset) line.excluded = true;
    }
  }
  return { lines, hasExplicitName, hasExplicitRoastery };
}

function overlap(left: Box, right: Box): number {
  return Math.max(0, Math.min(left.x1, right.x1) - Math.max(left.x0, right.x0)) / Math.min(left.x1 - left.x0, right.x1 - right.x0);
}

function nearby(title: Title, line: Line): boolean {
  const gap = Math.max(0, line.box.y0 - title.box.y1, title.box.y0 - line.box.y1);
  return overlap(title.box, line.box) >= 0.3 && gap <= title.height * 6 + line.height * 2;
}

function groupTitles(lines: Line[]): Title[] {
  const titles: Title[] = [];
  for (const line of [...lines].sort((left, right) => left.box.y0 - right.box.y0 || left.box.x0 - right.box.x0)) {
    // A badge in another column must not split two aligned title rows.
    const matches = titles.filter(title => {
      const preceding = title.lines.at(-1)!;
      const gap = line.box.y0 - preceding.box.y1;
      const countryCaption = countryNames.has(compact(title.lines[0].text));
      // Separate printed language versions and vertical columns. A mixed-script
      // row can still be the continuation of one country-prefixed heading.
      const separateLanguage = korean(line.text) !== korean(preceding.text)
        && (titleCountry(line.text) || !titleCountry(title.text) || !(/[가-힣]/u.test(line.text) && /[a-z]/iu.test(line.text)));
      return line.orientation === "horizontal" && preceding.orientation === "horizontal" && !separateLanguage
        && title.lines.length < (countryCaption ? 2 : 3) && gap >= -Math.min(line.height, preceding.height) * 0.5
        && gap <= Math.min(line.height, preceding.height) * 0.75
        && Math.max(line.height, preceding.height) / Math.min(line.height, preceding.height) <= (countryCaption ? 1.85 : 1.5)
        && overlap(line.box, preceding.box) >= 0.65
        && !(titleCountry(title.text) && titleCountry(line.text));
    });
    const last = matches.length === 1 ? matches[0] : undefined;
    if (last) {
      last.lines.push(line);
      last.text += ` ${line.text}`;
      last.box = { x0: Math.min(last.box.x0, line.box.x0), y0: last.box.y0, x1: Math.max(last.box.x1, line.box.x1), y1: line.box.y1 };
      last.height = Math.max(last.height, line.height);
    } else titles.push({ lines: [line], text: line.text, box: { ...line.box }, height: line.height });
  }
  return titles;
}

function countrySupportedTitles(titles: Title[], lines: Line[], base: LabelExtraction): Title[] {
  const country = base.fields.origin_country;
  const evidence = base.evidence.origin_country;
  if (!country || !evidence || !countryHeading.test(evidence) || base.bean_type === "blend") return titles;
  const headings = lines.filter(line => countryHeading.test(line.text));
  const rows = headings.flatMap(heading => {
    if (heading.confidence < 85 || heading.wordConfidence < 80) return [];
    const inline = parseBeanLabelText(heading.text).fields.origin_country;
    if (inline) return [{ country: inline, lines: [heading] }];
    // Sparse OCR can return the heading and value as separate blocks on one row.
    if (heading.text.replace(countryHeading, "").trim()) return [];
    return lines.flatMap(value => {
      if (value === heading || value.confidence < 85 || value.wordConfidence < 80 || value.box.x0 < heading.box.x1
        || value.box.x0 - heading.box.x1 > heading.height * 8
        || Math.abs((value.box.y0 + value.box.y1 - heading.box.y0 - heading.box.y1) / 2) > Math.max(value.height, heading.height) * 0.7) return [];
      const parsed = parseBeanLabelText(`${heading.text}\n${value.text}`).fields.origin_country;
      return parsed ? [{ country: parsed, lines: [heading, value] }] : [];
    });
  });
  if (!rows.length || rows.some(row => row.country !== country)) return titles;
  const countryOf = (title: Title) => {
    const ownCountry = titleCountry(title.text);
    if (ownCountry) return ownCountry;
    const first = title.lines[0];
    // A damaged first caption row may be ineligible as a name, but its legible
    // country still belongs to the directly adjoining continuation. Otherwise
    // rejecting that row can turn its tail into an unrelated competing title.
    const preceding = lines.filter(line => !title.lines.includes(line) && !line.excluded && line.printedCountryPrefix
      && line.orientation === "horizontal" && first.orientation === "horizontal" && korean(line.text) === korean(first.text)
      && !metadata.test(line.text) && !administrative.test(line.text) && !promotion.test(line.text)
      && !/[%:：=]/u.test(line.text) && line.text.length <= 150
      && first.box.y0 - line.box.y1 >= -Math.min(first.height, line.height) * .5
      && first.box.y0 - line.box.y1 <= Math.min(first.height, line.height) * .75
      && Math.max(first.height, line.height) / Math.min(first.height, line.height) <= 1.5
      && overlap(first.box, line.box) >= .65
      && !lines.some(other => other !== line && !title.lines.includes(other)
        && overlap(other.box, first.box) >= .65
        && (other.box.y0 >= line.box.y1 && other.box.y1 <= first.box.y0
          || (metadata.test(other.text) || excludedSection.test(other.text) || packageWeight.test(other.text) || isLabelMetadataLine(other.text))
            && other.box.y0 + other.box.y1 > line.box.y0 + line.box.y1
            && other.box.y0 + other.box.y1 < first.box.y0 + first.box.y1)));
    return preceding.length === 1 ? preceding[0].printedCountryPrefix : undefined;
  };
  // Removing a conflicting country heading cannot manufacture support for an
  // unrelated heading whose country was never read (e.g. a longer word).
  if (titles.some(title => countryOf(title) && countryOf(title) !== country)
    && !titles.some(title => titleCountry(title.text) === country)) return [];
  return titles.filter(title => !countryOf(title) || countryOf(title) === country
    || !rows.some(row => row.lines.every(line => nearby(title, line))));
}

function titleProcesses(text: string): Set<string> {
  const normalized = text.replace(/\s+(?:coffee|커피)$/iu, "");
  const words = normalized.split(/\s+/u);
  const suffixes = words.map((_, index) => words.slice(index).join(" "));
  // Korean OCR may omit all word spacing. Only a parser-recognized complete
  // suffix contributes a process; the title text itself is never rewritten.
  if (/[가-힣]$/u.test(normalized)) suffixes.push(...[...normalized].map((_, index) => [...normalized].slice(index).join("")));
  return new Set(suffixes.flatMap(suffix => {
    const method = parseBeanLabelText(`Process: ${suffix}`).fields.process_method;
    return method && method !== "other" ? [method] : [];
  }));
}

function titleProcessMethods(title: Title, lines: Line[]): Set<string> {
  const methods = titleProcesses(title.text);
  for (const line of lines) {
    if (title.lines.includes(line) || line.confidence < 85 || line.wordConfidence < 80
      || line.box.y0 < title.box.y1 || line.box.y0 - title.box.y1 > title.height * .75 || overlap(title.box, line.box) < .8) continue;
    const method = parseBeanLabelText(`Process: ${line.text.replace(/\s+(?:coffee|커피)$/iu, "")}`).fields.process_method;
    if (method && method !== "other") methods.add(method);
  }
  return methods;
}

function compatibleBilingualTitles(titles: Title[]): boolean {
  if (titles.length !== 2 || korean(titles[0].text) === korean(titles[1].text)) return false;
  const [a, b] = titles;
  const country = titleCountry(a.text);
  return Boolean(country && country === titleCountry(b.text) && overlap(a.box, b.box) >= .8
    && Math.max(0, a.box.y0 - b.box.y1, b.box.y0 - a.box.y1) <= Math.max(a.height, b.height));
}

function stackedBrands(lines: Line[]): Brand[] {
  const brands: Brand[] = [];
  for (const descriptor of lines) {
    if (!coffeeDescriptor.test(descriptor.text) || descriptor.excluded || descriptor.confidence < 85 || descriptor.wordConfidence < 80) continue;
    for (const brand of lines) {
      if (brand === descriptor || brand.excluded || brand.confidence < 85 || brand.wordConfidence < 80
        || !/^[\p{L}][\p{L} .&'’\-]{2,79}$/u.test(brand.text) || brand.text.split(/\s+/u).length > 3
        || placeNames.has(compact(brand.text)) || flavorNames.has(compact(brand.text)) || promotion.test(brand.text)
        || generic.test(brand.text) || coffeeProduct.test(brand.text) || metadata.test(brand.text) || roaster.test(brand.text)) continue;
      const gap = descriptor.box.y0 - brand.box.y1;
      const widthRatio = (brand.box.x1 - brand.box.x0) / (descriptor.box.x1 - descriptor.box.x0);
      if (gap >= -Math.min(brand.height, descriptor.height) * .25 && gap <= brand.height * 1.25 && overlap(brand.box, descriptor.box) >= 0.8 && widthRatio >= 0.4 && widthRatio <= 3
        && Math.max(brand.height, descriptor.height) / Math.min(brand.height, descriptor.height) <= 4
        && !lines.some(other => other !== brand && other !== descriptor && other.confidence >= 85
          && other.box.y0 >= brand.box.y1 && other.box.y1 <= descriptor.box.y0 && overlap(other.box, descriptor.box) >= 0.8)) {
        const chain = [brand];
        while (chain.length < 3) {
          const first = chain[0];
          const preceding = lines.filter(other => other !== descriptor && !chain.includes(other) && !other.excluded
            && other.confidence >= 85 && other.wordConfidence >= 80 && /^[\p{L}][\p{L} &'’\-]{2,79}$/u.test(other.text)
            && !generic.test(other.text) && !coffeeProduct.test(other.text) && !promotion.test(other.text)
            && !metadata.test(other.text) && !placeNames.has(compact(other.text)) && !flavorNames.has(compact(other.text))
            && first.box.y0 - other.box.y1 >= -Math.min(first.height, other.height) * 0.15
            && first.box.y0 - other.box.y1 <= Math.min(first.height, other.height) * 0.75
            && Math.max(first.height, other.height) / Math.min(first.height, other.height) <= 1.5
            && overlap(first.box, other.box) >= 0.8).sort((a, b) => b.box.y1 - a.box.y1);
          if (preceding.length !== 1) break;
          chain.unshift(preceding[0]);
        }
        brands.push({ lines: chain, text: chain.map(line => line.text).join(" "), descriptor });
      }
    }
  }
  // A coffee-prefixed wordmark is treated as a roastery only when a separate
  // printed roasting attribution repeats its distinctive word(s).
  for (const line of lines) {
    if (line.confidence < 85 || line.wordConfidence < 80 || line.excluded || generic.test(line.text)
      || coffeeProduct.test(line.text) || promotion.test(line.text) || !/^(?:coffee|커피)\s+[\p{L}][\p{L} &'’\-]{2,60}$/iu.test(line.text)) continue;
    const words = line.text.toLowerCase().split(/\s+/u).filter(word => word.length >= 3 && !/^(?:coffee|커피|the)$/iu.test(word));
    const descriptor = lines.find(other => other !== line && roaster.test(other.text) && other.confidence >= 80
      && words.some(word => other.text.toLowerCase().split(/[^\p{L}]+/u).includes(word))
      && nearby({ lines: [line], text: line.text, box: line.box, height: line.height }, other));
    if (descriptor) brands.push({ lines: [line], text: line.text, descriptor });
  }
  return brands;
}

/** Recover a printed title and roastery from geometry. Existing names are only
 * reconsidered when their same printed row is corroborated as a non-product. */
export function extractLabelLayout(blocks: unknown, base: LabelExtraction): LabelExtraction {
  const { lines, hasExplicitName, hasExplicitRoastery } = readLines(blocks);
  const brands = stackedBrands(lines);
  const replaceableName = !hasExplicitName && base.fields.name && !explicitName.test(base.evidence.name ?? "")
    && lines.some(line => compact(line.text) === compact(base.fields.name ?? "")
      && (administrative.test(line.text) || packageCategory.test(line.text) || generic.test(line.text)
        || roastCategory.test(line.text) || isLabelMetadataLine(line.text) || brands.some(brand => brand.lines.includes(line))));
  if (base.fields.name && base.fields.roastery && !replaceableName) return base;
  const retainedName = Boolean((base.fields.name || base.evidence.name) && !replaceableName);
  const parsedCountries = new Map(lines.map(line => [line, line.country]));
  const notes = new Set([...(base.tasting_notes?.en ?? []), ...(base.tasting_notes?.ko ?? [])].map(compact));
  const varieties = new Set((base.fields.varietal ?? "").split(/[,/&]/u).map(compact));
  const sourceRoastCategory = (line: Line) => roastCategory.test(line.text) && base.fields.roast_level
    && base.evidence.roast_level && compact(base.evidence.roast_level) === compact(line.text);
  const candidates = lines.filter((line) => {
    const text = line.text;
    if (retainedName || hasExplicitName || line.excluded || line.confidence < 85 || line.wordConfidence < 80 || text.length > 150
      || !/^[\p{L}\p{N}\s&'’()\-]+$/u.test(text) || (text.match(/\p{L}/gu)?.length ?? 0) < 3
      || (line.orientation === "vertical" ? line.box.y1 - line.box.y0 : line.box.x1 - line.box.x0) < line.height * 0.8
      || text.split(/\s+/u).length > 8 || metadata.test(text) || excludedSection.test(text) || roaster.test(text)
      || promotion.test(text) || generic.test(text) || packageCategory.test(text) || roastCategory.test(text)
      || administrative.test(text) || isLabelMetadataLine(text) || coffeeWordmark(text) || (parsedCountries.get(line) && !countryNames.has(compact(text)))
      || (placeNames.has(compact(text)) && !countryNames.has(compact(text))) || varieties.has(compact(text)) || brands.some((wordmark) => wordmark.lines.includes(line))
      || notes.has(compact(text)) || compact(text) === compact(base.fields.roastery ?? "")
      || /\b(?:and|with)\b/iu.test(text) || text.split(/\s+/u).some((word) => /^\p{L}$/u.test(word))) return false;
    // An adjacent roaster descriptor makes the large wordmark a brand, not a product.
    return !lines.some((other) => other !== line && roaster.test(other.text)
      && other.box.y0 >= line.box.y1 && other.box.y0 - line.box.y1 <= line.height * 0.8 && overlap(line.box, other.box) >= 0.5);
  });
  const hasBaseCoffee = Boolean(base.bean_type !== "unknown" || base.fields.roastery || base.fields.origin_country || base.fields.process_method || base.fields.varietal || base.fields.blend_components);
  const titles = countrySupportedTitles(groupTitles(candidates).filter((title) => {
    if (title.text.length > 200 || flavorNames.has(compact(title.text)) || placeNames.has(compact(title.text)) || broadGeography.test(title.text)) return false;
    // A clipped "Blend X" fragment is not evidence that a nearby category
    // heading is a complete product name either.
    const context = lines.filter((line) => !title.lines.includes(line) && !line.excluded && line.confidence >= 50 && nearby(title, line)
      && (metadata.test(line.text) || packageWeight.test(line.text) || !line.text.split(/\s+/u).some((word) => /^[a-z]$/iu.test(word))));
    const anchors = context.filter((line) => coffeeContext.test(line.text) || roaster.test(line.text) || metadata.test(line.text) || sourceRoastCategory(line) || placeNames.has(compact(line.text)) || parsedCountries.get(line));
    // A product between its printed cultivar and net weight has local package
    // context. A detached footer wordmark below the weight does not share it.
    const cultivarAbove = context.find(line => varieties.has(compact(line.text)) && line.confidence >= 90
      && line.box.y1 <= title.box.y0 && title.box.y0 - line.box.y1 <= title.height * 3);
    if (cultivarAbove && context.some(line => packageWeight.test(line.text) && line.confidence >= 85
      && line.box.y0 >= title.box.y1 && line.box.y0 - title.box.y1 <= title.height * 3)) anchors.push(cultivarAbove);
    const usage = context.filter((line) => usageCategory.test(line.text) && line.confidence >= 85);
    if (base.fields.weight_g && usage.length && context.some((line) => sensoryDescription.test(line.text) && line.confidence >= 85)) anchors.push(...usage);
    if (hasBaseCoffee && coffeeProduct.test(title.text)) anchors.push(...context.filter((line) => line.confidence >= 85
      && /^[\p{L}\s]+$/u.test(line.text) && !promotion.test(line.text)));
    const hasCoffee = hasBaseCoffee || coffeeProduct.test(title.text) || anchors.some((line) => coffeeContext.test(line.text) || roaster.test(line.text) || placeNames.has(compact(line.text)) || parsedCountries.get(line));
    if ((!hasCoffee && !anchors.some((line) => usage.includes(line))) || !anchors.length) return false;
    // Coffee-specific titles can sit below a larger bilingual title. Arbitrary
    // names must stand out from the nearby supporting label text.
    const originBelow = anchors.find(line => parsedCountries.get(line) && !titleCountry(title.text)
      && line.box.y0 >= title.box.y0 && line.box.y0 - title.box.y1 <= Math.max(title.height, line.height)
      && overlap(title.box, line.box) >= 0.8);
    const printedWeight = context.some(line => packageWeight.test(line.text) && line.confidence >= 85
      && Math.max(0, line.box.y0 - title.box.y1, title.box.y0 - line.box.y1) <= title.height * 3);
    const localMetadata = anchors.some(line => (metadata.test(line.text) || sourceRoastCategory(line) || parsedCountries.get(line)) && line.confidence >= 85
      && Math.max(0, line.box.y0 - title.box.y1, title.box.y0 - line.box.y1) <= title.height * 4);
    // A vertical title can sit above a compact footer table. Two adjacent rows
    // with different readable field types establish that same-column context;
    // repeated headings or metadata elsewhere on the package cannot do so.
    const verticalDetails = title.lines.every(line => line.orientation === "vertical") ? anchors.flatMap(line => {
      if (!metadata.test(line.text) || line.confidence < 85 || line.wordConfidence < 80) return [];
      const fields = Object.keys(parseBeanLabelText(line.text).fields).filter(field =>
        ["origin_country", "origin_region", "farm_producer", "varietal", "process_method", "process_detail", "roast_level"].includes(field))
        .map(field => field === "process_detail" ? "process_method" : field);
      return fields.length ? [{ line, fields }] : [];
    }) : [];
    const verticalMetadata = verticalDetails.some((first, index) => verticalDetails.slice(index + 1).some(second =>
      overlap(first.line.box, second.line.box) >= .8
      && Math.max(0, first.line.box.y0 - second.line.box.y1, second.line.box.y0 - first.line.box.y1) <= Math.max(first.line.height, second.line.height) * 2
      && first.fields.some(field => second.fields.some(other => field !== other))));
    if (title.text.split(/\s+/u).length === 1 && !coffeeProduct.test(title.text)
      && !printedWeight && !localMetadata && !verticalMetadata) return false;
    const countryCaption = title.lines.length >= 2 && countryNames.has(compact(title.lines[0].text))
      && title.lines.every(line => line.confidence >= 95 && line.wordConfidence >= 90);
    // Some information cards print the complete product heading at body size.
    // Its explicit local origin plus independent cultivar/process evidence can
    // establish the heading without relying on a fractional font-size margin.
    const countryValue = titleCountry(title.text);
    const printedCountry = countryValue && countryValue === base.fields.origin_country && context.some(line =>
      countryHeading.test(line.text) && line.confidence >= 80 && line.wordConfidence >= 80
      && compact(line.text) === compact(base.evidence.origin_country ?? "")
      && parseBeanLabelText(line.text).fields.origin_country === countryValue);
    const printedCoffeeDetail = context.some(line => line.box.y0 >= title.box.y1 && line.confidence >= 85 && line.wordConfidence >= 80
      && [base.evidence.varietal, base.evidence.process_method].some(evidence => evidence && compact(line.text) === compact(evidence)));
    const countryProductHeading = printedCountry && printedCoffeeDetail && title.text.split(/\s+/u).length >= 3
      && title.lines.every(line => line.confidence >= 95 && line.wordConfidence >= 90);
    return countryCaption || countryProductHeading || Boolean(cultivarAbove && anchors.includes(cultivarAbove)) || coffeeProduct.test(title.text) || title.height >= Math.min(...anchors.map((line) => line.height)) * 1.25
      || Boolean(originBelow && printedWeight && title.lines.every(line => line.confidence >= 90 && line.wordConfidence >= 85));
  }), lines, base).sort((left, right) => right.height - left.height);
  // A larger bilingual heading can itself contain OCR errors. Font size cannot
  // establish that its letters are a better product name than the other script.
  const confidence = (title: Title) => Math.min(...title.lines.flatMap(line => [line.confidence, line.wordConfidence]));
  const sameHeadingArea = (a: Title, b: Title) => overlap(a.box, b.box) >= .65
    && Math.max(0, a.box.y0 - b.box.y1, b.box.y0 - a.box.y1) <= Math.max(a.height, b.height) * 3;
  const competingLanguage = titles.some(title => titles[0] && sameHeadingArea(title, titles[0])
    && /[가-힣]/u.test(title.text) !== /[가-힣]/u.test(titles[0].text));
  // Confidence measures transcription, not whether two conflicting labels
  // describe the same coffee. Only verified local country metadata may decide.
  const competingCountries = new Set(titles.map(title => titleCountry(title.text)).filter(Boolean)).size > 1;
  const competingProcesses = titles.length > 1 && new Set(titles.flatMap(title => [...titleProcessMethods(title, lines)])).size > 1;
  const beatsDetached = (title: Title, other: Title) => title.height >= other.height * 1.35;
  const clearReading = competingLanguage && !competingCountries && !competingProcesses ? titles.find(title => confidence(title) >= 95
    && titles.every(other => other === title || (sameHeadingArea(title, other)
      ? confidence(title) - confidence(other) >= 5 : beatsDetached(title, other)))) : undefined;
  // Two prominent wrapped rows can establish the main heading above a much
  // smaller bilingual caption. A detached badge is compared by prominence.
  const mainHeading = competingLanguage && !competingCountries && !competingProcesses ? titles.find(title => title.lines.length >= 2 && confidence(title) >= 95
    && titles.every(other => other === title || (sameHeadingArea(title, other)
      ? title.height >= other.height * 2 : beatsDetached(title, other)))) : undefined;
  // Two adjacent language versions can supply one printed name without joining
  // their scripts or claiming a translation. Country/process contradictions and
  // headings elsewhere on the package still prevent this selection.
  const bilingualTitle = !competingProcesses && compatibleBilingualTitles(titles) ? [...titles]
    .filter(title => confidence(title) >= 95)
    .sort((a, b) => confidence(b) - confidence(a) || b.height - a.height || a.text.localeCompare(b.text))[0] : undefined;
  const selectedTitle = bilingualTitle ?? clearReading ?? mainHeading
    ?? (!competingLanguage && !competingCountries && !competingProcesses && titles.length && (!titles[1] || beatsDetached(titles[0], titles[1])) ? titles[0] : undefined);
  let result = base;
  if (replaceableName) {
    result = { ...base, fields: { ...base.fields }, evidence: { ...base.evidence } };
    delete result.fields.name;
    delete result.evidence.name;
  }
  if (selectedTitle) {
    const title = selectedTitle;
    result = { ...base, fields: { ...base.fields, name: title.text.replace(/\s+/gu, " ") },
      evidence: { ...base.evidence, name: title.lines.map((line) => line.text).join("\n") } };
  }
  if (!base.fields.roastery && !base.evidence.roastery && !hasExplicitRoastery && result.fields.name && brands.length) {
    const names = new Set(brands.map(brand => compact(brand.text)));
    if (names.size === 1) result = { ...result, fields: { ...result.fields, roastery: brands[0].text },
      evidence: { ...result.evidence, roastery: [...brands[0].lines.map(line => line.text), brands[0].descriptor.text].join("\n") } };
  }
  return result;
}
