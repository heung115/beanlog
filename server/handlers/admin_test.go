package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type adminTestTx struct {
	pgx.Tx
	queryRow func(string, ...any) pgx.Row
	query    func(string, ...any) (pgx.Rows, error)
}

func (tx *adminTestTx) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	return tx.queryRow(sql, args...)
}

func (tx *adminTestTx) Query(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
	return tx.query(sql, args...)
}

type adminTestRow struct {
	values []any
	err    error
}

func (row adminTestRow) Scan(dest ...any) error {
	if row.err != nil {
		return row.err
	}
	for i, value := range row.values {
		reflect.ValueOf(dest[i]).Elem().Set(reflect.ValueOf(value))
	}
	return nil
}

type adminTestRows struct {
	pgx.Rows
	values  [][]any
	index   int
	closed  bool
	scanErr error
	rowErr  error
}

func (rows *adminTestRows) Close()     { rows.closed = true }
func (rows *adminTestRows) Err() error { return rows.rowErr }
func (rows *adminTestRows) Next() bool {
	if rows.closed || rows.index >= len(rows.values) {
		return false
	}
	rows.index++
	return true
}
func (rows *adminTestRows) Scan(dest ...any) error {
	return (adminTestRow{values: rows.values[rows.index-1], err: rows.scanErr}).Scan(dest...)
}

func adminTestContext(method, path, body string, tx *adminTestTx) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("request_database", tx)
	return c, recorder
}

func TestAdminAccessReturnsMembershipWithoutGrantingIt(t *testing.T) {
	for _, test := range []struct {
		name    string
		allowed bool
		err     error
		status  int
	}{
		{name: "regular user", status: http.StatusOK},
		{name: "operator", allowed: true, status: http.StatusOK},
		{name: "database unavailable", err: errors.New("private database detail"), status: http.StatusServiceUnavailable},
	} {
		t.Run(test.name, func(t *testing.T) {
			tx := &adminTestTx{queryRow: func(sql string, args ...any) pgx.Row {
				if sql != "SELECT beanmap_private.beanmap_is_admin()" || len(args) != 0 {
					t.Fatalf("membership must use the request identity inside PostgreSQL: %s %#v", sql, args)
				}
				return adminTestRow{values: []any{test.allowed}, err: test.err}
			}}
			c, response := adminTestContext(http.MethodGet, "/api/admin/access", "", tx)
			NewAdminHandler("").Access(c)
			if response.Code != test.status {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
			if test.err == nil {
				var data map[string]bool
				if err := json.Unmarshal(response.Body.Bytes(), &data); err != nil || len(data) != 1 || data["is_admin"] != test.allowed {
					t.Fatalf("access = %s", response.Body.String())
				}
			} else if strings.Contains(response.Body.String(), "private database detail") {
				t.Fatal("database details leaked")
			}
		})
	}
}

func TestAdminGuardRechecksMembershipAndDisablesCaching(t *testing.T) {
	h := NewAdminHandler("")
	checks, calls := 0, 0
	tx := &adminTestTx{queryRow: func(sql string, args ...any) pgx.Row {
		checks++
		if checks == 3 {
			return adminTestRow{err: errors.New("connection lost")}
		}
		return adminTestRow{values: []any{checks == 1}}
	}}
	router := gin.New()
	router.Use(h.NoStore, func(c *gin.Context) { c.Set("request_database", tx) }, h.RequireAdmin)
	router.GET("/api/admin/overview", func(c *gin.Context) {
		calls++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	for _, status := range []int{http.StatusOK, http.StatusForbidden, http.StatusServiceUnavailable} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/admin/overview", nil))
		if response.Code != status || response.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("status = %d, cache = %q", response.Code, response.Header().Get("Cache-Control"))
		}
	}
	if checks != 3 || calls != 1 {
		t.Fatalf("membership checks = %d, authorized handler calls = %d", checks, calls)
	}
}

func TestAdminCatalogSearchIsLiteralAndPreservesNullableLabels(t *testing.T) {
	search := `%_\' OR 1=1 --`
	country := "Ethiopia"
	var noLabel *string
	rows := &adminTestRows{values: [][]any{{int64(42), "Test Farm", noLabel, &country}}}
	tx := &adminTestTx{
		queryRow: func(sql string, args ...any) pgx.Row {
			if !strings.Contains(sql, "strpos(") || strings.Contains(sql, search) || !reflect.DeepEqual(args, []any{search}) {
				t.Fatalf("unsafe count query or arguments: %s %#v", sql, args)
			}
			return adminTestRow{values: []any{int64(27)}}
		},
		query: func(sql string, args ...any) (pgx.Rows, error) {
			if strings.Contains(sql, search) || !reflect.DeepEqual(args, []any{search, 25, 25}) {
				t.Fatalf("unsafe catalog query or arguments: %s %#v", sql, args)
			}
			return rows, nil
		},
	}
	c, response := adminTestContext(http.MethodGet, "/api/admin/catalog?kind=entity&offset=25", "", tx)
	params := c.Request.URL.Query()
	params.Set("q", search)
	c.Request.URL.RawQuery = params.Encode()
	NewAdminHandler("").Catalog(c)
	var result struct {
		Items  []adminCatalogItem `json:"items"`
		Total  int64              `json:"total"`
		Limit  int                `json:"limit"`
		Offset int                `json:"offset"`
	}
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &result) != nil {
		t.Fatalf("catalog = %d %s", response.Code, response.Body.String())
	}
	if result.Total != 27 || result.Limit != 25 || result.Offset != 25 || len(result.Items) != 1 ||
		result.Items[0].NameKo != nil || result.Items[0].Kind != "entity" || !rows.closed {
		t.Fatalf("catalog = %#v, closed = %v", result, rows.closed)
	}
}

