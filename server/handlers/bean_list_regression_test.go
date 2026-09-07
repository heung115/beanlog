package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"unicode"

	"beanmap-server/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func TestBeanListTreatsSearchWildcardsAsLiteralText(t *testing.T) {
	for _, query := range []string{"100%", "under_score", `back\slash`} {
		t.Run(query, func(t *testing.T) {
			tx, recorder := requestEmptyBeanList(t, "search="+url.QueryEscape(query))
			if recorder.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
			}
			want := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(query) + "%"
			for _, arg := range tx.args[1:] {
				if arg != want {
					t.Fatalf("literal %q search bound as %q, want %q", query, arg, want)
				}
			}
		})
	}
}

func TestBeanListSelectedRoasteryDoesNotUseSubstringPattern(t *testing.T) {
	tx, recorder := requestEmptyBeanList(t, "roastery=QA")
	if recorder.Code != http.StatusOK {
		t.Fatal(recorder.Body.String())
	}
	if len(tx.args) != 2 || tx.args[1] != "QA" || strings.Contains(tx.query, "roastery ILIKE") {
		t.Fatalf("selected QA roastery must use equality, query=%s args=%v", tx.query, tx.args)
	}
}

func TestBeanListExactFiltersTrimTheSameWhitespaceAsOptions(t *testing.T) {
	// Verify all Unicode codepoints, not just common tab/newline examples.
	for r := rune(1); r <= unicode.MaxRune; r++ {
		literal := strings.ToUpper(strconv.FormatInt(int64(r), 16))
		for len(literal) < 4 {
			literal = "0" + literal
		}
		present := strings.Contains(sqlTrimSpaceCharacters, `\`+literal)
		if present != unicode.IsSpace(r) {
			t.Fatalf("SQL/Go whitespace mismatch at U+%04X", r)
		}
	}
	for _, query := range []string{"roastery=QA", "varietal=Geisha"} {
		tx, recorder := requestEmptyBeanList(t, query)
		if recorder.Code != http.StatusOK || !strings.Contains(tx.query, sqlTrimSpaceCharacters) {
			t.Fatalf("exact filter does not apply the option whitespace set: %s", tx.query)
		}
	}
}

func TestBeanListKeepsHalfPointScoreFilters(t *testing.T) {
	tx, recorder := requestEmptyBeanList(t, "score_min=7.5&score_max=8.5")
	if recorder.Code != http.StatusOK {
		t.Fatalf("valid half-point filter rejected: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !reflect.DeepEqual(tx.args, []any{"list-user", 7.5, 8.5}) {
		t.Fatalf("score arguments = %#v", tx.args)
	}
}

func TestBeanListUsesStableOrderingForTies(t *testing.T) {
	for _, sort := range []string{"consumed_at", "overall_score", "name"} {
		tx, recorder := requestEmptyBeanList(t, "sort_by="+sort+"&page=1")
		if recorder.Code != http.StatusOK {
			t.Fatal(recorder.Body.String())
		}
		if !strings.Contains(tx.query, ", b.id") {
			t.Fatalf("%s pagination has no unique ordering: %s", sort, tx.query)
		}
	}
}

func TestBeanListIncludesBlendOriginsAndWholeVarietalAliases(t *testing.T) {
	tx, recorder := requestEmptyBeanList(t, "origin_country=Ethiopia&varietal="+url.QueryEscape("게이샤"))
	if recorder.Code != http.StatusOK {
		t.Fatal(recorder.Body.String())
	}
	if strings.Count(tx.query, "blend_components") < 2 || !strings.Contains(tx.query, "regexp_split_to_table") {
		t.Fatalf("origin and whole-varietal filters must include blend components: %s", tx.query)
	}
	if strings.Count(tx.query, "b.bean_type = 'single_origin'") != 2 || strings.Count(tx.query, "b.bean_type = 'blend'") != 2 {
		t.Fatalf("filters must use the type's active origin/varietal fields: %s", tx.query)
	}
	aliases, ok := tx.args[2].([]string)
	if !ok || !reflect.DeepEqual(aliases, []string{"geisha", "게이샤"}) {
		t.Fatalf("varietal aliases = %#v", tx.args[2])
	}
}

func requestEmptyBeanList(t *testing.T, query string) (*emptyBeanListTx, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/beans?"+query, nil)
	tx := &emptyBeanListTx{}
	c.Set("request_database", tx)
	c.Set(middleware.UserIDKey, "list-user")
	NewBeanHandler().List(c)
	return tx, recorder
}

type emptyBeanListTx struct {
	pgx.Tx
	query string
	args  []any
}

func (tx *emptyBeanListTx) QueryRow(_ context.Context, _ string, args ...any) pgx.Row {
	tx.args = args
	return zeroCountRow{}
}
func (tx *emptyBeanListTx) Query(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
	tx.query = sql
	tx.args = args
	return emptyBeanRows{}, nil
}

type zeroCountRow struct{}

func (zeroCountRow) Scan(dest ...any) error { *dest[0].(*int) = 0; return nil }

type emptyBeanRows struct{ pgx.Rows }

func (emptyBeanRows) Next() bool { return false }
func (emptyBeanRows) Close()     {}
func (emptyBeanRows) Err() error { return nil }

func TestBeanListRejectsOverflowAndExcessiveOffsets(t *testing.T) {
	for _, query := range []string{"page=9223372036854775807&limit=100", "page=1001&limit=100"} {
		tx, rec := requestEmptyBeanList(t, query)
		if rec.Code != 400 || tx.query != "" {
			t.Fatalf("query %s: status %d database query %s", query, rec.Code, tx.query)
		}
	}
	_, rec := requestEmptyBeanList(t, "page=1000&limit=100")
	if rec.Code != 200 {
		t.Fatalf("maximum supported offset rejected: %d", rec.Code)
	}
}
