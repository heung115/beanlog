// Command grpcserver runs the gRPC face of the beanmap API. It is a separate
// binary from the REST (Gin) server so each transport can be deployed and
// scaled independently. Both share the same Supabase database and the same
// JWT verification rules via middleware.TokenVerifier.
package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"beanmap-server/config"
	beanmapv1 "beanmap-server/gen/beanmap/v1"
	"beanmap-server/grpcserver"
	"beanmap-server/middleware"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc"
)

func main() {
	address, serverOptions, err := secureTransport(os.Getenv)
	if err != nil {
		log.Fatal(err)
	}
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("database credential is unavailable")
	}

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal("failed to configure database connection")
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatal("failed to connect to database")
	}

	// The connection role must be non-privileged so that per-request
	// SET LOCAL ROLE authenticated + RLS stays the real authorization boundary.
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
		log.Fatal("unsafe database role: gRPC API requires a non-privileged authenticated member")
	}
	log.Println("connected to database")

	verifier := middleware.NewTokenVerifier(cfg.JWKSURL, cfg.JWTIssuer)

	serverOptions = append(serverOptions,
		grpc.UnaryInterceptor(grpcserver.AuthUnaryInterceptor(verifier)),
	)
	server := grpc.NewServer(serverOptions...)
	beanmapv1.RegisterStatsServiceServer(server, grpcserver.NewStatsServer(pool))
	// Reflection is intentionally unavailable on this authenticated transport.
	lis, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", address, err)
	}

	// Graceful shutdown: stop accepting new RPCs and let in-flight ones finish.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		log.Println("shutting down gRPC server")
		server.GracefulStop()
	}()

	log.Printf("beanmap gRPC server starting on %s", address)
	if err := server.Serve(lis); err != nil {
		log.Fatalf("gRPC server failed: %v", err)
	}
}
