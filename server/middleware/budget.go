package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Budgets are process-local: run one API replica or enforce an additional shared
// edge budget when scaling out. ClientIP ignores forwarded headers by default.
type RequestBudget struct {
	mu        sync.Mutex
	buckets   map[string]*budgetBucket
	active    map[string]int
	total     int
	now       func() time.Time
	lastSweep time.Time
}

type budgetBucket struct {
	tokens  float64
	updated time.Time
}

func NewRequestBudget() *RequestBudget {
	return &RequestBudget{buckets: make(map[string]*budgetBucket), active: make(map[string]int), now: time.Now}
}

func expensiveRoute(c *gin.Context) bool {
	return c.FullPath() == "/api/stats" || c.FullPath() == "/api/export" || strings.HasPrefix(c.FullPath(), "/api/admin/")
}

func (b *RequestBudget) allow(key string, burst int, perMinute float64) bool {
	now := b.now()
	if now.Sub(b.lastSweep) >= time.Minute {
		for key, bucket := range b.buckets {
			if now.Sub(bucket.updated) > 10*time.Minute {
				delete(b.buckets, key)
			}
		}
		b.lastSweep = now
	}
	bucket := b.buckets[key]
	if bucket == nil {
		// Bound attacker-controlled IP/identity cardinality, without evicting active
		// budgets (which would let callers reset a quota by churning identities).
		if len(b.buckets) >= 10000 {
			return false
		}
		bucket = &budgetBucket{tokens: float64(burst), updated: now}
		b.buckets[key] = bucket
	}
	bucket.tokens = min(float64(burst), bucket.tokens+now.Sub(bucket.updated).Seconds()*perMinute/60)
	bucket.updated = now
	if bucket.tokens < 1 {
		return false
	}
	bucket.tokens--
	return true
}

func rejectBudget(c *gin.Context) {
	c.Header("Retry-After", "10")
	c.Header("Cache-Control", "no-store")
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "request limit exceeded"})
}

func (b *RequestBudget) IP() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "ip:" + c.ClientIP()
		b.mu.Lock()
		allowed := b.allow(key, 120, 600)
		if allowed && expensiveRoute(c) {
			allowed = b.allow(key+":expensive", 20, 120)
		}
		b.mu.Unlock()
		if !allowed {
			rejectBudget(c)
			return
		}
		c.Next()
	}
}

// User runs after JWT validation and before opening a database transaction.
func (b *RequestBudget) User() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "user:" + c.GetString(UserIDKey)
		expensiveKey := key + ":expensive"
		expensive := expensiveRoute(c)
		b.mu.Lock()
		allowed := b.allow(key, 60, 120)
		if allowed && expensive {
			allowed = b.allow(expensiveKey, 2, 6)
		}
		if b.total >= 32 || b.active[key] >= 4 || (expensive && b.active[expensiveKey] >= 1) {
			allowed = false
		}
		if allowed {
			b.total++
			b.active[key]++
			if expensive {
				b.active[expensiveKey]++
			}
		}
		b.mu.Unlock()
		if !allowed {
			rejectBudget(c)
			return
		}
		defer func() {
			b.mu.Lock()
			defer b.mu.Unlock()
			b.total--
			b.active[key]--
			if b.active[key] == 0 {
				delete(b.active, key)
			}
			if expensive {
				b.active[expensiveKey]--
				if b.active[expensiveKey] == 0 {
					delete(b.active, expensiveKey)
				}
			}
		}()
		c.Next()
	}
}