func TestAdminCatalogRejectsInvalidQueriesBeforeDatabaseAccess(t *testing.T) {
	for _, query := range []string{
		"kind=unknown", "kind=region;DELETE", "kind=country&offset=-1", "kind=entity&offset=100001",
		"kind=entity&offset=1.5", "kind=region&offset=9999999999999999999999999",
		"kind=country&q=" + strings.Repeat("가", 101),
	} {
		t.Run(query[:min(len(query), 50)], func(t *testing.T) {
			c, response := adminTestContext(http.MethodGet, "/api/admin/catalog?"+query, "", nil)
			NewAdminHandler("").Catalog(c)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d", response.Code)
			}
		})
	}
}

func TestAdminCatalogAndAuditNeverReturnPartialDatabaseResults(t *testing.T) {
	h := NewAdminHandler("")
	for _, handler := range []struct {
		name string
		call gin.HandlerFunc
	}{
		{name: "catalog", call: h.Catalog},
		{name: "audit", call: h.Audit},
	} {
		for _, failure := range []string{"query", "scan", "iteration"} {
			t.Run(handler.name+"/"+failure, func(t *testing.T) {
				rows := &adminTestRows{}
				if failure == "scan" {
					rows.values = [][]any{{}}
					rows.scanErr = errors.New("scan failure")
				}
				if failure == "iteration" {
					rows.rowErr = errors.New("iteration failure")
				}
				tx := &adminTestTx{
					queryRow: func(string, ...any) pgx.Row { return adminTestRow{values: []any{int64(0)}} },
					query: func(string, ...any) (pgx.Rows, error) {
						if failure == "query" {
							return nil, errors.New("query failure")
						}
						return rows, nil
					},
				}
				c, response := adminTestContext(http.MethodGet, "/api/admin/"+handler.name+"?kind=region", "", tx)
				handler.call(c)
				if response.Code != http.StatusInternalServerError || strings.Contains(response.Body.String(), "\"items\"") {
					t.Fatalf("partial failure response = %d %s", response.Code, response.Body.String())
				}
				if failure != "query" && !rows.closed {
					t.Fatal("rows not closed after failure")
				}
			})
		}
	}
}

