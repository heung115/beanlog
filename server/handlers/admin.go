package handlers

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"beanmap-server/middleware"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
)

type AdminHandler struct {
	privateIngressDigest  [sha256.Size]byte
	privateIngressEnabled bool
}

const (
	adminCatalogLimit     = 25
	adminMaxCatalogOffset = 100000
)

func NewAdminHandler(privateIngressSecret string) *AdminHandler {
	return &AdminHandler{
		privateIngressDigest:  sha256.Sum256([]byte(privateIngressSecret)),
		privateIngressEnabled: len(privateIngressSecret) >= 32,
	}
}

// NoStore applies even when the access check rejects the request.
func (h *AdminHandler) NoStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Next()
}

// RequirePrivate accepts only requests vouched for by the private web ingress.
// Forwarded addresses, host names, and Tailscale identity headers are not proof.
// The secret is server-to-server only; the user JWT and DB allowlist are still
// required afterwards. An absent or weak configured secret disables all access.
func (h *AdminHandler) RequirePrivate(c *gin.Context) {
	values := c.Request.Header.Values("X-Beanmap-Admin-Secret")
	if !h.privateIngressEnabled || len(values) != 1 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	digest := sha256.Sum256([]byte(values[0]))
	if subtle.ConstantTimeCompare(digest[:], h.privateIngressDigest[:]) != 1 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Next()
}

// RequireAdmin checks the private database allowlist on every request. A JWT
// metadata claim cannot grant this permission, and RLS remains in force.
func (h *AdminHandler) RequireAdmin(c *gin.Context) {
	var allowed bool
	if err := middleware.RequestDB(c).QueryRow(c.Request.Context(),
		"SELECT beanmap_private.beanmap_is_admin()",
	).Scan(&allowed); err != nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "admin access unavailable"})
		return
	}
	if !allowed {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}
	c.Next()
}

func (h *AdminHandler) Access(c *gin.Context) {
	var allowed bool
	if err := middleware.RequestDB(c).QueryRow(c.Request.Context(),
		"SELECT beanmap_private.beanmap_is_admin()",
	).Scan(&allowed); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "admin access unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"is_admin": allowed})
}

type adminOverview struct {
	Users          int64 `json:"users"`
	Beans          int64 `json:"beans"`
	NewUsers30D    int64 `json:"new_users_30d"`
	NewBeans30D    int64 `json:"new_beans_30d"`
	ActiveUsers30D int64 `json:"active_users_30d"`
	Countries      int64 `json:"countries"`
	Regions        int64 `json:"regions"`
	Entities       int64 `json:"entities"`
}

func (h *AdminHandler) Overview(c *gin.Context) {
	var overview adminOverview
	if err := middleware.RequestDB(c).QueryRow(c.Request.Context(),
		`SELECT users, beans, new_users_30d, new_beans_30d, active_users_30d,
		        countries, regions, entities FROM beanmap_private.beanmap_admin_overview()`,
	).Scan(&overview.Users, &overview.Beans, &overview.NewUsers30D,
		&overview.NewBeans30D, &overview.ActiveUsers30D, &overview.Countries,
		&overview.Regions, &overview.Entities); err != nil {
		adminDatabaseError(c, err, "failed to load admin overview")
		return
	}
	c.JSON(http.StatusOK, overview)
}

type adminCatalogItem struct {
	ID      int64   `json:"id"`
	Kind    string  `json:"kind"`
	Name    string  `json:"name"`
	NameKo  *string `json:"name_ko"`
	Country *string `json:"country"`
}

func adminCatalogSource(kind string) (string, bool) {
	switch kind {
	case "country":
		return `SELECT id, name_en AS name, name_ko, NULL::text AS country FROM public.origin_countries`, true
	case "region":
		return `SELECT r.id, r.display_name AS name, r.display_name_ko AS name_ko,
		               c.name_en AS country
		        FROM public.origin_regions r JOIN public.origin_countries c ON c.id = r.country_id
		        WHERE r.is_canonical AND r.display_name IS NOT NULL`, true
	case "entity":
		return `SELECT e.id, e.name, e.name_ko, c.name_en AS country
		        FROM public.origin_entities e JOIN public.origin_countries c ON c.id = e.country_id`, true
	default:
		return "", false
	}
}

