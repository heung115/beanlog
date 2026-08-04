package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"beanlog-server/middleware"
	"beanlog-server/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type BeanHandler struct{}

func isInvalidBeanData(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return strings.HasPrefix(pgErr.Code, "22") || strings.HasPrefix(pgErr.Code, "23")
}

func writeBeanMutationError(c *gin.Context, err error, operation string) {
	if isInvalidBeanData(err) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to " + operation + " bean"})
}

func NewBeanHandler() *BeanHandler {
	return &BeanHandler{}
}

func (h *BeanHandler) List(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	var f models.BeanFilters
	if err := c.ShouldBindQuery(&f); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid query parameters"})
		return
	}
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 20
	}
	if f.Page < 0 {
		f.Page = 0
	}
	offset := f.Page * f.Limit

	// Build WHERE clauses
	var wheres []string
	var args []interface{}
	argIdx := 1

	wheres = append(wheres, fmt.Sprintf("b.user_id = $%d", argIdx))
	args = append(args, userID)
	argIdx++

	if f.OriginCountry != "" {
		wheres = append(wheres, fmt.Sprintf("b.origin_country = $%d", argIdx))
		args = append(args, f.OriginCountry)
		argIdx++
	}
	if f.ProcessMethod != "" {
		wheres = append(wheres, fmt.Sprintf("b.process_method = $%d", argIdx))
		args = append(args, f.ProcessMethod)
		argIdx++
	}
	if f.Varietal != "" {
		wheres = append(wheres, fmt.Sprintf("b.varietal ILIKE $%d", argIdx))
		args = append(args, "%"+f.Varietal+"%")
		argIdx++
	}
	if f.Roastery != "" {
		wheres = append(wheres, fmt.Sprintf("b.roastery ILIKE $%d", argIdx))
		args = append(args, "%"+f.Roastery+"%")
		argIdx++
	}
	if f.BeanType != "" {
		wheres = append(wheres, fmt.Sprintf("b.bean_type = $%d", argIdx))
		args = append(args, f.BeanType)
		argIdx++
	}
	if f.RoastLevel != "" {
		wheres = append(wheres, fmt.Sprintf("b.roast_level = $%d", argIdx))
		args = append(args, f.RoastLevel)
		argIdx++
	}
	if f.ScoreMin != nil {
		wheres = append(wheres, fmt.Sprintf("b.overall_score >= $%d", argIdx))
		args = append(args, *f.ScoreMin)
		argIdx++
	}
	if f.ScoreMax != nil {
		wheres = append(wheres, fmt.Sprintf("b.overall_score <= $%d", argIdx))
		args = append(args, *f.ScoreMax)
		argIdx++
	}
	if f.DateFrom != "" {
		wheres = append(wheres, fmt.Sprintf("b.consumed_at >= $%d", argIdx))
		args = append(args, f.DateFrom)
		argIdx++
	}
	if f.DateTo != "" {
		wheres = append(wheres, fmt.Sprintf("b.consumed_at <= $%d", argIdx))
		args = append(args, f.DateTo)
		argIdx++
	}
	if f.Search != "" {
		wheres = append(wheres, fmt.Sprintf("(b.name ILIKE $%d OR b.roastery ILIKE $%d OR b.note ILIKE $%d)", argIdx, argIdx+1, argIdx+2))
		s := "%" + f.Search + "%"
		args = append(args, s, s, s)
		argIdx += 3
	}
	if f.Tag != "" {
		// Apply the tag filter in SQL (not after pagination) so the count and
		// page slicing both reflect filtered results.
		wheres = append(wheres, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM tasting_tags t WHERE t.bean_id = b.id AND t.user_id = b.user_id AND t.tag = $%d)", argIdx))
		args = append(args, f.Tag)
		argIdx++
	}

	whereClause := strings.Join(wheres, " AND ")

	// Sort
	sortBy := "b.consumed_at"
	switch f.SortBy {
	case "overall_score":
		sortBy = "b.overall_score"
	case "name":
		sortBy = "b.name"
	}
	sortOrder := "DESC"
	if f.SortOrder == "asc" {
		sortOrder = "ASC"
	}

	// Count query
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM beans b WHERE %s", whereClause)
	var total int
	if err := db.QueryRow(c.Request.Context(), countSQL, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count beans"})
		return
	}

	// Data query
	dataSQL := fmt.Sprintf(
		`SELECT b.id, b.user_id, b.name, b.roastery, b.bean_type, b.origin_country,
		        b.origin_country_id, b.origin_region, b.origin_region_id, b.origin_subregions,
		        b.origin_lat, b.origin_lng, b.farm_producer, b.origin_entity_id, b.varietal,
		        b.process_method, b.process_detail, b.altitude_m, b.harvest_year,
		        b.roast_level, b.roast_date, b.consumed_at, b.place_type,
		        b.cafe_name, b.cafe_location, b.menu_name, b.overall_score, b.note,
		        b.score_aroma, b.score_acidity, b.score_body, b.score_sweetness,
		        b.score_aftertaste, b.score_balance, b.purchase_source, b.price,
		        b.weight_g, b.purchased_at, b.created_at, b.updated_at
		 FROM beans b WHERE %s ORDER BY %s %s LIMIT %d OFFSET %d`,
		whereClause, sortBy, sortOrder, f.Limit, offset,
	)

	rows, err := db.Query(c.Request.Context(), dataSQL, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query beans"})
		return
	}
	defer rows.Close()

	var beans []models.Bean
	for rows.Next() {
		var b models.Bean
		var roastDate, purchasedAt *time.Time
		if err := rows.Scan(
			&b.ID, &b.UserID, &b.Name, &b.Roastery, &b.BeanType, &b.OriginCountry,
			&b.OriginCountryID, &b.OriginRegion, &b.OriginRegionID, &b.OriginSubregions,
			&b.OriginLat, &b.OriginLng, &b.FarmProducer, &b.OriginEntityID, &b.Varietal,
			&b.ProcessMethod, &b.ProcessDetail, &b.AltitudeM, &b.HarvestYear,
			&b.RoastLevel, &roastDate, &b.ConsumedAt, &b.PlaceType,
			&b.CafeName, &b.CafeLocation, &b.MenuName, &b.OverallScore, &b.Note,
			&b.ScoreAroma, &b.ScoreAcidity, &b.ScoreBody, &b.ScoreSweetness,
			&b.ScoreAftertaste, &b.ScoreBalance, &b.PurchaseSource, &b.Price,
			&b.WeightG, &purchasedAt, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			continue
		}
		if roastDate != nil {
			s := roastDate.Format("2006-01-02")
			b.RoastDate = &s
		}
		if purchasedAt != nil {
			s := purchasedAt.Format("2006-01-02")
			b.PurchasedAt = &s
		}
		beans = append(beans, b)
	}

	// Load tags for all beans
	if len(beans) > 0 {
		h.loadTags(c.Request.Context(), db, userID, beans)
		h.loadBlendComponents(c.Request.Context(), db, userID, beans)
	}

	if beans == nil {
		beans = []models.Bean{}
	}

	c.JSON(http.StatusOK, gin.H{"beans": beans, "count": total})
}

