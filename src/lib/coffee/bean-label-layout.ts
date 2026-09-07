import type { LabelExtraction } from "./bean-label.ts";
import { originPresets } from "../../data/origin-presets.ts";
import { flavorPresets } from "../../data/flavor-wheel.ts";
import { parseBeanLabelText } from "./bean-label-parser.ts";

type Box = { x0: number; y0: number; x1: number; y1: number };
type Line = { text: string; box: Box; height: number; confidence: number; wordConfidence: number; excluded: boolean };
type Title = { lines: Line[]; text: string; box: Box; height: number };
const compact = (text: string) => text.toLowerCase().replace(/[\s-]+/gu, "");
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
const titleCountry = (text: string) => countryPrefixes.find(({ pattern }) => pattern.test(text))?.country;
const excludedSection = /^(?:tasting\s*notes?|cup\s*notes?|flavo[u]?r\s*notes?|nutrition|ingredients|brew(?:ing)?|recipe|(?:roastery\s*)?address|컵\s*노트|향미|영양|원재료|레시피|추출|주소)(?:\b|\s|[:：])/iu;
const roaster = /\broasters?\b|\broastery\b|로스터스|로스터리/iu;
const promotion = /\b(?:business|price|sale|discount|wholesale|shipping|subscribe|enjoy|favorite|favourite|freshly|delicious|perfect|crafted|quality|our|your|instructions|ignore)\b|\bfor\s+you\b|\bevery\s+(?:day|cup)\b|특가|할인|무료배송|추천|즐기|신선한/iu;
const coffeeProduct = /espresso|에스프레소|\b\w*blend\b|블렌드|decaf(?:feinated)?|디카페인/iu;
const coffeeContext = /\bcoffee\b|커피|espresso|에스프레소|\bblend\b|블렌드|decaf|디카페인|\b(?:country|origin|varietal|variety|process(?:ing)?)\b|원산지|생산국|품종|가공/iu;
const usageCategory = /^(?:milk[\s-]*based|filter|espresso)$/iu;
const sensoryDescription = /\b(?:sweet|creamy|juicy|smooth|floral|fruity)\b.*\b(?:chocolate|berries|fruit|caramel|nuts|citrus)\b|달콤|고소|향미/iu;
const generic = /^(?:coffee|coffee\s*beans?|coffee\s*blend|roasted\s*coffee|natural\s*coffee|specialty\s*coffee|single\s*origin|blend|milk[\s-]*based|filter|whole\s*beans?|ground\s*coffee|natural|washed|honey|white\s*honey|anaerobic|light\s*roast|medium\s*roast|dark\s*roast|커피|원두|블렌드|싱글\s*오리진|내추럴|워시드|허니)$/iu;

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

function readLines(blocks: unknown): { lines: Line[]; hasExplicitName: boolean; hasExplicitRoastery: boolean } {
  const lines: Line[] = [];
  if (!Array.isArray(blocks)) return { lines, hasExplicitName: false, hasExplicitRoastery: false };
  let count = 0;
  let excluded = false;
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
        if (excludedSection.test(text)) excluded = true;
        else if (metadata.test(text)) excluded = false;
        const box = boundingBox(value.bbox);
        if (!text || text.length > 500 || controls.test(text) || !box || typeof value.confidence !== "number"
          || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 100) continue;
        const words = Array.isArray(value.words) ? value.words.filter((word): word is Record<string, unknown> => record(word)
          && typeof word.text === "string" && /\p{L}/u.test(word.text)) : [];
        const confidences = words.map((word) => typeof word.confidence === "number" && Number.isFinite(word.confidence) ? word.confidence : 0);
        const heights = words.flatMap((word) => {
          const wordBox = boundingBox(word.bbox);
          return wordBox ? [wordBox.y1 - wordBox.y0] : [];
        }).sort((left, right) => left - right);
        const height = heights.length ? heights[Math.floor(heights.length / 2)] : box.y1 - box.y0;
        lines.push({ text, box, height, confidence: value.confidence,
          wordConfidence: confidences.length ? Math.min(...confidences) : 0, excluded });
      }
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
    const last = titles.at(-1);
    const preceding = last?.lines.at(-1);
    const gap = preceding ? line.box.y0 - preceding.box.y1 : Infinity;
    const sameSize = preceding && Math.max(line.height, preceding.height) / Math.min(line.height, preceding.height) <= 1.25;
    if (last && preceding && last.lines.length < 3 && gap >= -Math.min(line.height, preceding.height) * 0.15 && gap <= Math.min(line.height, preceding.height) * 0.75
      && sameSize && overlap(line.box, preceding.box) >= 0.65
      && !(titleCountry(last.text) && titleCountry(line.text))) {
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
  return titles.filter(title => !titleCountry(title.text) || titleCountry(title.text) === country
    || !rows.some(row => row.lines.every(line => nearby(title, line))));
}

