# 비공개 운영 콘솔 배포

이 구성은 기존 앱·DB·Kong을 그대로 사용하고 Studio와 postgres-meta만 별도 Compose 프로젝트로 실행한다. Tailscale Serve가 인증한 **현재 서버 소유자 계정**만 운영 화면에 들어갈 수 있다. 기기를 공유하거나 다른 사용자를 tailnet에 추가해도 그 사용자에게 관리 권한을 주지 않는다.

| 화면 | Tailscale HTTPS | 서버 내부 전달 |
| --- | --- | --- |
| 운영 현황 | `https://oracle-free.tail6e4bc0.ts.net` | Serve 443 → `/run/caddy/private/status.sock` |
| 데이터베이스 Studio | `https://oracle-free.tail6e4bc0.ts.net:8443` | Serve 8443 → `/run/caddy/private/studio.sock` → Studio 관리망 고정 IPv4의 `3000` 포트 |
| beanmap 관리자 | `https://oracle-free.tail6e4bc0.ts.net:9443/ko/admin` | Serve 9443 → `/run/caddy/private/admin.sock` → 기존 Next `127.0.0.1:3100` |

웹 브라우저에서 쓰는 DB API 주소는 기존 `API_EXTERNAL_URL`이며, Studio 서버의 API 요청은 컨테이너 네트워크의 `supabase-kong:8000`을 사용한다. PostgreSQL과 postgres-meta 포트는 호스트에 공개하지 않는다. Studio에서 보여 주는 API 키·SQL·사용자 데이터도 소유자에게만 보여야 하므로 Studio 전체 경로가 같은 접근 제한을 받는다.

## 배포 전 확인

- 다른 배포·브라우저 QA가 끝난 뒤 작업한다. 현재 앱·Supabase·Caddy 설정과 DB 백업을 root만 읽을 수 있는 위치에 보관한다.
- Docker Compose 2.30 이상, 실행 중인 `supabase-db/auth/rest/kong`과 [관리망 격리 준비](../../production/security-boundary.md)가 필요하다. Meta/Studio는 기존 앱 네트워크에 연결하지 않는다.
- 기존 Kong에는 비활성 `studio:3000`·`meta:8080` 경로가 남아 있다. 이 구성은 서비스 이름을 `private-studio`·`private-meta`로 정해 그 DNS 별칭을 만들지 않는다. 서비스 키나 네트워크 별칭을 `studio`·`meta`로 바꾸면 공개 Kong 경로가 살아날 수 있다.
- Tailscale의 현재 서버 소유자 계정과 `oracle-free.tail6e4bc0.ts.net` DNS가 맞아야 한다. HTTPS 인증서 기능을 활성화하고, 기존 Serve 설정을 확인한다. 기존 규칙을 `reset`하지 않는다.
- 새 이미지 두 개는 버전과 multiarch digest를 고정했다. 2026-09-06 registry 검사에서 두 이미지 모두 `linux/arm64`와 `linux/amd64`를 지원했다.
- Studio·meta는 명시적으로 UID/GID 1000으로 실행한다. 메모리 상한은 각각 1536 MiB·512 MiB이며, CPU 상한은 1.5·1개다. DB 리소스 설정은 바꾸지 않는다.

## 파일 설치와 자격 증명 준비

이 폴더를 `/opt/beanmap-private-console/deploy`에 복사하고, 상위의 collector·public 파일은 `/opt/beanmap-private-console`에 설치한다. 코드·공개 정적 파일은 root 소유로 두고 Caddy가 읽을 수 있게 한다. `INTEGRATION.md`에 있는 collector 설정·timer도 함께 설치한다.

관리망의 실제 subnet과 주소 사용 현황을 확인하고 Studio용 IPv4를 하나 예약한다.
배포 폴더의 `.env`에 `BEANMAP_STUDIO_IP=<예약한 IPv4>`를 한 번만 기록한다. 기존 Studio를
이동하는 경우 현재 관리망 IPv4를 유지한다. 이 파일은 root 소유 `0600`으로 두며 다른
설정을 보존한다. Compose는 이 주소를 고정하고 아래 준비 도구는 같은 값을 Caddy 환경에
반영한다. Docker의 `internal` 전용 bridge에서는 loopback 포트 게시가 생성되지 않을 수
있으므로 Studio의 `ports`는 사용하지 않는다. 호스트 Caddy만 내부 IPv4로 직접 연결하며
앱에서 관리망으로 들어오는 트래픽 차단과 관리망의 외부 통신 제한은 유지한다.

```sh
sudo python3 /opt/beanmap-private-console/deploy/provision.py
```

