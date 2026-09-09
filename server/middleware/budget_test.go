package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func budgetRouter(b *RequestBudget, handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(func(c *gin.Context) { c.Set(UserIDKey, c.GetHeader("Test-User")) }, b.User())
	r.GET("/api/stats", handler)
	r.GET("/api/beans", handler)
	return r
}
func budgetRequest(r *gin.Engine, path, user string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("Test-User", user)
	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, request)
	return recorder
}
func TestUserRouteBudgetsAndRefill(t *testing.T) {
	b := NewRequestBudget()
	now := time.Now()
	b.now = func() time.Time { return now }
	r := budgetRouter(b, func(c *gin.Context) { c.Status(204) })
	for i := 0; i < 2; i++ {
		if res := budgetRequest(r, "/api/stats", "a"); res.Code != 204 {
			t.Fatal(res.Code)
		}
	}
	res := budgetRequest(r, "/api/stats", "a")
	if res.Code != 429 || res.Header().Get("Retry-After") == "" {
		t.Fatalf("missing rejection: %v", res)
	}
	if budgetRequest(r, "/api/beans", "a").Code != 204 || budgetRequest(r, "/api/stats", "b").Code != 204 {
		t.Fatal("budget incorrectly shared")
	}
	now = now.Add(10 * time.Second)
	if budgetRequest(r, "/api/stats", "a").Code != 204 {
		t.Fatal("quota did not refill")
	}
}
func TestConcurrentExpensiveRequestsAreRejectedAndReleased(t *testing.T) {
	b := NewRequestBudget()
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	r := budgetRouter(b, func(c *gin.Context) { once.Do(func() { close(started) }); <-release; c.Status(204) })
	done := make(chan *httptest.ResponseRecorder, 1)
	go func() { done <- budgetRequest(r, "/api/stats", "a") }()
	<-started
	if budgetRequest(r, "/api/stats", "a").Code != 429 {
		t.Fatal("concurrent expensive request allowed")
	}
	close(release)
	if (<-done).Code != 204 {
		t.Fatal("first request failed")
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.globalInFlight != 0 || len(b.active) != 0 {
		t.Fatal("concurrency slots leaked")
	}
}
func TestBudgetStorageIsBoundedAndExpires(t *testing.T) {
	b := NewRequestBudget()
	now := time.Now()
	b.now = func() time.Time { return now }
	for i := 0; i < 10000; i++ {
		b.buckets[time.Unix(int64(i), 0).String()] = &budgetBucket{updated: now}
	}
	if b.allow("new", 1, 1) {
		t.Fatal("bucket bound exceeded")
	}
	now = now.Add(11 * time.Minute)
	if !b.allow("new", 1, 1) || len(b.buckets) != 1 {
		t.Fatal("expired entries not reclaimed")
	}
}

func TestSharedProxySubjectsHaveIndependentBudgets(t *testing.T) {
	b := NewRequestBudget()
	now := time.Now()
	b.now = func() time.Time { return now }
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks := testJWKS(t, &key.PublicKey)
	const issuer = "https://auth.beanmap.test/auth/v1"
	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(AuthRequired(jwks.URL, issuer), b.User())
	r.GET("/api/beans", func(c *gin.Context) { c.Status(204) })
	tokens := make([]string, 3)
	for i := range tokens {
		tokens[i] = signedToken(t, key, jwt.MapClaims{
			"sub":        fmt.Sprintf("00000000-0000-0000-0000-%012d", i+1),
			"session_id": fmt.Sprintf("10000000-0000-0000-0000-%012d", i+1),
			"iss":        issuer, "aud": "authenticated", "role": "authenticated", "exp": now.Add(time.Hour).Unix(),
		})
	}
	request := func(token string, sequence int) int {
		req := httptest.NewRequest(http.MethodGet, "/api/beans", nil)
		req.RemoteAddr = "172.30.0.2:48000" // Every request uses the same web proxy connection.
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("198.51.100.%d", sequence%200+1))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec.Code
	}
	// Authentication failures cannot allocate or deplete any subject budget.
	for i := 0; i < 180; i++ {
		if got := request("invalid.jwt.signature", i); got != 401 {
			t.Fatalf("invalid JWT status=%d", got)
		}
	}
	if len(b.buckets) != 0 || b.globalInFlight != 0 || len(b.active) != 0 {
		t.Fatal("invalid JWT consumed capacity or quota")
	}
	accepted, rejected := 0, 0
	for i := 0; i < 180; i++ {
		switch request(tokens[i%2], i) {
		case 204:
			accepted++
		case 429:
			rejected++
		default:
			t.Fatal("unexpected response")
		}
	}
	if accepted != 120 || rejected != 60 {
		t.Fatalf("subject budgets: accepted=%d rejected=%d", accepted, rejected)
	}
	if request(tokens[2], 181) != 204 {
		t.Fatal("two subjects depleted another subject through shared proxy")
	}
	if b.globalInFlight != 0 || len(b.active) != 0 {
		t.Fatal("capacity leaked after sequential requests")
	}
}

func TestGlobalCapacityIsBoundedAndReleased(t *testing.T) {
	b := NewRequestBudget()
	started, release := make(chan struct{}, maxGlobalInFlight), make(chan struct{})
	r := budgetRouter(b, func(c *gin.Context) { started <- struct{}{}; <-release; c.Status(204) })
	done := make(chan int, maxGlobalInFlight)
	for i := 0; i < maxGlobalInFlight; i++ {
		go func(i int) { done <- budgetRequest(r, "/api/beans", fmt.Sprintf("user-%d", i/4)).Code }(i)
	}
	for i := 0; i < maxGlobalInFlight; i++ {
		<-started
	}
	rec := budgetRequest(r, "/api/beans", "another-user")
	if rec.Code != 429 || rec.Header().Get("Retry-After") != "1" {
		t.Fatal("global capacity guard missing")
	}
	close(release)
	for i := 0; i < maxGlobalInFlight; i++ {
		if <-done != 204 {
			t.Fatal("accepted request failed")
		}
	}
	if b.globalInFlight != 0 || len(b.active) != 0 {
		t.Fatal("global capacity not released")
	}
	if budgetRequest(r, "/api/beans", "another-user").Code != 204 {
		t.Fatal("capacity rejection depleted subject quota")
	}
}
