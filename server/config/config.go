package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWKSURL     string
	JWTIssuer   string
	CORSOrigin  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnvOrFile("DATABASE_URL", "DATABASE_URL_FILE", "postgres://authenticator:postgres@localhost:54322/postgres?sslmode=disable"),
		JWKSURL:     getEnv("JWKS_URL", "http://localhost:54321/auth/v1/.well-known/jwks.json"),
		JWTIssuer:   getEnv("JWT_ISSUER", "http://127.0.0.1:54321/auth/v1"),
		CORSOrigin:  getEnv("CORS_ORIGIN", "http://localhost:3000"),
	}
}

func getEnvOrFile(valueKey, fileKey, fallback string) string {
	if value := os.Getenv(valueKey); value != "" {
		return value
	}
	if filePath := os.Getenv(fileKey); filePath != "" {
		// filePath is trusted process configuration supplied by the deployer,
		// never request data. An operator who can change it can also set the
		// value environment variable directly.
		// #nosec G304 G703 -- reading an operator-configured Docker secret path
		value, err := os.ReadFile(filePath)
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(value))
	}
	return fallback
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
