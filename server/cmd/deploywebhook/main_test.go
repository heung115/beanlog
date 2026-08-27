package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestValidWebhookWritesDeploymentTrigger(t *testing.T) {
	t.Parallel()

	secret := []byte("0123456789abcdef0123456789abcdef")
	body := []byte(`{"repository":"heung115/beanlog","sha":"e449ae80e308cfd0b6a65a053a6aef8a63ff18c3","run_id":33033294037}`)
	triggerPath := filepath.Join(t.TempDir(), "request")
	triggerQueue := make(chan struct{}, 1)
	handler := webhookHandler{secret: secret, triggerPath: triggerPath, triggerQueue: triggerQueue}

	request := httptest.NewRequest(http.MethodPost, "/", bytesReader(body))
	request.Header.Set("X-Hub-Signature-256", signatureForTest(secret, body))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusAccepted)
	}
	written, err := os.ReadFile(triggerPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(written) != "e449ae80e308cfd0b6a65a053a6aef8a63ff18c3 33033294037\n" {
		t.Fatalf("trigger = %q", written)
	}
	temporaryFiles, err := filepath.Glob(filepath.Join(filepath.Dir(triggerPath), ".request-*"))
	if err != nil {
		t.Fatal(err)
	}
	if len(temporaryFiles) != 0 {
		t.Fatalf("temporary trigger files remain: %v", temporaryFiles)
	}
	select {
	case <-triggerQueue:
	default:
		t.Fatal("deployment trigger was not queued")
	}
}

func TestWebhookRejectsInvalidSignature(t *testing.T) {
	t.Parallel()

	body := []byte(`{"repository":"heung115/beanlog","sha":"e449ae80e308cfd0b6a65a053a6aef8a63ff18c3","run_id":33033294037}`)
	handler := webhookHandler{
		secret:      []byte("0123456789abcdef0123456789abcdef"),
		triggerPath: filepath.Join(t.TempDir(), "request"),
	}
	request := httptest.NewRequest(http.MethodPost, "/", bytesReader(body))
	request.Header.Set("X-Hub-Signature-256", "sha256=00")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}

func bytesReader(value []byte) *bytes.Reader {
	return bytes.NewReader(value)
}

func signatureForTest(secret, body []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(body)
	return fmt.Sprintf("sha256=%x", mac.Sum(nil))
}