function stackedBrands(lines: Line[]): { brand: Line; descriptor: Line }[] {
  const brands: { brand: Line; descriptor: Line }[] = [];
  for (const descriptor of lines) {
    if (!/^(?:coffee|커피)$/iu.test(descriptor.text) || descriptor.excluded || descriptor.confidence < 85 || descriptor.wordConfidence < 80) continue;
    for (const brand of lines) {
      if (brand === descriptor || brand.excluded || brand.confidence < 85 || brand.wordConfidence < 80
        || !/^[\p{L}][\p{L} .&'’\-]{2,79}$/u.test(brand.text) || brand.text.split(/\s+/u).length > 3
        || placeNames.has(compact(brand.text)) || flavorNames.has(compact(brand.text)) || promotion.test(brand.text)
        || generic.test(brand.text) || coffeeProduct.test(brand.text) || metadata.test(brand.text) || roaster.test(brand.text)) continue;
      const gap = descriptor.box.y0 - brand.box.y1;
      const widthRatio = (brand.box.x1 - brand.box.x0) / (descriptor.box.x1 - descriptor.box.x0);
      if (gap >= 0 && gap <= brand.height * 1.25 && overlap(brand.box, descriptor.box) >= 0.8 && widthRatio >= 0.5 && widthRatio <= 2
        && Math.max(brand.height, descriptor.height) / Math.min(brand.height, descriptor.height) <= 1.5) brands.push({ brand, descriptor });
    }
  }
  return brands;
}

/** Add only a missing, source-backed title; never replace previously read facts. */
export function extractLabelLayout(blocks: unknown, base: LabelExtraction): LabelExtraction {
  if (base.fields.name && base.fields.roastery) return base;
  const { lines, hasExplicitName, hasExplicitRoastery } = readLines(blocks);
  const brands = stackedBrands(lines);
  const notes = new Set([...(base.tasting_notes?.en ?? []), ...(base.tasting_notes?.ko ?? [])].map(compact));
  const candidates = lines.filter((line) => {
    const text = line.text;
    if (base.fields.name || base.evidence.name || hasExplicitName || line.excluded || line.confidence < 85 || line.wordConfidence < 80 || text.length > 150
      || !/^[\p{L}\p{N}\s&'’()\-]+$/u.test(text) || (text.match(/\p{L}/gu)?.length ?? 0) < 3
      || text.split(/\s+/u).length > 8 || metadata.test(text) || excludedSection.test(text) || roaster.test(text)
      || promotion.test(text) || generic.test(text) || placeNames.has(compact(text)) || brands.some((wordmark) => wordmark.brand === line)
      || notes.has(compact(text)) || compact(text) === compact(base.fields.roastery ?? "")
      || /\b(?:and|with)\b/iu.test(text) || text.split(/\s+/u).some((word) => /^\p{L}$/u.test(word))) return false;
    // An adjacent roaster descriptor makes the large wordmark a brand, not a product.
    return !lines.some((other) => other !== line && roaster.test(other.text)
      && other.box.y0 >= line.box.y1 && other.box.y0 - line.box.y1 <= line.height * 0.8 && overlap(line.box, other.box) >= 0.5);
  });
  const hasBaseCoffee = Boolean(base.bean_type !== "unknown" || base.fields.roastery || base.fields.origin_country || base.fields.process_method || base.fields.varietal || base.fields.blend_components);
  const titles = countrySupportedTitles(groupTitles(candidates).filter((title) => {
    if (title.text.length > 200 || flavorNames.has(compact(title.text)) || (!coffeeProduct.test(title.text) && title.text.split(/\s+/u).length < 2)) return false;
    // A clipped "Blend X" fragment is not evidence that a nearby category
    // heading is a complete product name either.
    const context = lines.filter((line) => !title.lines.includes(line) && !line.excluded && line.confidence >= 50 && nearby(title, line)
      && !line.text.split(/\s+/u).some((word) => /^[a-z]$/iu.test(word)));
    const anchors = context.filter((line) => coffeeContext.test(line.text) || metadata.test(line.text) || placeNames.has(compact(line.text)));
    const usage = context.filter((line) => usageCategory.test(line.text) && line.confidence >= 85);
    if (base.fields.weight_g && usage.length && context.some((line) => sensoryDescription.test(line.text) && line.confidence >= 85)) anchors.push(...usage);
    if (hasBaseCoffee && coffeeProduct.test(title.text)) anchors.push(...context.filter((line) => line.confidence >= 85
      && /^[\p{L}\s]+$/u.test(line.text) && !promotion.test(line.text)));
    const hasCoffee = hasBaseCoffee || coffeeProduct.test(title.text) || anchors.some((line) => coffeeContext.test(line.text) || placeNames.has(compact(line.text)));
    if ((!hasCoffee && !anchors.some((line) => usage.includes(line))) || !anchors.length) return false;
    // Coffee-specific titles can sit below a larger bilingual title. Arbitrary
    // names must stand out from the nearby supporting label text.
    return coffeeProduct.test(title.text) || title.height >= Math.min(...anchors.map((line) => line.height)) * 1.25;
  }), lines, base).sort((left, right) => right.height - left.height);
  // A larger bilingual heading can itself contain OCR errors. Font size cannot
  // establish that its letters are a better product name than the other script.
  const competingLanguage = titles.some((title) => /[가-힣]/u.test(title.text) !== /[가-힣]/u.test(titles[0]?.text ?? ""));
  let result = base;
  if (titles.length && !competingLanguage && (!titles[1] || titles[0].height >= titles[1].height * 1.35)) {
    const title = titles[0];
    result = { ...base, fields: { ...base.fields, name: title.text.replace(/\s+/gu, " ") },
      evidence: { ...base.evidence, name: title.lines.map((line) => line.text).join("\n") } };
  }
  if (!base.fields.roastery && !base.evidence.roastery && !hasExplicitRoastery && result.fields.name && brands.length) {
    const names = new Set(brands.map(({ brand }) => compact(brand.text)));
    if (names.size === 1) result = { ...result, fields: { ...result.fields, roastery: brands[0].brand.text },
      evidence: { ...result.evidence, roastery: `${brands[0].brand.text}\n${brands[0].descriptor.text}` } };
  }
  return result;
}
