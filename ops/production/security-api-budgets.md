# API resource budgets

The REST API applies these process-local limits before acquiring a database connection:

| Scope | Sustained rate | Burst | Concurrent requests |
| --- | --- | --- | --- |
| Connecting IP, all API routes | 600/min | 120 | — |
| Connecting IP, stats/export/admin combined | 120/min | 20 | — |
| Verified user, all API routes | 120/min | 60 | 4 |
| Verified user, stats/export/admin combined | 6/min | 2 | 1 |
| API process | — | — | 32 authenticated requests |

Budgets return HTTP 429 with `Retry-After: 10`. IP identity uses the connecting
peer; forwarded headers are not trusted. With server-side forwarding, multiple
users can share the web server's IP quota. User limits still distinguish their
verified JWT identities. Retain a shared ingress limit if adding API replicas;
these in-memory quotas are not distributed. Quota storage is capped at 10,000
entries and idle entries expire after ten minutes; capacity exhaustion denies new
identities instead of discarding active limits.

Pool acquisition and transaction begin have a two-second deadline. Each request
transaction has an eight-second PostgreSQL statement timeout, ten-second idle
transaction timeout, and twelve-second overall request context. Settings are
transaction-local and set before switching to `authenticated`; setup failure
rejects the request. Cancellation cleanup has a separate two-second deadline.

Origin autocomplete accepts trimmed country/region strings of at most 100/200
UTF-16 code units, matching the server action. Bean listing permits offsets up to
100,000 and validates before multiplication to prevent integer overflow.

## Database function permissions

Apply migration `00028_function_execution_allowlist.sql` with a database operator
that can alter default privileges for both `postgres` and `supabase_admin`.
It revokes global and public-schema default execution, then restricts existing
public functions to four explicitly granted authenticated RPCs. Trigger functions
continue to run from their existing triggers without a direct RPC execute grant.
Public extension routines also lose execution grants: this application uses
PostgreSQL built-ins and does not require public extension RPCs. Any future
required function must be reviewed and added to both migration grants and the
checker allowlist.

Run `psql -X -v ON_ERROR_STOP=1 -f scripts/verify-function-acls.sql` against a
configured database connection for read-only verification. The separate Database
security CI job rebuilds a disposable database from all migrations, checks every
public function's actual ACL and both owners' defaults, creates future-function
probes, and proves that the checker rejects injected function/default grants.
`scripts/test-function-acls.sh` must only target a disposable database using the
explicit `ACL_TEST_DATABASE_URL`; it creates roles, schemas and fixture objects.
