package handlers

import (
	"net/http"

	"beanlog-server/middleware"
	"beanlog-server/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProfileHandler struct {
	DB *pgxpool.Pool
}

func NewProfileHandler(db *pgxpool.Pool) *ProfileHandler {
	return &ProfileHandler{DB: db}
}

func (h *ProfileHandler) GetProfile(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)

	var p models.Profile
	err := h.DB.QueryRow(c.Request.Context(),
		"SELECT id, email, display_name, locale, created_at FROM profiles WHERE id = $1", userID,
	).Scan(&p.ID, &p.Email, &p.DisplayName, &p.Locale, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}

	c.JSON(http.StatusOK, p)
}

func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := h.DB.Exec(c.Request.Context(),
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

func (h *ProfileHandler) ExportData(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)

	var p models.Profile
	h.DB.QueryRow(c.Request.Context(),
		"SELECT id, email, display_name, locale, created_at FROM profiles WHERE id = $1", userID,
	).Scan(&p.ID, &p.Email, &p.DisplayName, &p.Locale, &p.CreatedAt)

	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id, user_id, name, roastery, bean_type, origin_country,
		        origin_region, origin_lat, origin_lng, farm_producer, varietal,
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

	var beans []models.Bean
	for rows.Next() {
		var b models.Bean
		if err := rows.Scan(
			&b.ID, &b.UserID, &b.Name, &b.Roastery, &b.BeanType, &b.OriginCountry,
			&b.OriginRegion, &b.OriginLat, &b.OriginLng, &b.FarmProducer, &b.Varietal,
			&b.ProcessMethod, &b.ProcessDetail, &b.AltitudeM, &b.HarvestYear,
			&b.RoastLevel, &b.RoastDate, &b.ConsumedAt, &b.PlaceType,
			&b.CafeName, &b.CafeLocation, &b.MenuName, &b.OverallScore, &b.Note,
			&b.ScoreAroma, &b.ScoreAcidity, &b.ScoreBody, &b.ScoreSweetness,
			&b.ScoreAftertaste, &b.ScoreBalance, &b.PurchaseSource, &b.Price,
			&b.WeightG, &b.PurchasedAt, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			continue
		}
		beans = append(beans, b)
	}

	c.JSON(http.StatusOK, gin.H{
		"profile": p,
		"beans":   beans,
	})
}

func (h *ProfileHandler) DeleteAccount(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)

	h.DB.Exec(c.Request.Context(), "DELETE FROM tasting_tags WHERE user_id=$1", userID)
	h.DB.Exec(c.Request.Context(), "DELETE FROM beans WHERE user_id=$1", userID)
	h.DB.Exec(c.Request.Context(), "DELETE FROM profiles WHERE id=$1", userID)

	c.JSON(http.StatusOK, gin.H{"success": true})
}
