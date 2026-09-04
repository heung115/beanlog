package handlers

import (
	"reflect"
	"strings"
	"testing"
)

func TestBuildUserSubregionsQueryPlacesRegionBeforeLimit(t *testing.T) {
	for _, table := range []string{"beans", "blend_components"} {
		t.Run(table, func(t *testing.T) {
			query, args := buildUserSubregionsQuery(table, "user-1", "Colombia", "Huila")

			want := "SELECT origin_subregions FROM " + table +
				" WHERE user_id = $1 AND origin_country = $2 AND origin_subregions <> '{}'" +
				" AND origin_region = $3 LIMIT 200"
			if query != want {
				t.Fatalf("query = %q, want %q", query, want)
			}
			regionAt := strings.Index(query, " AND origin_region = $3")
			limitAt := strings.Index(query, " LIMIT 200")
			if regionAt == -1 || limitAt == -1 || regionAt > limitAt {
				t.Fatalf("region filter must precede LIMIT: %q", query)
			}
			if wantArgs := []interface{}{"user-1", "Colombia", "Huila"}; !reflect.DeepEqual(args, wantArgs) {
				t.Fatalf("args = %#v, want %#v", args, wantArgs)
			}
		})
	}
}

func TestBuildUserSubregionsQueryWithoutRegion(t *testing.T) {
	for _, table := range []string{"beans", "blend_components"} {
		t.Run(table, func(t *testing.T) {
			query, args := buildUserSubregionsQuery(table, "user-1", "Colombia", "")

			want := "SELECT origin_subregions FROM " + table +
				" WHERE user_id = $1 AND origin_country = $2 AND origin_subregions <> '{}' LIMIT 200"
			if query != want {
				t.Fatalf("query = %q, want %q", query, want)
			}
			if strings.Contains(query, "origin_region = $3") {
				t.Fatalf("query unexpectedly contains a region filter: %q", query)
			}
			if wantArgs := []interface{}{"user-1", "Colombia"}; !reflect.DeepEqual(args, wantArgs) {
				t.Fatalf("args = %#v, want %#v", args, wantArgs)
			}
		})
	}
}
