package grpcserver

import (
	"math"
	"strconv"
	"testing"
)

func TestSaturatingInt32(t *testing.T) {
	tests := []struct {
		name  string
		value int
		want  int32
	}{
		{name: "ordinary", value: 42, want: 42},
		{name: "maximum", value: math.MaxInt32, want: math.MaxInt32},
		{name: "minimum", value: math.MinInt32, want: math.MinInt32},
	}
	if strconv.IntSize > 32 {
		tests = append(tests,
			struct {
				name  string
				value int
				want  int32
			}{name: "overflow", value: int(int64(math.MaxInt32) + 1), want: math.MaxInt32},
			struct {
				name  string
				value int
				want  int32
			}{name: "underflow", value: int(int64(math.MinInt32) - 1), want: math.MinInt32},
		)
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := saturatingInt32(test.value); got != test.want {
				t.Fatalf("saturatingInt32(%d) = %d, want %d", test.value, got, test.want)
			}
		})
	}
}

func TestCountEntriesUsesStableKeyTieBreaker(t *testing.T) {
	entries := countEntries(map[string]int{"z": 2, "a": 2, "m": 1}, true)
	if len(entries) != 3 {
		t.Fatalf("len(entries) = %d, want 3", len(entries))
	}
	if entries[0].Key != "a" || entries[1].Key != "z" || entries[2].Key != "m" {
		t.Fatalf("keys = [%s %s %s], want [a z m]", entries[0].Key, entries[1].Key, entries[2].Key)
	}
}
