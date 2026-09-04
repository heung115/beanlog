package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"beanmap-server/middleware"
	"beanmap-server/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type StatsHandler struct{}

const (
	maxStatsBeans             = 10000
	maxStatsOriginOccurrences = maxStatsBeans * 50
)

func NewStatsHandler() *StatsHandler {
	return &StatsHandler{}
}

type statsBeanRow struct {
	id              string
	beanType        string
	origin          string
	originCountryID *int64
	region          string
	originRegionID  *int64
	process         string
	varietal        string
	name            string
	roastery        string
	score           float64
	consumedAt      time.Time
}

type originOccurrence struct {
	beanID    string
	country   string
	countryID *int64
	region    string
	regionID  *int64
}

type originCatalogCountry struct {
	id     int64
	nameEn string
	nameKo *string
}

type originCatalogRegion struct {
	id        int64
	countryID int64
	name      string
	nameKo    *string
}

type originCatalog struct {
	countriesByID           map[int64]originCatalogCountry
	countriesByEnglish      map[string]originCatalogCountry
	countriesByKorean       map[string]originCatalogCountry
	ambiguousCountryEnglish map[string]struct{}
	ambiguousCountryKorean  map[string]struct{}
	regionsByID             map[int64]originCatalogRegion
	regionsByEnglish        map[int64]map[string]originCatalogRegion
	regionsByKorean         map[int64]map[string]originCatalogRegion
	ambiguousRegionEnglish  map[int64]map[string]struct{}
	ambiguousRegionKorean   map[int64]map[string]struct{}
}

func (h *StatsHandler) GetStats(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)

	rows, err := db.Query(c.Request.Context(),
		`SELECT id::text, bean_type, COALESCE(origin_country, ''), origin_country_id,
		        COALESCE(origin_region, ''), origin_region_id, process_method,
		        COALESCE(varietal,''), overall_score, consumed_at, name, roastery
		 FROM beans WHERE user_id = $1 LIMIT $2`, userID, maxStatsBeans+1,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query stats"})
		return
	}

	var beanRows []statsBeanRow
	for rows.Next() {
		var b statsBeanRow
		if err := rows.Scan(
			&b.id, &b.beanType, &b.origin, &b.originCountryID, &b.region,
			&b.originRegionID, &b.process, &b.varietal, &b.score,
			&b.consumedAt, &b.name, &b.roastery,
		); err != nil {
			rows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query stats"})
			return
		}
		beanRows = append(beanRows, b)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query stats"})
		return
	}
	rows.Close()

	if len(beanRows) > maxStatsBeans {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "dataset too large for statistics"})
		return
	}
	if len(beanRows) == 0 {
		c.JSON(http.StatusOK, nil)
		return
	}

	catalog, err := loadOriginCatalog(c.Request.Context(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin stats"})
		return
	}

	originOccurrences := make([]originOccurrence, 0, len(beanRows))
	for _, b := range beanRows {
		if b.beanType != "single_origin" {
			continue
		}
		originOccurrences = append(originOccurrences, originOccurrence{
			beanID:    b.id,
			country:   b.origin,
			countryID: b.originCountryID,
			region:    b.region,
			regionID:  b.originRegionID,
		})
	}
	blendOccurrences, tooManyOrigins, err := loadBlendOriginOccurrences(c.Request.Context(), db, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin stats"})
		return
	}
	if tooManyOrigins {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "dataset too large for statistics"})
		return
	}
	originOccurrences = append(originOccurrences, blendOccurrences...)
	originMap := buildOriginMap(originOccurrences, catalog)

	total := len(beanRows)
	var sumScore float64
	best := beanRows[0]
	byOrigin := make(map[string]int, len(originMap))
	byProcess := map[string]int{}
	byVarietal := map[string]int{}
	byMonth := map[string]int{}
	scoreDist := map[string]int{}

	for _, origin := range originMap {
		if origin.NameEn != "" {
			byOrigin[origin.NameEn] = origin.Count
		}
	}
	for _, b := range beanRows {
		sumScore += b.score
		if b.score > best.score {
			best = b
		}
		byProcess[b.process]++
		if b.varietal != "" {
			byVarietal[b.varietal]++
		}
		month := b.consumedAt.Format("2006-01")
		byMonth[month]++
		bucket := fmt.Sprintf("%d", int(math.Floor(b.score)))
		scoreDist[bucket]++
	}

	avgScore := math.Round(sumScore/float64(total)*10) / 10

	stats := models.BeanStats{
		Total:    total,
		AvgScore: avgScore,
		Best: &models.BestBean{
			Name:     best.name,
			Roastery: best.roastery,
			Score:    best.score,
		},
		ByOrigin:   toCountEntries(byOrigin, true),
		ByProcess:  toCountEntries(byProcess, true),
		ByVarietal: toCountEntries(byVarietal, true),
		ByMonth:    toCountEntries(byMonth, false),
		ScoreDist:  toCountEntries(scoreDist, false),
		OriginMap:  originMap,
	}

	if len(stats.ByOrigin) > 0 {
		stats.TopOrigin = &stats.ByOrigin[0]
	}
	if len(stats.ByProcess) > 0 {
		stats.TopProcess = &stats.ByProcess[0]
	}

	c.JSON(http.StatusOK, stats)
}

