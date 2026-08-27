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
	"time"
)

const maxPayloadSize = 64 * 1024

var commitPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)

type triggerPayload struct {
	Repository string `json:"repository"`
	SHA        string `json:"sha"`
	RunID      uint64 `json:"run_id"`
}

type webhookHandler struct {
	secret       []byte
	triggerPath  string
	triggerQueue chan<- struct{}
}

func main() {
	secretPath := envOrDefault("WEBHOOK_SECRET_FILE", "/etc/beanmap-deploy-webhook/secret")
	triggerPath := envOrDefault("DEPLOY_TRIGGER_FILE", "/run/beanmap-deploy-trigger/request")
	listenAddress := envOrDefault("LISTEN_ADDRESS", "127.0.0.1:9087")

	secret, err := os.ReadFile(secretPath)
	if err != nil {
		log.Fatalf("read webhook secret: %v", err)
	}
	secret = []byte(strings.TrimSpace(string(secret)))
	if len(secret) < 32 {
		log.Fatal("webhook secret must contain at least 32 bytes")
	}

	triggerQueue := make(chan struct{}, 1)
	go runDeployWorker(triggerQueue)
	handler := webhookHandler{secret: secret, triggerPath: triggerPath, triggerQueue: triggerQueue}
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

func (h webhookHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
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

	if err := temporary.Chmod(0o600); err != nil {
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