func TestAdminCatalogUpdateValidatesRequiredExpectedValueAndBounds(t *testing.T) {
	valid := `{"name_ko":"한글명","expected_name_ko":null,"reason":"표기 수정"}`
	for _, test := range []struct {
		name, kind, id, body string
	}{
		{name: "invalid kind", kind: "users", body: valid},
		{name: "invalid id", id: "-1", body: valid},
		{name: "overflow id", id: "999999999999999999999", body: valid},
		{name: "missing expected", body: `{"name_ko":"한글명","reason":"표기 수정"}`},
		{name: "invalid expected type", body: `{"name_ko":"한글명","expected_name_ko":3,"reason":"표기 수정"}`},
		{name: "missing name", body: `{"expected_name_ko":null,"reason":"표기 수정"}`},
		{name: "null name", body: `{"name_ko":null,"expected_name_ko":null,"reason":"표기 수정"}`},
		{name: "missing reason", body: `{"name_ko":"한글명","expected_name_ko":null}`},
		{name: "short reason", body: `{"name_ko":"한글명","expected_name_ko":null,"reason":" 가 "}`},
		{name: "unknown actor input", body: strings.TrimSuffix(valid, "}") + `,"actor_id":"other-user"}`},
		{name: "second json value", body: valid + `{}`},
		{name: "null payload", body: `null`},
		{name: "long label", body: `{"name_ko":"` + strings.Repeat("가", 121) + `","expected_name_ko":null,"reason":"표기 수정"}`},
		{name: "long reason", body: `{"name_ko":"한글명","expected_name_ko":null,"reason":"` + strings.Repeat("가", 301) + `"}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			if test.kind == "" {
				test.kind = "country"
			}
			if test.id == "" {
				test.id = "1"
			}
			c, response := adminTestContext(http.MethodPut, "/api/admin/catalog", test.body, nil)
			c.Params = gin.Params{{Key: "kind", Value: test.kind}, {Key: "id", Value: test.id}}
			NewAdminHandler("").UpdateCatalog(c)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminCatalogUpdateKeepsExpectedValueAndAcceptsUnicodeLimits(t *testing.T) {
	for _, test := range []struct {
		name    string
		newName string
		changed bool
	}{
		{name: "120 Korean characters", newName: strings.Repeat("가", 120), changed: true},
		{name: "clear label", newName: " \n\t ", changed: true},
		{name: "no-op still succeeds", newName: "기존 한글명"},
	} {
		t.Run(test.name, func(t *testing.T) {
			expected := " 기존 한글명 "
			body, _ := json.Marshal(map[string]any{"name_ko": test.newName, "expected_name_ko": expected, "reason": " 표기 수정 "})
			tx := &adminTestTx{queryRow: func(sql string, args ...any) pgx.Row {
				if !strings.Contains(sql, "beanmap_private.beanmap_admin_update_catalog") || len(args) != 5 ||
					args[0] != "region" || args[1] != int64(42) || args[2] != strings.TrimSpace(test.newName) ||
					args[3].(*string) == nil || *args[3].(*string) != expected || args[4] != "표기 수정" {
					t.Fatalf("update lost caller expectation or exceeded its scope: %s %#v", sql, args)
				}
				return adminTestRow{values: []any{test.changed}}
			}}
			c, response := adminTestContext(http.MethodPut, "/api/admin/catalog/region/42", string(body), tx)
			c.Params = gin.Params{{Key: "kind", Value: "region"}, {Key: "id", Value: "42"}}
			NewAdminHandler("").UpdateCatalog(c)
			if response.Code != http.StatusOK || response.Body.String() != `{"ok":true}` {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminCatalogUpdateMapsDatabaseBoundaryErrors(t *testing.T) {
	for _, test := range []struct {
		code   string
		status int
	}{
		{"42501", http.StatusForbidden}, {"22023", http.StatusBadRequest},
		{"P0002", http.StatusNotFound}, {"40001", http.StatusConflict},
		{"XX000", http.StatusInternalServerError},
	} {
		t.Run(test.code, func(t *testing.T) {
			tx := &adminTestTx{queryRow: func(string, ...any) pgx.Row {
				return adminTestRow{err: &pgconn.PgError{Code: test.code, Message: "private row details"}}
			}}
			c, response := adminTestContext(http.MethodPut, "/api/admin/catalog/country/1",
				`{"name_ko":"수정","expected_name_ko":null,"reason":"표기 수정"}`, tx)
			c.Params = gin.Params{{Key: "kind", Value: "country"}, {Key: "id", Value: "1"}}
			NewAdminHandler("").UpdateCatalog(c)
			if response.Code != test.status || strings.Contains(response.Body.String(), "private row details") {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminOverviewOnlyReturnsAggregateFields(t *testing.T) {
	tx := &adminTestTx{queryRow: func(string, ...any) pgx.Row {
		return adminTestRow{values: []any{int64(100), int64(500), int64(10), int64(40), int64(12), int64(37), int64(220), int64(420)}}
	}}
	c, response := adminTestContext(http.MethodGet, "/api/admin/overview", "", tx)
	NewAdminHandler("").Overview(c)
	var result map[string]int64
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &result) != nil || len(result) != 8 ||
		result["active_users_30d"] != 12 || result["new_beans_30d"] != 40 {
		t.Fatalf("overview = %d %s", response.Code, response.Body.String())
	}
}

func TestAdminAuditOmitsActorIdentityAndPreservesClearedLabels(t *testing.T) {
	oldLabel := "이전 이름"
	var cleared *string
	rows := &adminTestRows{values: [][]any{{int64(2), "country", int64(7), "Ethiopia", &oldLabel, cleared, "표기 삭제", time.Now().UTC()}}}
	tx := &adminTestTx{query: func(string, ...any) (pgx.Rows, error) { return rows, nil }}
	c, response := adminTestContext(http.MethodGet, "/api/admin/audit", "", tx)
	NewAdminHandler("").Audit(c)
	var result struct {
		Items []map[string]any `json:"items"`
	}
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &result) != nil || len(result.Items) != 1 {
		t.Fatalf("audit = %d %s", response.Code, response.Body.String())
	}
	if len(result.Items[0]) != 8 || result.Items[0]["new_name_ko"] != nil || !rows.closed {
		t.Fatalf("audit exposed unexpected fields: %#v", result.Items[0])
	}
	for _, key := range []string{"actor_id", "user_id", "email", "display_name"} {
		if _, exists := result.Items[0][key]; exists {
			t.Fatalf("audit exposed %s", key)
		}
	}
}

func TestAdminPrivateIngressRejectsUntrustedRequestsBeforeOtherChecks(t *testing.T) {
	secret := strings.Repeat("a", 32)
	for _, test := range []struct {
		name       string
		configured string
		headers    []string
		want       int
	}{
		{name: "unconfigured even with client secret", headers: []string{secret}, want: http.StatusNotFound},
		{name: "short configured secret", configured: "too-short", headers: []string{"too-short"}, want: http.StatusNotFound},
		{name: "missing", configured: secret, want: http.StatusNotFound},
		{name: "empty", configured: secret, headers: []string{""}, want: http.StatusNotFound},
		{name: "incorrect same length", configured: secret, headers: []string{strings.Repeat("b", 32)}, want: http.StatusNotFound},
		{name: "incorrect length", configured: secret, headers: []string{secret + "a"}, want: http.StatusNotFound},
		{name: "whitespace is not normalized", configured: secret, headers: []string{secret + " "}, want: http.StatusNotFound},
		{name: "duplicate headers", configured: secret, headers: []string{secret, secret}, want: http.StatusNotFound},
		{name: "exact private credential", configured: secret, headers: []string{secret}, want: http.StatusNoContent},
	} {
		t.Run(test.name, func(t *testing.T) {
			h := NewAdminHandler(test.configured)
			router := gin.New()
			downstreamCalls := 0
			router.GET("/api/admin/access", h.NoStore, h.RequirePrivate, func(c *gin.Context) {
				downstreamCalls++
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodGet, "/api/admin/access", nil)
			// None of these client-controlled headers can stand in for the secret.
			request.Header.Set("X-Forwarded-For", "127.0.0.1")
			request.Header.Set("X-Forwarded-Host", "private.example.ts.net")
			request.Header.Set("Tailscale-User-Login", "operator@example.test")
			request.Header.Set("Authorization", "Bearer forged-admin-token")
			for _, value := range test.headers {
				request.Header.Add("X-Beanmap-Admin-Secret", value)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.want || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("status = %d, cache = %q", response.Code, response.Header().Get("Cache-Control"))
			}
			wantCalls := 0
			if test.want == http.StatusNoContent {
				wantCalls = 1
			}
			if downstreamCalls != wantCalls {
				t.Fatalf("downstream calls = %d, want %d", downstreamCalls, wantCalls)
			}
		})
	}
}
