#!/usr/bin/env bash
# Beanlog security/quality audit harness.
# The persistent report never includes environment values, tokens, matched
# secret text, database URLs, or raw scanner output.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/.audit-report.md"
RUNTIME=0
[[ "${1:-}" == "--runtime" ]] && RUNTIME=1

GIT_COMMON_DIR="$(git -C "$ROOT" rev-parse --git-common-dir)"
STAGING_RUNTIME_INFO="$(cd "$ROOT" && node --input-type=module - "$ROOT" "$GIT_COMMON_DIR" <<'NODE'
import path from "node:path";
import { deriveStagingRuntime } from "./scripts/staging-runtime.mjs";

const root = path.resolve(process.argv[2]);
const gitCommonDir = path.resolve(root, process.argv[3]);
const runtime = deriveStagingRuntime({ root, gitCommonDir });
console.log([
  runtime.runtimeRoot,
  runtime.composeProject,
  runtime.supabaseProject,
  runtime.web,
  runtime.api,
].join("\t"));
NODE
)"
IFS=$'\t' read -r STAGING_RUNTIME_ROOT STAGING_COMPOSE_PROJECT STAGING_SUPABASE_PROJECT STAGING_WEB_PORT STAGING_API_PORT <<< "$STAGING_RUNTIME_INFO"
STAGING_ENV_FILE="$STAGING_RUNTIME_ROOT/docker.env"
STAGING_WEB_CONTAINER="${STAGING_COMPOSE_PROJECT}-web-1"
STAGING_API_CONTAINER="${STAGING_COMPOSE_PROJECT}-api-1"
STAGING_DB_CONTAINER="supabase_db_${STAGING_SUPABASE_PROJECT}"
STAGING_SUPABASE_NETWORK="supabase_network_${STAGING_SUPABASE_PROJECT}"

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/beanlog-audit.XXXXXX")"
chmod 700 "$TMP_ROOT"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT INT TERM

cd "$ROOT"
declare -i C_CRIT=0 C_HIGH=0 C_MED=0 C_LOW=0 C_INFO=0 C_OK=0

: > "$REPORT"
chmod 600 "$REPORT"
printf '# Beanlog Audit Report — %s\n\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$REPORT"
printf '> Secret values and raw scanner matches are intentionally excluded.\n' >> "$REPORT"

finding() {
  local sev="$1" category="$2" message="$3" detail="${4:-}"
  case "$sev" in
    CRITICAL) C_CRIT+=1 ;;
    HIGH) C_HIGH+=1 ;;
    MEDIUM) C_MED+=1 ;;
    LOW) C_LOW+=1 ;;
    INFO) C_INFO+=1 ;;
    OK) C_OK+=1 ;;
  esac
  printf -- '- **[%s]** `%s` — %s\n' "$sev" "$category" "$message" >> "$REPORT"
  [[ -n "$detail" ]] && printf '  - %s\n' "$detail" >> "$REPORT"
  # Callers use `condition && finding OK || finding HIGH`. A finding without
  # detail must still report success, otherwise both branches are recorded.
  return 0
}

section() { printf '\n## %s\n\n' "$1" >> "$REPORT"; }

file_mode() {
  stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1" 2>/dev/null || printf 'unknown'
}

json_vulnerability_counts() {
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const counts = data.metadata?.vulnerabilities ?? {};
    console.log(["critical", "high", "moderate", "low", "info"]
      .map((key) => Number(counts[key] ?? 0)).join(" "));
  ' "$1" 2>/dev/null
}

section "1. Secrets and environment files"

# Scan only files that are eligible for Git. Ignored env files are never read.
git ls-files --cached --others --exclude-standard -z > "$TMP_ROOT/git-files.zlist"
SECRET_PATHS="$TMP_ROOT/secret-paths.txt"
: > "$SECRET_PATHS"
SECRET_PATTERN='(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|GOCSPX-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk_live_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)'
while IFS= read -r -d '' file; do
  [[ "$file" == "scripts/audit.sh" || "$file" == "package-lock.json" ]] && continue
  if [[ -f "$file" ]] && LC_ALL=C rg -I -l -e "$SECRET_PATTERN" -- "$file" >/dev/null 2>&1; then
    printf '%s\n' "$file" >> "$SECRET_PATHS"
  fi
done < "$TMP_ROOT/git-files.zlist"
if [[ -s "$SECRET_PATHS" ]]; then
  finding "CRITICAL" "secrets/current" "Git-eligible files contain secret-shaped values" "Files only: $(sort -u "$SECRET_PATHS" | tr '\n' ' ')"
else
  finding "OK" "secrets/current" "No secret-shaped values in Git-eligible files"
fi

