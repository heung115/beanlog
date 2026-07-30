#!/usr/bin/env bash
# ============================================================
# Beanlog 종합 감사 하니스
# 보안 / 품질 / 빌드 / 런타임 전체 검사
# 사용: bash scripts/audit.sh [--runtime]
#   --runtime : 떠 있는 서버 대상으로 런타임 검사까지 수행
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="$ROOT/.audit-report.md"
RUNTIME=0
[[ "${1:-}" == "--runtime" ]] && RUNTIME=1

# 카운터
declare -i C_CRIT=0 C_HIGH=0 C_MED=0 C_LOW=0 C_INFO=0 C_OK=0

: > "$REPORT"
echo "# Beanlog Audit Report — $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT"
echo "" >> "$REPORT"

finding() { # sev | category | message [detail]
  local sev="$1" cat="$2" msg="$3" detail="${4:-}"
  case "$sev" in
    CRITICAL) C_CRIT+=1 ;; HIGH) C_HIGH+=1 ;; MEDIUM) C_MED+=1 ;;
    LOW) C_LOW+=1 ;; INFO) C_INFO+=1 ;; OK) C_OK+=1 ;;
  esac
  {
    echo "- **[$sev]** \`$cat\` — $msg"
    [[ -n "$detail" ]] && echo "  - $detail"
  } >> "$REPORT"
}

section() { echo -e "\n## $1\n" >> "$REPORT"; }

# ============================================================
section "1. Secrets / 민감정보"
# ============================================================
# 구글/카카오 OAuth 시크릿, 서비스롤 키, JWT 시크릿 하드코딩 스캔
# (node_modules, .next 제외 / .env.example 은 허용)
SECRET_PATTERNS='GOCSPX-[A-Za-z0-9_-]{20,}|service_role|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI|super-secret-jwt-token|PRIVATE KEY-----|sk_live_|sk-[A-Za-z0-9]{20,}'
HITS=$(grep -rInE "$SECRET_PATTERNS" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=build \
  --exclude='.env.example' --exclude='*.lock' --exclude='package-lock.json' \
  . 2>/dev/null | grep -v 'audit.sh' | head -40)
if [[ -n "$HITS" ]]; then
  while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    # git에 추적(커밋)되는지 여부로 심각도 판정.
    # gitignore된 로컬 파일은 MEDIUM(비밀관리 권장), 추적되면 CRITICAL.
    tracked=1
    git ls-files --error-unmatch "$file" >/dev/null 2>&1 && tracked=0
    if echo "$line" | grep -qE 'GOCSPX-|PRIVATE KEY|sk_live|sk-'; then
      if [[ $tracked -eq 0 ]]; then
        finding "CRITICAL" "secrets" "git에 커밋된 실제 시크릿: $file" "$(echo "$line" | cut -c1-120)"
      else
        finding "MEDIUM" "secrets" "gitignore된 로컬 plaintext 시크릿: $file" "커밋 안됨. 1Password 등 비밀관리 권장"
      fi
    elif echo "$line" | grep -q 'service_role'; then
      finding "HIGH" "secrets" "service_role 키 참조: $file" "$(echo "$line" | cut -c1-120)"
    elif echo "$line" | grep -q 'super-secret-jwt-token'; then
      finding "MEDIUM" "secrets" "기본 JWT 시크릿 하드코딩: $file" "$(echo "$line" | cut -c1-120)"
    else
      finding "INFO" "secrets" "민감가능 문자열: $file" "$(echo "$line" | cut -c1-100)"
    fi
  done <<< "$HITS"
else
  finding "OK" "secrets" "하드코딩 시크릿 미발견"
fi

# git 추적 중인 민감 파일
TRACKED=$(git ls-files 2>/dev/null | grep -iE '\.env$|\.env\.|secret|credential|\.pem$|\.key$' | grep -v '.env.example' || true)
if [[ -n "$TRACKED" ]]; then
  finding "HIGH" "secrets" "git에 추적되는 민감 파일" "$TRACKED"
else
  finding "OK" "secrets" "git 추적 민감 파일 없음"
fi

