package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetEnvOrFilePrefersEnvironmentValue(t *testing.T) {
	t.Setenv("TEST_DATABASE_URL", "postgres://from-environment")
	t.Setenv("TEST_DATABASE_URL_FILE", filepath.Join(t.TempDir(), "missing"))

	got := getEnvOrFile("TEST_DATABASE_URL", "TEST_DATABASE_URL_FILE", "postgres://fallback")
	if got != "postgres://from-environment" {
		t.Fatalf("getEnvOrFile() = %q, want environment value", got)
	}
}

func TestGetEnvOrFileReadsAndTrimsSecretFile(t *testing.T) {
	t.Setenv("TEST_DATABASE_URL", "")
	secretPath := filepath.Join(t.TempDir(), "database-url.secret")
	if err := os.WriteFile(secretPath, []byte("postgres://from-secret-file\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TEST_DATABASE_URL_FILE", secretPath)

	got := getEnvOrFile("TEST_DATABASE_URL", "TEST_DATABASE_URL_FILE", "postgres://fallback")
	if got != "postgres://from-secret-file" {
		t.Fatalf("getEnvOrFile() = %q, want trimmed secret file value", got)
	}
}

func TestGetEnvOrFileFailsClosedWhenConfiguredFileCannotBeRead(t *testing.T) {
	t.Setenv("TEST_DATABASE_URL", "")
	t.Setenv("TEST_DATABASE_URL_FILE", filepath.Join(t.TempDir(), "missing"))

	if got := getEnvOrFile("TEST_DATABASE_URL", "TEST_DATABASE_URL_FILE", "postgres://fallback"); got != "" {
		t.Fatalf("getEnvOrFile() = %q, want empty value for unreadable configured file", got)
	}
}

func TestGetEnvOrFileUsesFallbackWithoutConfiguredValueOrFile(t *testing.T) {
	t.Setenv("TEST_DATABASE_URL", "")
	t.Setenv("TEST_DATABASE_URL_FILE", "")

	if got := getEnvOrFile("TEST_DATABASE_URL", "TEST_DATABASE_URL_FILE", "postgres://fallback"); got != "postgres://fallback" {
		t.Fatalf("getEnvOrFile() = %q, want fallback", got)
	}
}