func loadOriginCatalog(ctx context.Context, db pgx.Tx) (originCatalog, error) {
	countries := []originCatalogCountry{}
	countryRows, err := db.Query(ctx,
		"SELECT id, name_en, name_ko FROM origin_countries ORDER BY id",
	)
	if err != nil {
		return originCatalog{}, err
	}
	for countryRows.Next() {
		var country originCatalogCountry
		if err := countryRows.Scan(&country.id, &country.nameEn, &country.nameKo); err != nil {
			countryRows.Close()
			return originCatalog{}, err
		}
		countries = append(countries, country)
	}
	if err := countryRows.Err(); err != nil {
		countryRows.Close()
		return originCatalog{}, err
	}
	countryRows.Close()

	regions := []originCatalogRegion{}
	regionRows, err := db.Query(ctx,
		`SELECT id, country_id, display_name, display_name_ko
		 FROM origin_regions
		 WHERE is_canonical = true AND display_name IS NOT NULL
		 ORDER BY id`,
	)
	if err != nil {
		return originCatalog{}, err
	}
	for regionRows.Next() {
		var region originCatalogRegion
		if err := regionRows.Scan(&region.id, &region.countryID, &region.name, &region.nameKo); err != nil {
			regionRows.Close()
			return originCatalog{}, err
		}
		regions = append(regions, region)
	}
	if err := regionRows.Err(); err != nil {
		regionRows.Close()
		return originCatalog{}, err
	}
	regionRows.Close()

	return newOriginCatalog(countries, regions), nil
}

