package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const UserIDKey = "user_id"

type jwksKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksResponse struct {
	Keys []jwksKey `json:"keys"`
}

type keyProvider struct {
	mu         sync.RWMutex
	keys       map[string]*ecdsa.PublicKey
	jwksURL    string
	lastFetch  time.Time
	cacheTTL   time.Duration
}

func newKeyProvider(jwksURL string) *keyProvider {
	return &keyProvider{
		keys:     make(map[string]*ecdsa.PublicKey),
		jwksURL:  jwksURL,
		cacheTTL: 5 * time.Minute,
	}
}

func (kp *keyProvider) getKey(kid string) (*ecdsa.PublicKey, error) {
	kp.mu.RLock()
	if key, ok := kp.keys[kid]; ok && time.Since(kp.lastFetch) < kp.cacheTTL {
		kp.mu.RUnlock()
		return key, nil
	}
	kp.mu.RUnlock()

	// Fetch JWKS
	if err := kp.refresh(); err != nil {
		return nil, err
	}

	kp.mu.RLock()
	defer kp.mu.RUnlock()
	if key, ok := kp.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("key %s not found in JWKS", kid)
}

func (kp *keyProvider) refresh() error {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(kp.jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("failed to decode JWKS: %w", err)
	}

	keys := make(map[string]*ecdsa.PublicKey)
	for _, k := range jwks.Keys {
		if k.Kty != "EC" || k.Crv != "P-256" {
			continue
		}
		xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil {
			continue
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
		if err != nil {
			continue
		}
		pub := &ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}
		keys[k.Kid] = pub
	}

	kp.mu.Lock()
	kp.keys = keys
	kp.lastFetch = time.Now()
	kp.mu.Unlock()

	return nil
}

func AuthRequired(jwksURL string) gin.HandlerFunc {
	kp := newKeyProvider(jwksURL)

	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		if tokenStr == header {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			// Verify signing method is ES256
			if _, ok := t.Method.(*jwt.SigningMethodECDSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			kid, _ := t.Header["kid"].(string)
			if kid == "" {
				return nil, fmt.Errorf("missing kid in token header")
			}
			return kp.getKey(kid)
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}

		sub, _ := claims["sub"].(string)
		if sub == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing subject"})
			return
		}

		c.Set(UserIDKey, sub)
		c.Next()
	}
}