TRACKED_SENSITIVE="$TMP_ROOT/tracked-sensitive.txt"
git ls-files | LC_ALL=C rg -i '(^|/)(\.env($|\.)|[^/]*(secret|credential)[^/]*|[^/]+\.(pem|p12|pfx|key))$' \
  | LC_ALL=C rg -v '(^|/)\.env\.example$' \
  | LC_ALL=C rg -v '^(scripts/staging-credentials\.mjs|tests/staging-credentials\.test\.mjs)$' \
  > "$TRACKED_SENSITIVE" || true
if [[ -s "$TRACKED_SENSITIVE" ]]; then
  finding "HIGH" "secrets/tracked-files" "Sensitive file names are tracked by Git" "Paths only: $(tr '\n' ' ' < "$TRACKED_SENSITIVE")"
else
  finding "OK" "secrets/tracked-files" "No sensitive file names tracked by Git"
fi

# Inspect only metadata for local ignored secret files; never read contents.
declare -i IGNORED_COUNT=0
BAD_LOCAL_PATHS="$TMP_ROOT/bad-local-secret-paths.txt"
: > "$BAD_LOCAL_PATHS"
while IFS= read -r -d '' file; do
  [[ "$file" == "./.env.example" ]] && continue
  IGNORED_COUNT+=1
  relative="${file#./}"
  mode="$(file_mode "$file")"
  if ! git check-ignore -q -- "$relative" || git ls-files --error-unmatch "$relative" >/dev/null 2>&1 || [[ "$mode" != "600" ]]; then
    printf '%s\n' "$relative" >> "$BAD_LOCAL_PATHS"
  fi
done < <(find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './.next' -prune -o \
  -path './.staging/supabase' -prune -o \
  -type f \( -name '.env' -o -name '.env.*' -o -name '*.env' -o -name '*.secret' -o -name '*client_secret*.json' -o -name '*.pem' -o -name '*.key' \) \
  -print0)
if [[ -s "$BAD_LOCAL_PATHS" ]]; then
  finding "HIGH" "secrets/local-files" "Local secret files are tracked, unignored, or not mode 0600" "Paths only: $(tr '\n' ' ' < "$BAD_LOCAL_PATHS")"
else
  finding "OK" "secrets/local-files" "$IGNORED_COUNT local secret files are ignored and mode 0600"
fi

# Full-history scanner. The report is redacted and deleted with TMP_ROOT.
GITLEAKS_JSON="$TMP_ROOT/gitleaks.json"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --redact --no-banner --report-format json --report-path "$GITLEAKS_JSON" "$ROOT" >/dev/null 2>&1
  GITLEAKS_STATUS=$?
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker run --rm -v "$ROOT:/repo:ro" -v "$TMP_ROOT:/out" \
    zricethezav/gitleaks:v8.30.1 git --redact --no-banner \
    --report-format json --report-path /out/gitleaks.json /repo >/dev/null 2>&1
  GITLEAKS_STATUS=$?
else
  GITLEAKS_STATUS=127
fi
if [[ "$GITLEAKS_STATUS" -eq 0 ]]; then
  finding "OK" "secrets/history" "Gitleaks found no potential secret in Git history"
elif [[ "$GITLEAKS_STATUS" -eq 1 && -s "$GITLEAKS_JSON" ]]; then
  GITLEAKS_COUNT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$GITLEAKS_JSON" 2>/dev/null || printf '?')"
  finding "MEDIUM" "secrets/history" "Gitleaks found $GITLEAKS_COUNT redacted historical candidates" "Review classification before publishing history; no matched values were persisted."
else
  finding "INFO" "secrets/history" "Gitleaks could not run" "Install gitleaks or start Docker."
fi

section "2. Dependency and compiler security"

npm audit --omit=dev --json > "$TMP_ROOT/npm-runtime.json" 2> "$TMP_ROOT/npm-runtime.err"
NPM_RUNTIME_STATUS=$?
if COUNTS="$(json_vulnerability_counts "$TMP_ROOT/npm-runtime.json")"; then
  read -r N_CRIT N_HIGH N_MOD N_LOW N_INFO <<< "$COUNTS"
  [[ "$N_CRIT" -gt 0 ]] && finding "CRITICAL" "npm/runtime" "$N_CRIT critical production dependency vulnerabilities"
  [[ "$N_HIGH" -gt 0 ]] && finding "HIGH" "npm/runtime" "$N_HIGH high production dependency vulnerabilities"
  [[ "$N_MOD" -gt 0 ]] && finding "MEDIUM" "npm/runtime" "$N_MOD moderate production dependency vulnerabilities"
  [[ "$N_LOW" -gt 0 ]] && finding "LOW" "npm/runtime" "$N_LOW low production dependency vulnerabilities"
  [[ $((N_CRIT + N_HIGH + N_MOD + N_LOW)) -eq 0 ]] && finding "OK" "npm/runtime" "npm production dependency audit is clean"
else
  finding "HIGH" "npm/runtime" "npm audit result could not be parsed (exit $NPM_RUNTIME_STATUS)"
fi