func loadBlendOriginOccurrences(ctx context.Context, db pgx.Tx, userID string) ([]originOccurrence, bool, error) {
	rows, err := db.Query(ctx,
		`SELECT components.bean_id::text, components.origin_country,
		        COALESCE(components.origin_region, '')
		 FROM blend_components AS components
		 JOIN beans ON beans.id = components.bean_id
		           AND beans.user_id = components.user_id
		           AND beans.bean_type = 'blend'
		 WHERE components.user_id = $1
		 LIMIT $2`,
		userID, maxStatsOriginOccurrences+1,
	)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	occurrences := []originOccurrence{}
	for rows.Next() {
		var occurrence originOccurrence
		if err := rows.Scan(&occurrence.beanID, &occurrence.country, &occurrence.region); err != nil {
			return nil, false, err
		}
		occurrences = append(occurrences, occurrence)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	if len(occurrences) > maxStatsOriginOccurrences {
		return nil, true, nil
	}
	return occurrences, false, nil
}

func newOriginCatalog(countries []originCatalogCountry, regions []originCatalogRegion) originCatalog {
	catalog := originCatalog{
		countriesByID:           make(map[int64]originCatalogCountry, len(countries)),
		countriesByEnglish:      make(map[string]originCatalogCountry, len(countries)),
		countriesByKorean:       make(map[string]originCatalogCountry, len(countries)),
		ambiguousCountryEnglish: map[string]struct{}{},
		ambiguousCountryKorean:  map[string]struct{}{},
		regionsByID:             make(map[int64]originCatalogRegion, len(regions)),
		regionsByEnglish:        map[int64]map[string]originCatalogRegion{},
		regionsByKorean:         map[int64]map[string]originCatalogRegion{},
		ambiguousRegionEnglish:  map[int64]map[string]struct{}{},
		ambiguousRegionKorean:   map[int64]map[string]struct{}{},
	}
	for _, country := range countries {
		catalog.countriesByID[country.id] = country
		putCountryIfUnique(
			catalog.countriesByEnglish,
			catalog.ambiguousCountryEnglish,
			normalizedEnglish(country.nameEn),
			country,
		)
		if country.nameKo != nil && strings.TrimSpace(*country.nameKo) != "" {
			putCountryIfUnique(
				catalog.countriesByKorean,
				catalog.ambiguousCountryKorean,
				strings.TrimSpace(*country.nameKo),
				country,
			)
		}
	}
	for _, region := range regions {
		catalog.regionsByID[region.id] = region
		if catalog.regionsByEnglish[region.countryID] == nil {
			catalog.regionsByEnglish[region.countryID] = map[string]originCatalogRegion{}
			catalog.ambiguousRegionEnglish[region.countryID] = map[string]struct{}{}
		}
		putRegionIfUnique(
			catalog.regionsByEnglish[region.countryID],
			catalog.ambiguousRegionEnglish[region.countryID],
			normalizedEnglish(region.name),
			region,
		)
		if region.nameKo != nil && strings.TrimSpace(*region.nameKo) != "" {
			if catalog.regionsByKorean[region.countryID] == nil {
				catalog.regionsByKorean[region.countryID] = map[string]originCatalogRegion{}
				catalog.ambiguousRegionKorean[region.countryID] = map[string]struct{}{}
			}
			putRegionIfUnique(
				catalog.regionsByKorean[region.countryID],
				catalog.ambiguousRegionKorean[region.countryID],
				strings.TrimSpace(*region.nameKo),
				region,
			)
		}
	}
	return catalog
}

func putCountryIfUnique(
	index map[string]originCatalogCountry,
	ambiguous map[string]struct{},
	key string,
	candidate originCatalogCountry,
) {
	if key == "" {
		return
	}
	if _, exists := ambiguous[key]; exists {
		return
	}
	if current, exists := index[key]; exists && current.id != candidate.id {
		delete(index, key)
		ambiguous[key] = struct{}{}
		return
	}
	index[key] = candidate
}

func putRegionIfUnique(
	index map[string]originCatalogRegion,
	ambiguous map[string]struct{},
	key string,
	candidate originCatalogRegion,
) {
	if key == "" {
		return
	}
	if _, exists := ambiguous[key]; exists {
		return
	}
	if current, exists := index[key]; exists && current.id != candidate.id {
		delete(index, key)
		ambiguous[key] = struct{}{}
		return
	}
	index[key] = candidate
}

func normalizedEnglish(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func (catalog originCatalog) matchCountry(id *int64, raw string) (originCatalogCountry, bool) {
	if id != nil {
		if country, ok := catalog.countriesByID[*id]; ok {
			return country, true
		}
	}
	trimmed := strings.TrimSpace(raw)
	if country, ok := catalog.countriesByEnglish[normalizedEnglish(trimmed)]; ok {
		return country, true
	}
	if country, ok := catalog.countriesByKorean[trimmed]; ok {
		return country, true
	}
	return originCatalogCountry{}, false
}

func (catalog originCatalog) matchRegion(countryID int64, id *int64, raw string) (originCatalogRegion, bool) {
	if id != nil {
		if region, ok := catalog.regionsByID[*id]; ok && region.countryID == countryID {
			return region, true
		}
	}
	trimmed := strings.TrimSpace(raw)
	if region, ok := catalog.regionsByEnglish[countryID][normalizedEnglish(trimmed)]; ok {
		return region, true
	}
	if region, ok := catalog.regionsByKorean[countryID][trimmed]; ok {
		return region, true
	}
	return originCatalogRegion{}, false
}

type originRegionAccumulator struct {
	entry models.OriginMapRegionEntry
	beans map[string]struct{}
}

type originCountryAccumulator struct {
	entry   models.OriginMapEntry
	beans   map[string]struct{}
	regions map[string]*originRegionAccumulator
}

func buildOriginMap(occurrences []originOccurrence, catalog originCatalog) []models.OriginMapEntry {
	countries := map[string]*originCountryAccumulator{}
	for _, occurrence := range occurrences {
		rawCountry := strings.TrimSpace(occurrence.country)
		matchedCountry, countryMapped := catalog.matchCountry(occurrence.countryID, rawCountry)
		if !countryMapped && rawCountry == "" {
			continue
		}

		countryKey := "raw:" + normalizedEnglish(rawCountry)
		countryEntry := models.OriginMapEntry{
			NameEn:  rawCountry,
			Mapped:  false,
			Regions: []models.OriginMapRegionEntry{},
		}
		if countryMapped {
			countryID := matchedCountry.id
			countryKey = fmt.Sprintf("id:%d", countryID)
			countryEntry.CountryID = &countryID
			countryEntry.NameEn = matchedCountry.nameEn
			countryEntry.NameKo = matchedCountry.nameKo
			countryEntry.Mapped = true
		}

		countryAccumulator, exists := countries[countryKey]
		if !exists {
			countryAccumulator = &originCountryAccumulator{
				entry:   countryEntry,
				beans:   map[string]struct{}{},
				regions: map[string]*originRegionAccumulator{},
			}
			countries[countryKey] = countryAccumulator
		} else if !countryMapped && stableTextLess(rawCountry, countryAccumulator.entry.NameEn) {
			countryAccumulator.entry.NameEn = rawCountry
		}
		countryAccumulator.beans[occurrence.beanID] = struct{}{}

		rawRegion := strings.TrimSpace(occurrence.region)
		regionKey := "raw:" + normalizedEnglish(rawRegion)
		regionEntry := models.OriginMapRegionEntry{Name: rawRegion}
		if countryMapped {
			if matchedRegion, ok := catalog.matchRegion(matchedCountry.id, occurrence.regionID, rawRegion); ok {
				regionID := matchedRegion.id
				regionKey = fmt.Sprintf("id:%d", regionID)
				regionEntry.RegionID = &regionID
				regionEntry.Name = matchedRegion.name
				regionEntry.NameKo = matchedRegion.nameKo
			}
		}

		regionAccumulator, exists := countryAccumulator.regions[regionKey]
		if !exists {
			regionAccumulator = &originRegionAccumulator{
				entry: regionEntry,
				beans: map[string]struct{}{},
			}
			countryAccumulator.regions[regionKey] = regionAccumulator
		} else if regionEntry.RegionID == nil && stableTextLess(rawRegion, regionAccumulator.entry.Name) {
			regionAccumulator.entry.Name = rawRegion
		}
		regionAccumulator.beans[occurrence.beanID] = struct{}{}
	}

	result := make([]models.OriginMapEntry, 0, len(countries))
	for _, country := range countries {
		country.entry.Count = len(country.beans)
		country.entry.Regions = make([]models.OriginMapRegionEntry, 0, len(country.regions))
		for _, region := range country.regions {
			region.entry.Count = len(region.beans)
			country.entry.Regions = append(country.entry.Regions, region.entry)
		}
		sort.Slice(country.entry.Regions, func(i, j int) bool {
			return originRegionLess(country.entry.Regions[i], country.entry.Regions[j])
		})
		result = append(result, country.entry)
	}
	sort.Slice(result, func(i, j int) bool { return originMapLess(result[i], result[j]) })
	return result
}

func stableTextLess(candidate, current string) bool {
	if candidate == current {
		return false
	}
	if current == "" {
		return candidate != ""
	}
	if candidate == "" {
		return false
	}
	return candidate < current
}

func originMapLess(left, right models.OriginMapEntry) bool {
	if left.Count != right.Count {
		return left.Count > right.Count
	}
	leftName := normalizedEnglish(left.NameEn)
	rightName := normalizedEnglish(right.NameEn)
	if leftName != rightName {
		if leftName == "" {
			return false
		}
		if rightName == "" {
			return true
		}
		return leftName < rightName
	}
	if left.Mapped != right.Mapped {
		return left.Mapped
	}
	return nullableIDLess(left.CountryID, right.CountryID)
}

func originRegionLess(left, right models.OriginMapRegionEntry) bool {
	if left.Count != right.Count {
		return left.Count > right.Count
	}
	leftName := normalizedEnglish(left.Name)
	rightName := normalizedEnglish(right.Name)
	if leftName != rightName {
		if leftName == "" {
			return false
		}
		if rightName == "" {
			return true
		}
		return leftName < rightName
	}
	return nullableIDLess(left.RegionID, right.RegionID)
}

func nullableIDLess(left, right *int64) bool {
	if left == nil {
		return false
	}
	if right == nil {
		return true
	}
	return *left < *right
}

func toCountEntries(m map[string]int, desc bool) []models.CountEntry {
	entries := make([]models.CountEntry, 0, len(m))
	for k, v := range m {
		entries = append(entries, models.CountEntry{Key: k, Count: v})
	}
	if desc {
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].Count == entries[j].Count {
				return entries[i].Key < entries[j].Key
			}
			return entries[i].Count > entries[j].Count
		})
	} else {
		sort.Slice(entries, func(i, j int) bool { return entries[i].Key < entries[j].Key })
	}
	return entries
}
