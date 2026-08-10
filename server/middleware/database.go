package middleware

import (
	"bytes"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	requestDatabaseKey       = "request_database"
	maxBufferedResponseBytes = 8 << 20
)

var errBufferedResponseTooLarge = errors.New("buffered response exceeds limit")

// bufferedResponseWriter keeps the response private until the request's
// database transaction commits. API handlers do not stream or hijack
// connections, so buffering is both bounded by their small JSON responses and
// prevents a successful response from escaping before a failed commit.
type bufferedResponseWriter struct {
	gin.ResponseWriter
	header     http.Header
	body       bytes.Buffer
	status     int
	size       int
	overflowed bool
}

func newBufferedResponseWriter(writer gin.ResponseWriter) *bufferedResponseWriter {
	header := writer.Header().Clone()
	return &bufferedResponseWriter{
		ResponseWriter: writer,
		header:         header,
		status:         http.StatusOK,
		size:           -1,
	}
}

func (writer *bufferedResponseWriter) Header() http.Header {
	return writer.header
}

func (writer *bufferedResponseWriter) WriteHeader(status int) {
	if status > 0 && !writer.Written() {
		writer.status = status
	}
}

func (writer *bufferedResponseWriter) WriteHeaderNow() {
	if !writer.Written() {
		writer.size = 0
	}
}

func (writer *bufferedResponseWriter) Write(data []byte) (int, error) {
	writer.WriteHeaderNow()
	if writer.overflowed || len(data) > maxBufferedResponseBytes-writer.body.Len() {
		writer.overflowed = true
		writer.body.Reset()
		return 0, errBufferedResponseTooLarge
	}
	written, err := writer.body.Write(data)
	writer.size += written
	return written, err
}

func (writer *bufferedResponseWriter) WriteString(value string) (int, error) {
	return writer.Write([]byte(value))
}

func (writer *bufferedResponseWriter) Status() int {
	return writer.status
}

func (writer *bufferedResponseWriter) Size() int {
	return writer.size
}

func (writer *bufferedResponseWriter) Written() bool {
	return writer.size >= 0
}

func (writer *bufferedResponseWriter) Flush() {
	writer.WriteHeaderNow()
}

func (writer *bufferedResponseWriter) Overflowed() bool {
	return writer.overflowed
}

func (writer *bufferedResponseWriter) flushTo(destination gin.ResponseWriter) error {
	destinationHeader := destination.Header()
	for key := range destinationHeader {
		destinationHeader.Del(key)
	}
	for key, values := range writer.header {
		for _, value := range values {
			destinationHeader.Add(key, value)
		}
	}
	destination.WriteHeader(writer.status)
	if writer.body.Len() == 0 {
		destination.WriteHeaderNow()
		return nil
	}
	_, err := destination.Write(writer.body.Bytes())
	return err
}

// RequestDatabase lowers the privileged connection to the authenticated role
// for exactly one request and supplies auth.uid() from the already-verified JWT
// subject. Every handler query is therefore enforced by PostgreSQL RLS even if
// an application-level user_id predicate is accidentally omitted.
func RequestDatabase(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		tx, err := pool.Begin(ctx)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
			return
		}
		committed := false
		originalWriter := c.Writer
		defer func() {
			c.Writer = originalWriter
			if !committed {
				_ = tx.Rollback(ctx)
			}
		}()

		if _, err := tx.Exec(ctx, "SET LOCAL ROLE authenticated"); err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
			return
		}
		if _, err := tx.Exec(ctx,
			`SELECT set_config('request.jwt.claim.sub', $1, true),
			        set_config('request.jwt.claim.role', 'authenticated', true)`,
			c.GetString(UserIDKey),
		); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid identity"})
			return
		}

		buffered := newBufferedResponseWriter(originalWriter)
		c.Writer = buffered
		c.Set(requestDatabaseKey, tx)
		c.Next()
		c.Writer = originalWriter
		if buffered.Overflowed() {
			_ = tx.Rollback(ctx)
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "response too large"})
			return
		}

		if buffered.Status() >= http.StatusBadRequest {
			_ = tx.Rollback(ctx)
			if err := buffered.flushTo(originalWriter); err != nil {
				c.Abort()
			}
			return
		}
		if err := tx.Commit(ctx); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "database transaction failed"})
			return
		}
		committed = true
		if err := buffered.flushTo(originalWriter); err != nil {
			c.Abort()
		}
	}
}

func RequestDB(c *gin.Context) pgx.Tx {
	value, exists := c.Get(requestDatabaseKey)
	if !exists {
		panic("authenticated handler called without request database transaction")
	}
	tx, ok := value.(pgx.Tx)
	if !ok {
		panic("invalid request database transaction")
	}
	return tx
}