준비 도구는 필요한 키만 현재 컨테이너에서 읽어 `/etc/beanmap-private-console` 아래에 기록한다. 기존 Supabase `.env`나 `OPENAI_API_KEY`를 읽어 옮기거나 변경하지 않는다. 새 Studio의 AI 기능에는 빈 키를 명시한다. 명령 출력에는 자격 증명·소유자 이메일이 포함되지 않는다.

- 디렉터리: root:root `0700`.
- `studio.env`, `meta.env`, `meta_crypto_key`, `caddy.env`: root:root `0600`.
- `admin_ingress_secret`: root:1001 `0440`. Docker가 웹·API의 `/run/secrets/admin_ingress_secret`에 읽기 전용으로 마운트한다.
- 재실행해도 기존 ingress secret과 meta 암호화 키를 유지한다. 원본 DB/API 자격 증명이 교체되면 env 파일만 최신 값으로 갱신한다. 파일 준비만 수행하므로 변경 후 관련 서비스 재생성은 별도다.
- secret 값을 조회하거나 `docker compose config`의 전체 출력을 공유하지 않는다. `env_file: format: raw`는 `$`, 따옴표 등을 포함한 실제 값을 셸 확장 없이 전달한다.

## 앱·DB 경계 적용

1. `app-private.override.yml`을 기존 **앱** Compose 구성과 병합한다. 기존 네트워크·이미지·환경·API DB secret을 보존한다. 운영 배포 스크립트도 이 override를 매번 포함해야 한다. 고정 운영 Compose에 이 파일의 환경·secret 항목을 직접 병합해도 된다.
2. 관리자 변경이 들어간 웹·API 이미지를 빌드한다. 기존 웹 인스턴스 하나에 private ingress 환경을 주며, 관리용 Next를 별도로 실행하지 않는다.
3. 관리자 스키마가 없는 운영 DB에는 저장소 루트에서 `python3 ops/private-console/apply-admin-migrations.py --apply`로 `00024`·`00025`를 한 트랜잭션으로 적용한다. 이 도구는 백업을 대신하지 않으며, 기존 관리자 스키마가 있으면 중단한다. `00025`는 관리 RPC를 `beanmap_private`로 옮긴다. PostgREST의 `PGRST_DB_SCHEMAS`에 `beanmap_private`를 추가하지 않는다.
4. `auth.users`에서 Tailscale 소유자와 정확히 일치하는 기존 사용자 한 명을 확인한 뒤 그 UUID만 `beanmap_private.admin_users`에 등록한다. 사용자 레코드·비밀번호를 새로 만들거나 바꾸지 않는다.
5. 기존 GoTrue 허용 목록에 `https://oracle-free.tail6e4bc0.ts.net:9443/api/auth/callback`과 같은 주소 뒤에 `[?]**`를 붙인 항목을 추가한다. 후자는 로그인 후 돌아갈 `next` 쿼리만 허용한다. GoTrue는 쿼리를 포함한 전체 URL을 검사하므로 둘 다 필요하다. 호스트·포트·콜백 경로는 고정하고 기존 허용 항목을 보존한다. OAuth 공급자 callback URL은 기존 Supabase 주소를 유지한다.
6. 공개 Caddy는 `X-Beanmap-Admin-Secret`을 제거하고 관리자 경로를 거절해야 한다. Next/Go/DB의 경계와 함께 적용한다. 익명·일반 사용자·공개 RPC·Server Action 우회 검증이 끝나기 전 관리자 기능을 공개 배포하지 않는다.

## Studio 시작

```sh
# First prepare beanmap-management and attach DB/Kong using
# ops/production/security-boundary.md; this Compose no longer joins the app network.
sudo docker compose --env-file /opt/beanmap-private-console/deploy/.env -f /opt/beanmap-private-console/deploy/compose.yml config --quiet
# Security-patched local images must already be loaded with their recorded digests.
sudo docker compose --env-file /opt/beanmap-private-console/deploy/.env -f /opt/beanmap-private-console/deploy/compose.yml up -d --wait
```

최초에는 두 healthcheck와 Studio의 DB 테이블 목록 조회를 확인한다. 두 컨테이너의 실제 Docker network aliases에 `studio`·`meta`가 없음을 확인하고, 공개 API 도메인의 `/`, `/pg/`, `/mcp`, `/api/mcp`에서 Studio·meta가 접근되지 않는지도 확인한다. Studio와 meta가 UID 1000으로 정상 동작하는지 확인하고, 쓰기 권한 오류를 해결하려고 root 실행이나 전체 디렉터리 `0777`로 바꾸지 않는다. 전용 snippets만 쓰기 가능하며 기존 함수 소스는 공유하지 않는다.

