package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// RowQuerier allows the startup boundary to be exercised against a real
// transaction in tests and the application's connection pool in production.
type RowQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

var ErrUnsafeRole = errors.New("database connection role does not satisfy the API role boundary")

const connectionRoleQuery = `
SELECT
  connector.rolcanlogin AND NOT connector.rolinherit
    AND NOT connector.rolsuper AND NOT connector.rolbypassrls
    AND NOT connector.rolcreaterole AND NOT connector.rolcreatedb
    AND NOT connector.rolreplication
    AND EXISTS (SELECT 1 FROM pg_auth_members m
      WHERE m.member = connector.oid AND m.roleid = runtime.oid)
    AND NOT EXISTS (SELECT 1 FROM pg_auth_members m
      JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE m.member = connector.oid
        AND (granted.rolname NOT IN ('beanmap_api_runtime', 'authenticated')
          OR m.admin_option OR m.inherit_option OR NOT m.set_option)),
  NOT runtime.rolcanlogin AND runtime.rolinherit
    AND NOT runtime.rolsuper AND NOT runtime.rolbypassrls
    AND NOT runtime.rolcreaterole AND NOT runtime.rolcreatedb
    AND NOT runtime.rolreplication
    AND (SELECT count(*) = 1
      AND bool_and(m.roleid = authenticated.oid AND NOT m.admin_option
        AND m.inherit_option AND m.set_option)
      FROM pg_auth_members m WHERE m.member = runtime.oid)
    AND NOT authenticated.rolcanlogin
    AND NOT authenticated.rolsuper AND NOT authenticated.rolbypassrls
    AND NOT authenticated.rolcreaterole AND NOT authenticated.rolcreatedb
    AND NOT authenticated.rolreplication
    AND NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = authenticated.oid),
  NOT EXISTS (
    SELECT 1 FROM pg_class relation JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    CROSS JOIN (VALUES (connector.oid), (runtime.oid)) checked(role_id)
    WHERE schema.nspname = 'auth' AND relation.relname IN ('users', 'sessions')
      AND (has_any_column_privilege(checked.role_id, relation.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
        OR has_table_privilege(checked.role_id, relation.oid, 'DELETE,TRUNCATE,TRIGGER'))
  )
FROM pg_roles connector
JOIN pg_roles runtime ON runtime.rolname = 'beanmap_api_runtime'
JOIN pg_roles authenticated ON authenticated.rolname = 'authenticated'
WHERE connector.rolname = current_user`

// VerifyConnectionRole requires explicit SET ROLE into the private runtime.
// The legacy authenticated SET-only grant is harmless and is accepted during
// upgrades; neither membership may expose privileges before a request starts.
func VerifyConnectionRole(ctx context.Context, query RowQuerier) error {
	var connectorSafe, runtimeSafe, authTablesPrivate bool
	if err := query.QueryRow(ctx, connectionRoleQuery).Scan(&connectorSafe, &runtimeSafe, &authTablesPrivate); err != nil {
		return err
	}
	if !connectorSafe || !runtimeSafe || !authTablesPrivate {
		return ErrUnsafeRole
	}
	return nil
}