func (h *AdminHandler) Catalog(c *gin.Context) {
	kind := c.Query("kind")
	source, valid := adminCatalogSource(kind)
	query := strings.TrimSpace(c.Query("q"))
	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if !valid || utf8.RuneCountInString(query) > 100 || err != nil || offset < 0 || offset > adminMaxCatalogOffset {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog query"})
		return
	}

	// strpos performs a literal substring search: %, _, and backslash have no
	// wildcard meaning, and user input never becomes a SQL fragment.
	filtered := ` FROM (` + source + `) catalog WHERE $1 = ''
		OR strpos(lower(name), lower($1)) > 0
		OR strpos(lower(coalesce(name_ko, '')), lower($1)) > 0
		OR strpos(lower(coalesce(country, '')), lower($1)) > 0`
	db := middleware.RequestDB(c)
	var total int64
	if err := db.QueryRow(c.Request.Context(), "SELECT count(*)"+filtered, query).Scan(&total); err != nil {
		adminDatabaseError(c, err, "failed to query catalog")
		return
	}
	rows, err := db.Query(c.Request.Context(),
		"SELECT id, name, name_ko, country"+filtered+" ORDER BY name, id LIMIT $2 OFFSET $3",
		query, adminCatalogLimit, offset)
	if err != nil {
		adminDatabaseError(c, err, "failed to query catalog")
		return
	}
	defer rows.Close()
	items := []adminCatalogItem{}
	for rows.Next() {
		item := adminCatalogItem{Kind: kind}
		if err := rows.Scan(&item.ID, &item.Name, &item.NameKo, &item.Country); err != nil {
			adminDatabaseError(c, err, "failed to read catalog")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		adminDatabaseError(c, err, "failed to read catalog")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "limit": adminCatalogLimit, "offset": offset})
}

func (h *AdminHandler) UpdateCatalog(c *gin.Context) {
	kind := c.Param("kind")
	_, validKind := adminCatalogSource(kind)
	id, validID := parseOriginIDParam(c, "id")
	var request struct {
		NameKo         *string         `json:"name_ko"`
		ExpectedNameKo json.RawMessage `json:"expected_name_ko"`
		Reason         *string         `json:"reason"`
	}
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if !validKind || !validID || decoder.Decode(&request) != nil || request.NameKo == nil || request.Reason == nil || len(request.ExpectedNameKo) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog update"})
		return
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog update"})
		return
	}
	var expectedNameKo *string
	if err := json.Unmarshal(request.ExpectedNameKo, &expectedNameKo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expected catalog value"})
		return
	}
	nameKo := strings.TrimSpace(*request.NameKo)
	reason := strings.TrimSpace(*request.Reason)
	if utf8.RuneCountInString(nameKo) > 120 || utf8.RuneCountInString(reason) < 3 || utf8.RuneCountInString(reason) > 300 ||
		(expectedNameKo != nil && utf8.RuneCountInString(*expectedNameKo) > 300) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog field length"})
		return
	}
	var updated bool
	if err := middleware.RequestDB(c).QueryRow(c.Request.Context(),
		"SELECT beanmap_private.beanmap_admin_update_catalog($1, $2, $3, $4, $5)",
		kind, id, nameKo, expectedNameKo, reason,
	).Scan(&updated); err != nil {
		adminDatabaseError(c, err, "failed to update catalog")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type adminAuditItem struct {
	ID        int64     `json:"id"`
	Kind      string    `json:"kind"`
	ItemID    int64     `json:"item_id"`
	ItemName  string    `json:"item_name"`
	OldNameKo *string   `json:"old_name_ko"`
	NewNameKo *string   `json:"new_name_ko"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *AdminHandler) Audit(c *gin.Context) {
	rows, err := middleware.RequestDB(c).Query(c.Request.Context(),
		`SELECT id, kind, item_id, item_name, old_name_ko, new_name_ko, reason, created_at
		 FROM beanmap_private.beanmap_admin_audit()`,
	)
	if err != nil {
		adminDatabaseError(c, err, "failed to query catalog history")
		return
	}
	defer rows.Close()
	items := []adminAuditItem{}
	for rows.Next() {
		var item adminAuditItem
		if err := rows.Scan(&item.ID, &item.Kind, &item.ItemID, &item.ItemName,
			&item.OldNameKo, &item.NewNameKo, &item.Reason, &item.CreatedAt); err != nil {
			adminDatabaseError(c, err, "failed to read catalog history")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		adminDatabaseError(c, err, "failed to read catalog history")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func adminDatabaseError(c *gin.Context, err error, fallback string) {
	var databaseError *pgconn.PgError
	if errors.As(err, &databaseError) {
		switch databaseError.Code {
		case "42501":
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		case "22023":
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog update"})
			return
		case "P0002":
			c.JSON(http.StatusNotFound, gin.H{"error": "catalog item not found"})
			return
		case "40001":
			c.JSON(http.StatusConflict, gin.H{"error": "catalog item changed; refresh and try again"})
			return
		}
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
}
