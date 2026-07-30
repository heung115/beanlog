package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWKSURL     string
	CORSOrigin  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:54322/postgres?sslmode=disable"),
		JWKSURL:     getEnv("JWKS_URL", "http://localhost:54321/auth/v1/.well-known/jwks.json"),
		CORSOrigin:  getEnv("CORS_ORIGIN", "http://localhost:3000"),
	}
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
