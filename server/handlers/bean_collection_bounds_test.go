package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestBeanCollectionBoundsOnCreateAndUpdate(t *testing.T) {
	cases := []struct {
		name  string
		patch map[string]any
		valid bool
	}{
		{"precision hidden by float64", map[string]any{"blend_components": []map[string]any{{"origin_country": "A", "percentage": json.RawMessage("33.3300000000000000001")}, {"origin_country": "B", "percentage": json.RawMessage("66.6699999999999999999")}}}, false},
		{"extreme exponent", map[string]any{"blend_components": []map[string]any{{"origin_country": "A", "percentage": json.RawMessage("1e-999999999")}}}, false},
		{"weight zero", map[string]any{"weight_g": 0}, false},
		{"weight too large", map[string]any{"weight_g": 100001}, false},
		{"weight positive", map[string]any{"weight_g": 1}, true},
		{"weight maximum", map[string]any{"weight_g": 100000}, true},
		{"weight string", map[string]any{"weight_g": "1"}, false},
		{"unknown bean field", map[string]any{"extra": true}, false},
		{"subregions null", map[string]any{"origin_subregions": nil}, true},
		{"subregions empty", map[string]any{"origin_subregions": []string{}}, true},
		{"subregions non-array", map[string]any{"origin_subregions": map[string]any{}}, false},
		{"subregions empty item", map[string]any{"origin_subregions": []string{""}}, false},
		{"subregions whitespace item", map[string]any{"origin_subregions": []string{" \t\ufeff"}}, false},
		{"subregions long item", map[string]any{"origin_subregions": []string{strings.Repeat("x", 101)}}, false},
		{"subregions numeric item", map[string]any{"origin_subregions": []any{1}}, false},
		{"tags null", map[string]any{"tags": nil}, false},
		{"components null", map[string]any{"blend_components": nil}, false},
	}
	for _, size := range []int{10, 11} {
		values := make([]string, size)
		for i := range values {
			values[i] = "region"
		}
		cases = append(cases, struct {
			name  string
			patch map[string]any
			valid bool
		}{fmt.Sprintf("subregions %d", size), map[string]any{"origin_subregions": values}, size == 10})
	}
	for _, size := range []int{30, 31} {
		values := make([]map[string]any, size)
		for i := range values {
			values[i] = map[string]any{"tag": fmt.Sprintf("tag%d", i), "category": "sweet"}
		}
		cases = append(cases, struct {
			name  string
			patch map[string]any
			valid bool
		}{fmt.Sprintf("tags %d", size), map[string]any{"tags": values}, size == 30})
	}
	for _, size := range []int{20, 21} {
		values := make([]map[string]any, size)
		for i := range values {
			percentage := 5.0
			if size == 21 {
				percentage = 4.75
				if i == 20 {
					percentage = 5
				}
			}
			values[i] = map[string]any{"origin_country": "Fixture", "percentage": percentage}
		}
		cases = append(cases, struct {
			name  string
			patch map[string]any
			valid bool
		}{fmt.Sprintf("components %d", size), map[string]any{"blend_components": values}, size == 20})
	}
	for _, item := range []struct {
		name  string
		field string
		value any
		valid bool
	}{
		{"sort negative", "sort_order", -1, false}, {"sort maximum", "sort_order", 100, true}, {"sort too large", "sort_order", 101, false}, {"sort fractional", "sort_order", 0.5, false}, {"sort null", "sort_order", nil, false}, {"sort string", "sort_order", "1", false}, {"unknown component", "extra", 1, false}, {"component blank subregion", "origin_subregions", []string{" "}, false}, {"component country boolean", "origin_country", true, false},
	} {
		component := map[string]any{"origin_country": "Fixture", "percentage": 100}
		component[item.field] = item.value
		cases = append(cases, struct {
			name  string
			patch map[string]any
			valid bool
		}{item.name, map[string]any{"blend_components": []any{component}}, item.valid})
	}
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tc := range cases {
			t.Run(method+"/"+tc.name, func(t *testing.T) {
				data := map[string]any{"name": "Fixture", "roastery": "Fixture", "note": "Note", "bean_type": "blend", "process_method": "washed", "roast_level": "light", "place_type": "home", "overall_score": 8, "blend_components": []map[string]any{{"origin_country": "Fixture", "percentage": 100}}}
				for key, value := range tc.patch {
					data[key] = value
				}
				if method == http.MethodPut {
					data["expected_updated_at"] = "2026-09-09T00:00:00Z"
				}
				body, err := json.Marshal(data)
				if err != nil {
					t.Fatal(err)
				}
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				c.Request = httptest.NewRequest(method, "/api/beans/fixture", bytes.NewReader(body))
				c.Request.Header.Set("Content-Type", "application/json")
				c.Params = gin.Params{{Key: "id", Value: "fixture"}}
				tx := &blendPercentageTx{t: t}
				c.Set("request_database", tx)
				if method == http.MethodPost {
					NewBeanHandler().Create(c)
				} else {
					NewBeanHandler().Update(c)
				}
				expected := 400
				if tc.valid {
					expected = 200
					if method == http.MethodPost {
						expected = 201
					}
				}
				if recorder.Code != expected {
					t.Fatalf("status=%d want=%d body=%s", recorder.Code, expected, recorder.Body.String())
				}
				if !tc.valid && tx.calls != 0 {
					t.Fatal("invalid collection reached database")
				}
			})
		}
	}
}
