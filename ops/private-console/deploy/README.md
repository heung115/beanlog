# 비공개 운영 콘솔 배포

이 구성은 기존 앱·DB·Kong을 그대로 사용하고 Studio와 postgres-meta만 별도 Compose 프로젝트로 실행한다. Tailscale Serve가 인증한 **현재 서버 소유자 계정**만 운영 화면에 들어갈 수 있다. 기기를 공유하거나 다른 사용자를 tailnet에 추가해도 그 사용자에게 관리 권한을 주지 않는다.

| 화면 | Tailscale HTTPS | 서버 내부 전달 |
| --- | --- | --- |
| 운영 현황 | `https://oracle-free.tail6e4bc0.ts.net` | Serve 443 → `127.0.0.1:9310` |
| 데이터베이스 Studio | `https://oracle-free.tail6e4bc0.ts.net:8443` | Serve 8443 → `127.0.0.1:9311` → Studio `127.0.0.1:4321` |
| beanmap 관리자 | `https://oracle-free.tail6e4bc0.ts.net:9443/ko/admin` | Serve 9443 → `127.0.0.1:9312` → 기존 Next `127.0.0.1:3100` |

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
sudo docker compose -f /opt/beanmap-private-console/deploy/compose.yml config --quiet
sudo docker compose -f /opt/beanmap-private-console/deploy/compose.yml pull
sudo docker compose -f /opt/beanmap-private-console/deploy/compose.yml up -d --wait
```

최초에는 두 healthcheck와 Studio의 DB 테이블 목록 조회를 확인한다. 두 컨테이너의 실제 Docker network aliases에 `studio`·`meta`가 없음을 확인하고, 공개 API 도메인의 `/`, `/pg/`, `/mcp`, `/api/mcp`에서 Studio·meta가 접근되지 않는지도 확인한다. Studio와 meta가 UID 1000으로 정상 동작하는지 확인하고, 쓰기 권한 오류를 해결하려고 root 실행이나 전체 디렉터리 `0777`로 바꾸지 않는다. 전용 snippets만 쓰기 가능하며 기존 함수 소스는 공유하지 않는다.

## Caddy와 Tailscale Serve 연결

`beanmap-private.Caddyfile`을 `/etc/caddy/beanmap-private.Caddyfile`에 설치하고 기존 주 Caddyfile의 top-level에 `import /etc/caddy/beanmap-private.Caddyfile`을 한 번만 추가한다. 기존 공개 사이트 라우팅·배포 webhook·보안 헤더를 유지한다.

`caddy-private.conf`는 `/etc/systemd/system/caddy.service.d/private-console.conf`로 설치한다. 이 파일은 환경을 읽고, 배포판의 `--environ` 옵션을 제거해 재시작 시에도 secret이 journal에 출력되지 않게 한다. 기존 hardening drop-in과 Unix admin socket은 유지한다. 기존 전역 로그 filter에는 `X-Beanmap-Admin-Secret`, `Tailscale-User-Login`, `Tailscale-User-Name`, `Tailscale-User-Profile-Pic`, `Authorization`, `Cookie`의 치환/삭제를 추가한다. private listener의 access log는 기본적으로 켜지 않는다.

환경 파일을 적용한 별도 프로세스에서 Caddy 구성 검증을 먼저 수행한다. 실제 secret으로 `caddy adapt` 전체 JSON을 출력하지 않는다. 검증 후:

```sh
sudo systemctl daemon-reload
sudo systemctl reload caddy
sudo tailscale serve --bg --https=443 http://127.0.0.1:9310
sudo tailscale serve --bg --https=8443 http://127.0.0.1:9311
sudo tailscale serve --bg --https=9443 http://127.0.0.1:9312
```

Serve 설정은 `--bg`로 재부팅 후 유지된다. **Funnel 명령은 실행하지 않는다.** Tailscale 네트워크만 허용하며 OCI·호스트 방화벽의 공개 포트는 추가하지 않는다. `tailscale serve status --json`에서 세 포트의 HTTP loopback 전달과 Funnel 미사용을 확인한다.

소유자 검증은 Serve가 덮어써서 전달하는 `Tailscale-User-Login`에 기반한다. Caddy의 세 포트는 `127.0.0.1`에만 바인딩한다. 다른 네트워크 인터페이스로 바꾸거나 임의 프록시를 앞에 두면 이 신뢰 경계가 달라진다. Studio의 쓰기 요청은 정확한 private Studio Origin을 요구하며, 다른 Origin이나 Origin 누락은 403이다.

## 확인과 복구

운영 홈의 연결 상태·갱신 시간, Studio의 테이블/행 읽기, 기존 앱 로그인 후 관리자 화면을 확인한다. 외부 도메인에서는 관리자 페이지·API·RPC가 거절되어야 한다. owner 헤더가 없거나 다른 사용자면 private 세 listener가 404를 반환하고, 정적 허용 목록 밖의 파일은 소유자도 404여야 한다. 상태 응답과 화면에 원시 로그·SQL·이메일·토큰이 없는지 확인한다.

DB·서비스를 재시작하지 않고 콘솔 노출만 중단하려면 추가한 Serve 포트만 `tailscale serve --https=PORT off`로 비활성화한다. 이전에 있던 Serve 규칙은 유지한다. Studio 중단은 이 별도 프로젝트에 대해서만 `docker compose ... stop`을 사용한다. `down -v`, DB 볼륨 삭제, 비밀키 교체는 복구 절차에 포함하지 않는다. Caddy 문제가 있으면 백업본 설정으로 검증 후 reload한다. 공개 RPC를 다시 생성하거나 `beanmap_private`를 노출하는 방식으로 되돌리지 않는다.

참고: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Supabase 공식 Compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml), [Compose env_file raw](https://docs.docker.com/reference/compose-file/services/#env_file).
