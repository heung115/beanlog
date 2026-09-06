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

func TestLoadAdminIngressSecretRequiresReadableConfiguredFile(t *testing.T) {
	for _, test := range []struct {
		name    string
		content string
		file    bool
		missing bool
		want    string
	}{
		{name: "disabled without file"},
		{name: "disabled when file missing", missing: true},
		{name: "disabled for empty file", file: true},
		{name: "read trimmed secret file", file: true, content: "test-admin-ingress-secret-32-bytes\n", want: "test-admin-ingress-secret-32-bytes"},
	} {
		t.Run(test.name, func(t *testing.T) {
			// A direct environment value must not bypass the mounted-file policy.
			t.Setenv("ADMIN_INGRESS_SECRET", "ignored-test-environment-secret")
			t.Setenv("ADMIN_INGRESS_SECRET_FILE", "")
			if test.file || test.missing {
				path := filepath.Join(t.TempDir(), "admin-ingress.secret")
				if test.file {
					if err := os.WriteFile(path, []byte(test.content), 0o600); err != nil {
						t.Fatal(err)
					}
				}
				t.Setenv("ADMIN_INGRESS_SECRET_FILE", path)
			}
			if got := Load().AdminIngressSecret; got != test.want {
				t.Fatal("admin ingress secret did not follow the file-only fail-closed policy")
			}
		})
	}
}
