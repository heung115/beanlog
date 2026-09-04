package handlers

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
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

func TestBuildOriginMapBoundsCardinalityDeterministically(t *testing.T) {
	catalog := newOriginCatalog(
		[]originCatalogCountry{{id: 1, nameEn: "Zulu Mapped"}},
		nil,
	)
	occurrences := make([]originOccurrence, 0, maxStatsOriginMapCountries+maxStatsOriginMapRegions+32)

	for index := 0; index < maxStatsOriginMapCountries+2; index++ {
		occurrences = append(occurrences, originOccurrence{
			beanID:  fmt.Sprintf("country-%03d", index),
			country: fmt.Sprintf("Country %03d", index),
			region:  "Only region",
		})
	}
	occurrences = append(occurrences, originOccurrence{
		beanID:    "mapped-country",
		countryID: testInt64(1),
		region:    "Mapped region",
	})
	for index := 0; index < 4; index++ {
		occurrences = append(occurrences, originOccurrence{
			beanID:  fmt.Sprintf("competing-primary-%d", index),
			country: "Competing",
			region:  "Primary",
		})
	}
	for index := 0; index < 3; index++ {
		occurrences = append(occurrences, originOccurrence{
			beanID:  fmt.Sprintf("competing-secondary-%d", index),
			country: "Competing",
			region:  "Secondary",
		})
	}
	for index := 0; index < maxStatsOriginMapRegions+16; index++ {
		occurrences = append(occurrences, originOccurrence{
			beanID:  fmt.Sprintf("priority-%03d", index),
			country: "Priority",
			region:  fmt.Sprintf("Region %04d", index),
		})
	}
	occurrences = append(occurrences,
		originOccurrence{beanID: "popular-a", country: "Priority", region: "Popular"},
		originOccurrence{beanID: "popular-b", country: "Priority", region: "Popular"},
	)

	got := buildOriginMap(occurrences, catalog)
	if len(got) != maxStatsOriginMapCountries {
		t.Fatalf("len(origin_map) = %d, want %d", len(got), maxStatsOriginMapCountries)
	}

	totalRegions := 0
	mappedFound := false
	for _, entry := range got {
		totalRegions += len(entry.Regions)
		if len(entry.Regions) == 0 {
			t.Fatalf("retained country %q has no retained region", entry.NameEn)
		}
		if entry.NameEn == "Zulu Mapped" {
			mappedFound = true
		}
	}
	if totalRegions != maxStatsOriginMapRegions {
		t.Fatalf("origin map regions = %d, want %d", totalRegions, maxStatsOriginMapRegions)
	}
	if !mappedFound {
		t.Fatal("mapped country was dropped before equally frequent free-text countries")
	}

	priority := got[0]
	wantPriorityCount := maxStatsOriginMapRegions + 18
	if priority.NameEn != "Priority" || priority.Count != wantPriorityCount {
		t.Fatalf("top country = %#v, want Priority count %d", priority, wantPriorityCount)
	}
	wantPriorityRegions := maxStatsOriginMapRegions - (maxStatsOriginMapCountries - 1) - 1
	if len(priority.Regions) != wantPriorityRegions {
		t.Fatalf("Priority regions = %d, want %d", len(priority.Regions), wantPriorityRegions)
	}
	if priority.Regions[0].Name != "Popular" || priority.Regions[0].Count != 2 {
		t.Fatalf("top Priority region = %#v, want Popular count 2", priority.Regions[0])
	}
	competing := got[1]
	if competing.NameEn != "Competing" || len(competing.Regions) != 2 {
		t.Fatalf("globally ranked competing country = %#v, want both regions retained", competing)
	}
	if competing.Regions[1].Name != "Secondary" || competing.Regions[1].Count != 3 {
		t.Fatalf("globally ranked region = %#v, want Secondary count 3", competing.Regions[1])
	}

	reversed := append([]originOccurrence(nil), occurrences...)
	for left, right := 0, len(reversed)-1; left < right; left, right = left+1, right-1 {
		reversed[left], reversed[right] = reversed[right], reversed[left]
	}
	if reversedResult := buildOriginMap(reversed, catalog); !reflect.DeepEqual(reversedResult, got) {
		t.Fatalf("reversed input changed bounded origin map\n got: %#v\nwant: %#v", reversedResult, got)
	}
}

