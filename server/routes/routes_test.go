package routes

import (
	"testing"

	"beanmap-server/config"
)

// TestSetupRegistersRoutesWithoutConflict guards against Gin panicking on
// overlapping static/param routes (e.g. /beans/filter-options vs /beans/:id).
// Route registration happens before any DB use, so a nil pool is safe here.
func TestSetupRegistersRoutesWithoutConflict(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("routes.Setup panicked: %v", r)
		}
	}()

	cfg := &config.Config{
		Port:        "8080",
		JWKSURL:     "http://localhost/auth/v1/.well-known/jwks.json",
		JWTIssuer:   "http://localhost/auth/v1",
		CORSOrigin:  "http://localhost:3100",
		DatabaseURL: "postgres://unused",
	}
	r := Setup(cfg, nil)
	if r == nil {
		t.Fatal("Setup returned nil engine")
	}
}
