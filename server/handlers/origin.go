package handlers

import (
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"beanlog-server/middleware"
	"beanlog-server/models"

	"github.com/gin-gonic/gin"
)

type OriginHandler struct{}

func NewOriginHandler() *OriginHandler {
	return &OriginHandler{}
}

func (h *OriginHandler) List(c *gin.Context) {
	db := middleware.RequestDB(c)
	rows, err := db.Query(c.Request.Context(),
		`SELECT id, country, region, lat, lng, altitude_range, signature, key_varietals, name_ko, name_en
		 FROM origin_presets ORDER BY country, region`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin presets"})
		return
	}
	defer rows.Close()

	var presets []models.OriginPreset
	for rows.Next() {
		var p models.OriginPreset
		if err := rows.Scan(
			&p.ID, &p.Country, &p.Region, &p.Lat, &p.Lng,
			&p.AltitudeRange, &p.Signature, &p.KeyVarietals, &p.NameKo, &p.NameEn,
		); err != nil {
			continue
		}
		presets = append(presets, p)
	}

	if presets == nil {
		presets = []models.OriginPreset{}
	}

	c.JSON(http.StatusOK, presets)
}

// Countries lists the origin catalog countries for the selector.
func (h *OriginHandler) Countries(c *gin.Context) {
	db := middleware.RequestDB(c)
	rows, err := db.Query(c.Request.Context(),
		"SELECT id, name_en, name_ko FROM origin_countries ORDER BY name_en",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin countries"})
		return
	}
	defer rows.Close()

	countries := []models.OriginCountryOption{}
	for rows.Next() {
		var opt models.OriginCountryOption
		if err := rows.Scan(&opt.ID, &opt.NameEn, &opt.NameKo); err != nil {
			continue
		}
		countries = append(countries, opt)
	}
	c.JSON(http.StatusOK, countries)
}

// Regions lists the canonical regions for one country.
func (h *OriginHandler) Regions(c *gin.Context) {
	db := middleware.RequestDB(c)
	countryID, ok := parseOriginIDParam(c, "countryId")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid country id"})
		return
	}

	rows, err := db.Query(c.Request.Context(),
		`SELECT id, display_name, display_name_ko
		 FROM origin_regions
		 WHERE country_id = $1 AND is_canonical = true AND display_name IS NOT NULL
		 ORDER BY display_name`,
		countryID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin regions"})
		return
	}
	defer rows.Close()

	regions := []models.OriginRegionOption{}
	for rows.Next() {
		var opt models.OriginRegionOption
		if err := rows.Scan(&opt.ID, &opt.Name, &opt.NameKo); err != nil {
			continue
		}
		regions = append(regions, opt)
	}
	c.JSON(http.StatusOK, regions)
}

var (
	noisySegmentPattern = regexp.MustCompile(`(?i)^(contact|contact name|exporter name|phone|phone number|tel|mobile|email)$`)
	contactValuePattern = regexp.MustCompile(`(?i)@|\b(phone|tel|mobile|email)\b|[0-9][0-9 -]{5,}`)
)

// cleanEntityName mirrors the frontend: split on "|", drop contact/noise
// segments, and reject values that still look like contact info.
func cleanEntityName(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	var cleanParts []string
	for _, part := range strings.Split(trimmed, "|") {
		part = strings.TrimSpace(part)
		if part != "" && !noisySegmentPattern.MatchString(part) && !contactValuePattern.MatchString(part) {
			cleanParts = append(cleanParts, part)
		}
	}
	cleaned := trimmed
	if len(cleanParts) > 0 {
		cleaned = cleanParts[0]
	}
	if noisySegmentPattern.MatchString(cleaned) || contactValuePattern.MatchString(cleaned) {
		return nil
	}
	return &cleaned
}

