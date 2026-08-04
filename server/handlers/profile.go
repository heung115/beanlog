package handlers

import (
	"net/http"
	"time"

	"beanlog-server/middleware"
	"beanlog-server/models"

	"github.com/gin-gonic/gin"
)

type ProfileHandler struct{}

func NewProfileHandler() *ProfileHandler {
	return &ProfileHandler{}
}

func (h *ProfileHandler) GetProfile(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)

	var p models.Profile
	err := db.QueryRow(c.Request.Context(),
		"SELECT id, email, display_name, locale, created_at FROM profiles WHERE id = $1", userID,
	).Scan(&p.ID, &p.Email, &p.DisplayName, &p.Locale, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}

	c.JSON(http.StatusOK, p)
}

func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile data"})
		return
	}

	tag, err := db.Exec(c.Request.Context(),
		"UPDATE profiles SET display_name=$1, locale=$2 WHERE id=$3",
		req.DisplayName, req.Locale, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ExportData returns the caller's full dataset in the same shape the frontend
// download expects: exported_at, profile, and beans with nested tags and blend
// components.
func (h *ProfileHandler) ExportData(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)
	beanH := NewBeanHandler()

	var p models.Profile
	if err := db.QueryRow(c.Request.Context(),
		"SELECT id, email, display_name, locale, created_at FROM profiles WHERE id = $1", userID,
	).Scan(&p.ID, &p.Email, &p.DisplayName, &p.Locale, &p.CreatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to export data"})
		return
	}

	rows, err := db.Query(c.Request.Context(),
		`SELECT id, user_id, name, roastery, bean_type, origin_country,
		        origin_country_id, origin_region, origin_region_id, origin_subregions,
		        origin_lat, origin_lng, farm_producer, origin_entity_id, varietal,
		        process_method, process_detail, altitude_m, harvest_year,
		        roast_level, roast_date, consumed_at, place_type,
		        cafe_name, cafe_location, menu_name, overall_score, note,
		        score_aroma, score_acidity, score_body, score_sweetness,
		        score_aftertaste, score_balance, purchase_source, price,
		        weight_g, purchased_at, created_at, updated_at
		 FROM beans WHERE user_id = $1 ORDER BY consumed_at DESC`, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to export data"})
		return
	}
	defer rows.Close()

	beans := []models.Bean{}
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

	if len(beans) > 0 {
		beanH.loadTags(c.Request.Context(), db, userID, beans)
		beanH.loadBlendComponents(c.Request.Context(), db, userID, beans)
	}

	c.JSON(http.StatusOK, gin.H{
		"exported_at": time.Now().UTC().Format(time.RFC3339),
		"profile":     p,
		"beans":       beans,
	})
}