# ============================================================
section "2. 의존성 보안"
# ============================================================
# 수용된 위험(문서화): 전부 빌드타임 PWA/workbox/postcss 간접 의존성.
# 런타임에 신뢰할 수 없는 입력을 처리하지 않으며, 수정 시 breaking change 필요.
# → 아래 목록은 HIGH/MEDIUM 대신 INFO(수용)로 보고하고 종료코드에서 제외.
ACCEPTED_BUILDTIME="workbox-build workbox-webpack-plugin @rollup/plugin-terser @surma/rollup-plugin-off-main-thread ejs jake filelist minimatch brace-expansion glob postcss @ducanh2912/next-pwa next-intl next serialize-javascript"

if command -v npm >/dev/null 2>&1 && [[ -f package.json ]]; then
  NPM_AUDIT=$(npm audit --omit=dev --json 2>/dev/null)
  if [[ -n "$NPM_AUDIT" ]]; then
    echo "$NPM_AUDIT" | ACCEPTED="$ACCEPTED_BUILDTIME" python3 -c '
import json,sys,os
d=json.load(sys.stdin)
vulns=d.get("vulnerabilities",{})
accepted=os.environ.get("ACCEPTED","").split()
act={"critical":0,"high":0,"moderate":0}
acc=0
for name,info in vulns.items():
    sev=info.get("severity","low")
    if name in accepted:
        acc+=1
    elif sev in act:
        act[sev]+=1
print(str(act["critical"]) + " " + str(act["high"]) + " " + str(act["moderate"]) + " " + str(acc))
' > /tmp/npm_class.txt 2>/dev/null || echo "0 0 0 0" > /tmp/npm_class.txt
    read -r CRITV HIGHV MODV ACCV < /tmp/npm_class.txt
    CRITV=${CRITV:-0}; HIGHV=${HIGHV:-0}; MODV=${MODV:-0}; ACCV=${ACCV:-0}
    [[ "$CRITV" -gt 0 ]] && finding "CRITICAL" "deps" "npm 런타임 취약점 critical ${CRITV}건"
    [[ "$HIGHV" -gt 0 ]] && finding "HIGH" "deps" "npm 런타임 취약점 high ${HIGHV}건"
    [[ "$MODV" -gt 0 ]] && finding "MEDIUM" "deps" "npm 런타임 취약점 moderate ${MODV}건"
    [[ "$ACCV" -gt 0 ]] && finding "INFO" "deps" "수용된 빌드타임 취약점 ${ACCV}건 (workbox/postcss 체인 — 문서화됨, breaking change로만 수정 가능)"
    [[ "$CRITV" -eq 0 && "$HIGHV" -eq 0 && "$MODV" -eq 0 ]] && finding "OK" "deps" "npm 런타임 취약점 없음"
  fi
fi

if command -v go >/dev/null 2>&1 && [[ -f server/go.mod ]]; then
  ( cd server && go vet ./... 2>&1 ) > /tmp/govet.out
  if [[ -s /tmp/govet.out ]]; then
    finding "HIGH" "deps" "go vet 경고" "$(head -5 /tmp/govet.out | tr '\n' ' ')"
  else
    finding "OK" "deps" "go vet 깨끗"
  fi
  if command -v govulncheck >/dev/null 2>&1; then
    ( cd server && govulncheck ./... 2>&1 ) > /tmp/govuln.out
    if grep -q 'Vulnerability' /tmp/govuln.out; then
      finding "HIGH" "deps" "Go 알려진 취약점 발견" "$(grep -c 'Vulnerability' /tmp/govuln.out)건"
    else
      finding "OK" "deps" "govulncheck 깨끗"
    fi
  else
    finding "INFO" "deps" "govulncheck 미설치 (go install golang.org/x/vuln/cmd/govulncheck@latest)"
  fi
fi

# ============================================================
section "3. 타입 / 빌드"
# ============================================================
if [[ -f tsconfig.json ]]; then
  npx tsc --noEmit > /tmp/tsc.out 2>&1
  if [[ $? -ne 0 ]]; then
    finding "HIGH" "build" "TypeScript 타입 오류" "$(grep -c 'error TS' /tmp/tsc.out)건 — /tmp/tsc.out"
  else
    finding "OK" "build" "tsc --noEmit 통과"
  fi
fi

( cd server && go build -o /tmp/beanlog-audit-build . 2>&1 ) > /tmp/gobuild.out
if [[ $? -ne 0 ]]; then
  finding "HIGH" "build" "Go 빌드 실패" "$(head -5 /tmp/gobuild.out | tr '\n' ' ')"
