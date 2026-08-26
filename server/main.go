package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"beanmap-server/config"
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
	var isSuperuser, bypassRLS, hasExactMembership bool
	if err := pool.QueryRow(context.Background(),
		`SELECT rolsuper,
		        rolbypassrls,
		        (
		          SELECT count(*) = 1
		             AND bool_and(granted_role.rolname = 'authenticated')
		             AND bool_and(NOT membership.admin_option)
		          FROM pg_auth_members membership
		          JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
		          WHERE membership.member = (SELECT oid FROM pg_roles WHERE rolname = current_user)
		        )
		 FROM pg_roles WHERE rolname = current_user`,
	).Scan(&isSuperuser, &bypassRLS, &hasExactMembership); err != nil {
		log.Fatal("failed to verify database role")
	}
	if isSuperuser || bypassRLS || !hasExactMembership {
		log.Fatal("unsafe database role: API requires a non-privileged authenticated member")
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
