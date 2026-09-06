# 비공개 운영 콘솔 배치 메모

이 폴더는 준비된 소스다. 운영 배치나 Tailscale 접근 정책 적용 자체를 의미하지 않는다.
운영 서버 변경은 통합 담당자가 수행한다.

## 파일과 권한

- `/opt/beanmap-private-console/collector.py`: root 소유, 일반 사용자 쓰기 금지.
- `/opt/beanmap-private-console/public/`: `index.html`, `app.js`, `style.css`, `config.json`만 복사.
- `/etc/beanmap-console/collector.json`: `collector.example.json`을 기준으로 root 소유 `0640` 이하. 그룹/기타 사용자 쓰기 금지. 비밀값을 넣지 않는다.
- `/var/lib/beanmap-console/`: root:caddy `0750`. 최초 설치 때 해당 소유권을 지정한다.
- `status.json`: 수집기가 root:caddy `0640`으로 원자적 교체한다.
- `cpu-state.json`: 수집기가 `0600`으로 저장하는 이전 CPU 카운터다. 웹에서 제공하지 않는다.
- 수집기 service/timer 예시는 `/etc/systemd/system/`에 설치한다. 웹 서버 사용자 그룹이 `caddy`가 아니면 service의 `Group`과 데이터 디렉터리 그룹을 함께 맞춘다.

`config.json`에는 `studioUrl`, `adminUrl`만 지정한다. 둘 다 HTTPS `*.ts.net` 주소이고
사용자 이름·비밀번호가 포함되지 않은 URL이어야 링크가 표시된다. 키·토큰·DB 접속 문자열은
설정하지 않는다. 링크에 이미지를 포함하거나 외부 스크립트/글꼴을 불러오지 않는다.

## Caddy 연결 시 필수 경계

- 콘솔 HTTP 리스너는 `127.0.0.1`에만 bind하고 Tailscale 개인 전용 접근 게이트를 통해 노출한다.
- `/`, `/index.html`, `/app.js`, `/style.css`, `/config.json`만 public 디렉터리에서 제공한다.
- `/status.json`만 `/var/lib/beanmap-console/status.json`에 명시적으로 연결한다.
- 나머지 경로, 디렉터리 탐색, `cpu-state.json`, 수집기와 테스트 파일은 404 처리한다.
- HTTP GET/HEAD만 허용하고 다른 메서드는 405 처리한다.
- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY`를 사용한다.
- 권장 CSP: `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- Caddy에 Docker 소켓, docker 그룹, sudo 또는 root 권한을 추가하지 않는다.

## 수집 내용과 의미

15초 oneshot timer이므로 이전 실행이 끝나기 전에 새 수집기가 겹쳐 실행되지 않는다.
고정 명령의 출력은 256 KiB, DB 집계는 16 KiB, 개별 명령 실행은 최대 4초로 제한한다.
최대 4개의 읽기 작업을 병행한다. 비정상적으로 긴 명령 출력이나 실패는 버리고
해당 값을 `unknown`/`unavailable`로 표시한다. 단위 서비스 timeout은 90초이며,
화면은 60초 이상 갱신되지 않은 결과를 오래된 상태로 표시한다.

CPU는 이전 수집부터의 평균이다. 첫 수집과 재부팅 직후에는 수치가 없다.
메모리는 Linux MemAvailable 기준이며, DB 연결 집계에는 조회 세션 자체도 포함된다.
DB 쿼리는 연결 timeout 2초, 읽기 전용 트랜잭션 기본값, statement timeout 2초, lock timeout 1초로 실행한다.
Docker CLI가 종료되더라도 DB 쿼리에 별도 시간 제한이 유지된다.

로그는 서비스별 최근 15분의 최대 60줄(stdout과 stderr 모두)에서 요약한다.
GIN 접근 로그의 알려진 경로는 동적 ID와 쿼리를 제거하며, 인식하지 못한 경로는
`기타 경로`로 바꾼다. 원문, SQL, IP, 이메일, 요청 헤더/본문은 저장하지 않는다.
다른 로그는 level/severity 또는 대문자 오류 표식을 보고 오류·경고 건수만 센다.
따라서 표시되는 건수는 로그 표본의 요약이며 전체 요청 통계가 아니다.

백업 항목은 지정 폴더 안의 가장 최근 일반 파일의 시각·크기만 보여 준다.
파일 내용, 이름, 경로는 JSON에 넣지 않는다. DB 백업 성공 여부를 판정하는 기능은 아니다.

## 검증

```sh
python3 -m unittest -v test_collector.py
node --test test_app.mjs
node --check public/app.js
```

준비 소스에서 unit 검증을 수행했다. 운영 적용 후에는 실제 JSON 갱신, root/caddy 파일
권한, Caddy 명시 경로 차단, 본인 Tailscale 접속, 미허용 기기와 공개 인터넷 접속 차단을
통합 담당자가 검증해야 한다. 브라우저와 운영 서버는 이 소스 준비 과정에서 실행하지 않았다.
