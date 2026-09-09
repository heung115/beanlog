package db

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
)

// This integration test creates roles transactionally in an explicitly selected
// disposable database. It never uses the application's DATABASE_URL.
func TestConnectionRoleBoundary(t *testing.T) {
	url := os.Getenv("BEANMAP_ROLE_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set BEANMAP_ROLE_TEST_DATABASE_URL to an empty disposable PostgreSQL 17 database")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
 CREATE ROLE authenticated NOLOGIN;
 CREATE ROLE beanmap_api_runtime NOLOGIN INHERIT;
 CREATE ROLE role_test_connector LOGIN NOINHERIT;
 CREATE ROLE role_test_extra NOLOGIN;
 GRANT authenticated TO beanmap_api_runtime;
 GRANT beanmap_api_runtime TO role_test_connector WITH INHERIT FALSE, SET TRUE;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid);
 CREATE TABLE auth.sessions(id uuid);
 `)
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name, mutation string
		safe           bool
	}{
		{"runtime only", "", true},
		{"legacy authenticated set-only membership", "GRANT authenticated TO role_test_connector WITH INHERIT FALSE, SET TRUE", true},
		{"superuser connector", "ALTER ROLE role_test_connector SUPERUSER", false},
		{"bypass RLS connector", "ALTER ROLE role_test_connector BYPASSRLS", false},
		{"inheriting connector", "ALTER ROLE role_test_connector INHERIT", false},
		{"creator connector", "ALTER ROLE role_test_connector CREATEROLE", false},
		{"database creator connector", "ALTER ROLE role_test_connector CREATEDB", false},
		{"replicating connector", "ALTER ROLE role_test_connector REPLICATION", false},
		{"nonlogin connector", "ALTER ROLE role_test_connector NOLOGIN", false},
		{"missing runtime membership", "REVOKE beanmap_api_runtime FROM role_test_connector", false},
		{"membership administration", "GRANT beanmap_api_runtime TO role_test_connector WITH ADMIN TRUE", false},
		{"inherited runtime membership", "GRANT beanmap_api_runtime TO role_test_connector WITH INHERIT TRUE", false},
		{"cannot set runtime", "GRANT beanmap_api_runtime TO role_test_connector WITH SET FALSE", false},
		{"unexpected membership", "GRANT role_test_extra TO role_test_connector", false},
		{"runtime can login", "ALTER ROLE beanmap_api_runtime LOGIN", false},
		{"runtime bypasses RLS", "ALTER ROLE beanmap_api_runtime BYPASSRLS", false},
		{"runtime superuser", "ALTER ROLE beanmap_api_runtime SUPERUSER", false},
		{"runtime cannot inherit policies", "ALTER ROLE beanmap_api_runtime NOINHERIT", false},
		{"runtime extra membership", "GRANT role_test_extra TO beanmap_api_runtime", false},
		{"runtime can administer authenticated", "GRANT authenticated TO beanmap_api_runtime WITH ADMIN TRUE", false},
		{"authenticated privilege expansion", "GRANT role_test_extra TO authenticated", false},
		{"authenticated bypasses RLS", "ALTER ROLE authenticated BYPASSRLS", false},
		{"connector auth column access", "GRANT SELECT(id) ON auth.users TO role_test_connector", false},
		{"runtime auth user access", "GRANT SELECT ON auth.users TO beanmap_api_runtime", false},
		{"runtime auth session access", "GRANT DELETE ON auth.sessions TO beanmap_api_runtime", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := tx.Exec(ctx, "SAVEPOINT role_case"); err != nil {
				t.Fatal(err)
			}
			defer func() {
				if _, err := tx.Exec(ctx, "ROLLBACK TO SAVEPOINT role_case"); err != nil {
					t.Fatal(err)
				}
			}()
			if tt.mutation != "" {
				if _, err := tx.Exec(ctx, tt.mutation); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := tx.Exec(ctx, "SET LOCAL ROLE role_test_connector"); err != nil {
				t.Fatal(err)
			}
			err := VerifyConnectionRole(ctx, tx)
			if _, resetErr := tx.Exec(ctx, "RESET ROLE"); resetErr != nil {
				t.Fatal(resetErr)
			}
			if tt.safe && err != nil {
				t.Fatalf("safe connection rejected: %v", err)
			}
			if !tt.safe && !errors.Is(err, ErrUnsafeRole) {
				t.Fatalf("unsafe connection returned %v", err)
			}
		})
	}
}