npm audit --json > "$TMP_ROOT/npm-all.json" 2> "$TMP_ROOT/npm-all.err"
if ALL_COUNTS="$(json_vulnerability_counts "$TMP_ROOT/npm-all.json")"; then
  read -r A_CRIT A_HIGH A_MOD A_LOW A_INFO <<< "$ALL_COUNTS"
  if [[ $((A_CRIT + A_HIGH + A_MOD + A_LOW)) -gt 0 ]]; then
    finding "INFO" "npm/development" "Development dependency findings: critical=$A_CRIT high=$A_HIGH moderate=$A_MOD low=$A_LOW"
  else
    finding "OK" "npm/development" "Full npm dependency audit is clean"
  fi
fi

if npm audit signatures > "$TMP_ROOT/npm-signatures.out" 2>&1; then
  finding "OK" "npm/signatures" "npm registry signatures and attestations verified"
else
  finding "MEDIUM" "npm/signatures" "npm package signature verification failed"
fi

if npm ci > "$TMP_ROOT/npm-ci.out" 2>&1; then
  finding "OK" "build/npm-ci" "Clean npm install succeeded"
else
  finding "HIGH" "build/npm-ci" "Clean npm install failed"
fi
if npm run typecheck > "$TMP_ROOT/tsc.out" 2>&1; then
  finding "OK" "build/typescript" "TypeScript check passed"
else
  finding "HIGH" "build/typescript" "TypeScript check failed"
fi
if npm run lint > "$TMP_ROOT/lint.out" 2>&1; then
  finding "OK" "build/lint" "ESLint passed"
else
  finding "HIGH" "build/lint" "ESLint failed"
fi
if npm run test:node > "$TMP_ROOT/node-test.out" 2>&1; then
  finding "OK" "test/node" "Node unit tests passed"
else
  finding "HIGH" "test/node" "Node unit tests failed"
fi
if npm run design:lint > "$TMP_ROOT/design-lint.out" 2>&1; then
  DESIGN_WARNINGS="$(node -e '
    const text = require("fs").readFileSync(process.argv[1], "utf8");
    const matches = [...text.matchAll(/"warnings":\s*(\d+)/g)];
    console.log(matches.length ? matches.at(-1)[1] : 0);
  ' "$TMP_ROOT/design-lint.out")"
  if [[ "$DESIGN_WARNINGS" -gt 0 ]]; then
    finding "LOW" "build/design" "Design policy checks reported $DESIGN_WARNINGS warnings"
  else
    finding "OK" "build/design" "Design policy checks passed"
  fi
else
  finding "MEDIUM" "build/design" "Design policy checks failed"
fi
if npm run build > "$TMP_ROOT/next-build.out" 2>&1; then
  finding "OK" "build/next" "Production Next.js build passed"
else
  finding "HIGH" "build/next" "Production Next.js build failed"
fi

if (cd server && GOTOOLCHAIN=go1.26.6 go test -race ./...) > "$TMP_ROOT/go-test.out" 2>&1; then
  finding "OK" "go/test" "Go tests passed with race detector"
else
  finding "HIGH" "go/test" "Go tests or race detector failed"
fi
if (cd server && GOTOOLCHAIN=go1.26.6 go vet ./...) > "$TMP_ROOT/go-vet.out" 2>&1; then
  finding "OK" "go/vet" "go vet passed"
else
  finding "HIGH" "go/vet" "go vet failed"
fi
if (cd server && GOTOOLCHAIN=go1.26.6 go build -trimpath -o "$TMP_ROOT/beanlog-server" .) > "$TMP_ROOT/go-build.out" 2>&1; then
  finding "OK" "go/build" "Go production binary built"
else
  finding "HIGH" "go/build" "Go production build failed"
fi
if (cd server && GOTOOLCHAIN=go1.26.6 go run golang.org/x/vuln/cmd/govulncheck@v1.7.0 ./...) > "$TMP_ROOT/govulncheck.out" 2>&1; then
  finding "OK" "go/vulnerability" "No reachable Go vulnerability found"
else
  finding "HIGH" "go/vulnerability" "govulncheck found a reachable vulnerability or failed"
fi
if (cd server && GOTOOLCHAIN=go1.26.6 go run github.com/securego/gosec/v2/cmd/gosec@v2.28.0 \
    -quiet -exclude-generated -severity high -confidence medium ./...) > "$TMP_ROOT/gosec.out" 2>&1; then
  finding "OK" "go/static-security" "gosec found no issue"
else
  finding "HIGH" "go/static-security" "gosec found an issue or failed"
fi

section "3. Source and database controls"

if rg -n 'dangerouslySetInnerHTML|\beval\s*\(|new Function\s*\(' src --glob '*.{ts,tsx}' > "$TMP_ROOT/xss-paths.txt" 2>/dev/null; then
  cut -d: -f1 "$TMP_ROOT/xss-paths.txt" | sort -u > "$TMP_ROOT/xss-files.txt"
  finding "MEDIUM" "source/xss" "Dynamic HTML or code execution primitive found" "Files only: $(tr '\n' ' ' < "$TMP_ROOT/xss-files.txt")"