## Caddy와 Tailscale Serve 연결

`beanmap-private.Caddyfile`을 `/etc/caddy/beanmap-private.Caddyfile`에 설치하고 기존 주 Caddyfile의 top-level에 `import /etc/caddy/beanmap-private.Caddyfile`을 한 번만 추가한다. 기존 공개 사이트 라우팅·배포 webhook·보안 헤더를 유지한다.

`caddy-private.conf`는 `/etc/systemd/system/caddy.service.d/private-console.conf`로 설치한다. 이 파일은 환경을 읽고, 배포판의 `--environ` 옵션을 제거해 재시작 시에도 secret이 journal에 출력되지 않게 한다. 기존 hardening drop-in과 Unix admin socket은 유지한다. 기존 전역 로그 filter에는 `X-Beanmap-Admin-Secret`, `Tailscale-User-Login`, `Tailscale-User-Name`, `Tailscale-User-Profile-Pic`, `Authorization`, `Cookie`의 치환/삭제를 추가한다. private listener의 access log는 기본적으로 켜지 않는다.

먼저 아래 승인된 운영 적용 순서의 1~3단계로 host 전송 경계를 설치한다. 그 뒤 환경 파일을 적용한 별도 프로세스에서 Caddy 구성을 검증한다. 실제 secret으로 `caddy adapt` 전체 JSON을 출력하지 않는다. 검증 후:

```sh
sudo systemctl daemon-reload
sudo systemctl reload caddy
sudo tailscale serve --bg --https=443 unix:/run/caddy/private/status.sock
sudo tailscale serve --bg --https=8443 unix:/run/caddy/private/studio.sock
sudo tailscale serve --bg --https=9443 unix:/run/caddy/private/admin.sock
```

Serve 설정은 `--bg`로 재부팅 후 유지된다. **Funnel 명령은 실행하지 않는다.** Tailscale 네트워크만 허용하며 OCI·호스트 방화벽의 공개 포트는 추가하지 않는다. `tailscale serve status --json`에서 세 포트의 Unix 소켓 전달과 Funnel 미사용을 확인한다.

소유자 헤더는 **권한으로 보호된 전송 경로를 통과한 뒤에만** 신뢰한다. Caddy는 `/run/caddy/private`의 Unix 소켓만 열며 디렉터리는 Caddy 소유 `0700`, 소켓은 `0600`이다. root로 실행되는 tailscaled와 이미 관리 권한을 위임받은 Caddy만 접근할 수 있다. 사이트 이름에 남은 9310~9312는 Caddy 내부 라우트 구분용이며 TCP 포트를 열지 않는다. 단순히 loopback에 바인딩하거나 헤더를 지우는 것으로 대체하지 않는다. Studio 쓰기는 기존과 같이 정확한 private Origin을 요구한다.

호스트의 일반 UID가 Studio 관리망 IP에 직접 연결하거나 자신의 Tailscale IP의 Serve에 접속해 노드 소유자 신원을 빌리는 경로도 차단해야 한다. `management-transport-guard.py`는 IPv4/IPv6 OUTPUT 첫 규칙에 두 전용 체인을 설치한다. 관리 bridge `bm-management`의 애플리케이션 연결은 root와 확인된 Caddy UID만(커널 IPv6 이웃 탐색 135·136은 유지), 자신의 Tailscale 주소의 443·8443·9443은 root만 허용한다. 원격 tailnet의 실제 사용자 요청은 이 로컬 OUTPUT 조건에 해당하지 않는다. 이 정책은 HTTP 경로와 무관해 모든 `/api/platform/*`, SQL, 프로젝트, 조직, 스니펫 경로에 적용된다. root 또는 Caddy 자체 침해까지 방어한다고 주장하지 않는다.

### 승인된 운영 적용 순서

이 절차는 운영 변경 승인을 받은 뒤 실행한다. 파일 준비나 테스트 통과만으로 운영 적용이 완료된 것은 아니다.

