package handlers

import "strings"

// Keep these exact display aliases in sync with src/data/varietal-presets.ts.
// Unknown user-entered varietals are retained rather than guessed or translated.
var varietalAliases = [][2]string{
	{"Geisha", "게이샤"},
	{"Bourbon", "버본"},
	{"Typica", "티피카"},
	{"Caturra", "카투라"},
	{"Catuai", "카투아이"},
	{"Mundo Novo", "문도노보"},
	{"Heirloom", "에이룸"},
	{"Kurume", "쿠루메"},
	{"Dega", "데가"},
	{"Wolisho", "월리쇼"},
	{"SL28", "SL28"},
	{"SL34", "SL34"},
	{"Ruiru 11", "루이루 11"},
	{"Batian", "바티안"},
	{"Castillo", "카스티요"},
	{"Colombia", "콜롬비아"},
	{"Pink Bourbon", "핑크버본"},
	{"Yellow Bourbon", "옐로우버본"},
	{"Villa Sarchi", "비야사르치"},
	{"Pache", "파체"},
	{"Pacamara", "파카마라"},
	{"Maracaturra", "마라카투라"},
	{"Maragogype", "마라고지페"},
	{"Arusha", "아루샤"},
	{"S795", "S795"},
	{"SL9", "SL9"},
	{"Selection 9", "셀렉션 9"},
	{"Catimor", "카티모르"},
	{"Java", "자바"},
	{"Laurina", "라우리나"},
	{"Sidra", "시드라"},
	{"Wush Wush", "우시우시"},
	{"Eugenioides", "유게니오이데스"},
	{"Mokka", "모카"},
	{"Kent", "켄트"},
}

var varietalCanonicalByAlias = func() map[string]string {
	aliases := make(map[string]string, len(varietalAliases)*2)
	for _, pair := range varietalAliases {
		for _, alias := range pair {
			aliases[strings.ToLower(alias)] = pair[0]
		}
	}
	return aliases
}()

func canonicalVarietal(value string) string {
	trimmed := strings.TrimSpace(value)
	if canonical, ok := varietalCanonicalByAlias[strings.ToLower(trimmed)]; ok {
		return canonical
	}
	return trimmed
}

// A varietal contributes at most once within one record or component, even if
// its English and Korean labels both occur in legacy free-text data.
func splitCanonicalVarietals(value string) []string {
	result := []string{}
	seen := map[string]struct{}{}
	for _, part := range strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == '，' }) {
		canonical := canonicalVarietal(part)
		key := strings.ToLower(canonical)
		if key == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, canonical)
	}
	return result
}

// Lowercase exact tokens for SQL equality against a split legacy varietal field.
// These are values for bound parameters, never SQL expressions or LIKE patterns.
func varietalSearchAliases(value string) []string {
	canonical := canonicalVarietal(value)
	if canonical == "" {
		return []string{}
	}
	for _, pair := range varietalAliases {
		if pair[0] == canonical {
			english, korean := strings.ToLower(pair[0]), strings.ToLower(pair[1])
			if english == korean {
				return []string{english}
			}
			return []string{english, korean}
		}
	}
	return []string{strings.ToLower(canonical)}
}
