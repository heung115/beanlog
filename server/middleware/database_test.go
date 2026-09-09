package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestBufferedResponseWriterRejectsOversizedResponses(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	writer := newBufferedResponseWriter(context.Writer)

	written, err := writer.Write(make([]byte, maxBufferedResponseBytes+1))
	if !errors.Is(err, errBufferedResponseTooLarge) {
		t.Fatalf("Write error = %v, want %v", err, errBufferedResponseTooLarge)
	}
	if written != 0 {
		t.Fatalf("Write wrote %d bytes, want 0", written)
	}
	if !writer.Overflowed() {
		t.Fatal("writer did not record overflow")
	}
	if writer.body.Len() != 0 {
		t.Fatalf("writer buffered %d bytes after overflow, want 0", writer.body.Len())
	}
}

type deadlineTx struct {
	pgx.Tx
	statements    []string
	committed     bool
	rolledBack    bool
	failStatement bool
	sessionErr    error
	claims        map[string]string
}

func (tx *deadlineTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if _, ok := ctx.Deadline(); !ok {
		return pgconn.CommandTag{}, errors.New("missing deadline")
	}
	tx.statements = append(tx.statements, sql)
	if len(args) == 2 {
		_ = json.Unmarshal([]byte(args[1].(string)), &tx.claims)
	}
	if sql == "SELECT beanmap_security.require_current_session()" {
		return pgconn.CommandTag{}, tx.sessionErr
	}
	if tx.failStatement {
		return pgconn.CommandTag{}, errors.New("unavailable")
	}
	return pgconn.CommandTag{}, nil
}
func (tx *deadlineTx) Commit(context.Context) error { tx.committed = true; return nil }
func (tx *deadlineTx) Rollback(ctx context.Context) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	tx.rolledBack = true
	return nil
}
func TestRequestDatabaseAppliesTimeoutBeforeHandlerAndIdentity(t *testing.T) {
	tx := &deadlineTx{}
	var acquireCtx context.Context
	r := gin.New()
	r.Use(requestDatabase(func(ctx context.Context) (pgx.Tx, error) {
		acquireCtx = ctx
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 2*time.Second {
			t.Fatal("missing acquire deadline")
		}
		return tx, nil
	}))
	r.GET("/", func(c *gin.Context) {
		if acquireCtx.Err() != context.Canceled {
			t.Fatal("acquire context not released")
		}
		deadline, ok := c.Request.Context().Deadline()
		if !ok || time.Until(deadline) < 10*time.Second {
			t.Fatal("request has wrong lifetime")
		}
		if len(tx.statements) != 5 || tx.statements[0] != "SET LOCAL statement_timeout = '8s'" || tx.statements[2] != "SET LOCAL ROLE beanmap_api_runtime" {
			t.Fatalf("settings: %v", tx.statements)
		}
		c.Status(204)
	})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != 204 || !tx.committed {
		t.Fatal("request did not commit")
	}
}
func TestRequestDatabaseFailsClosedWhenTimeoutCannotBeSet(t *testing.T) {
	tx := &deadlineTx{failStatement: true}
	r := gin.New()
	r.Use(requestDatabase(func(context.Context) (pgx.Tx, error) { return tx, nil }))
	r.GET("/", func(c *gin.Context) { t.Fatal("handler called without timeout") })
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != 503 || !tx.rolledBack || tx.committed {
		t.Fatal("failed setup was not rolled back")
	}
}

func TestRequestDatabaseRejectsRevokedSessionBeforeHandler(t *testing.T) {
	for _, test := range []struct {
		name   string
		err    error
		status int
	}{
		{"revoked", &pgconn.PgError{Code: "28000"}, 401},
		{"unavailable", errors.New("database error"), 503},
	} {
		t.Run(test.name, func(t *testing.T) {
			tx := &deadlineTx{sessionErr: test.err}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set(UserIDKey, "user"); c.Set(SessionIDKey, "session") })
			r.Use(requestDatabase(func(context.Context) (pgx.Tx, error) { return tx, nil }))
			r.GET("/", func(c *gin.Context) { t.Fatal("handler ran without current session") })
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
			if rec.Code != test.status || !tx.rolledBack || tx.committed {
				t.Fatalf("incorrect rejection: %d", rec.Code)
			}
			if tx.claims["sub"] != "user" || tx.claims["session_id"] != "session" || tx.claims["role"] != "authenticated" {
				t.Fatal("verified identity not propagated")
			}
		})
	}
}