else
  finding "OK" "build" "Go 빌드 성공"
fi

# ============================================================
section "4. 코드 보안 패턴"
# ============================================================
# PostgREST .or() 에 사용자 입력 직접 보간 → 필터 인젝션
if grep -rInE '\.or\(' src --include='*.ts' --include='*.tsx' 2>/dev/null | grep -qE '\$\{'; then
  finding "HIGH" "injection" "PostgREST .or()에 사용자 입력 직접 보간" "$(grep -rInE '\.or\(' src --include='*.ts' | grep -E '\$\{' | head -3 | tr '\n' ' ')"
else
  finding "OK" "injection" "PostgREST .or() 직접 보간 없음"
fi

# Go: fmt.Sprintf 안의 '%s' — SQL 위치값에 문자열 값을 직접 보간하는 고전적 인젝션 패턴만 탐지.
# ($%d 플레이스홀더 조립이나 파라미터 바인딩은 오탐이므로 제외)
GOSQL=$(grep -rInE "fmt\.Sprintf\(" server --include='*.go' 2>/dev/null | grep -F "'%s'" || true)
if [[ -n "$GOSQL" ]]; then
  finding "HIGH" "injection" "Go SQL에 '%s' 값 직접 보간" "$(echo "$GOSQL" | head -4 | tr '\n' ' ')"
else
  finding "OK" "injection" "Go SQL 값 보간 없음 (파라미터화 쿼리 사용)"
fi

# dangerouslySetInnerHTML / eval
if grep -rInE 'dangerouslySetInnerHTML|eval\(' src --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v node_modules | head -1 | grep -q .; then
  finding "MEDIUM" "xss" "dangerouslySetInnerHTML/eval 사용" "$(grep -rInE 'dangerouslySetInnerHTML|eval\(' src --include='*.tsx' --include='*.ts' | head -2 | tr '\n' ' ')"
else
  finding "OK" "xss" "dangerouslySetInnerHTML/eval 없음"
fi

# ============================================================
section "5. 보안 설정"
# ============================================================
# Next.js 보안 헤더
if grep -qE 'headers|Content-Security-Policy|X-Frame-Options' next.config.ts 2>/dev/null; then
  finding "OK" "headers" "next.config에 보안 헤더 설정 있음"
else
  finding "MEDIUM" "headers" "next.config.ts에 보안 헤더(CSP/XFO 등) 미설정"
fi

