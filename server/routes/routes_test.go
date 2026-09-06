package routes

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestAdminRoutesRequirePrivateIngressBeforeAuthentication(t *testing.T) {
	secret := strings.Repeat("a", 32)
	cfg := &config.Config{
		JWKSURL:            "http://127.0.0.1:1/unused",
		JWTIssuer:          "http://localhost/auth/v1",
		CORSOrigin:         "http://localhost:3100",
		AdminIngressSecret: secret,
	}
	router := Setup(cfg, nil)
	for _, route := range []struct{ method, path string }{
		{http.MethodGet, "/api/admin/access"},
		{http.MethodGet, "/api/admin/overview"},
		{http.MethodGet, "/api/admin/catalog"},
		{http.MethodPut, "/api/admin/catalog/country/1"},
		{http.MethodGet, "/api/admin/audit"},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			for _, supplied := range []string{"", "forged-ingress-secret", secret} {
				request := httptest.NewRequest(route.method, route.path, nil)
				if supplied != "" {
					request.Header.Set("X-Beanmap-Admin-Secret", supplied)
				}
				request.Header.Set("X-Forwarded-For", "127.0.0.1")
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				want := http.StatusNotFound
				if supplied == secret {
					// Correct ingress proof still requires the separate user JWT.
					want = http.StatusUnauthorized
				}
				if response.Code != want || response.Header().Get("Cache-Control") != "no-store" {
					t.Fatalf("status = %d, want %d; cache = %q", response.Code, want, response.Header().Get("Cache-Control"))
				}
			}
		})
	}
}
