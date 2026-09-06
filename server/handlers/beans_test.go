package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"beanmap-server/middleware"
	"beanmap-server/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestBeanMutationsValidateBlendPercentagePrecision(t *testing.T) {
	tests := []struct {
		name        string
		percentages []float64
		valid       bool
	}{
		{name: "whole numbers", percentages: []float64{40, 60}, valid: true},
		{name: "one decimal", percentages: []float64{33.3, 66.7}, valid: true},
		{name: "two decimals with binary rounding", percentages: []float64{1.13, 98.87}, valid: true},
		{name: "smallest stored unit", percentages: []float64{0.01, 99.99}, valid: true},
		{name: "three decimals", percentages: []float64{33.333, 66.667}},
		{name: "later component has three decimals", percentages: []float64{50, 25.001, 24.999}},
		{name: "below stored unit", percentages: []float64{0.001, 99.999}},
	}
	handler := NewBeanHandler()
	mutations := []struct {
		name       string
		method     string
		handle     gin.HandlerFunc
		wantStatus int
	}{
		{name: "create", method: http.MethodPost, handle: handler.Create, wantStatus: http.StatusCreated},
		{name: "update", method: http.MethodPut, handle: handler.Update, wantStatus: http.StatusOK},
	}
	for _, mutation := range mutations {
		for _, test := range tests {
			t.Run(mutation.name+"/"+test.name, func(t *testing.T) {
				components := make([]models.BlendComponentInput, len(test.percentages))
				for i, percentage := range test.percentages {
					components[i] = models.BlendComponentInput{OriginCountry: "Ethiopia", Percentage: percentage}
				}
				body, err := json.Marshal(models.CreateBeanRequest{
					Name: "House Blend", Roastery: "Test Roastery", BeanType: "blend",
					ProcessMethod: "washed", RoastLevel: "medium", PlaceType: "home",
					OverallScore: 8, BlendComponents: components,
				})
				if err != nil {
					t.Fatal(err)
				}
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				c.Request = httptest.NewRequest(mutation.method, "/api/beans/test-bean", bytes.NewReader(body))
				c.Request.Header.Set("Content-Type", "application/json")
				c.Params = gin.Params{{Key: "id", Value: "test-bean"}}
				tx := &blendPercentageTx{t: t}
				c.Set("request_database", tx)

				mutation.handle(c)

				wantStatus := http.StatusBadRequest
				if test.valid {
					wantStatus = mutation.wantStatus
				}
				if recorder.Code != wantStatus {
					t.Fatalf("status = %d, want %d; body = %s", recorder.Code, wantStatus, recorder.Body.String())
				}
				if !test.valid {
					if tx.calls != 0 {
						t.Fatalf("invalid precision reached the database %d time(s)", tx.calls)
					}
					return
				}
				if tx.calls != 1 || !reflect.DeepEqual(tx.percentages, test.percentages) {
					t.Fatalf("database calls = %d, percentages = %v; want one call preserving %v", tx.calls, tx.percentages, test.percentages)
				}
			})
		}
	}
}

type blendPercentageTx struct {
	pgx.Tx
	t           *testing.T
	calls       int
	percentages []float64
}

func (tx *blendPercentageTx) QueryRow(_ context.Context, _ string, args ...any) pgx.Row {
	tx.t.Helper()
	tx.calls++
	var components []models.BlendComponentInput
	if err := json.Unmarshal([]byte(args[len(args)-1].(string)), &components); err != nil {
		tx.t.Fatal(err)
	}
	for _, component := range components {
		tx.percentages = append(tx.percentages, component.Percentage)
	}
	return blendPercentageRow{}
}

type blendPercentageRow struct{}

func (blendPercentageRow) Scan(dest ...any) error {
	*dest[0].(*string) = "test-bean"
	return nil
}

func TestFilterOptionsKeepsRoasteriesWhenBlendOriginIsNull(t *testing.T) {
	tests := []struct {
		name string
		rows [][][]byte
		want models.BeanFilterOptions
	}{
		{
			name: "blend only",
			rows: [][][]byte{{nil, []byte(" House Roastery "), []byte("")}},
			want: models.BeanFilterOptions{
				Origins: []string{}, Roasteries: []string{"House Roastery"}, Varietals: []string{},
			},
		},
		{
			name: "blend before single origins",
			rows: [][][]byte{
				{nil, []byte("House Roastery"), []byte("")},
				{[]byte("Ethiopia"), []byte("Single Roastery"), []byte("Heirloom")},
				{[]byte("Colombia"), []byte("Single Roastery"), []byte("Castillo, Caturra")},
			},
			want: models.BeanFilterOptions{
				Origins:    []string{"Colombia", "Ethiopia"},
				Roasteries: []string{"House Roastery", "Single Roastery"},
				Varietals:  []string{"Castillo", "Caturra", "Heirloom"},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/beans/filter-options", nil)
			c.Set(middleware.UserIDKey, "filter-user")
			c.Set("request_database", &filterOptionsTx{t: t, rows: &filterOptionsRows{values: test.rows}})

			NewBeanHandler().FilterOptions(c)

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
			var got models.BeanFilterOptions
			if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("filter options = %#v, want %#v", got, test.want)
			}
		})
	}
}

type filterOptionsTx struct {
	pgx.Tx
	t    *testing.T
	rows *filterOptionsRows
}

func (tx *filterOptionsTx) Query(_ context.Context, _ string, args ...any) (pgx.Rows, error) {
	tx.t.Helper()
	if !reflect.DeepEqual(args, []any{"filter-user"}) {
		tx.t.Fatalf("query user args = %#v, want caller filter-user", args)
	}
	return tx.rows, nil
}

type filterOptionsRows struct {
	pgx.Rows
	values [][][]byte
	index  int
	closed bool
}

func (rows *filterOptionsRows) Close() { rows.closed = true }

func (rows *filterOptionsRows) Next() bool {
	if rows.closed || rows.index >= len(rows.values) {
		return false
	}
	rows.index++
	return true
}

func (rows *filterOptionsRows) Scan(dest ...any) error {
	fields := []pgconn.FieldDescription{
		{DataTypeOID: pgtype.TextOID, Format: pgtype.TextFormatCode},
		{DataTypeOID: pgtype.TextOID, Format: pgtype.TextFormatCode},
		{DataTypeOID: pgtype.TextOID, Format: pgtype.TextFormatCode},
	}
	// Use pgx's decoder so a NULL cannot silently scan into a Go string.
	err := pgx.ScanRow(pgtype.NewMap(), fields, rows.values[rows.index-1], dest...)
	if err != nil {
		rows.Close()
	}
	return err
}
