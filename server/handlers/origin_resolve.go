package handlers

import (
	"context"
	"errors"
	"strings"

	"beanlog-server/models"

	"github.com/jackc/pgx/v5"
)

// Origin resolution errors map to 400 responses; they mean the client sent a
// catalog id that does not line up with the selected country/region.
var (
	errInvalidOriginCountry = errors.New("invalid origin country")
	errInvalidOriginRegion  = errors.New("invalid origin region")
	errInvalidOriginEntity  = errors.New("invalid farm or producer")
	errRegionRequiredFirst  = errors.New("select an origin region first")
)

func isOriginResolutionError(err error) bool {
	return errors.Is(err, errInvalidOriginCountry) ||
		errors.Is(err, errInvalidOriginRegion) ||
		errors.Is(err, errInvalidOriginEntity) ||
		errors.Is(err, errRegionRequiredFirst)
}

// originSelection is the resolved set of origin fields that get written to the
// bean row. It never trusts a browser-supplied catalog id: every id is
// re-checked against the catalog and its parent before use.
type originSelection struct {
	OriginCountry    *string
	OriginCountryID  *int64
	OriginRegion     *string
	OriginRegionID   *int64
	OriginSubregions []string
	OriginEntityID   *int64
	FarmProducer     *string
	OriginLat        *float64
	OriginLng        *float64
}

func nullIfEmpty(s *string) *string {
	if s == nil {
		return nil
	}
	if trimmed := strings.TrimSpace(*s); trimmed == "" {
		return nil
	} else {
		return &trimmed
	}
}

// resolveOriginSelection mirrors the frontend validation: a region must belong
// to the selected country and be canonical; an entity must belong to the
// selected region's canonical group. Blends carry no single origin.
func resolveOriginSelection(ctx context.Context, db pgx.Tx, req *models.CreateBeanRequest) (*originSelection, error) {
	// Keep JSON payloads array-shaped even when a blend has no parent origin.
	// A nil slice marshals as JSON null, which the mutation RPC cannot pass to
	// jsonb_array_elements_text.
	sel := &originSelection{OriginSubregions: []string{}}

	if req.BeanType == "blend" {
		return sel, nil
	}

	subregions := req.OriginSubregions
	if subregions == nil {
		subregions = []string{}
	}
	sel.OriginSubregions = subregions
	sel.OriginLat = req.OriginLat
	sel.OriginLng = req.OriginLng

	// No catalog country id: persist the free-text fields as-is.
	if req.OriginCountryID == nil || *req.OriginCountryID <= 0 {
		sel.OriginCountry = nullIfEmpty(&req.OriginCountry)
		sel.OriginRegion = nullIfEmpty(req.OriginRegion)
		sel.FarmProducer = nullIfEmpty(req.FarmProducer)
		return sel, nil
	}

	var countryID int64
	var countryName string
	err := db.QueryRow(ctx,
		"SELECT id, name_en FROM origin_countries WHERE id = $1", *req.OriginCountryID,
	).Scan(&countryID, &countryName)
	if err != nil {
		return nil, errInvalidOriginCountry
	}
	sel.OriginCountry = &countryName
	sel.OriginCountryID = &countryID
	sel.OriginRegion = nullIfEmpty(req.OriginRegion)
	sel.FarmProducer = nullIfEmpty(req.FarmProducer)

	if req.OriginRegionID != nil && *req.OriginRegionID > 0 {
		var regionID int64
		var displayName string
		var canonicalRegionID *int64
		err := db.QueryRow(ctx,
			`SELECT id, display_name, canonical_region_id
			 FROM origin_regions WHERE id = $1 AND country_id = $2`,
			*req.OriginRegionID, countryID,
		).Scan(&regionID, &displayName, &canonicalRegionID)
		if err != nil || canonicalRegionID == nil || *canonicalRegionID != regionID || displayName == "" {
			return nil, errInvalidOriginRegion
		}
		sel.OriginRegionID = &regionID
		sel.OriginRegion = &displayName
	}

	if req.OriginEntityID == nil || *req.OriginEntityID <= 0 {
		return sel, nil
	}
	if sel.OriginRegionID == nil {
		return nil, errRegionRequiredFirst
	}

	var entityID int64
	var entityRegionID *int64
	var entityName string
	err = db.QueryRow(ctx,
		"SELECT id, region_id, name FROM origin_entities WHERE id = $1 AND country_id = $2",
		*req.OriginEntityID, countryID,
	).Scan(&entityID, &entityRegionID, &entityName)
	if err != nil {
		return nil, errInvalidOriginEntity
	}
	if entityRegionID == nil {
		return nil, errInvalidOriginEntity
	}

	var entityCanonical *int64
	err = db.QueryRow(ctx,
		"SELECT canonical_region_id FROM origin_regions WHERE id = $1", *entityRegionID,
	).Scan(&entityCanonical)
	if err != nil || entityCanonical == nil || *entityCanonical != *sel.OriginRegionID {
		return nil, errInvalidOriginEntity
	}

	sel.OriginEntityID = &entityID
	sel.FarmProducer = &entityName
	return sel, nil
}
