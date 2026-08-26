package handlers

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"time"

	"beanmap-server/middleware"
	"beanmap-server/models"

	"github.com/gin-gonic/gin"
)

type StatsHandler struct{}

const maxStatsBeans = 10000

func NewStatsHandler() *StatsHandler {
	return &StatsHandler{}
}

func (h *StatsHandler) GetStats(c *gin.Context) {
	db := middleware.RequestDB(c)
	userID := c.GetString(middleware.UserIDKey)

	rows, err := db.Query(c.Request.Context(),
		`SELECT origin_country, process_method, COALESCE(varietal,''), overall_score, consumed_at, name, roastery
		 FROM beans WHERE user_id = $1 LIMIT $2`, userID, maxStatsBeans+1,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query stats"})
		return
	}
	defer rows.Close()

	type beanRow struct {
		origin, process, varietal, name, roastery string
		score                                     float64
		consumedAt                                time.Time
	}
	var beanRows []beanRow
	for rows.Next() {
		var b beanRow
		if err := rows.Scan(&b.origin, &b.process, &b.varietal, &b.score, &b.consumedAt, &b.name, &b.roastery); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query stats"})
			return
		}
		beanRows = append(beanRows, b)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query stats"})
		return
	}
	if len(beanRows) > maxStatsBeans {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "dataset too large for statistics"})
		return
	}

	if len(beanRows) == 0 {
		c.JSON(http.StatusOK, nil)
		return
	}

	total := len(beanRows)
	var sumScore float64
	best := beanRows[0]
	byOrigin := map[string]int{}
	byProcess := map[string]int{}
	byVarietal := map[string]int{}
	byMonth := map[string]int{}
	scoreDist := map[string]int{}

	for _, b := range beanRows {
		sumScore += b.score
		if b.score > best.score {
			best = b
		}
		byOrigin[b.origin]++
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
	}

	if len(stats.ByOrigin) > 0 {
		stats.TopOrigin = &stats.ByOrigin[0]
	}
	if len(stats.ByProcess) > 0 {
		stats.TopProcess = &stats.ByProcess[0]
	}

	c.JSON(http.StatusOK, stats)
}

func toCountEntries(m map[string]int, desc bool) []models.CountEntry {
	entries := make([]models.CountEntry, 0, len(m))
	for k, v := range m {
		entries = append(entries, models.CountEntry{Key: k, Count: v})
	}
	if desc {
		sort.Slice(entries, func(i, j int) bool { return entries[i].Count > entries[j].Count })
	} else {
		sort.Slice(entries, func(i, j int) bool { return entries[i].Key < entries[j].Key })
	}
	return entries
}
