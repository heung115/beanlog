package grpcserver

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"beanmap-server/middleware"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const testKeyID = "qa-es256-key"

func encodedCoordinate(value *big.Int) string {
	bytes := value.Bytes()
	padded := make([]byte, 32)
	copy(padded[32-len(bytes):], bytes)
	return base64.RawURLEncoding.EncodeToString(padded)
}

type testJWKS struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

func startJWKS(t *testing.T, publicKey *ecdsa.PublicKey) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []testJWKS{{
			Kty: "EC", Kid: testKeyID, Alg: jwt.SigningMethodES256.Alg(), Crv: "P-256",
			X: encodedCoordinate(publicKey.X), Y: encodedCoordinate(publicKey.Y),
		}}})
	}))
	t.Cleanup(server.Close)
	return server
}

func signToken(t *testing.T, privateKey *ecdsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = testKeyID
	signed, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func validClaims(issuer string) jwt.MapClaims {
	now := time.Now()
	return jwt.MapClaims{
		"sub":  "00000000-0000-0000-0000-000000000001",
		"iss":  issuer,
		"aud":  "authenticated",
		"role": "authenticated",
		"iat":  now.Unix(),
		"exp":  now.Add(time.Hour).Unix(),
	}
}

// passthroughHandler captures the context it receives and returns a sentinel.
func passthroughHandler(captured *context.Context) grpc.UnaryHandler {
	return func(ctx context.Context, _ any) (any, error) {
		*captured = ctx
		return "ok", nil
	}
}

func TestAuthInterceptorRejectsMissingOrMalformedMetadata(t *testing.T) {
	privateKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	jwks := startJWKS(t, &privateKey.PublicKey)
	interceptor := AuthUnaryInterceptor(middleware.NewTokenVerifier(jwks.URL, "https://auth.beanmap.test/auth/v1"))
	info := &grpc.UnaryServerInfo{FullMethod: "/beanmap.v1.StatsService/GetStats"}

	cases := []struct {
		name string
		ctx  context.Context
	}{
		{name: "no metadata", ctx: context.Background()},
		{name: "empty authorization", ctx: metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", ""))},
		{name: "missing bearer prefix", ctx: metadata.NewIncomingContext(context.Background(), metadata.Pairs("authorization", "token-only"))},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := interceptor(tc.ctx, nil, info, func(context.Context, any) (any, error) { return nil, nil })
			if status.Code(err) != codes.Unauthenticated {
				t.Fatalf("code = %v, want Unauthenticated", status.Code(err))
			}
		})
	}
}

func TestAuthInterceptorValidatesTokenBoundary(t *testing.T) {
	privateKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	issuer := "https://auth.beanmap.test/auth/v1"
	jwks := startJWKS(t, &privateKey.PublicKey)
	interceptor := AuthUnaryInterceptor(middleware.NewTokenVerifier(jwks.URL, issuer))
	info := &grpc.UnaryServerInfo{FullMethod: "/beanmap.v1.StatsService/GetStats"}

	tests := []struct {
		name     string
		mutate   func(jwt.MapClaims)
		wantCode codes.Code
	}{
		{name: "valid", mutate: func(jwt.MapClaims) {}, wantCode: codes.OK},
		{name: "wrong issuer", mutate: func(c jwt.MapClaims) { c["iss"] = "https://evil.test" }, wantCode: codes.Unauthenticated},
		{name: "wrong audience", mutate: func(c jwt.MapClaims) { c["aud"] = "anon" }, wantCode: codes.Unauthenticated},
		{name: "wrong role", mutate: func(c jwt.MapClaims) { c["role"] = "service_role" }, wantCode: codes.Unauthenticated},
		{name: "expired", mutate: func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Minute).Unix() }, wantCode: codes.Unauthenticated},
		{name: "missing subject", mutate: func(c jwt.MapClaims) { delete(c, "sub") }, wantCode: codes.Unauthenticated},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			claims := validClaims(issuer)
			tc.mutate(claims)
			ctx := metadata.NewIncomingContext(context.Background(),
				metadata.Pairs("authorization", "Bearer "+signToken(t, privateKey, claims)))

			var handlerCtx context.Context
			resp, err := interceptor(ctx, nil, info, passthroughHandler(&handlerCtx))
			if status.Code(err) != tc.wantCode {
				t.Fatalf("code = %v, want %v", status.Code(err), tc.wantCode)
			}
			if tc.wantCode == codes.OK {
				if resp != "ok" {
					t.Fatalf("resp = %v, want ok", resp)
				}
				userID, ok := UserIDFromContext(handlerCtx)
				if !ok || userID != "00000000-0000-0000-0000-000000000001" {
					t.Fatalf("userID = %q ok=%v, want injected subject", userID, ok)
				}
			}
		})
	}
}
