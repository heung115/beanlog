package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
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
		        b.origin_region, b.origin_lat, b.origin_lng, b.farm_producer, b.varietal,
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
			&b.OriginRegion, &b.OriginLat, &b.OriginLng, &b.FarmProducer, &b.Varietal,
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
	}

	// Filter by tag if requested (post-query)
	if f.Tag != "" {
		var filtered []models.Bean
		for _, b := range beans {
			for _, t := range b.TastingTags {
				if t.Tag == f.Tag {
					filtered = append(filtered, b)
					break
				}
			}
		}
		beans = filtered
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

func (h *BeanHandler) GetByID(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	beanID := c.Param("id")

	var b models.Bean
	var roastDate, purchasedAt *time.Time
	err := db.QueryRow(c.Request.Context(),
		`SELECT id, user_id, name, roastery, bean_type, origin_country,
		        origin_region, origin_lat, origin_lng, farm_producer, varietal,
		        process_method, process_detail, altitude_m, harvest_year,
		        roast_level, roast_date, consumed_at, place_type,
		        cafe_name, cafe_location, menu_name, overall_score, note,
		        score_aroma, score_acidity, score_body, score_sweetness,
		        score_aftertaste, score_balance, purchase_source, price,
		        weight_g, purchased_at, created_at, updated_at
		 FROM beans WHERE id = $1 AND user_id = $2`, beanID, userID,
	).Scan(
		&b.ID, &b.UserID, &b.Name, &b.Roastery, &b.BeanType, &b.OriginCountry,
		&b.OriginRegion, &b.OriginLat, &b.OriginLng, &b.FarmProducer, &b.Varietal,
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

	// Load tags
	h.loadTags(c.Request.Context(), db, userID, []models.Bean{b})
	rows, _ := db.Query(c.Request.Context(),
		"SELECT id, bean_id, user_id, tag, category FROM tasting_tags WHERE bean_id = $1 AND user_id = $2",
		beanID, userID,
	)
	if rows != nil {
		defer rows.Close()
		var tags []models.TastingTag
		for rows.Next() {
			var t models.TastingTag
			if err := rows.Scan(&t.ID, &t.BeanID, &t.UserID, &t.Tag, &t.Category); err == nil {
				tags = append(tags, t)
			}
		}
		if tags == nil {
			tags = []models.TastingTag{}
		}
		b.TastingTags = tags
	}

	c.JSON(http.StatusOK, b)
}

func (h *BeanHandler) Create(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	var req models.CreateBeanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}

	consumedAt := time.Now()
	if req.ConsumedAt != nil {
		if t, err := time.Parse(time.RFC3339, *req.ConsumedAt); err == nil {
			consumedAt = t
		}
	}

	var beanID string
	err := func() error {
		if err := db.QueryRow(c.Request.Context(),
			`INSERT INTO beans (user_id, name, roastery, bean_type, origin_country, origin_region,
			origin_lat, origin_lng, farm_producer, varietal, process_method, process_detail,
			altitude_m, harvest_year, roast_level, roast_date, consumed_at, place_type,
			cafe_name, cafe_location, menu_name, overall_score, note,
			score_aroma, score_acidity, score_body, score_sweetness, score_aftertaste, score_balance,
			purchase_source, price, weight_g, purchased_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
		RETURNING id`,
			userID, req.Name, req.Roastery, req.BeanType, req.OriginCountry, req.OriginRegion,
			req.OriginLat, req.OriginLng, req.FarmProducer, req.Varietal, req.ProcessMethod, req.ProcessDetail,
			req.AltitudeM, req.HarvestYear, req.RoastLevel, req.RoastDate, consumedAt, req.PlaceType,
			req.CafeName, req.CafeLocation, req.MenuName, req.OverallScore, req.Note,
			req.ScoreAroma, req.ScoreAcidity, req.ScoreBody, req.ScoreSweetness, req.ScoreAftertaste, req.ScoreBalance,
			req.PurchaseSource, req.Price, req.WeightG, req.PurchasedAt,
		).Scan(&beanID); err != nil {
			return err
		}

		for _, tag := range req.Tags {
			category := tag.Category
			if category == "" {
				category = "other"
			}
			if _, err := db.Exec(c.Request.Context(),
				"INSERT INTO tasting_tags (bean_id, user_id, tag, category) VALUES ($1,$2,$3,$4)",
				beanID, userID, tag.Tag, category,
			); err != nil {
				return err
			}
		}
		return nil
	}()
	if err != nil {
		writeBeanMutationError(c, err, "create")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "id": beanID})
}

func (h *BeanHandler) Update(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	beanID := c.Param("id")
	var req models.UpdateBeanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bean data"})
		return
	}

	consumedAt := time.Now()
	if req.ConsumedAt != nil {
		if t, err := time.Parse(time.RFC3339, *req.ConsumedAt); err == nil {
			consumedAt = t
		}
	}

	err := func() error {
		commandTag, err := db.Exec(c.Request.Context(),
			`UPDATE beans SET name=$1, roastery=$2, bean_type=$3, origin_country=$4, origin_region=$5,
			origin_lat=$6, origin_lng=$7, farm_producer=$8, varietal=$9, process_method=$10, process_detail=$11,
			altitude_m=$12, harvest_year=$13, roast_level=$14, roast_date=$15, consumed_at=$16, place_type=$17,
			cafe_name=$18, cafe_location=$19, menu_name=$20, overall_score=$21, note=$22,
			score_aroma=$23, score_acidity=$24, score_body=$25, score_sweetness=$26, score_aftertaste=$27, score_balance=$28,
			purchase_source=$29, price=$30, weight_g=$31, purchased_at=$32, updated_at=now()
		WHERE id=$33 AND user_id=$34`,
			req.Name, req.Roastery, req.BeanType, req.OriginCountry, req.OriginRegion,
			req.OriginLat, req.OriginLng, req.FarmProducer, req.Varietal, req.ProcessMethod, req.ProcessDetail,
			req.AltitudeM, req.HarvestYear, req.RoastLevel, req.RoastDate, consumedAt, req.PlaceType,
			req.CafeName, req.CafeLocation, req.MenuName, req.OverallScore, req.Note,
			req.ScoreAroma, req.ScoreAcidity, req.ScoreBody, req.ScoreSweetness, req.ScoreAftertaste, req.ScoreBalance,
			req.PurchaseSource, req.Price, req.WeightG, req.PurchasedAt,
			beanID, userID,
		)
		if err != nil {
			return err
		}
		if commandTag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}

		if _, err := db.Exec(c.Request.Context(),
			"DELETE FROM tasting_tags WHERE bean_id=$1 AND user_id=$2", beanID, userID,
		); err != nil {
			return err
		}
		for _, tag := range req.Tags {
			category := tag.Category
			if category == "" {
				category = "other"
			}
			if _, err := db.Exec(c.Request.Context(),
				"INSERT INTO tasting_tags (bean_id, user_id, tag, category) VALUES ($1,$2,$3,$4)",
				beanID, userID, tag.Tag, category,
			); err != nil {
				return err
			}
		}
		return nil
	}()
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "bean not found"})
		} else {
			writeBeanMutationError(c, err, "update")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
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
