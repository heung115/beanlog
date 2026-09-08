package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"beanmap-server/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var deletionTokenPattern = regexp.MustCompile(`^[a-f0-9]{64}$`)
var deletionCodePattern = regexp.MustCompile(`^[0-9]{6,10}$`)
var errDeletionSession = errors.New("session expired")

type deletionIdentity struct{ userID, sessionID string }
type deletionStore interface {
	call(context.Context, deletionIdentity, string, ...any) (string, error)
}
type deletionDBStore struct {
	begin func(context.Context) (pgx.Tx, error)
}

// Each reservation commits before an external Auth call. Failed OTP attempts
// therefore survive a 4xx response and cannot be reset by request rollback.
func (s deletionDBStore) call(ctx context.Context, identity deletionIdentity, operation string, args ...any) (string, error) {
	queries := map[string]string{
		"begin":    "SELECT beanmap_security.begin_account_deletion($1,$2)",
		"reserve":  "SELECT beanmap_security.reserve_account_deletion($1,$2,$3)",
		"complete": "SELECT beanmap_security.complete_account_deletion($1,$2,$3)",
		"release":  "SELECT beanmap_security.release_account_deletion($1)",
	}
	query, ok := queries[operation]
	if !ok {
		return "", errors.New("invalid deletion operation")
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	tx, err := s.begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() {
		cleanup, done := context.WithTimeout(context.Background(), time.Second)
		defer done()
		_ = tx.Rollback(cleanup)
	}()
	for _, statement := range []string{"SET LOCAL statement_timeout = '2s'", "SET LOCAL idle_in_transaction_session_timeout = '3s'", "SET LOCAL ROLE beanmap_api_runtime"} {
		if _, err = tx.Exec(ctx, statement); err != nil {
			return "", err
		}
	}
	claims, _ := json.Marshal(map[string]string{"sub": identity.userID, "session_id": identity.sessionID, "role": "authenticated"})
	if _, err = tx.Exec(ctx, `SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims',$2,true)`, identity.userID, string(claims)); err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, "SELECT beanmap_security.require_current_session()"); err != nil {
		var p *pgconn.PgError
		if errors.As(err, &p) && p.Code == "28000" {
			return "", errDeletionSession
		}
		return "", err
	}
	result := "ok"
	if operation == "release" {
		_, err = tx.Exec(ctx, query, args...)
	} else {
		err = tx.QueryRow(ctx, query, args...).Scan(&result)
	}
	if err != nil {
		var p *pgconn.PgError
		if errors.As(err, &p) && p.Code == "28000" {
			return "", errDeletionSession
		}
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return result, nil
}

type AccountDeletionHandler struct {
	store      deletionStore
	authURL    string
	client     *http.Client
	rateSecret string
}

func NewAccountDeletionHandler(pool *pgxpool.Pool, authURL, rateSecret string) *AccountDeletionHandler {
	endpoint, err := url.Parse(authURL)
	if err != nil || endpoint.Hostname() == "" || (endpoint.Scheme != "http" && endpoint.Scheme != "https") || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		authURL = "" // An invalid operator setting fails closed; never derive from request headers.
	}
	return &AccountDeletionHandler{store: deletionDBStore{begin: pool.Begin}, authURL: strings.TrimRight(authURL, "/"), rateSecret: rateSecret, client: &http.Client{
		Timeout:       4 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

type deletionAuthUser struct {
	ID               string `json:"id"`
	Email            string `json:"email"`
	EmailConfirmedAt string `json:"email_confirmed_at"`
}
type deletionAuthSession struct {
	AccessToken string `json:"access_token"`
}

type deletionRateContextKey struct{}

func (h *AccountDeletionHandler) rateIdentity(userID string) string {
	if len(h.rateSecret) < 32 || userID == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(h.rateSecret))
	_, _ = mac.Write([]byte("account-delete\x00" + userID))
	return "deletion:" + hex.EncodeToString(mac.Sum(nil))
}

func (h *AccountDeletionHandler) auth(ctx context.Context, method, path, token string, body any, result any) (int, error) {
	rateID, _ := ctx.Value(deletionRateContextKey{}).(string)
	if h.authURL == "" || rateID == "" {
		return 0, errors.New("auth unavailable")
	}
	var input io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		input = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, h.authURL+path, input)
	if err != nil {
		return 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Beanmap-Auth-Rate-Identity", rateID)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := h.client.Do(request)
	if err != nil {
		return 0, errors.New("auth unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return response.StatusCode, nil
	}
	if result != nil {
		data, err := io.ReadAll(io.LimitReader(response.Body, 65537))
		if err != nil || len(data) > 65536 {
			return 0, errors.New("invalid auth response")
		}
		if json.Unmarshal(data, result) != nil {
			return 0, errors.New("invalid auth response")
		}
	}
	return response.StatusCode, nil
}

func deletionError(c *gin.Context, code string) {
	status := http.StatusBadRequest
	switch code {
	case "session_expired":
		status = 401
	case "email_unavailable":
		status = 403
	case "rate_limited":
		status = 429
	case "temporarily_unavailable":
		status = 503
	}
	if code == "rate_limited" {
		c.Header("Retry-After", "60")
	}
	c.JSON(status, gin.H{"error": code})
}
func deletionStateError(c *gin.Context, result string, err error) bool {
	if errors.Is(err, errDeletionSession) {
		deletionError(c, "session_expired")
		return true
	}
	if err != nil {
		deletionError(c, "temporarily_unavailable")
		return true
	}
	if result != "ok" {
		switch result {
		case "rate_limited", "challenge_expired", "email_unavailable":
			deletionError(c, result)
		default:
			deletionError(c, "temporarily_unavailable")
		}
		return true
	}
	return false
}
func deletionSecret() (string, error) {
	var value [32]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(value[:]), nil
}
func deletionHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func deletionRequestIdentity(c *gin.Context) deletionIdentity {
	return deletionIdentity{c.GetString(middleware.UserIDKey), c.GetString(middleware.SessionIDKey)}
}

func (h *AccountDeletionHandler) currentUser(c *gin.Context) (deletionAuthUser, string, bool) {
	var user deletionAuthUser
	token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	if token == "" || token == c.GetHeader("Authorization") {
		deletionError(c, "session_expired")
		return user, "", false
	}
	status, err := h.auth(c.Request.Context(), http.MethodGet, "/user", token, nil, &user)
	if err != nil || status >= 500 {
		deletionError(c, "temporarily_unavailable")
		return user, "", false
	}
	if status == 429 {
		deletionError(c, "rate_limited")
		return user, "", false
	}
	if status != 200 || user.ID != c.GetString(middleware.UserIDKey) || user.ID == "" {
		deletionError(c, "session_expired")
		return user, "", false
	}
	if user.Email == "" || user.EmailConfirmedAt == "" {
		deletionError(c, "email_unavailable")
		return user, "", false
	}
	return user, token, true
}

func (h *AccountDeletionHandler) Challenge(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	ctx = context.WithValue(ctx, deletionRateContextKey{}, h.rateIdentity(c.GetString(middleware.UserIDKey)))
	c.Request = c.Request.WithContext(ctx)
	user, _, ok := h.currentUser(c)
	if !ok {
		return
	}
	proof, err := deletionSecret()
	if err != nil {
		deletionError(c, "temporarily_unavailable")
		return
	}
	result, err := h.store.call(ctx, deletionRequestIdentity(c), "begin", user.Email, deletionHash(proof))
	if deletionStateError(c, result, err) {
		return
	}
	status, err := h.auth(ctx, http.MethodPost, "/otp", "", map[string]any{"email": user.Email, "create_user": false}, nil)
	if err != nil || status < 200 || status >= 300 {
		if status == 429 {
			deletionError(c, "rate_limited")
		} else {
			deletionError(c, "temporarily_unavailable")
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"challenge": proof, "expires_in": 300})
}

func (h *AccountDeletionHandler) Delete(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 22*time.Second)
	defer cancel()
	ctx = context.WithValue(ctx, deletionRateContextKey{}, h.rateIdentity(c.GetString(middleware.UserIDKey)))
	c.Request = c.Request.WithContext(ctx)
	var input struct {
		Challenge string `json:"challenge"`
		Code      string `json:"code"`
	}
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF || !deletionTokenPattern.MatchString(input.Challenge) || !deletionCodePattern.MatchString(input.Code) {
		deletionError(c, "challenge_expired")
		return
	}
	user, originalToken, ok := h.currentUser(c)
	if !ok {
		return
	}
	reservation, err := deletionSecret()
	if err != nil {
		deletionError(c, "temporarily_unavailable")
		return
	}
	identity := deletionRequestIdentity(c)
	proofHash, reservationHash := deletionHash(input.Challenge), deletionHash(reservation)
	result, err := h.store.call(ctx, identity, "reserve", proofHash, user.Email, reservationHash)
	if deletionStateError(c, result, err) {
		return
	}
	// Releasing an in-flight slot never refunds an attempt or a send allowance.
	defer func() {
		cleanup, done := context.WithTimeout(context.Background(), 3*time.Second)
		defer done()
		_, _ = h.store.call(cleanup, identity, "release", reservationHash)
	}()
	var session deletionAuthSession
	status, err := h.auth(ctx, http.MethodPost, "/verify", "", map[string]string{"email": user.Email, "token": input.Code, "type": "email"}, &session)
	if session.AccessToken != "" && session.AccessToken != originalToken {
		defer func() {
			cleanup, done := context.WithTimeout(context.Background(), 2*time.Second)
			defer done()
			cleanup = context.WithValue(cleanup, deletionRateContextKey{}, h.rateIdentity(identity.userID))
			_, _ = h.auth(cleanup, http.MethodPost, "/logout?scope=local", session.AccessToken, nil, nil)
		}()
	}
	if err != nil || status >= 500 {
		deletionError(c, "temporarily_unavailable")
		return
	}
	if status == 429 {
		deletionError(c, "rate_limited")
		return
	}
	if status != 200 || session.AccessToken == "" || session.AccessToken == originalToken {
		deletionError(c, "invalid_code")
		return
	}
	var verified deletionAuthUser
	status, err = h.auth(ctx, http.MethodGet, "/user", session.AccessToken, nil, &verified)
	if err != nil || status >= 500 {
		deletionError(c, "temporarily_unavailable")
		return
	}
	if status != 200 || verified.ID != user.ID || verified.Email != user.Email || verified.EmailConfirmedAt == "" {
		deletionError(c, "invalid_code")
		return
	}
	result, err = h.store.call(ctx, identity, "complete", proofHash, user.Email, reservationHash)
	if deletionStateError(c, result, err) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
