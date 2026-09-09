# API resource budgets

The REST API applies these process-local limits before acquiring a database connection:

| Scope | Sustained rate | Burst | Concurrent requests |
| --- | --- | --- | --- |
| Verified user, all API routes | 120/min | 60 | 4 |
| Verified user, stats/export/admin combined | 6/min | 2 | 1 |
| API process | — | — | 32 authenticated requests |

JWT authentication precedes user quotas. The shared web proxy address is not a
client identity and carries no per-IP bucket. User quotas return HTTP 429 with
`Retry-After: 10`; the separate 32-request process capacity guard returns
`global_capacity_exceeded` and `Retry-After: 1`. Invalid JWTs consume neither user
quota nor concurrency slots. These process-local limits are not distributed across
replicas. Quota storage is capped at 10,000 entries and idle entries expire after
ten minutes; capacity exhaustion denies new identities instead of discarding
active limits.

Pool acquisition and transaction begin have a two-second deadline. Each request
transaction has an eight-second PostgreSQL statement timeout, ten-second idle
transaction timeout, and twelve-second overall request context. Settings are
transaction-local and set before switching to `beanmap_api_runtime`; setup failure
rejects the request. Cancellation cleanup has a separate two-second deadline.

Origin autocomplete accepts trimmed country/region strings of at most 100/200
UTF-16 code units, matching the server action. Bean listing permits offsets up to
100,000 and validates before multiplication to prevent integer overflow.

## Database function permissions

The complete migration sequence removes public mutation execution and grants the
three record functions only to the private API runtime role. Required fields,
versions and current sessions are checked inside those routines. Trigger functions
keep their trigger behavior without a public execute grant. DDL owners have denied
function, table and sequence defaults; new objects need explicit reviewed grants.
Unused database-network functions are inaccessible to application/gateway roles.

Run `psql -X -v ON_ERROR_STOP=1 -f scripts/verify-function-acls.sql` against a
configured database connection for read-only verification. The database regression harness rebuilds a disposable database from all migrations, checks every
public function's actual ACL and both owners' defaults, creates future-function
probes, and proves that the checker rejects injected function/default grants.
`scripts/test-function-acls.sh` must only target a disposable database using the
explicit `ACL_TEST_DATABASE_URL`; it creates roles, schemas and fixture objects.
