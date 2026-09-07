package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const maxPayloadSize = 64 * 1024
const maxDeliveryAge = 5 * time.Minute
const maxFutureSkew = 30 * time.Second
const deliveryRetention = 24 * time.Hour
const maxLedgerEntries = 10000

var commitPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
var deliveryPattern = regexp.MustCompile(`^[0-9]{1,20}-[0-9]{1,10}$`)

type triggerPayload struct {
	Repository string `json:"repository"`
	SHA        string `json:"sha"`
	RunID      uint64 `json:"run_id"`
	Timestamp  int64  `json:"timestamp"`
	DeliveryID string `json:"delivery_id"`
}

type webhookHandler struct {
	secret       []byte
	triggerPath  string
	triggerQueue chan<- struct{}
	ledgerPath   string
	now          func() time.Time
	mu           sync.Mutex
}

func main() {
	secretPath := envOrDefault("WEBHOOK_SECRET_FILE", "/etc/beanmap-deploy-webhook/secret")
	triggerPath := envOrDefault("DEPLOY_TRIGGER_FILE", "/run/beanmap-deploy-trigger/request")
	ledgerPath := envOrDefault("WEBHOOK_LEDGER_DIR", "/var/lib/beanmap-deploy-webhook/deliveries")
	listenAddress := envOrDefault("LISTEN_ADDRESS", "127.0.0.1:9087")

	secret, err := os.ReadFile(secretPath)
	if err != nil {
		log.Fatalf("read webhook secret: %v", err)
	}
	secret = []byte(strings.TrimSpace(string(secret)))
	if len(secret) < 32 {
		log.Fatal("webhook secret must contain at least 32 bytes")
	}

	if err := os.MkdirAll(ledgerPath, 0o700); err != nil {
		log.Fatalf("create durable delivery ledger: %v", err)
	}
	if err := syncDirectory(filepath.Dir(ledgerPath)); err != nil {
		log.Fatalf("persist delivery ledger directory: %v", err)
	}

	triggerQueue := make(chan struct{}, 1)
	go runDeployWorker(triggerQueue)
	handler := &webhookHandler{secret: secret, triggerPath: triggerPath, triggerQueue: triggerQueue, ledgerPath: ledgerPath, now: time.Now}
	server := &http.Server{
		Addr:              listenAddress,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 * 1024,
	}

	log.Printf("deployment webhook listening on %s", listenAddress)
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func (h *webhookHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	if request.URL.Path == "/healthz" {
		if request.Method != http.MethodGet {
			response.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		response.WriteHeader(http.StatusNoContent)
		return
	}

	if request.URL.Path != "/" {
		http.NotFound(response, request)
		return
	}
	if request.Method != http.MethodPost {
		response.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(response, request.Body, maxPayloadSize))
	if err != nil {
		http.Error(response, "invalid request body", http.StatusBadRequest)
		return
	}
	if !validSignature(h.secret, body, request.Header.Get("X-Hub-Signature-256")) {
		http.Error(response, "invalid signature", http.StatusUnauthorized)
		return
	}

	var payload triggerPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(response, "invalid payload", http.StatusBadRequest)
		return
	}
	if payload.Repository != "heung115/beanlog" || !commitPattern.MatchString(payload.SHA) || payload.RunID == 0 {
		http.Error(response, "invalid deployment target", http.StatusBadRequest)
		return
	}

	if !deliveryPattern.MatchString(payload.DeliveryID) || !strings.HasPrefix(payload.DeliveryID, fmt.Sprintf("%d-", payload.RunID)) {
		http.Error(response, "invalid delivery ID", http.StatusBadRequest)
		return
	}
	now := time.Now()
	if h.now != nil {
		now = h.now()
	}
	if payload.Timestamp < now.Add(-maxDeliveryAge).Unix() || payload.Timestamp > now.Add(maxFutureSkew).Unix() {
		http.Error(response, "expired delivery", http.StatusUnauthorized)
		return
	}

	// Serialize ledger consumption and trigger replacement. Persist consumption
	// BEFORE triggering work, so crashes and concurrent retries cannot replay it.
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := consumeDelivery(h.ledgerPath, payload.DeliveryID, body, now); err != nil {
		if errors.Is(err, os.ErrExist) {
			http.Error(response, "delivery already consumed", http.StatusConflict)
			return
		}
		log.Printf("persist deployment delivery: %v", err)
		http.Error(response, "delivery ledger unavailable", http.StatusServiceUnavailable)
		return
	}

	trigger := []byte(fmt.Sprintf("%s %d\n", payload.SHA, payload.RunID))
	if err := replaceFile(h.triggerPath, trigger); err != nil {
		log.Printf("write deployment trigger: %v", err)
		http.Error(response, "trigger unavailable", http.StatusServiceUnavailable)
		return
	}
	select {
	case h.triggerQueue <- struct{}{}:
	default:
	}

	log.Printf("accepted verified deployment trigger for %.12s", payload.SHA)
	response.WriteHeader(http.StatusAccepted)
}

// The ledger must be on persistent local storage, never /run or /tmp. Each
// signed delivery is consumed at most once even across process/host restarts.
// Retain records beyond the signature window and cap disk use. Host time must
// remain synchronized; large backward clock corrections require rotating secrets.
func consumeDelivery(directory, deliveryID string, body []byte, now time.Time) error {
	if directory == "" {
		return errors.New("delivery ledger is not configured")
	}
	if err := pruneDeliveries(directory, now); err != nil {
		return err
	}
	file, err := os.OpenFile(filepath.Join(directory, deliveryID), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	// Never remove a partially written record: fail closed after any I/O error.
	defer file.Close()
	if _, err := file.Write(body); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return err
	}
	return syncDirectory(directory)
}

func syncDirectory(directory string) error {
	dir, err := os.Open(directory)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func pruneDeliveries(directory string, now time.Time) error {
	dir, err := os.Open(directory)
	if err != nil {
		return err
	}
	defer dir.Close()
	entries, err := dir.ReadDir(maxLedgerEntries + 1)
	if err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	if len(entries) > maxLedgerEntries {
		return errors.New("delivery ledger capacity exceeded")
	}
	remaining := len(entries)
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode().IsRegular() && deliveryPattern.MatchString(entry.Name()) && info.ModTime().Before(now.Add(-deliveryRetention)) {
			if err := os.Remove(filepath.Join(directory, entry.Name())); err != nil {
				return err
			}
			remaining--
		}
	}
	if remaining >= maxLedgerEntries {
		return errors.New("delivery ledger capacity exceeded")
	}
	return nil
}

func runDeployWorker(triggerQueue <-chan struct{}) {
	for range triggerQueue {
		for attempt := 1; attempt <= 2; attempt++ {
			command := exec.Command(
				"/usr/bin/systemctl",
				"--no-ask-password",
				"start",
				"beanmap-deploy-poller.service",
			)
			output, err := command.CombinedOutput()
			if err != nil {
				log.Printf("start deployment poller attempt %d: %v: %s", attempt, err, strings.TrimSpace(string(output)))
			}
		}
	}
}

func replaceFile(path string, content []byte) error {
	temporary, err := os.CreateTemp(filepath.Dir(path), ".request-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)

	if err := temporary.Chmod(0o640); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, path)
}

func validSignature(secret, body []byte, provided string) bool {
	if !strings.HasPrefix(provided, "sha256=") {
		return false
	}
	decoded, err := hex.DecodeString(strings.TrimPrefix(provided, "sha256="))
	if err != nil {
		return false
	}
	expected := hmac.New(sha256.New, secret)
	_, _ = expected.Write(body)
	return hmac.Equal(decoded, expected.Sum(nil))
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
