package handlers

import (
	"net/http"

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
