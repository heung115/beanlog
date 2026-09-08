package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWKSURL            string
	JWTIssuer          string
	AuthURL            string
	AuthRateIDSecret   string
	CORSOrigin         string
	AdminIngressSecret string
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnvOrFile("DATABASE_URL", "DATABASE_URL_FILE", "postgres://authenticator:postgres@localhost:55322/postgres?sslmode=disable"),
		JWKSURL:            getEnv("JWKS_URL", "http://localhost:55321/auth/v1/.well-known/jwks.json"),
		JWTIssuer:          getEnv("JWT_ISSUER", "http://127.0.0.1:55321/auth/v1"),
		AuthURL:            getEnv("AUTH_URL", "http://127.0.0.1:55321/auth/v1"),
		AuthRateIDSecret:   getSecretFile("AUTH_RATE_ID_SECRET_FILE"),
		CORSOrigin:         getEnv("CORS_ORIGIN", "http://localhost:3100"),
		AdminIngressSecret: getSecretFile("ADMIN_INGRESS_SECRET_FILE"),
	}
}

func getEnvOrFile(valueKey, fileKey, fallback string) string {
	if value := os.Getenv(valueKey); value != "" {
		return value
	}
	if os.Getenv(fileKey) != "" {
		return getSecretFile(fileKey)
	}
	return fallback
}

func getSecretFile(fileKey string) string {
	filePath := os.Getenv(fileKey)
	if filePath == "" {
		return ""
	}
	// filePath is trusted process configuration supplied by the deployer,
	// never request data.
	// #nosec G304 G703 -- reading an operator-configured Docker secret path
	value, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(value))
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (c *Config) Addr() string {
	return fmt.Sprintf(":%s", c.Port)
}