// Entities lists farm/producer/cooperative suggestions for one canonical region,
// resolving source-region aliases through canonical_region_id.
func (h *OriginHandler) Entities(c *gin.Context) {
	db := middleware.RequestDB(c)
	countryID, ok := parseOriginIDParam(c, "countryId")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid country id"})
		return
	}
	regionID, ok := parseOriginIDParam(c, "regionId")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid region id"})
		return
	}
	ctx := c.Request.Context()

	// The selected region must exist, belong to the country, and be canonical.
	var selectedCanonical *int64
	err := db.QueryRow(ctx,
		"SELECT canonical_region_id FROM origin_regions WHERE id = $1 AND country_id = $2",
		regionID, countryID,
	).Scan(&selectedCanonical)
	if err != nil || selectedCanonical == nil || *selectedCanonical != regionID {
		c.JSON(http.StatusOK, []models.OriginEntityOption{})
		return
	}

	// Collect every source region alias that resolves to this canonical region.
	aliasRows, err := db.Query(ctx,
		"SELECT id FROM origin_regions WHERE country_id = $1 AND canonical_region_id = $2",
		countryID, regionID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin entities"})
		return
	}
	var aliasIDs []int64
	for aliasRows.Next() {
		var id int64
		if err := aliasRows.Scan(&id); err == nil {
			aliasIDs = append(aliasIDs, id)
		}
	}
	aliasRows.Close()
	if len(aliasIDs) == 0 {
		c.JSON(http.StatusOK, []models.OriginEntityOption{})
		return
	}

	placeholders := make([]string, len(aliasIDs))
	args := make([]interface{}, 0, len(aliasIDs)+1)
	args = append(args, countryID)
	for i, id := range aliasIDs {
		placeholders[i] = strconv.Itoa(i + 2)
		placeholders[i] = "$" + placeholders[i]
		args = append(args, id)
	}
	entitySQL := `SELECT id, name, name_ko, entity_type, farm_name, producer_name, mill_name
	              FROM origin_entities
	              WHERE country_id = $1 AND region_id IN (` + strings.Join(placeholders, ",") + `)
	              ORDER BY name`
	entityRows, err := db.Query(ctx, entitySQL, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query origin entities"})
		return
	}
	defer entityRows.Close()

	entities := []models.OriginEntityOption{}
	for entityRows.Next() {
		var id int64
		var name string
		var nameKo, entityType, farmName, producerName, millName *string
		if err := entityRows.Scan(&id, &name, &nameKo, &entityType, &farmName, &producerName, &millName); err != nil {
			continue
		}

		displayName := cleanEntityName(&name)
		if displayName == nil {
			displayName = cleanEntityName(farmName)
		}
		if displayName == nil {
			displayName = cleanEntityName(producerName)
		}
		if displayName == nil {
			displayName = cleanEntityName(millName)
		}
		if displayName == nil {
			continue
		}

		hasSpecificSource := cleanEntityName(farmName) != nil ||
			cleanEntityName(producerName) != nil ||
			cleanEntityName(millName) != nil
		if entityType != nil && *entityType == "미분류" && !hasSpecificSource {
			continue
		}

		opt := models.OriginEntityOption{ID: id, Name: *displayName, EntityType: entityType}
		if name == *displayName {
			opt.NameKo = nameKo
		}
		entities = append(entities, opt)
	}
	c.JSON(http.StatusOK, entities)
}

// UserSubregions returns the distinct origin-subregion chains the caller has
// previously entered for a country (and optionally a region), for autocomplete.
func (h *OriginHandler) UserSubregions(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	country := strings.TrimSpace(c.Query("country"))
	region := strings.TrimSpace(c.Query("region"))
	if country == "" {
		c.JSON(http.StatusOK, [][]string{})
		return
	}
	ctx := c.Request.Context()

	collect := func(table string) [][]string {
		query := "SELECT origin_subregions FROM " + table +
			" WHERE user_id = $1 AND origin_country = $2 AND origin_subregions <> '{}' LIMIT 200"
		args := []interface{}{userID, country}
		if region != "" {
			query += " AND origin_region = $3"
			args = append(args, region)
		}
		rows, err := db.Query(ctx, query, args...)
		if err != nil {
			return nil
		}
		defer rows.Close()
		var chains [][]string
		for rows.Next() {
			var subregions []string
			if err := rows.Scan(&subregions); err != nil {
				continue
			}
			chains = append(chains, subregions)
		}
		return chains
	}

	seen := map[string]struct{}{}
	result := [][]string{}
	for _, chain := range append(collect("beans"), collect("blend_components")...) {
		var trimmed []string
		for _, item := range chain {
			if s := strings.TrimSpace(item); s != "" {
				trimmed = append(trimmed, s)
			}
		}
		if len(trimmed) == 0 {
			continue
		}
		key := strings.Join(lowerAll(trimmed), "\x1f")
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	sort.Slice(result, func(i, j int) bool {
		return strings.Join(result[i], " ") < strings.Join(result[j], " ")
	})
	c.JSON(http.StatusOK, result)
}

func lowerAll(items []string) []string {
	out := make([]string, len(items))
	for i, s := range items {
		out[i] = strings.ToLower(s)
	}
	return out
}

func parseOriginIDParam(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}
