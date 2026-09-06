package handlers

import (
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
