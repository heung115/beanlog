package middleware

import (
	"errors"
	"net/http/httptest"
	"testing"

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
