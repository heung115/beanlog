package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// Valid IDs from two countries and two canonical groups must be resolved before
// either mutation RPC. Browser labels never override catalog names.
func TestBeanMutationsEnforceOriginCatalogHierarchy(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, scenario := range []struct {
			name           string
			region, entity int64
			wantError      string
		}{
			{"country A with canonical region B", 20, 200, "invalid origin region"},
			{"country A region A with entity B", 10, 200, "invalid farm or producer"},
			{"alias cannot be selected as canonical", 11, 100, "invalid origin region"},
			{"entity in another canonical group", 10, 120, "invalid farm or producer"},
			{"entity alias points to another group", 10, 130, "invalid farm or producer"},
			{"entity without catalog region", 10, 140, "invalid farm or producer"},
			{"entity requires selected region", 0, 100, "select an origin region first"},
			{"canonical entity uses catalog names", 10, 100, ""},
			{"alias in selected canonical group is valid", 10, 110, ""},
		} {
			t.Run(method+"/"+scenario.name, func(t *testing.T) {
				data := map[string]any{
					"name": "Fixture coffee", "roastery": "Fixture", "bean_type": "single_origin",
					"process_method": "washed", "roast_level": "light", "place_type": "home", "overall_score": 8,
					"origin_country_id": int64(1), "origin_country": "Untrusted country label",
					"origin_region_id": scenario.region, "origin_region": "Untrusted region label",
					"origin_entity_id": scenario.entity, "farm_producer": "Untrusted producer label",
				}
				if method == http.MethodPut {
					data["expected_updated_at"] = "2026-09-09T00:00:00.123456Z"
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
				tx := newOriginCatalogTx(t)
				c.Set("request_database", tx)
				if method == http.MethodPost {
					NewBeanHandler().Create(c)
				} else {
					NewBeanHandler().Update(c)
				}
				if scenario.wantError != "" {
					if recorder.Code != http.StatusBadRequest {
						t.Fatalf("status=%d want=400 body=%s", recorder.Code, recorder.Body.String())
					}
					var response map[string]string
					if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
						t.Fatal(err)
					}
					if response["error"] != scenario.wantError {
						t.Fatalf("error=%q want=%q", response["error"], scenario.wantError)
					}
					if tx.mutations != 0 {
						t.Fatal("inconsistent catalog IDs reached a mutation RPC")
					}
					return
				}
				expectedStatus := http.StatusCreated
				if method == http.MethodPut {
					expectedStatus = http.StatusOK
				}
				if recorder.Code != expectedStatus || tx.mutations != 1 {
					t.Fatalf("status=%d mutations=%d body=%s", recorder.Code, tx.mutations, recorder.Body.String())
				}
				for key, expected := range map[string]any{"origin_country": "Country A", "origin_country_id": float64(1), "origin_region": "Region A", "origin_region_id": float64(10), "farm_producer": tx.entities[scenario.entity].name, "origin_entity_id": float64(scenario.entity)} {
					if tx.saved[key] != expected {
						t.Fatalf("%s=%v want=%v", key, tx.saved[key], expected)
					}
				}
			})
		}
	}
}

type mutationCatalogRegion struct {
	country   int64
	name      string
	canonical *int64
}
type mutationCatalogEntity struct {
	country int64
	region  *int64
	name    string
}
type originCatalogTx struct {
	pgx.Tx
	t         *testing.T
	regions   map[int64]mutationCatalogRegion
	entities  map[int64]mutationCatalogEntity
	mutations int
	saved     map[string]any
}

func newOriginCatalogTx(t *testing.T) *originCatalogTx {
	id := func(value int64) *int64 { return &value }
	return &originCatalogTx{
		t: t,
		regions: map[int64]mutationCatalogRegion{
			10: {1, "Region A", id(10)},
			11: {1, "Alias A", id(10)},
			12: {1, "Other group A", id(12)},
			13: {1, "Alias other group A", id(12)},
			20: {2, "Region B", id(20)},
		},
		entities: map[int64]mutationCatalogEntity{
			100: {1, id(10), "Canonical producer"},
			110: {1, id(11), "Alias producer"},
			120: {1, id(12), "Other producer"},
			130: {1, id(13), "Other alias producer"},
			140: {1, nil, "No-region producer"},
			200: {2, id(20), "Foreign producer"},
		},
	}
}
func (tx *originCatalogTx) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	tx.t.Helper()
	switch {
	case strings.Contains(sql, "FROM origin_countries"):
		if args[0] == int64(1) {
			return originCatalogRow{values: []any{int64(1), "Country A"}}
		}
	case strings.Contains(sql, "SELECT id, display_name, canonical_region_id"):
		if !strings.Contains(sql, "AND country_id = $2") || len(args) != 2 {
			tx.t.Fatal("region query lost country boundary")
		}
		region, ok := tx.regions[args[0].(int64)]
		if ok && region.country == args[1].(int64) {
			return originCatalogRow{values: []any{args[0], region.name, region.canonical}}
		}
	case strings.Contains(sql, "FROM origin_entities"):
		if !strings.Contains(sql, "AND country_id = $2") || len(args) != 2 {
			tx.t.Fatal("entity query lost country boundary")
		}
		entity, ok := tx.entities[args[0].(int64)]
		if ok && entity.country == args[1].(int64) {
			return originCatalogRow{values: []any{args[0], entity.region, entity.name}}
		}
	case strings.Contains(sql, "SELECT canonical_region_id FROM origin_regions"):
		if region, ok := tx.regions[args[0].(int64)]; ok {
			return originCatalogRow{values: []any{region.canonical}}
		}
	case strings.Contains(sql, "public.create_bean_record") || strings.Contains(sql, "public.update_bean_record"):
		tx.mutations++
		payloadIndex := 0
		if strings.Contains(sql, "public.update_bean_record") {
			payloadIndex = 1
		}
		if err := json.Unmarshal([]byte(args[payloadIndex].(string)), &tx.saved); err != nil {
			tx.t.Fatal(err)
		}
		return originCatalogRow{values: []any{"fixture"}}
	default:
		tx.t.Fatalf("unexpected origin query: %s", sql)
	}
	return originCatalogRow{err: pgx.ErrNoRows}
}

type originCatalogRow struct {
	values []any
	err    error
}

func (row originCatalogRow) Scan(dest ...any) error {
	if row.err != nil {
		return row.err
	}
	for index, value := range row.values {
		reflect.ValueOf(dest[index]).Elem().Set(reflect.ValueOf(value))
	}
	return nil
}
