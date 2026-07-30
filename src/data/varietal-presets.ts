import type { OriginPresetData } from "./origin-presets";
import type { ComboboxOption } from "@/components/ui/combobox";

export interface VarietalPreset {
  en: string;
  ko: string;
}

/** Common specialty coffee varietals (en/ko) used for autocomplete. */
export const varietalPresets: VarietalPreset[] = [
  { en: "Geisha", ko: "게이샤" },
  { en: "Bourbon", ko: "버본" },
  { en: "Typica", ko: "티피카" },
  { en: "Caturra", ko: "카투라" },
  { en: "Catuai", ko: "카투아이" },
  { en: "Mundo Novo", ko: "문도노보" },
  { en: "Heirloom", ko: "에이룸" },
  { en: "Kurume", ko: "쿠루메" },
  { en: "Dega", ko: "데가" },
  { en: "Wolisho", ko: "월리쇼" },
  { en: "SL28", ko: "SL28" },
  { en: "SL34", ko: "SL34" },
  { en: "Ruiru 11", ko: "루이루 11" },
  { en: "Batian", ko: "바티안" },
  { en: "Castillo", ko: "카스티요" },
  { en: "Colombia", ko: "콜롬비아" },
  { en: "Pink Bourbon", ko: "핑크버본" },
  { en: "Yellow Bourbon", ko: "옐로우버본" },
  { en: "Villa Sarchi", ko: "비야사르치" },
  { en: "Pache", ko: "파체" },
  { en: "Pacamara", ko: "파카마라" },
  { en: "Maracaturra", ko: "마라카투라" },
  { en: "Maragogype", ko: "마라고지페" },
  { en: "Arusha", ko: "아루샤" },
  { en: "S795", ko: "S795" },
  { en: "SL9", ko: "SL9" },
  { en: "Selection 9", ko: "셀렉션 9" },
  { en: "Catimor", ko: "카티모르" },
  { en: "Java", ko: "자바" },
  { en: "Laurina", ko: "라우리나" },
  { en: "Sidra", ko: "시드라" },
  { en: "Wush Wush", ko: "우시우시" },
  { en: "Eugenioides", ko: "유게니오이데스" },
  { en: "Mokka", ko: "모카" },
  { en: "Kent", ko: "켄트" },
];

const byEn = new Map(varietalPresets.map((v) => [v.en.toLowerCase(), v]));

/**
 * Varietal suggestions as combobox options.
 * When a country preset is known, its key varietals come first.
 */
export function varietalOptions(
  locale: string,
  countryPreset?: OriginPresetData
): ComboboxOption[] {
  const ko = locale === "ko";
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const en of countryPreset?.keyVarietals ?? []) {
    const key = en.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(en);
    }
  }
  for (const v of varietalPresets) {
    const key = v.en.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(v.en);
    }
  }

  return ordered.map((en) => {
    const preset = byEn.get(en.toLowerCase());
    const koName = preset?.ko ?? en;
    return {
      value: en,
      label: ko ? koName : en,
      sublabel: ko ? en : koName !== en ? koName : undefined,
    };
  });
}
