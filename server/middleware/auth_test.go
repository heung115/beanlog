package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testKeyID = "qa-es256-key"

func encodedCoordinate(value *big.Int) string {
	bytes := value.Bytes()
	padded := make([]byte, 32)
	copy(padded[32-len(bytes):], bytes)
	return base64.RawURLEncoding.EncodeToString(padded)
}

func testJWKS(t *testing.T, publicKey *ecdsa.PublicKey) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(response).Encode(jwksResponse{Keys: []jwksKey{{
			Kty: "EC",
			Kid: testKeyID,
			Alg: jwt.SigningMethodES256.Alg(),
			Crv: "P-256",
			X:   encodedCoordinate(publicKey.X),
			Y:   encodedCoordinate(publicKey.Y),
		}}}); err != nil {
			t.Fatalf("encode JWKS: %v", err)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func signedToken(t *testing.T, privateKey *ecdsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = testKeyID
	signed, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestAuthRequiredValidatesTokenBoundary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	issuer := "https://auth.beanlog.test/auth/v1"
	jwks := testJWKS(t, &privateKey.PublicKey)

	now := time.Now()
	validClaims := func() jwt.MapClaims {
		return jwt.MapClaims{
			"sub":  "00000000-0000-0000-0000-000000000001",
			"iss":  issuer,
			"aud":  "authenticated",
			"role": "authenticated",
			"iat":  now.Unix(),
			"exp":  now.Add(time.Hour).Unix(),
		}
	}

	tests := []struct {
		name       string
		mutate     func(jwt.MapClaims)
		wantStatus int
	}{
		{name: "valid", mutate: func(jwt.MapClaims) {}, wantStatus: http.StatusNoContent},
		{name: "wrong issuer", mutate: func(c jwt.MapClaims) { c["iss"] = "https://evil.test" }, wantStatus: http.StatusUnauthorized},
		{name: "wrong audience", mutate: func(c jwt.MapClaims) { c["aud"] = "anon" }, wantStatus: http.StatusUnauthorized},
		{name: "wrong role", mutate: func(c jwt.MapClaims) { c["role"] = "service_role" }, wantStatus: http.StatusUnauthorized},
		{name: "expired", mutate: func(c jwt.MapClaims) { c["exp"] = now.Add(-time.Minute).Unix() }, wantStatus: http.StatusUnauthorized},
		{name: "missing expiration", mutate: func(c jwt.MapClaims) { delete(c, "exp") }, wantStatus: http.StatusUnauthorized},
		{name: "missing subject", mutate: func(c jwt.MapClaims) { delete(c, "sub") }, wantStatus: http.StatusUnauthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			claims := validClaims()
			test.mutate(claims)

			router := gin.New()
			router.Use(AuthRequired(jwks.URL, issuer))
			router.GET("/protected", func(context *gin.Context) {
				context.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodGet, "/protected", nil)
			request.Header.Set("Authorization", "Bearer "+signedToken(t, privateKey, claims))
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", response.Code, test.wantStatus, response.Body.String())
			}
		})
	}
}

func TestAuthRequiredRejectsUnsignedToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	jwks := testJWKS(t, &privateKey.PublicKey)
	router := gin.New()
	router.Use(AuthRequired(jwks.URL, "https://auth.beanlog.test/auth/v1"))
	router.GET("/protected", func(context *gin.Context) { context.Status(http.StatusNoContent) })

	unsignedHeader := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	unsignedPayload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"attacker"}`))
	unsignedToken := unsignedHeader + "." + unsignedPayload + "."
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer "+unsignedToken)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", response.Code)
	}
}

func TestKeyProviderDoesNotRefetchFreshJWKSForUnknownKey(t *testing.T) {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	var fetches atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		fetches.Add(1)
		response.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(response).Encode(jwksResponse{Keys: []jwksKey{{
			Kty: "EC",
			Kid: testKeyID,
			Alg: jwt.SigningMethodES256.Alg(),
			Crv: "P-256",
			X:   encodedCoordinate(privateKey.PublicKey.X),
			Y:   encodedCoordinate(privateKey.PublicKey.Y),
		}}}); err != nil {
			t.Errorf("encode JWKS: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	provider := newKeyProvider(server.URL)
	if _, err := provider.getKey(testKeyID); err != nil {
		t.Fatalf("initial key lookup: %v", err)
	}
	for range 3 {
		if _, err := provider.getKey("attacker-controlled-kid"); err == nil {
			t.Fatal("unknown key lookup unexpectedly succeeded")
		}
	}
	if got := fetches.Load(); got != 1 {
		t.Fatalf("JWKS fetches = %d, want 1", got)
	}
}
