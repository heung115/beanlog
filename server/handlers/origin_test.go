package handlers

import (
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"net/url"
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

func TestAutocompleteRejectsOversizedQueriesBeforeDatabaseAccess(t *testing.T) {
	for _, query := range []string{
		"country=" + url.QueryEscape(strings.Repeat("한", 101)),
		"country=Colombia&region=" + url.QueryEscape(strings.Repeat("😀", 101)),
	} {
		r := gin.New()
		r.Use(func(c *gin.Context) { c.Set("request_database", &emptyBeanListTx{}) })
		r.GET("/", NewOriginHandler().UserSubregions)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest("GET", "/?"+query, nil))
		if rec.Code != 400 {
			t.Fatalf("oversized query returned %d", rec.Code)
		}
	}
}

func TestOriginContactDisplayFiltering(t *testing.T) {
	for _, value := range []string{"fixture@example.test", "+1 (202) 555-0100", "연락처", "contact", "123 4567"} {
		if cleanEntityName(&value) != nil {
			t.Fatal("contact-only label leaked")
		}
	}
	for value, want := range map[string]string{"Valid Farm | fixture@example.test": "Valid Farm", "Lot 42": "Lot 42"} {
		got := cleanEntityName(&value)
		if got == nil || *got != want {
			t.Fatal("valid origin label removed")
		}
	}
}
