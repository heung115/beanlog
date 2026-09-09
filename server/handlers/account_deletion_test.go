package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"beanmap-server/middleware"
	"github.com/gin-gonic/gin"
)

const deletionTestUser = "a1111111-1111-4111-8111-111111111111"
const deletionTestSession = "b1111111-1111-4111-8111-111111111111"
const deletionTestSecret = "private-test-rate-identity-key-32-bytes"

type fakeDeletionStore struct {
	mu      sync.Mutex
	calls   []string
	results map[string]string
	failure error
	inspect func(string, []any)
}

func (s *fakeDeletionStore) call(_ context.Context, identity deletionIdentity, op string, args ...any) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, op)
	if identity.userID != deletionTestUser || identity.sessionID != deletionTestSession {
		return "", errors.New("wrong bound identity")
	}
	if s.inspect != nil {
		s.inspect(op, args)
	}
	if s.failure != nil {
		return "", s.failure
	}
	if result := s.results[op]; result != "" {
		return result, nil
	}
	return "ok", nil
}
func deletionTestRequest(t *testing.T, h *AccountDeletionHandler, body string, challenge bool) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(r)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/account/delete", strings.NewReader(body))
	c.Request.Header.Set("Authorization", "Bearer original-token")
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("X-Beanmap-Auth-Rate-Identity", "attacker-supplied")
	c.Set(middleware.UserIDKey, deletionTestUser)
	c.Set(middleware.SessionIDKey, deletionTestSession)
	if challenge {
		h.Challenge(c)
	} else {
		h.Delete(c)
	}
	return r
}

func TestAccountDeletionRequiresDirectFreshOTPAndCommitsBeforeSuccess(t *testing.T) {
	for _, test := range []struct {
		name         string
		originalID   string
		verifyStatus int
		freshID      string
		reserve      string
		completeErr  error
		want         int
		wantVerify   bool
		wantComplete bool
	}{
		{name: "success", originalID: deletionTestUser, verifyStatus: 200, freshID: deletionTestUser, want: 200, wantVerify: true, wantComplete: true},
		{name: "exact original token rejected", originalID: "other", want: 401},
		{name: "missing proof", originalID: deletionTestUser, reserve: "challenge_expired", want: 400},
		{name: "persistent attempts exhausted", originalID: deletionTestUser, reserve: "rate_limited", want: 429},
		{name: "wrong OTP", originalID: deletionTestUser, verifyStatus: 403, want: 400, wantVerify: true},
		{name: "OTP belongs to another user", originalID: deletionTestUser, verifyStatus: 200, freshID: "other", want: 400, wantVerify: true},
		{name: "auth outage", originalID: deletionTestUser, verifyStatus: 503, want: 503, wantVerify: true},
		{name: "deletion commit failure", originalID: deletionTestUser, verifyStatus: 200, freshID: deletionTestUser, completeErr: errors.New("commit failed"), want: 503, wantVerify: true, wantComplete: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			calls := []string{}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls = append(calls, r.Method+" "+r.URL.Path)
				expected := (&AccountDeletionHandler{rateSecret: deletionTestSecret}).rateIdentity(deletionTestUser)
				if r.Header.Get("X-Beanmap-Auth-Rate-Identity") != expected {
					t.Error("untrusted or missing rate identity")
				}
				switch r.URL.Path {
				case "/user":
					id := test.originalID
					if r.Header.Get("Authorization") == "Bearer fresh-token" {
						id = test.freshID
					} else if r.Header.Get("Authorization") != "Bearer original-token" {
						t.Error("wrong exact token")
					}
					_ = json.NewEncoder(w).Encode(deletionAuthUser{ID: id, Email: "owner@example.invalid", EmailConfirmedAt: "2026-01-01T00:00:00Z"})
				case "/verify":
					var body map[string]string
					_ = json.NewDecoder(r.Body).Decode(&body)
					if body["email"] != "owner@example.invalid" || body["type"] != "email" || body["token"] != "123456" {
						t.Error("OTP identity changed")
					}
					w.WriteHeader(test.verifyStatus)
					if test.verifyStatus == 200 {
						_ = json.NewEncoder(w).Encode(deletionAuthSession{AccessToken: "fresh-token"})
					}
				case "/logout":
					if r.URL.Query().Get("scope") != "local" || r.Header.Get("Authorization") != "Bearer fresh-token" {
						t.Error("cleanup revoked wrong session")
					}
					w.WriteHeader(204)
				default:
					t.Error("unexpected Auth endpoint")
					w.WriteHeader(500)
				}
			}))
			defer server.Close()
			store := &fakeDeletionStore{results: map[string]string{"reserve": test.reserve}}
			store.inspect = func(op string, _ []any) {
				if op == "complete" && test.completeErr != nil {
					store.failure = test.completeErr
				}
			}
			h := NewAccountDeletionHandler(nil, server.URL, deletionTestSecret)
			h.store = store
			recorder := deletionTestRequest(t, h, `{"challenge":"`+strings.Repeat("a", 64)+`","code":"123456"}`, false)
			if recorder.Code != test.want {
				t.Fatalf("status=%d expected=%d body=%s", recorder.Code, test.want, recorder.Body.String())
			}
			gotVerify, gotComplete, gotCleanup := false, false, false
			for _, call := range calls {
				if call == "POST /verify" {
					gotVerify = true
				}
				if call == "POST /logout" {
					gotCleanup = true
				}
			}
			for _, call := range store.calls {
				if call == "complete" {
					gotComplete = true
				}
			}
			if gotVerify != test.wantVerify || gotComplete != test.wantComplete {
				t.Fatalf("verify=%v complete=%v", gotVerify, gotComplete)
			}
			if gotCleanup != (test.wantVerify && test.verifyStatus == 200) {
				t.Fatal("temporary OTP session cleanup missing or original session touched")
			}
			if recorder.Header().Get("Cache-Control") != "no-store" {
				t.Error("response may be cached")
			}
			if strings.Contains(recorder.Body.String(), "token") || strings.Contains(recorder.Body.String(), "example.invalid") {
				t.Error("Auth secret or email escaped response")
			}
			if test.want == 200 && recorder.Body.String() != `{"success":true}` {
				t.Error("ambiguous success")
			}
		})
	}
}

