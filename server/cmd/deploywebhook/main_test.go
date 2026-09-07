package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestValidWebhookWritesDeploymentTrigger(t *testing.T) {
	t.Parallel()

	secret := []byte("0123456789abcdef0123456789abcdef")
	body := testPayload(t, time.Now().Unix(), "33033294037-1")
	triggerPath := filepath.Join(t.TempDir(), "request")
	triggerQueue := make(chan struct{}, 1)
	handler := webhookHandler{secret: secret, triggerPath: triggerPath, triggerQueue: triggerQueue, ledgerPath: t.TempDir()}

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

	body := testPayload(t, time.Now().Unix(), "33033294037-1")
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

func testPayload(t *testing.T, timestamp int64, deliveryID string) []byte {
	t.Helper()
	body, err := json.Marshal(triggerPayload{Repository: "heung115/beanlog", SHA: "e449ae80e308cfd0b6a65a053a6aef8a63ff18c3", RunID: 33033294037, Timestamp: timestamp, DeliveryID: deliveryID})
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func sendWebhook(handler *webhookHandler, body []byte) int {
	request := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	request.Header.Set("X-Hub-Signature-256", signatureForTest(handler.secret, body))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response.Code
}

func TestWebhookRejectsExpiredFutureAndLegacyDeliveries(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	for _, timestamp := range []int64{0, now.Add(-maxDeliveryAge - time.Second).Unix(), now.Add(maxFutureSkew + time.Second).Unix()} {
		handler := webhookHandler{secret: []byte("test-secret"), triggerPath: filepath.Join(t.TempDir(), "request"), ledgerPath: t.TempDir(), now: func() time.Time { return now }}
		if got := sendWebhook(&handler, testPayload(t, timestamp, "33033294037-1")); got != http.StatusUnauthorized {
			t.Fatalf("timestamp %d: status %d", timestamp, got)
		}
		if _, err := os.Stat(handler.triggerPath); !os.IsNotExist(err) {
			t.Fatal("rejected delivery wrote a trigger")
		}
	}
}

func TestWebhookConsumesDeliveryAcrossRestart(t *testing.T) {
	ledger := t.TempDir()
	handler := webhookHandler{secret: []byte("test-secret"), triggerPath: filepath.Join(t.TempDir(), "request"), ledgerPath: ledger}
	body := testPayload(t, time.Now().Unix(), "33033294037-1")
	if got := sendWebhook(&handler, body); got != http.StatusAccepted {
		t.Fatal(got)
	}
	restarted := webhookHandler{secret: handler.secret, triggerPath: filepath.Join(t.TempDir(), "request"), ledgerPath: ledger}
	if got := sendWebhook(&restarted, body); got != http.StatusConflict {
		t.Fatal(got)
	}
	if _, err := os.Stat(restarted.triggerPath); !os.IsNotExist(err) {
		t.Fatal("replay wrote a trigger")
	}
	info, err := os.Stat(filepath.Join(ledger, "33033294037-1"))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("ledger mode: %v, %v", info, err)
	}
}

func TestConcurrentDuplicateDeliveryTriggersOnlyOnce(t *testing.T) {
	handler := webhookHandler{secret: []byte("test-secret"), triggerPath: filepath.Join(t.TempDir(), "request"), ledgerPath: t.TempDir()}
	body := testPayload(t, time.Now().Unix(), "33033294037-1")
	results := make(chan int, 20)
	var workers sync.WaitGroup
	for i := 0; i < 20; i++ {
		workers.Add(1)
		go func() { defer workers.Done(); results <- sendWebhook(&handler, body) }()
	}
	workers.Wait()
	close(results)
	accepted := 0
	for result := range results {
		if result == http.StatusAccepted {
			accepted++
		} else if result != http.StatusConflict {
			t.Fatalf("unexpected status %d", result)
		}
	}
	if accepted != 1 {
		t.Fatalf("accepted %d duplicates", accepted)
	}
}

func TestWebhookFailsClosedWithoutDurableLedger(t *testing.T) {
	handler := webhookHandler{secret: []byte("test-secret"), triggerPath: filepath.Join(t.TempDir(), "request"), ledgerPath: filepath.Join(t.TempDir(), "missing")}
	if got := sendWebhook(&handler, testPayload(t, time.Now().Unix(), "33033294037-1")); got != http.StatusServiceUnavailable {
		t.Fatal(got)
	}
	if _, err := os.Stat(handler.triggerPath); !os.IsNotExist(err) {
		t.Fatal("ledger failure wrote a trigger")
	}
}

func TestDeliveryIDCannotEscapeLedgerOrImpersonateAnotherRun(t *testing.T) {
	for _, id := range []string{"", "../../request", "1-1", "33033294037-"} {
		handler := webhookHandler{secret: []byte("test-secret"), triggerPath: filepath.Join(t.TempDir(), "request"), ledgerPath: t.TempDir()}
		if got := sendWebhook(&handler, testPayload(t, time.Now().Unix(), id)); got != http.StatusBadRequest {
			t.Fatalf("%q: %d", id, got)
		}
	}
}

func TestLedgerPrunesOnlyExpiredRecords(t *testing.T) {
	ledger := t.TempDir()
	now := time.Now()
	for _, id := range []string{"1-1", "2-1"} {
		if err := os.WriteFile(filepath.Join(ledger, id), []byte("{}"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	expired := now.Add(-deliveryRetention - time.Hour)
	if err := os.Chtimes(filepath.Join(ledger, "1-1"), expired, expired); err != nil {
		t.Fatal(err)
	}
	if err := pruneDeliveries(ledger, now); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(ledger, "1-1")); !os.IsNotExist(err) {
		t.Fatal("expired record retained")
	}
	if _, err := os.Stat(filepath.Join(ledger, "2-1")); err != nil {
		t.Fatal("recent record removed")
	}
}
