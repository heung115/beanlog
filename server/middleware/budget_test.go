package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func budgetRouter(b *RequestBudget, handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(b.IP(), func(c *gin.Context) { c.Set(UserIDKey, c.GetHeader("Test-User")) }, b.User())
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
	if b.total != 0 || len(b.active) != 0 {
		t.Fatal("concurrency slots leaked")
	}
}
func TestIPBudgetIgnoresForgedForwardedHeaders(t *testing.T) {
	b := NewRequestBudget()
	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(b.IP())
	r.GET("/api/beans", func(c *gin.Context) { c.Status(204) })
	for i := 0; i < 120; i++ {
		if budgetRequest(r, "/api/beans", "").Code != 204 {
			t.Fatal("unexpected rejection")
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/api/beans", nil)
	req.Header.Set("X-Forwarded-For", "198.51.100.1")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != 429 {
		t.Fatal("forwarded header bypassed IP quota")
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