func (h *BeanHandler) loadTags(ctx context.Context, db pgx.Tx, userID string, beans []models.Bean) {
	if len(beans) == 0 {
		return
	}
	// Parameterized IN clause: values are bound as $2..$N, never interpolated.
	placeholders := make([]string, len(beans))
	args := make([]interface{}, 0, len(beans)+1)
	args = append(args, userID)
	for i, b := range beans {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args = append(args, b.ID)
	}
	tagSQL := "SELECT id, bean_id, user_id, tag, category FROM tasting_tags WHERE user_id = $1 AND bean_id IN (" + strings.Join(placeholders, ",") + ")"
	rows, err := db.Query(ctx, tagSQL, args...)
	if err != nil {
		return
	}
	defer rows.Close()

	tagMap := make(map[string][]models.TastingTag)
	for rows.Next() {
		var t models.TastingTag
		if err := rows.Scan(&t.ID, &t.BeanID, &t.UserID, &t.Tag, &t.Category); err != nil {
			continue
		}
		tagMap[t.BeanID] = append(tagMap[t.BeanID], t)
	}
	for i := range beans {
		if tags, ok := tagMap[beans[i].ID]; ok {
			beans[i].TastingTags = tags
		} else {
			beans[i].TastingTags = []models.TastingTag{}
		}
	}
}

