package handlers

import (
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

func TestCanonicalVarietalMatchesEveryFrontendPreset(t *testing.T) {
	source, err := os.ReadFile("../../src/data/varietal-presets.ts")
	if err != nil {
		t.Fatal(err)
	}
	entries := regexp.MustCompile(`\{ en: "([^"]+)", ko: "([^"]+)" \}`).FindAllStringSubmatch(string(source), -1)
	if len(entries) == 0 || len(entries) != len(varietalAliases) {
		t.Fatalf("frontend presets = %d, backend aliases = %d; both catalogs must remain in sync", len(entries), len(varietalAliases))
	}
	for _, entry := range entries {
		english, korean := entry[1], entry[2]
		for _, alias := range []string{english, korean, strings.ToUpper(english), " \t" + korean + "\n"} {
			if got := canonicalVarietal(alias); got != english {
				t.Errorf("canonicalVarietal(%q) = %q, want %q", alias, got, english)
			}
		}
	}
}

func TestCanonicalVarietalPreservesUnknownValues(t *testing.T) {
	for _, value := range []string{" Custom Lot 27 ", " 로컬 품종 ", " Geisha-like ", "", " \t\n "} {
		if got := canonicalVarietal(value); got != strings.TrimSpace(value) {
			t.Errorf("canonicalVarietal(%q) = %q, unknown values must be retained", value, got)
		}
	}
}

func TestSplitCanonicalVarietalsDeduplicatesAliasesAndCommaVariants(t *testing.T) {
	got := splitCanonicalVarietals(" 게이샤，Geisha, GEISHA, Bourbon,버본, Custom Lot ,custom lot, ,\t")
	want := []string{"Geisha", "Bourbon", "Custom Lot"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("split = %#v, want %#v", got, want)
	}
	if got := splitCanonicalVarietals(" ,， \t "); len(got) != 0 {
		t.Fatalf("blank varietals = %#v, want no tokens", got)
	}
}

func TestVarietalSearchAliasesUsesExactCanonicalTokens(t *testing.T) {
	for _, test := range []struct {
		input string
		want  []string
	}{
		{" 게이샤 ", []string{"geisha", "게이샤"}},
		{"GEISHA", []string{"geisha", "게이샤"}},
		{"sl28", []string{"sl28"}},
		{" Lot_% ", []string{"lot_%"}},
		{" ", []string{}},
	} {
		if got := varietalSearchAliases(test.input); !reflect.DeepEqual(got, test.want) {
			t.Errorf("aliases(%q) = %#v, want %#v", test.input, got, test.want)
		}
	}
}
