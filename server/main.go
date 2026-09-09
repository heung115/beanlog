package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"beanmap-server/config"
	"beanmap-server/db"
	"beanmap-server/routes"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("database credential is unavailable")
	}

	// Connect to PostgreSQL (Supabase)
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal("failed to configure database connection")
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatal("failed to connect to database")
	}
	if err := db.VerifyConnectionRole(context.Background(), pool); err != nil {
		log.Fatal("unsafe database role: API requires a non-privileged private runtime role")
	}

	log.Println("connected to database")

	r := routes.Setup(cfg, pool)

	log.Printf("beanmap API server starting on %s", cfg.Addr())
	server := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server failed: %v", err)
	}
}