1. 기존 private Caddyfile, Serve JSON, 해당 systemd drop-in, IPv4/IPv6 OUTPUT 규칙을 root 전용 백업에 보관한다. 원본을 화면이나 일반 로그에 출력하지 않는다.
2. `management-transport-guard.py`를 `/usr/local/sbin/beanmap-private-transport`에 root:root `0755`로, `beanmap-private-transport.service`를 systemd unit 디렉터리에 root:root `0644`로 설치한다. `docker-private-transport.conf`는 Docker의 별도 drop-in으로 추가한다. 기존 drop-in을 덮어쓰거나 `ExecStartPost` 목록을 초기화하지 않는다.
3. 준비 도구와 새 `caddy-private.conf`를 설치해 소켓 디렉터리 `0700`을 준비한다. Caddy는 기존 non-root UID, 기존 writable `/run/caddy`, 기존 admin Unix socket을 유지한다. `systemctl daemon-reload` 후 `systemctl enable --now beanmap-private-transport.service`로 경계를 먼저 적용하고 `beanmap-private-transport check`가 성공하는지 확인한다. 도구는 unit 설정·실제 프로세스 UID를 검증하고 호출자의 헤더나 UID 인자를 받지 않는다.
4. 현재 전체 Caddy 환경에서 새 private Caddyfile을 포함한 후보를 검증한 뒤 교체·reload한다. 공개 Caddyfile 전체를 예제 파일로 교체하지 않는다. 이어 위의 세 Serve 대상만 Unix 주소로 갱신한다. 공유 loopback listener를 임시 fallback으로 남기지 않는다.
5. `ss`에 9310~9312 TCP listener가 없고 소켓 세 개의 `0600`·상위 디렉터리 `0700`이 유지되는지 확인한다. 소유자 tailnet 브라우저에서 기존 운영 현황·Studio·관리자 UI를 확인한다. `nobody`의 위조 소유자 헤더 요청은 Unix connect 단계에서 거부되어야 하며 관리망 IP와 자신의 Tailscale IPv4/IPv6 주소 우회도 거부되어야 한다.
6. 별도 승인된 재시작 점검에서 guard → Docker/Caddy 의존 순서와 guard 재적용을 확인한다. 보호 경계가 실패하면 의존 서비스 시작도 실패한다. 키·계정·DB 데이터 변경은 필요하지 않다.

문제 발생 시 공개 앱을 변경하지 말고 추가한 private Serve 포트를 끈 상태에서 원인을 해결한다. 노출된 예전 TCP listener나 일반 UID의 관리망 접근을 복원하는 방식으로 되돌리지 않는다. root의 SSH/Tailscale 및 기존 공개 트래픽은 이 규칙의 대상이 아니다.

### 격리 검증

`python3 ops/private-console/deploy/test-private-transport.py`는 Caddy 2.11.4와 두 개의 일회용 Linux 컨테이너를 사용한다. 호스트 네트워크와 운영 계정은 사용하지 않는다. 실제 UID 65534가 소유자 헤더·정상 Origin을 모두 위조해도 Unix 소켓, 직접 관리망 IPv4/IPv6, 자신의 Serve 주소에서 거부되는지 검사한다. root의 정상 프록시 흐름, Caddy UID의 관리망 연결, 모든 대표 플랫폼 경로, 기존 Origin 제한, guard 두 번 적용, 예전 TCP listener 부재를 함께 확인한다.

전송 지원 확인: [운영 Tailscale 1.102.3의 Unix HTTP proxy 구현](https://github.com/tailscale/tailscale/blob/v1.102.3/ipn/ipnlocal/serve.go), [Caddy Unix bind](https://caddyserver.com/docs/caddyfile/directives/bind), [Caddy 소켓 권한](https://caddyserver.com/docs/conventions#network-addresses).

## 확인과 복구

운영 홈의 연결 상태·갱신 시간, Studio의 테이블/행 읽기, 기존 앱 로그인 후 관리자 화면을 확인한다. 외부 도메인에서는 관리자 페이지·API·RPC가 거절되어야 한다. owner 헤더가 없거나 다른 사용자면 private 세 listener가 404를 반환하고, 정적 허용 목록 밖의 파일은 소유자도 404여야 한다. 상태 응답과 화면에 원시 로그·SQL·이메일·토큰이 없는지 확인한다.

DB·서비스를 재시작하지 않고 콘솔 노출만 중단하려면 추가한 Serve 포트만 `tailscale serve --https=PORT off`로 비활성화한다. 이전에 있던 Serve 규칙은 유지한다. Studio 중단은 이 별도 프로젝트에 대해서만 `docker compose ... stop`을 사용한다. `down -v`, DB 볼륨 삭제, 비밀키 교체는 복구 절차에 포함하지 않는다. Caddy 문제가 있으면 백업본 설정으로 검증 후 reload한다. 공개 RPC를 다시 생성하거나 `beanmap_private`를 노출하는 방식으로 되돌리지 않는다.

참고: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Supabase 공식 Compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml), [Compose env_file raw](https://docs.docker.com/reference/compose-file/services/#env_file).
