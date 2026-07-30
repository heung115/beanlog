package routes

import (
	"beanlog-server/config"
	"beanlog-server/handlers"
	"beanlog-server/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Setup(cfg *config.Config, db *pgxpool.Pool) *gin.Engine {
	r := gin.Default()

	// 신뢰할 프록시 없음 — X-Forwarded-For를 믿지 않고 직접 연결 IP를 사용.
	// 역프록시 뒤에서 운영할 경우 여기에 해당 대역을 명시할 것.
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.CORSOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Health check (no auth)
	r.GET("/health", func(c *gin.Context) {
		if err := db.Ping(c.Request.Context()); err != nil {
			c.JSON(503, gin.H{"status": "unhealthy", "error": err.Error()})
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Origin presets are reference data, but should only be returned to signed-in users.
	originH := handlers.NewOriginHandler(db)

	// Authenticated routes
	auth := r.Group("/api")
	auth.Use(middleware.AuthRequired(cfg.JWKSURL))
	{
		auth.GET("/origins", originH.List)

		// Beans
		beanH := handlers.NewBeanHandler(db)
		auth.GET("/beans", beanH.List)
		auth.GET("/beans/:id", beanH.GetByID)
		auth.POST("/beans", beanH.Create)
		auth.PUT("/beans/:id", beanH.Update)
		auth.DELETE("/beans/:id", beanH.Delete)

		// Stats
		statsH := handlers.NewStatsHandler(db)
		auth.GET("/stats", statsH.GetStats)

		// Profile
		profileH := handlers.NewProfileHandler(db)
		auth.GET("/profile", profileH.GetProfile)
		auth.PUT("/profile", profileH.UpdateProfile)
		auth.GET("/export", profileH.ExportData)
		auth.DELETE("/account", profileH.DeleteAccount)
	}

	return r
}