else
  finding "OK" "source/xss" "No dynamic HTML or code execution primitive"
fi
if rg -n "fmt\.Sprintf\([^\n]*['\"]%s" server --glob '*.go' > "$TMP_ROOT/sql-paths.txt" 2>/dev/null; then
  cut -d: -f1 "$TMP_ROOT/sql-paths.txt" | sort -u > "$TMP_ROOT/sql-files.txt"
  finding "HIGH" "source/sql" "Potential direct string interpolation in Go SQL" "Files only: $(tr '\n' ' ' < "$TMP_ROOT/sql-files.txt")"
else
  finding "OK" "source/sql" "No direct Go SQL value interpolation pattern"
fi
if rg -n '(h\.DB|\.DB\.(Query|QueryRow|Exec)|type [A-Za-z]+Handler struct \{[^}]*pgxpool)' server/handlers --glob '*.go' > "$TMP_ROOT/direct-pool-paths.txt" 2>/dev/null; then
  cut -d: -f1 "$TMP_ROOT/direct-pool-paths.txt" | sort -u > "$TMP_ROOT/direct-pool-files.txt"
  finding "HIGH" "source/rls" "A Go handler bypasses the request-scoped RLS transaction" "Files only: $(tr '\n' ' ' < "$TMP_ROOT/direct-pool-files.txt")"
else
  finding "OK" "source/rls" "Go handlers can access only the request-scoped RLS transaction"
fi
if rg -q 'security definer' supabase/migrations --glob '*.sql' && \
   rg -l 'security definer' supabase/migrations --glob '*.sql' | while IFS= read -r file; do
     rg -qi "set search_path = ''" "$file" || printf '%s\n' "$file"
   done > "$TMP_ROOT/unsafe-definer.txt"; then
  if [[ -s "$TMP_ROOT/unsafe-definer.txt" ]]; then
    finding "HIGH" "database/functions" "SECURITY DEFINER migration lacks empty search_path" "Files only: $(tr '\n' ' ' < "$TMP_ROOT/unsafe-definer.txt")"
  else
    finding "OK" "database/functions" "SECURITY DEFINER functions pin an empty search_path"
  fi
fi

MISSING_RLS="$TMP_ROOT/missing-rls.txt"
: > "$MISSING_RLS"
for migration in supabase/migrations/*.sql; do
  while IFS= read -r table_name; do
    [[ -z "$table_name" ]] && continue
    if ! rg -qi "alter table( if exists)? public\\.${table_name} enable row level security" supabase/migrations supabase/schema.sql; then
      printf '%s:%s\n' "$(basename "$migration")" "$table_name" >> "$MISSING_RLS"
    fi
  done < <(sed -nE 's/^[[:space:]]*create table( if not exists)? public\.([a-z_]+).*/\2/ip' "$migration")
done
if [[ -s "$MISSING_RLS" ]]; then
  finding "HIGH" "database/rls" "Public tables without an RLS enable statement" "Migration/table only: $(tr '\n' ' ' < "$MISSING_RLS")"
else
  finding "OK" "database/rls" "Every public migration table enables RLS"
fi

if rg -q 'revoke all on function public\.delete_current_account\(\) from public, anon' supabase/migrations/00019_delete_current_account.sql && \
   rg -q 'revoke all on function public\.check_rate_limit' supabase/migrations/00020_function_privileges.sql && \
   rg -q 'alter default privileges in schema public' supabase/migrations/00020_function_privileges.sql && \
   rg -q 'revoke insert, update, delete on public\.beans from authenticated' supabase/migrations/00022_postgrest_mutation_boundary.sql && \
   rg -q 'grant update \(display_name, locale\) on public\.profiles to authenticated' supabase/migrations/00022_postgrest_mutation_boundary.sql && \
   rg -q 'security definer' supabase/migrations/00022_postgrest_mutation_boundary.sql && \
   rg -q 'jsonb_array_length\(p_tags\) > 100' supabase/migrations/00023_bound_mutation_payloads.sql && \
   rg -q 'jsonb_array_length\(p_components\) > 50' supabase/migrations/00023_bound_mutation_payloads.sql && \
   rg -q 'octet_length\(p_bean::text\)' supabase/migrations/00023_bound_mutation_payloads.sql; then
  finding "OK" "database/privileges" "Functions and tables define explicit least-privilege grants"
else
  finding "HIGH" "database/privileges" "Function execution revokes are incomplete"
fi

if git diff --check > "$TMP_ROOT/diff-check.out" 2>&1; then
  finding "OK" "source/diff" "Git diff has no whitespace errors"
else
  finding "LOW" "source/diff" "Git diff has whitespace errors"
fi

section "4. Docker build and configuration"

