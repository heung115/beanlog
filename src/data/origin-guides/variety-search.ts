import { varietyKey } from "./variety-research/enrich.ts";
import { getVarietyGuides } from "../coffee-varieties/index.ts";

const aliases: Record<string, string[]> = {
  gesha: ["Geisha", "Gesha", "게이샤", "게샤"],
  pinkbourbon: ["핑크 버번", "핑크버번", "핑크 부르봉"],
  bourbon: ["버번", "부르봉"], yellowbourbon: ["옐로 버번", "옐로우 버번", "옐로우버번"],
  redbourbon: ["레드 버번", "레드버번"],
  sidra: ["시드라"], chiroso: ["치로소"], wushwush: ["우시우시", "우슈우슈", "우쉬우쉬"],
  ombligon: ["옴블리곤"], laurina: ["라우리나"],
  sudanrume: ["수단 루메", "수단루메"],
  pacamara: ["파카마라"], maragogipe: ["마라고지페", "마라고지프", "Maragogype"],
  java: ["자바"], typicamejorado: ["티피카 메호라도", "티피카메호라도", "메호라도"],
  typica: ["티피카"], caturra: ["카투라", "카뚜라"], catuai: ["카투아이"],
  villasarchi: ["빌라 사치", "빌라사치"], villalobos: ["빌라 로보스", "빌라로보스"],
  maracaturra: ["마라카투라"], mocca: ["모카"], arara: ["아라라"],
  aji: ["아히", "아지"], papayo: ["파파요"], tabi: ["타비"],
  catigua: ["카티구아"], catimor: ["카티모르", "카티모어"],
  sl28: ["SL28", "SL 28", "SL-28"], sl34: ["SL34", "SL 34", "SL-34"],
  kurume: ["쿠루메"], wolisho: ["월리쇼", "울리쇼"], dega: ["데가"],
  batian: ["바티안"], ruiru11: ["루이루 11", "루이루11"],
};

export function varietySearchTerms(varieties: string[]): string[] {
  return [...new Set([
    ...varieties.flatMap((variety) => [variety, varietyKey(variety), ...(aliases[varietyKey(variety)] ?? [])]),
    ...getVarietyGuides(varieties).flatMap((guide) => [guide.name, guide.nameKo, ...guide.aliases]),
  ])];
}