// loadBlendComponents attaches blend components to each bean in one query.
func (h *BeanHandler) loadBlendComponents(ctx context.Context, db pgx.Tx, userID string, beans []models.Bean) {
	if len(beans) == 0 {
		return
	}
	placeholders := make([]string, len(beans))
	args := make([]interface{}, 0, len(beans)+1)
	args = append(args, userID)
	for i, b := range beans {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args = append(args, b.ID)
	}
	sql := `SELECT id, bean_id, user_id, origin_country, origin_region, origin_subregions,
	               farm_producer, varietal, process_method, process_detail, percentage, sort_order
	        FROM blend_components WHERE user_id = $1 AND bean_id IN (` + strings.Join(placeholders, ",") + `)
	        ORDER BY sort_order`
	rows, err := db.Query(ctx, sql, args...)
	if err != nil {
		return
	}
	defer rows.Close()

	compMap := make(map[string][]models.BlendComponent)
	for rows.Next() {
		var comp models.BlendComponent
		if err := rows.Scan(
			&comp.ID, &comp.BeanID, &comp.UserID, &comp.OriginCountry, &comp.OriginRegion,
			&comp.OriginSubregions, &comp.FarmProducer, &comp.Varietal, &comp.ProcessMethod,
			&comp.ProcessDetail, &comp.Percentage, &comp.SortOrder,
		); err != nil {
			continue
		}
		compMap[comp.BeanID] = append(compMap[comp.BeanID], comp)
	}
	for i := range beans {
		if comps, ok := compMap[beans[i].ID]; ok {
			beans[i].BlendComponents = comps
		} else {
			beans[i].BlendComponents = []models.BlendComponent{}
		}
	}
}

func (h *BeanHandler) GetByID(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	beanID := c.Param("id")

	var b models.Bean
	var roastDate, purchasedAt *time.Time
	err := db.QueryRow(c.Request.Context(),
		`SELECT id, user_id, name, roastery, bean_type, origin_country,
		        origin_country_id, origin_region, origin_region_id, origin_subregions,
		        origin_lat, origin_lng, farm_producer, origin_entity_id, varietal,
		        process_method, process_detail, altitude_m, harvest_year,
		        roast_level, roast_date, consumed_at, place_type,
		        cafe_name, cafe_location, menu_name, overall_score, note,
		        score_aroma, score_acidity, score_body, score_sweetness,
		        score_aftertaste, score_balance, purchase_source, price,
		        weight_g, purchased_at, created_at, updated_at
		 FROM beans WHERE id = $1 AND user_id = $2`, beanID, userID,
	).Scan(
		&b.ID, &b.UserID, &b.Name, &b.Roastery, &b.BeanType, &b.OriginCountry,
		&b.OriginCountryID, &b.OriginRegion, &b.OriginRegionID, &b.OriginSubregions,
		&b.OriginLat, &b.OriginLng, &b.FarmProducer, &b.OriginEntityID, &b.Varietal,
		&b.ProcessMethod, &b.ProcessDetail, &b.AltitudeM, &b.HarvestYear,
		&b.RoastLevel, &roastDate, &b.ConsumedAt, &b.PlaceType,
		&b.CafeName, &b.CafeLocation, &b.MenuName, &b.OverallScore, &b.Note,
		&b.ScoreAroma, &b.ScoreAcidity, &b.ScoreBody, &b.ScoreSweetness,
		&b.ScoreAftertaste, &b.ScoreBalance, &b.PurchaseSource, &b.Price,
		&b.WeightG, &purchasedAt, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bean not found"})
		return
	}
	if roastDate != nil {
		s := roastDate.Format("2006-01-02")
		b.RoastDate = &s
	}
	if purchasedAt != nil {
		s := purchasedAt.Format("2006-01-02")
		b.PurchasedAt = &s
	}

	// Load dependent rows via the shared helpers so shapes match List.
	single := []models.Bean{b}
	h.loadTags(c.Request.Context(), db, userID, single)
	h.loadBlendComponents(c.Request.Context(), db, userID, single)
	b = single[0]

	c.JSON(http.StatusOK, b)
}

// beanRecordPayload is the exact JSON shape create_bean_record / update_bean_record
// read via ->> and cast. Every field is present so the RPC's nullif/casts behave
// predictably; nil pointers marshal to JSON null which the RPC treats as SQL NULL.
type beanRecordPayload struct {
	Name             string   `json:"name"`
	Roastery         string   `json:"roastery"`
	BeanType         string   `json:"bean_type"`
	OriginCountry    *string  `json:"origin_country"`
	OriginCountryID  *int64   `json:"origin_country_id"`
	OriginRegion     *string  `json:"origin_region"`
	OriginRegionID   *int64   `json:"origin_region_id"`
	OriginSubregions []string `json:"origin_subregions"`
	OriginLat        *float64 `json:"origin_lat"`
	OriginLng        *float64 `json:"origin_lng"`
	FarmProducer     *string  `json:"farm_producer"`
	OriginEntityID   *int64   `json:"origin_entity_id"`
	Varietal         *string  `json:"varietal"`
	ProcessMethod    string   `json:"process_method"`
	ProcessDetail    *string  `json:"process_detail"`
	AltitudeM        *int     `json:"altitude_m"`
	HarvestYear      *int     `json:"harvest_year"`
	RoastLevel       string   `json:"roast_level"`
	RoastDate        *string  `json:"roast_date"`
	ConsumedAt       string   `json:"consumed_at"`
	PlaceType        string   `json:"place_type"`
	CafeName         *string  `json:"cafe_name"`
	CafeLocation     *string  `json:"cafe_location"`
	MenuName         *string  `json:"menu_name"`
	OverallScore     float64  `json:"overall_score"`
	Note             string   `json:"note"`
	ScoreAroma       *int     `json:"score_aroma"`
	ScoreAcidity     *int     `json:"score_acidity"`
	ScoreBody        *int     `json:"score_body"`
	ScoreSweetness   *int     `json:"score_sweetness"`
	ScoreAftertaste  *int     `json:"score_aftertaste"`
	ScoreBalance     *int     `json:"score_balance"`
	PurchaseSource   *string  `json:"purchase_source"`
	Price            *int     `json:"price"`
	WeightG          *int     `json:"weight_g"`
	PurchasedAt      *string  `json:"purchased_at"`
}