if rg -q '^FROM [^ ]+@sha256:[0-9a-f]{64}' Dockerfile && \
   [[ "$(rg -c '^FROM [^ ]+@sha256:[0-9a-f]{64}' server/Dockerfile)" -eq 2 ]]; then
  finding "OK" "docker/base-images" "All Docker base images are version and digest pinned"
else
  finding "HIGH" "docker/base-images" "A Docker base image is not digest pinned"
fi
if rg -q '^USER [^0]' Dockerfile && rg -q '^USER [^0]' server/Dockerfile; then
  finding "OK" "docker/user" "Web and API images declare non-root runtime users"
else
  finding "HIGH" "docker/user" "A runtime image may run as root"
fi
if rg -q '127\.0\.0\.1:.*:3000' docker-compose.staging.yml && \
   rg -q '127\.0\.0\.1:.*:8080' docker-compose.staging.yml; then
  finding "OK" "docker/ports" "Application compose ports bind to loopback"
else
  finding "HIGH" "docker/ports" "An application compose port can bind beyond loopback"
fi

if [[ -f .staging/docker.env ]]; then
  if docker compose --env-file .staging/docker.env -f docker-compose.staging.yml config --quiet > "$TMP_ROOT/compose-config.out" 2>&1; then
    finding "OK" "docker/compose" "Staging Compose configuration is valid"
  else
    finding "HIGH" "docker/compose" "Staging Compose configuration is invalid"
  fi
else
  finding "INFO" "docker/compose" "Staging env absent; Compose rendering skipped"
fi
if rg -q 'staging-gateway' docker-compose.staging.yml && \
   rg -q 'staging-database' docker-compose.staging.yml && \
   ! rg -q '^[[:space:]]+- staging-supabase$' docker-compose.staging.yml && \
   rg -q 'ensurePrivateServiceNetworks' scripts/staging.mjs && \
   rg -q 'meta,studio' scripts/staging.mjs; then
  finding "OK" "docker/network-separation" "Application containers use narrow gateway/database networks and omit management services"
else
  finding "HIGH" "docker/network-separation" "Application containers may share the Supabase management network"
fi
if rg -q 'DATABASE_URL_FILE: /run/secrets/api_database_url' docker-compose.staging.yml && \
   ! rg -q '^[[:space:]]+DATABASE_URL:' docker-compose.staging.yml && \
   rg -q 'file: \$\{STAGING_DATABASE_URL_FILE:' docker-compose.staging.yml; then
  finding "OK" "docker/secrets" "API database credential uses a mounted Compose secret"
else
  finding "HIGH" "docker/secrets" "API database credential may be exposed through container environment"
fi
if rg -q 'compose\(\["up", "-d", "--build", "--force-recreate", "api"\]\)' scripts/staging.mjs && \
   [[ "$(rg -c 'compose\(\[[^]]*"--force-recreate"[^]]*\]\)' scripts/staging.mjs)" -eq 1 ]]; then
  finding "OK" "docker/secret-rotation" "Staging runtime recreates only the API after provisioning its database credential"
else
  finding "HIGH" "docker/secret-rotation" "API credential rotation may retain a stale process or replace unrelated services"
fi

section "5. Runtime and container isolation"