func TestBoundedOriginMapFitsBufferedStatsResponse(t *testing.T) {
	countries := make([]originCatalogCountry, 0, maxStatsOriginMapCountries+2)
	regions := make([]originCatalogRegion, 0, (maxStatsOriginMapCountries+2)*3)
	occurrences := make([]originOccurrence, 0, (maxStatsOriginMapCountries+2)*3)

	for countryIndex := 0; countryIndex < maxStatsOriginMapCountries+2; countryIndex++ {
		countryID := int64(countryIndex + 1)
		countryName := fmt.Sprintf("%03d%s", countryIndex, strings.Repeat("&", 97))
		countryNameKo := countryName
		countries = append(countries, originCatalogCountry{
			id:     countryID,
			nameEn: countryName,
			nameKo: &countryNameKo,
		})

		for countryRegionIndex := 0; countryRegionIndex < 3; countryRegionIndex++ {
			regionIndex := countryIndex*3 + countryRegionIndex
			regionID := int64(regionIndex + 1)
			regionName := fmt.Sprintf("%03d%s", regionIndex, strings.Repeat("&", 197))
			regionNameKo := regionName
			regions = append(regions, originCatalogRegion{
				id:        regionID,
				countryID: countryID,
				name:      regionName,
				nameKo:    &regionNameKo,
			})
			occurrences = append(occurrences, originOccurrence{
				beanID:    fmt.Sprintf("bean-%03d-%d", countryIndex, countryRegionIndex),
				countryID: testInt64(countryID),
				regionID:  testInt64(regionID),
			})
		}
	}

	originMap := buildOriginMap(occurrences, newOriginCatalog(countries, regions))
	if len(originMap) != maxStatsOriginMapCountries {
		t.Fatalf("len(origin_map) = %d, want %d", len(originMap), maxStatsOriginMapCountries)
	}
	regionCount := 0
	for _, entry := range originMap {
		regionCount += len(entry.Regions)
	}
	if regionCount != maxStatsOriginMapRegions {
		t.Fatalf("origin map regions = %d, want %d", regionCount, maxStatsOriginMapRegions)
	}

	originPayload, err := json.Marshal(originMap)
	if err != nil {
		t.Fatalf("marshal origin map: %v", err)
	}
	if len(originPayload) >= 2<<20 {
		t.Fatalf("origin map payload = %d bytes, want less than 2 MiB", len(originPayload))
	}

	byOrigin := make([]models.CountEntry, len(originMap))
	for index, entry := range originMap {
		byOrigin[index] = models.CountEntry{Key: entry.NameEn, Count: entry.Count}
	}
	byVarietal := make([]models.CountEntry, maxStatsBeans)
	byMonth := make([]models.CountEntry, maxStatsBeans)
	for index := 0; index < maxStatsBeans; index++ {
		byVarietal[index] = models.CountEntry{
			Key:   fmt.Sprintf("%05d%s", index, strings.Repeat("&", 95)),
			Count: 1,
		}
		byMonth[index] = models.CountEntry{
			Key:   fmt.Sprintf("%04d-%02d", 1000+index/12, index%12+1),
			Count: 1,
		}
	}
	byProcess := []models.CountEntry{{Key: "washed", Count: maxStatsBeans}}
	scoreDist := []models.CountEntry{{Key: "10", Count: maxStatsBeans}}
	stats := models.BeanStats{
		Total:      maxStatsBeans,
		AvgScore:   10,
		Best:       &models.BestBean{Name: strings.Repeat("&", 200), Roastery: strings.Repeat("&", 200), Score: 10},
		ByOrigin:   byOrigin,
		ByProcess:  byProcess,
		ByVarietal: byVarietal,
		ByMonth:    byMonth,
		ScoreDist:  scoreDist,
		TopOrigin:  &byOrigin[0],
		TopProcess: &byProcess[0],
		OriginMap:  originMap,
	}
	statsPayload, err := json.Marshal(stats)
	if err != nil {
		t.Fatalf("marshal stats response: %v", err)
	}
	if len(statsPayload) >= 8<<20 {
		t.Fatalf("stats response payload = %d bytes, want less than 8 MiB", len(statsPayload))
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
