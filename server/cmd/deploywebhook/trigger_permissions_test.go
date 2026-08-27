package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReplaceFileAllowsDeploymentGroupToReadTrigger(t *testing.T) {
	path := filepath.Join(t.TempDir(), "request")
	if err := replaceFile(path, []byte("trigger\n")); err != nil {
		t.Fatalf("replace trigger file: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat trigger file: %v", err)
	}
	if got, want := info.Mode().Perm(), os.FileMode(0o640); got != want {
		t.Fatalf("trigger permissions = %04o, want %04o", got, want)
	}
}