if [[ "$RUNTIME" -eq 1 ]]; then
  WEB_CODE="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:${STAGING_WEB_PORT}/ko/login" 2>/dev/null || printf '000')"
  API_CODE="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:${STAGING_API_PORT}/health" 2>/dev/null || printf '000')"
  [[ "$WEB_CODE" == "200" ]] && finding "OK" "runtime/web" "Staging web responds on loopback" || finding "HIGH" "runtime/web" "Staging web health failed (HTTP $WEB_CODE)"
  [[ "$API_CODE" == "200" ]] && finding "OK" "runtime/api" "Staging API health responds on loopback" || finding "HIGH" "runtime/api" "Staging API health failed (HTTP $API_CODE)"

  curl --silent --show-error --dump-header "$TMP_ROOT/headers.txt" --output /dev/null --max-time 10 "http://127.0.0.1:${STAGING_WEB_PORT}/ko/login" 2>/dev/null || true
  MISSING_HEADERS=""
  for header in content-security-policy x-frame-options x-content-type-options strict-transport-security permissions-policy cross-origin-opener-policy cross-origin-resource-policy; do
    rg -qi "^${header}:" "$TMP_ROOT/headers.txt" || MISSING_HEADERS="$MISSING_HEADERS $header"
  done
  if [[ -z "$MISSING_HEADERS" ]]; then
    finding "OK" "runtime/headers" "Required browser security headers are present"
  else
    finding "HIGH" "runtime/headers" "Security headers are missing:$MISSING_HEADERS"
  fi
  WEB_COMMAND="$(docker inspect --format '{{json .Config.Cmd}}' "$STAGING_WEB_CONTAINER" 2>/dev/null || true)"
  if rg -qi "^content-security-policy:.*unsafe-eval" "$TMP_ROOT/headers.txt"; then
    if [[ "$WEB_COMMAND" == *'"dev"'* ]]; then
      finding "INFO" "runtime/csp" "Development staging CSP permits unsafe-eval" "Production builds must continue to exclude it."
    else
      finding "HIGH" "runtime/csp" "Production CSP permits unsafe-eval"
    fi
  else
    finding "OK" "runtime/csp" "Production CSP blocks unsafe-eval"
  fi

  UNAUTH_CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:${STAGING_API_PORT}/api/beans" 2>/dev/null || printf '000')"
  [[ "$UNAUTH_CODE" == "401" ]] && finding "OK" "runtime/auth" "Unauthenticated API access returns 401" || finding "HIGH" "runtime/auth" "Unauthenticated API access returned $UNAUTH_CODE"

  for container in "$STAGING_WEB_CONTAINER" "$STAGING_API_CONTAINER"; do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      finding "HIGH" "container/isolation" "$container is unavailable"
      continue
    fi
    PROPERTIES="$(docker inspect --format '{{.Config.User}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.CapDrop}}|{{json .HostConfig.SecurityOpt}}|{{.HostConfig.PidsLimit}}|{{.HostConfig.Memory}}' "$container" 2>/dev/null)"
    IFS='|' read -r C_USER C_READONLY C_CAPS C_SECURITY C_PIDS C_MEMORY <<< "$PROPERTIES"
    if [[ -n "$C_USER" && "$C_USER" != "0" && "$C_USER" != "root" && "$C_READONLY" == "true" && "$C_CAPS" == *"ALL"* && "$C_SECURITY" == *"no-new-privileges:true"* && "$C_PIDS" -gt 0 && "$C_MEMORY" -gt 0 ]]; then
      finding "OK" "container/isolation" "$container is non-root, read-only, cap-drop ALL, no-new-privileges, and resource-limited"
    else
      finding "HIGH" "container/isolation" "$container isolation controls are incomplete"
    fi
    PORTS="$(docker port "$container" 2>/dev/null || true)"
    if [[ -n "$PORTS" ]] && ! printf '%s\n' "$PORTS" | rg -qv '127\.0\.0\.1:'; then
      finding "OK" "container/ports" "$container publishes only to loopback"
    else
      finding "HIGH" "container/ports" "$container has a non-loopback or missing port binding"
    fi
  done

  NON_LOOPBACK_PORTS="$TMP_ROOT/non-loopback-ports.txt"
  : > "$NON_LOOPBACK_PORTS"
  for container in \
    "$STAGING_WEB_CONTAINER" \
    "$STAGING_API_CONTAINER" \
    "supabase_kong_${STAGING_SUPABASE_PROJECT}" \
    "$STAGING_DB_CONTAINER" \
    "supabase_studio_${STAGING_SUPABASE_PROJECT}" \
    "supabase_inbucket_${STAGING_SUPABASE_PROJECT}"; do
    docker port "$container" 2>/dev/null | while IFS= read -r binding; do
      [[ "$binding" == *"127.0.0.1:"* ]] || printf '%s\n' "$container" >> "$NON_LOOPBACK_PORTS"
    done
  done
  if [[ -s "$NON_LOOPBACK_PORTS" ]]; then
    finding "HIGH" "runtime/network" "A staging service publishes beyond loopback" "Containers only: $(sort -u "$NON_LOOPBACK_PORTS" | tr '\n' ' ')"
  else
    finding "OK" "runtime/network" "All web, API, database, gateway, and mail ports bind to loopback"
  fi

  APP_MANAGEMENT_ACCESS="safe"
  for container in "$STAGING_WEB_CONTAINER" "$STAGING_API_CONTAINER"; do
    ATTACHED_NETWORKS="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "$container" 2>/dev/null || true)"
    if [[ "$ATTACHED_NETWORKS" == *"$STAGING_SUPABASE_NETWORK"* ]]; then
      APP_MANAGEMENT_ACCESS="unsafe"
    fi
    if docker exec "$container" wget -q --spider --timeout=2 http://pg_meta:8080/ >/dev/null 2>&1 || \
       docker exec "$container" wget -q --spider --timeout=2 http://studio:3000/ >/dev/null 2>&1; then
      APP_MANAGEMENT_ACCESS="unsafe"
    fi
  done
  for management_container in \
    "supabase_pg_meta_${STAGING_SUPABASE_PROJECT}" \
    "supabase_studio_${STAGING_SUPABASE_PROJECT}"; do
    if docker inspect "$management_container" >/dev/null 2>&1; then
      APP_MANAGEMENT_ACCESS="unsafe"
    fi
  done
  if [[ "$APP_MANAGEMENT_ACCESS" == "safe" ]]; then
    finding "OK" "runtime/management-network" "Application containers cannot reach Supabase management services"
  else
    finding "HIGH" "runtime/management-network" "Application containers can reach a Supabase management service or network"
  fi

  docker inspect "$STAGING_WEB_CONTAINER" "$STAGING_API_CONTAINER" > "$TMP_ROOT/app-containers.json" 2>/dev/null || true
  if node - "$TMP_ROOT/app-containers.json" "$STAGING_ENV_FILE" <<'NODE'