// normalizeConsumedAt returns an RFC3339 timestamp the RPC can cast to
// timestamptz, defaulting to now when the client omits or malforms the value.
func normalizeConsumedAt(raw *string) string {
	if raw != nil {
		if t, err := time.Parse(time.RFC3339, *raw); err == nil {
			return t.UTC().Format(time.RFC3339)
		}
		if t, err := time.Parse("2006-01-02", *raw); err == nil {
			return t.UTC().Format(time.RFC3339)
		}
	}
	return time.Now().UTC().Format(time.RFC3339)
}

// buildBeanRecordPayload marshals the request plus the resolved origin selection
// into the three JSONB arguments the atomic bean RPCs expect. Blend component
// sort_order is normalized to the array index, matching the frontend.
func buildBeanRecordPayload(req *models.CreateBeanRequest, sel *originSelection) (string, string, string, error) {
	bean := beanRecordPayload{
		Name: req.Name, Roastery: req.Roastery, BeanType: req.BeanType,
		OriginCountry: sel.OriginCountry, OriginCountryID: sel.OriginCountryID,
		OriginRegion: sel.OriginRegion, OriginRegionID: sel.OriginRegionID,
		OriginSubregions: sel.OriginSubregions, OriginLat: sel.OriginLat, OriginLng: sel.OriginLng,
		FarmProducer: sel.FarmProducer, OriginEntityID: sel.OriginEntityID,
		Varietal: req.Varietal, ProcessMethod: req.ProcessMethod, ProcessDetail: req.ProcessDetail,
		AltitudeM: req.AltitudeM, HarvestYear: req.HarvestYear, RoastLevel: req.RoastLevel,
		RoastDate: req.RoastDate, ConsumedAt: normalizeConsumedAt(req.ConsumedAt), PlaceType: req.PlaceType,
		CafeName: req.CafeName, CafeLocation: req.CafeLocation, MenuName: req.MenuName,
		OverallScore: req.OverallScore, Note: req.Note,
		ScoreAroma: req.ScoreAroma, ScoreAcidity: req.ScoreAcidity, ScoreBody: req.ScoreBody,
		ScoreSweetness: req.ScoreSweetness, ScoreAftertaste: req.ScoreAftertaste, ScoreBalance: req.ScoreBalance,
		PurchaseSource: req.PurchaseSource, Price: req.Price, WeightG: req.WeightG, PurchasedAt: req.PurchasedAt,
	}
	beanJSON, err := json.Marshal(bean)
	if err != nil {
		return "", "", "", err
	}

	type tagPayload struct {
		Tag      string `json:"tag"`
		Category string `json:"category"`
	}
	tags := make([]tagPayload, 0, len(req.Tags))
	for _, t := range req.Tags {
		category := t.Category
		if category == "" {
			category = "other"
		}
		tags = append(tags, tagPayload{Tag: t.Tag, Category: category})
	}
	tagsJSON, err := json.Marshal(tags)
	if err != nil {
		return "", "", "", err
	}

	type componentPayload struct {
		OriginCountry    string   `json:"origin_country"`
		OriginRegion     *string  `json:"origin_region"`
		OriginSubregions []string `json:"origin_subregions"`
		FarmProducer     *string  `json:"farm_producer"`
		Varietal         *string  `json:"varietal"`
		ProcessMethod    *string  `json:"process_method"`
		ProcessDetail    *string  `json:"process_detail"`
		Percentage       float64  `json:"percentage"`
		SortOrder        int      `json:"sort_order"`
	}
	components := make([]componentPayload, 0, len(req.BlendComponents))
	for i, comp := range req.BlendComponents {
		components = append(components, componentPayload{
			OriginCountry: comp.OriginCountry, OriginRegion: comp.OriginRegion,
			OriginSubregions: comp.OriginSubregions, FarmProducer: comp.FarmProducer,
			Varietal: comp.Varietal, ProcessMethod: comp.ProcessMethod,
			ProcessDetail: comp.ProcessDetail, Percentage: comp.Percentage, SortOrder: i,
		})
	}
	componentsJSON, err := json.Marshal(components)
	if err != nil {
		return "", "", "", err
	}

	return string(beanJSON), string(tagsJSON), string(componentsJSON), nil
}