func TestAccountDeletionChallengeUsesVerifiedEmailAndHashedOpaqueSecret(t *testing.T) {
	var hash string
	var otpCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/user" {
			_ = json.NewEncoder(w).Encode(deletionAuthUser{ID: deletionTestUser, Email: "owner@example.invalid", EmailConfirmedAt: "2026-01-01"})
			return
		}
		if r.URL.Path != "/otp" {
			t.Error("unexpected route")
			return
		}
		otpCalls++
		var body struct {
			Email      string `json:"email"`
			CreateUser *bool  `json:"create_user"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Email != "owner@example.invalid" || body.CreateUser == nil || *body.CreateUser {
			t.Error("OTP created user or used unverified email")
		}
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()
	store := &fakeDeletionStore{inspect: func(op string, args []any) {
		if op == "begin" {
			hash = args[1].(string)
		}
	}}
	h := NewAccountDeletionHandler(nil, server.URL, deletionTestSecret)
	h.store = store
	r := deletionTestRequest(t, h, `{"email":"attacker@example.invalid"}`, true)
	var response struct {
		Challenge string `json:"challenge"`
		Expires   int    `json:"expires_in"`
	}
	_ = json.Unmarshal(r.Body.Bytes(), &response)
	if r.Code != 200 || !deletionTokenPattern.MatchString(response.Challenge) || response.Expires != 300 || hash != deletionHash(response.Challenge) || hash == response.Challenge || otpCalls != 1 {
		t.Fatalf("invalid challenge result status %d", r.Code)
	}
}

func TestAccountDeletionFailClosedBeforeExternalRequests(t *testing.T) {
	for _, input := range []string{`{}`, `{"challenge":"` + strings.Repeat("a", 64) + `","code":"123456","email":"attacker"}`, `{"challenge":"` + strings.Repeat("a", 64) + `","code":"123456"} {}`, `{"challenge":"` + strings.Repeat("a", 64) + `","code":"x123456"}`} {
		h := NewAccountDeletionHandler(nil, "http://invalid.local", deletionTestSecret)
		if response := deletionTestRequest(t, h, input, false); response.Code != 400 {
			t.Fatal("invalid input accepted")
		}
	}
	for _, endpoint := range []string{"", "file:///tmp/auth", "http://user:password@localhost", "http://localhost/auth?redirect=evil", "//localhost/auth"} {
		h := NewAccountDeletionHandler(nil, endpoint, deletionTestSecret)
		if response := deletionTestRequest(t, h, "", true); response.Code != 503 {
			t.Fatal("invalid Auth URL not denied")
		}
	}
	h := NewAccountDeletionHandler(nil, "http://localhost", "")
	if response := deletionTestRequest(t, h, "", true); response.Code != 503 {
		t.Fatal("missing private rate identity key not denied")
	}
}

func TestAccountDeletionAuthNeverFollowsRedirects(t *testing.T) {
	reached := false
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true; w.WriteHeader(200) }))
	defer target.Close()
	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 307) }))
	defer redirector.Close()
	h := NewAccountDeletionHandler(nil, redirector.URL, deletionTestSecret)
	response := deletionTestRequest(t, h, "", true)
	if response.Code != 401 || reached {
		t.Fatal("Auth redirect leaked bearer token")
	}
}
