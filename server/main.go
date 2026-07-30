package main

import (
	"context"
	"log"

	"beanlog-server/config"
	"beanlog-server/routes"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()

	// Connect to PostgreSQL (Supabase)
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}
	log.Println("connected to database")

	r := routes.Setup(cfg, pool)

	log.Printf("Beanlog API server starting on %s", cfg.Addr())
	if err := r.Run(cfg.Addr()); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
