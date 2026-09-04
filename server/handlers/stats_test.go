package handlers

import (
	"reflect"
	"testing"

	"beanmap-server/models"
)

func TestBuildOriginMapMatchesCatalogAndDeduplicatesBeans(t *testing.T) {
	ethiopiaKo := "에티오피아"
	colombiaKo := "콜롬비아"
	gujiKo := "구지"
	sidamaKo := "시다마"
	catalog := newOriginCatalog(
		[]originCatalogCountry{
			{id: 1, nameEn: "Ethiopia", nameKo: &ethiopiaKo},
			{id: 2, nameEn: "Colombia", nameKo: &colombiaKo},
		},
		[]originCatalogRegion{
			{id: 10, countryID: 1, name: "Guji", nameKo: &gujiKo},
			{id: 11, countryID: 1, name: "Sidama", nameKo: &sidamaKo},
		},
	)

	occurrences := []originOccurrence{
		// A stored catalog id is authoritative even if its legacy label differs.
		{beanID: "single-1", country: "legacy Ethiopia label", countryID: testInt64(1), region: "legacy Guji label", regionID: testInt64(10)},
		// The same blend mentions Ethiopia repeatedly. It counts as one country record,
		// while each distinct region remains represented once.
		{beanID: "blend-1", country: " ETHIOPIA ", region: "guji"},
		{beanID: "blend-1", country: "에티오피아", region: " 구지 "},
		{beanID: "blend-1", country: "에티오피아", region: " 시다마 "},
		// Korean exact matching resolves to the same canonical country and region.
		{beanID: "single-2", country: " 에티오피아 ", region: " 구지 "},
		// An invalid id falls back to an exact canonical-name match.
		{beanID: "single-3", country: " colombia ", countryID: testInt64(999), region: ""},
		// Unknown free text is retained and case/whitespace variants are grouped.
		{beanID: "single-4", country: "Atlantis", region: "Central"},
		{beanID: "single-5", country: " atlantis ", region: "central"},
	}

	got := buildOriginMap(occurrences, catalog)
	if len(got) != 3 {
		t.Fatalf("len(origin_map) = %d, want 3: %#v", len(got), got)
	}

	ethiopia := got[0]
	if !ethiopia.Mapped || ethiopia.CountryID == nil || *ethiopia.CountryID != 1 {
		t.Fatalf("Ethiopia mapping = %#v, want mapped country 1", ethiopia)
	}
	if ethiopia.NameEn != "Ethiopia" || ethiopia.NameKo == nil || *ethiopia.NameKo != ethiopiaKo {
		t.Fatalf("Ethiopia names = (%q, %v), want canonical bilingual names", ethiopia.NameEn, ethiopia.NameKo)
	}
	if ethiopia.Count != 3 {
		t.Fatalf("Ethiopia count = %d, want 3 distinct records", ethiopia.Count)
	}
	if len(ethiopia.Regions) != 2 {
		t.Fatalf("Ethiopia regions = %#v, want Guji and Sidama", ethiopia.Regions)
	}
	if ethiopia.Regions[0].Name != "Guji" || ethiopia.Regions[0].Count != 3 {
		t.Fatalf("first Ethiopia region = %#v, want Guji count 3", ethiopia.Regions[0])
	}
	if ethiopia.Regions[1].Name != "Sidama" || ethiopia.Regions[1].Count != 1 {
		t.Fatalf("second Ethiopia region = %#v, want Sidama count 1", ethiopia.Regions[1])
	}

	atlantis := got[1]
	if atlantis.Mapped || atlantis.CountryID != nil || atlantis.NameEn != "Atlantis" || atlantis.Count != 2 {
		t.Fatalf("unmapped country = %#v, want preserved Atlantis count 2", atlantis)
	}
	if len(atlantis.Regions) != 1 || atlantis.Regions[0].Name != "Central" || atlantis.Regions[0].Count != 2 {
		t.Fatalf("unmapped regions = %#v, want preserved Central count 2", atlantis.Regions)
	}

	colombia := got[2]
	if !colombia.Mapped || colombia.NameEn != "Colombia" || colombia.Count != 1 {
		t.Fatalf("Colombia = %#v, want mapped count 1", colombia)
	}
	if len(colombia.Regions) != 1 || colombia.Regions[0].Name != "" || colombia.Regions[0].Count != 1 {
		t.Fatalf("Colombia missing-region bucket = %#v, want one empty-name region", colombia.Regions)
	}
}

func TestBuildOriginMapUsesExactMatchingAndStableOrder(t *testing.T) {
	brazilKo := "브라질"
	catalog := newOriginCatalog(
		[]originCatalogCountry{{id: 1, nameEn: "Brazil", nameKo: &brazilKo}},
		nil,
	)

	occurrences := []originOccurrence{
		{beanID: "3", country: "Zulu"},
		{beanID: "1", country: "Brazil"},
		{beanID: "2", country: "Ethiopian"},
	}
	got := buildOriginMap(occurrences, catalog)

	wantNames := []string{"Brazil", "Ethiopian", "Zulu"}
	names := make([]string, len(got))
	for i, entry := range got {
		names[i] = entry.NameEn
	}
	if !reflect.DeepEqual(names, wantNames) {
		t.Fatalf("stable tie order = %#v, want %#v", names, wantNames)
	}
	if got[1].Mapped {
		t.Fatalf("prefix-like value %q must remain unmapped", got[1].NameEn)
	}
}

func TestBuildOriginMapSkipsBlankUnmappedButKeepsCatalogID(t *testing.T) {
	catalog := newOriginCatalog(
		[]originCatalogCountry{{id: 1, nameEn: "Brazil"}},
		nil,
	)

	got := buildOriginMap([]originOccurrence{
		{beanID: "legacy-empty", country: "   "},
		{beanID: "catalog-id", country: "", countryID: testInt64(1)},
	}, catalog)

	if len(got) != 1 || got[0].NameEn != "Brazil" || got[0].Count != 1 || !got[0].Mapped {
		t.Fatalf("origin map = %#v, want only the catalog-backed Brazil record", got)
	}
}

func TestBuildOriginMapLeavesAmbiguousCatalogNameUnmapped(t *testing.T) {
	sharedKo := "공유 이름"
	catalog := newOriginCatalog(
		[]originCatalogCountry{
			{id: 1, nameEn: "Alpha", nameKo: &sharedKo},
			{id: 2, nameEn: "Beta", nameKo: &sharedKo},
		},
		nil,
	)

	got := buildOriginMap([]originOccurrence{
		{beanID: "ambiguous", country: sharedKo},
	}, catalog)

	if len(got) != 1 || got[0].Mapped || got[0].CountryID != nil || got[0].NameEn != sharedKo {
		t.Fatalf("origin map = %#v, want ambiguous exact name preserved as unmapped", got)
	}
}

func TestToCountEntriesUsesStableKeyTieBreaker(t *testing.T) {
	got := toCountEntries(map[string]int{"z": 2, "a": 2, "m": 1}, true)
	want := []models.CountEntry{
		{Key: "a", Count: 2},
		{Key: "z", Count: 2},
		{Key: "m", Count: 1},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("toCountEntries() = %#v, want %#v", got, want)
	}
}

func testInt64(value int64) *int64 {
	return &value
}