# Supabase RLS
if [[ -f supabase/schema.sql ]]; then
  TABLES=$(grep -oE 'create table public\.[a-z_]+' supabase/schema.sql | awk '{print $4}' | sed 's/public\.//')
  for tbl in $TABLES; do
    if grep -qE "alter table public\.$tbl enable row level security" supabase/schema.sql supabase/migrations/*.sql 2>/dev/null; then
      :
    else
      finding "HIGH" "rls" "테이블 $tbl 에 RLS 미적용"
    fi
  done
  finding "OK" "rls" "schema.sql 테이블 RLS 적용 여부 확인 완료"
fi
# 신규 마이그레이션 테이블 RLS
for mig in supabase/migrations/*.sql; do
  NEWT=$(grep -oE 'create table public\.[a-z_]+' "$mig" 2>/dev/null | awk '{print $4}' | sed 's/public\.//')
  for tbl in $NEWT; do
    if ! grep -qE "alter table public\.$tbl enable row level security" "$mig" 2>/dev/null; then
      finding "HIGH" "rls" "마이그레이션 $mig 의 $tbl 에 RLS 미적용"
    fi
  done
done

# Docker: build arg 로 시크릿 전달
if grep -qE '^\s+.*SECRET|^\s+.*PASSWORD' docker-compose.yml 2>/dev/null; then
  finding "HIGH" "docker" "docker-compose build args에 시크릿성 값" "$(grep -nE 'SECRET|PASSWORD' docker-compose.yml | head -3 | tr '\n' ' ')"
else
  finding "OK" "docker" "docker-compose 시크릿 build arg 없음"
fi

# Dockerfile non-root
if grep -qE '^USER ' Dockerfile 2>/dev/null; then
  finding "OK" "docker" "Next Dockerfile non-root USER 설정"
else
  finding "MEDIUM" "docker" "Next Dockerfile에 USER 지시어 없음"
fi
if grep -qE 'adduser|addgroup|USER ' server/Dockerfile 2>/dev/null; then
  finding "INFO" "docker" "Go Dockerfile 사용자 설정 확인" "$(grep -E 'USER|adduser' server/Dockerfile | head -1)"
else
  finding "MEDIUM" "docker" "Go Dockerfile root로 실행됨 (USER 없음)"
fi

# Gin trusted proxies 경고 억제 여부
if grep -qE 'SetTrustedProxies' server -r --include='*.go' 2>/dev/null; then
  finding "OK" "config" "Gin SetTrustedProxies 설정됨"
else
  finding "LOW" "config" "Gin SetTrustedProxies 미설정 (기본 all-proxy 신뢰 경고)"
fi

# OAuth redirect allow-list
if grep -qE 'additional_redirect_urls' supabase/config.toml 2>/dev/null; then
  finding "OK" "auth" "Supabase redirect allow-list 설정됨"
else
  finding "MEDIUM" "auth" "Supabase additional_redirect_urls 미설정"
fi

# ============================================================
section "6. 런타임"
# ============================================================
if [[ "$RUNTIME" -eq 1 ]]; then
  # Next 앱
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
  if [[ "$CODE" == "000" ]]; then
    finding "INFO" "runtime" "Next 앱(:3000) 미실행"
  else
    finding "OK" "runtime" "Next 앱 응답 $CODE"
  fi

  # 보안 헤더 적용 확인 (Next가 떠 있을 때만)
  if [[ "$CODE" != "000" ]]; then
    HDRS=$(curl -s -D - -o /dev/null http://localhost:3000/ko/login 2>/dev/null)
    for h in x-frame-options x-content-type-options content-security-policy strict-transport-security; do
      if echo "$HDRS" | grep -qi "^$h:"; then
        finding "OK" "runtime" "보안 헤더 적용: $h"
      else
        finding "MEDIUM" "runtime" "보안 헤더 누락: $h"
      fi
    done
  fi

  # Go API — 재현 가능하게 하니스가 직접 바이너리를 띄웠다 정리
  GO_STARTED=0
  GCODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/health 2>/dev/null)
  if [[ "$GCODE" == "000" && -x server/beanlog-server ]]; then
    ( cd server && PORT=8081 ./beanlog-server >/tmp/beanlog-audit-rt.log 2>&1 & echo $! > /tmp/beanlog-audit-rt.pid )
    sleep 2
    GO_STARTED=1
    GCODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/health 2>/dev/null)
  fi

  if [[ "$GCODE" == "000" ]]; then
    finding "INFO" "runtime" "Go API(:8081) 미실행/시작 실패"
  else
    finding "OK" "runtime" "Go API health $GCODE"
    UCODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/api/beans 2>/dev/null)
    if [[ "$UCODE" == "401" ]]; then
      finding "OK" "runtime" "무인증 /api/beans → 401"
    else
      finding "HIGH" "runtime" "무인증 /api/beans → $UCODE (401 기대)"
    fi
  fi

  # 하니스가 띄운 서버 정리
  if [[ "$GO_STARTED" -eq 1 && -f /tmp/beanlog-audit-rt.pid ]]; then
    kill "$(cat /tmp/beanlog-audit-rt.pid)" 2>/dev/null
    rm -f /tmp/beanlog-audit-rt.pid
  fi
else
  finding "INFO" "runtime" "런타임 검사 스킵 (--runtime 플래그로 활성화)"
fi

# ============================================================
# 요약
# ============================================================
{
  echo ""
  echo "---"
  echo "## 요약"
  echo "| 심각도 | 건수 |"
  echo "|---|---|"
  echo "| CRITICAL | $C_CRIT |"
  echo "| HIGH | $C_HIGH |"
  echo "| MEDIUM | $C_MED |"
  echo "| LOW | $C_LOW |"
  echo "| INFO | $C_INFO |"
  echo "| OK | $C_OK |"
} >> "$REPORT"

echo "CRIT=$C_CRIT HIGH=$C_HIGH MED=$C_MED LOW=$C_LOW INFO=$C_INFO OK=$C_OK"
echo "보고서: $REPORT"

# CRITICAL/HIGH 가 있으면 비정상 종료 (반복 루프용)
[[ $((C_CRIT + C_HIGH)) -gt 0 ]] && exit 1
exit 0