const fs = require("fs");
const containers = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const env = Object.fromEntries(
  fs.readFileSync(process.argv[3], "utf8").split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  })
);
const serviceRole = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRole) process.exit(2);
const serialized = JSON.stringify(containers);
if (serialized.includes(serviceRole) || serialized.includes("STAGING_SUPABASE_SERVICE_ROLE_KEY")) process.exit(1);
NODE
  then
    finding "OK" "runtime/secrets" "Service-role credential is absent from web/API container configuration"
  else
    finding "CRITICAL" "runtime/secrets" "Service-role credential is present in web/API container configuration or could not be verified"
  fi

  FUNCTION_PRIVILEGE_COUNT="$(docker exec "$STAGING_DB_CONTAINER" psql -U postgres -d postgres -Atqc "
    with sensitive as (
      select p.oid, p.proname,
        exists (
          select 1
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        ) as public_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'handle_new_user', 'check_rate_limit', 'delete_current_account',
          'create_bean_record', 'update_bean_record', 'delete_bean_record',
          'assert_bean_mutation_payload'
        )
    )
    select count(*)
    from sensitive
    where public_execute
      or anon_execute
      or (
        proname in ('delete_current_account', 'create_bean_record', 'update_bean_record', 'delete_bean_record')
        and not authenticated_execute
      )
      or (
        proname in ('handle_new_user', 'check_rate_limit')
        and authenticated_execute
      )
      or (
        proname = 'assert_bean_mutation_payload'
        and authenticated_execute
      );
  " 2>/dev/null || printf 'query-failed')"
  if [[ "$FUNCTION_PRIVILEGE_COUNT" == "0" ]]; then
    finding "OK" "runtime/database-privileges" "Sensitive function execution grants match the least-privilege policy"
  else
    finding "HIGH" "runtime/database-privileges" "Sensitive function grants are unsafe or could not be verified"
  fi

  TABLE_PRIVILEGE_MISMATCHES="$(docker exec "$STAGING_DB_CONTAINER" psql -U postgres -d postgres -Atqc "
    with expected(grantee, table_name, privilege_type) as (
      values
        ('authenticated', 'profiles', 'SELECT'),
        ('authenticated', 'beans', 'SELECT'),
        ('authenticated', 'tasting_tags', 'SELECT'),
        ('authenticated', 'blend_components', 'SELECT'),
        ('authenticated', 'origin_presets', 'SELECT'),
        ('authenticated', 'origin_countries', 'SELECT'),
        ('authenticated', 'origin_regions', 'SELECT'),
        ('authenticated', 'origin_entities', 'SELECT')
    ), actual as (
      select grantee::text, table_name::text, privilege_type::text
      from information_schema.table_privileges
      where table_schema = 'public'
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
    ), table_mismatches as (
      (select * from actual except select * from expected)
      union all
      (select * from expected except select * from actual)
    ), expected_columns(grantee, table_name, column_name, privilege_type) as (
      values
        ('authenticated', 'profiles', 'display_name', 'UPDATE'),
        ('authenticated', 'profiles', 'locale', 'UPDATE')
    ), actual_columns as (
      select grantee::text, table_name::text, column_name::text, privilege_type::text
      from information_schema.column_privileges
      where table_schema = 'public'
        and privilege_type = 'UPDATE'
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
    ), column_mismatches as (
      (select * from actual_columns except select * from expected_columns)
      union all
      (select * from expected_columns except select * from actual_columns)
    )
    select (select count(*) from table_mismatches)
         + (select count(*) from column_mismatches);
  " 2>/dev/null || printf 'query-failed')"
  if [[ "$TABLE_PRIVILEGE_MISMATCHES" == "0" ]]; then
    finding "OK" "runtime/table-privileges" "Public table grants exactly match the least-privilege allow-list"
  else
    finding "HIGH" "runtime/table-privileges" "Public table grants exceed or miss the least-privilege allow-list"
  fi

  if docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$STAGING_API_CONTAINER" 2>/dev/null | rg -q '^DATABASE_URL='; then
    finding "HIGH" "runtime/database-secret" "API database URL is exposed in container environment"
  else
    finding "OK" "runtime/database-secret" "API container environment does not contain DATABASE_URL"
  fi
  if docker exec "$STAGING_API_CONTAINER" test -r /run/secrets/api_database_url 2>/dev/null; then
    finding "OK" "runtime/database-secret" "API process can read the mounted database secret"
  else
    finding "CRITICAL" "runtime/database-secret" "API process cannot read the mounted database secret"
  fi

  API_ACTIVITY_ROLE="$(docker exec "$STAGING_DB_CONTAINER" psql -U postgres -d postgres -Atqc "
    select case
      when count(*) > 0 and bool_and(usename = 'beanlog_api') then 'safe'
      else 'unsafe'
    end
    from pg_stat_activity
    where application_name = 'beanlog-api';
  " 2>/dev/null || printf 'query-failed')"
  API_ROLE_PROPERTIES="$(docker exec "$STAGING_DB_CONTAINER" psql -U supabase_admin -d postgres -Atqc "
    select not rolsuper
       and not rolbypassrls
       and rolcanlogin
       and pg_has_role(rolname, 'authenticated', 'MEMBER')
       and rolpassword like 'SCRAM-SHA-256\$%'
       and (
         select count(*) = 1
            and bool_and(granted_role.rolname = 'authenticated')
            and bool_and(not membership.admin_option)
         from pg_auth_members membership
         join pg_roles granted_role on granted_role.oid = membership.roleid
         where membership.member = pg_authid.oid
       )
    from pg_authid
    where rolname = 'beanlog_api';
  " 2>/dev/null || printf 'query-failed')"
  if [[ "$API_ACTIVITY_ROLE" == "safe" && "$API_ROLE_PROPERTIES" == "t" ]]; then
    finding "OK" "runtime/database-role" "API uses the dedicated non-superuser, non-BYPASSRLS authenticated member"
  else
    finding "CRITICAL" "runtime/database-role" "API database login can bypass policy or could not be verified"
  fi

  DATABASE_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$STAGING_DB_CONTAINER" 2>/dev/null || true)"
  if [[ -z "$DATABASE_IMAGE" ]]; then
    finding "HIGH" "runtime/database-password" "Database image could not be identified for the password probe"
  elif docker run --rm --network "$STAGING_SUPABASE_NETWORK" \
    -e PGPASSWORD=postgres "$DATABASE_IMAGE" \
    psql -h db -U beanlog_api -d postgres -Atqc 'select 1' \
    > /dev/null 2>&1; then
    finding "CRITICAL" "runtime/database-password" "Dedicated API role accepts the shared staging postgres password"
  else
    finding "OK" "runtime/database-password" "Dedicated API role rejects the shared staging postgres password"
  fi

  if docker scout version >/dev/null 2>&1; then
    for image in "${STAGING_COMPOSE_PROJECT}-web" "${STAGING_COMPOSE_PROJECT}-api"; do
      if docker image inspect "$image" >/dev/null 2>&1; then
        docker scout cves --only-severity critical,high --format sarif --output "$TMP_ROOT/${image}.sarif" "$image" >/dev/null 2>&1
        SCOUT_STATUS=$?
        SCOUT_COUNT="$(node -e '
          const fs=require("fs");
          try { const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(d.runs?.reduce((n,r)=>n+(r.results?.length??0),0)??0); }
          catch { console.log("?"); }
        ' "$TMP_ROOT/${image}.sarif")"
        if [[ "$SCOUT_STATUS" -eq 0 && "$SCOUT_COUNT" == "0" ]]; then
          finding "OK" "container/cve" "$image has no critical/high Docker Scout finding"
        elif [[ "$SCOUT_COUNT" =~ ^[0-9]+$ ]]; then
          if [[ "$image" == "${STAGING_COMPOSE_PROJECT}-web" && "${WEB_COMMAND:-}" == *'"dev"'* ]]; then
            finding "INFO" "container/cve" "$image development image has $SCOUT_COUNT critical/high findings" "The development-only dependency image is not a production artifact."
          else
            finding "HIGH" "container/cve" "$image has $SCOUT_COUNT critical/high Docker Scout findings"
          fi
        else
          finding "MEDIUM" "container/cve" "$image Docker Scout result could not be parsed"
        fi
      fi
    done
  else
    finding "INFO" "container/cve" "Docker Scout unavailable"
  fi
else
  finding "INFO" "runtime" "Runtime checks skipped; pass --runtime after staging is up"
fi

{
  printf '\n---\n\n## Summary\n\n'
  printf '| Severity | Count |\n|---|---:|\n'
  printf '| CRITICAL | %d |\n| HIGH | %d |\n| MEDIUM | %d |\n| LOW | %d |\n| INFO | %d |\n| OK | %d |\n' \
    "$C_CRIT" "$C_HIGH" "$C_MED" "$C_LOW" "$C_INFO" "$C_OK"
} >> "$REPORT"

printf 'CRIT=%d HIGH=%d MED=%d LOW=%d INFO=%d OK=%d\n' "$C_CRIT" "$C_HIGH" "$C_MED" "$C_LOW" "$C_INFO" "$C_OK"
printf 'Report: %s\n' "$REPORT"
[[ $((C_CRIT + C_HIGH)) -gt 0 ]] && exit 1
exit 0