// Create persists a bean and its dependent rows through the atomic
// create_bean_record function, so blend validation, RLS, and rollback all live
// in one database-side unit rather than being re-implemented here.
func (h *BeanHandler) Create(c *gin.Context) {
	db := middleware.RequestDB(c)
	var req models.CreateBeanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}

	sel, err := resolveOriginSelection(c.Request.Context(), db, &req)
	if err != nil {
		writeOriginResolutionError(c, err)
		return
	}

	beanJSON, tagsJSON, componentsJSON, err := buildBeanRecordPayload(&req, sel)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}

	var beanID string
	err = db.QueryRow(c.Request.Context(),
		"SELECT public.create_bean_record($1::jsonb, $2::jsonb, $3::jsonb)",
		beanJSON, tagsJSON, componentsJSON,
	).Scan(&beanID)
	if err != nil {
		writeBeanMutationError(c, err, "create")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "id": beanID})
}

// Update replaces a bean and its dependent rows through update_bean_record. The
// RPC scopes the update to auth.uid(), so a foreign bean id yields P0002 → 404.
func (h *BeanHandler) Update(c *gin.Context) {
	db := middleware.RequestDB(c)
	beanID := c.Param("id")
	var req models.UpdateBeanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}

	sel, err := resolveOriginSelection(c.Request.Context(), db, &req)
	if err != nil {
		writeOriginResolutionError(c, err)
		return
	}

	beanJSON, tagsJSON, componentsJSON, err := buildBeanRecordPayload(&req, sel)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}

	var returnedID string
	err = db.QueryRow(c.Request.Context(),
		"SELECT public.update_bean_record($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb)",
		beanID, beanJSON, tagsJSON, componentsJSON,
	).Scan(&returnedID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "P0002" {
			c.JSON(http.StatusNotFound, gin.H{"error": "bean not found"})
			return
		}
		writeBeanMutationError(c, err, "update")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func writeOriginResolutionError(c *gin.Context, err error) {
	if isOriginResolutionError(err) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve origin"})
}

func (h *BeanHandler) Delete(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	beanID := c.Param("id")

	tag, err := db.Exec(c.Request.Context(), "DELETE FROM beans WHERE id=$1 AND user_id=$2", beanID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete bean"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "bean not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// splitVarietals mirrors src/lib/coffee/varietals.ts: one persisted varietal
// field can hold several comma-delimited values, and filters act on one at a
// time, so each is exposed as its own option.
func splitVarietals(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	replacer := strings.NewReplacer("，", ",")
	parts := strings.Split(replacer.Replace(value), ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// FilterOptions returns the distinct origin/roastery/varietal values used to
// populate the explore filter controls.
func (h *BeanHandler) FilterOptions(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)

	rows, err := db.Query(c.Request.Context(),
		"SELECT origin_country, roastery, COALESCE(varietal,'') FROM beans WHERE user_id = $1 LIMIT 5000",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query filter options"})
		return
	}
	defer rows.Close()

	origins := map[string]struct{}{}
	roasteries := map[string]struct{}{}
	varietals := map[string]struct{}{}
	for rows.Next() {
		var origin, roastery, varietal string
		if err := rows.Scan(&origin, &roastery, &varietal); err != nil {
			continue
		}
		if strings.TrimSpace(origin) != "" {
			origins[origin] = struct{}{}
		}
		if trimmed := strings.TrimSpace(roastery); trimmed != "" {
			roasteries[trimmed] = struct{}{}
		}
		for _, v := range splitVarietals(varietal) {
			varietals[v] = struct{}{}
		}
	}

	c.JSON(http.StatusOK, models.BeanFilterOptions{
		Origins:    sortedKeys(origins),
		Roasteries: sortedKeys(roasteries),
		Varietals:  sortedKeys(varietals),
	})
}

func sortedKeys(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
