package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestBeanUpdateForwardsVersionAndReportsAtomicConflict(t *testing.T) {
	for _, item := range []struct {
		name    string
		version any
		dbError error
		status  int
	}{
		{"current version", "2026-09-06T12:00:00.123456Z", nil, 200},
		{"stale version", "2026-09-06T12:00:00.123456Z", &pgconn.PgError{Code: "PT409"}, 409},
		{"old client", nil, nil, 200},
		{"invalid version", "not-a-timestamp", nil, 400},
	} {
		t.Run(item.name, func(t *testing.T) {
			data := map[string]any{"name": "House Blend", "roastery": "QA", "bean_type": "blend", "process_method": "washed", "roast_level": "medium", "place_type": "home", "overall_score": 8, "expected_updated_at": item.version, "blend_components": []map[string]any{{"origin_country": "Ethiopia", "percentage": 100}}}
			body, _ := json.Marshal(data)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPut, "/api/beans/record", bytes.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "id", Value: "record"}}
			tx := &versionedEditTx{err: item.dbError}
			c.Set("request_database", tx)
			NewBeanHandler().Update(c)
			if recorder.Code != item.status {
				t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
			}
			if item.status == 400 {
				if tx.called {
					t.Fatal("invalid version reached mutation")
				}
				return
			}
			if tx.payload["expected_updated_at"] != item.version {
				t.Fatalf("version changed in transit: %#v", tx.payload)
			}
			if item.status == 409 && recorder.Body.String() != `{"error":"record_conflict"}` {
				t.Fatalf("ambiguous conflict response: %s", recorder.Body.String())
			}
		})
	}
}

type versionedEditTx struct {
	pgx.Tx
	err     error
	payload map[string]any
	called  bool
}

func (tx *versionedEditTx) QueryRow(_ context.Context, _ string, args ...any) pgx.Row {
	tx.called = true
	_ = json.Unmarshal([]byte(args[1].(string)), &tx.payload)
	return versionedEditRow{err: tx.err}
}

type versionedEditRow struct{ err error }

func (r versionedEditRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	*dest[0].(*string) = "record"
	return nil
}
