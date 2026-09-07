# 2026-09-07 보안 감사: 컨테이너 격리 적용안

이 변경은 **저장소의 배포 후보**다. 운영 컨테이너, 호스트 방화벽, 인증 설정은
아직 변경하지 않았다. 운영 이미지는 읽기 전용으로 조사했으며, Compose 병합과
방화벽 반복 적용은 로컬 회귀 테스트로 검증한다. 실제 이미지의 재시작/DB 복원
호환성은 아래 격리 환경 검증이 끝나기 전까지 완료로 취급하지 않는다.

## 네트워크 경계

- `beanmap-management`: IPv4 `internal` bridge `bm-management`. Meta와 Studio는
  이 망에만 연결한다. DB와 Kong만 기존 런타임 망과 관리망 양쪽에 연결하여
  Meta의 DB 접속과 Studio의 Supabase API 사용을 유지한다.
- 웹은 DB 런타임 망에서 제거한다. 기존 인증 전용망의 **동일 고정 IP**로 Kong에
  연결하며, 새 `internal` 앱망을 통해 Go API에 연결한다. 기존 Kong의 /32 신뢰와
  ingress proof 설정은 유지한다. API는 DB 접속 때문에 런타임 망을 유지한다.
- `DOCKER-USER` 첫 규칙은 관리 bridge로 들어오는 다른 인터페이스의 전달 트래픽을
  차단한다. 따라서 앱이 관리 IP를 직접 알아도 Meta/Studio로 연결할 수 없다.
  호스트 Caddy의 loopback Studio 연결은 호스트 OUTPUT 경로라 유지된다.
- 모든 IPv4 전달 트래픽의 `169.254.169.254/32` 목적지를 차단하여 Docker bridge
  컨테이너의 OCI IMDS 접근을 막는다. 호스트의 IMDS 접근은 바꾸지 않는다.
  host-network/macvlan 컨테이너는 이 경계 밖이며 새로 도입하지 않는다.
- DB/Kong은 의도적으로 관리망의 신뢰 구성원이다. 이들의 코드 실행 권한을 얻은
  공격자까지 격리하는 구성은 아니다. DB 접근을 가진 Go API와 웹을 같은 망에
  두는 기존 구성보다 접근 범위를 줄인다.

## 재현 가능한 준비와 설치 순서

Docker Compose 2.30 이상, Linux Docker iptables backend를 전제로 한다.
`iptables-nft` 호환 frontend는 지원하지만 Docker native nftables backend는
`DOCKER-USER`가 없어 중단한다. 기존 chain/rule을 flush하지 않는다.

1. 기존 Compose/override/client-IP 파일, systemd drop-in을 root 전용 위치에
   백업한다. 실제 운영 배포 wrapper가 사용하는 파일 목록도 확인한다. 기존
   secret 파일을 출력하거나 저장소의 예제 Compose로 운영 파일을 대체하지 않는다.
2. `python3 ops/production/provision-container-boundary.py`로 비밀정보 없는 계획을
   검토한다. 승인된 적용 시 스크립트를 root 소유 0755의
   `/usr/local/sbin/beanmap-container-boundary`에 설치하고 `--apply`를 실행한다.
   소유 label, internal 옵션, bridge 이름이 다른 기존 네트워크를 재사용하지 않는다.
   네트워크/방화벽만 준비하며 컨테이너 이동이나 재시작은 하지 않는다.
3. `docker-container-boundary.conf`를
   `/etc/systemd/system/docker.service.d/beanmap-container-boundary.conf`에 설치하고
   `systemctl daemon-reload`한다. **Docker를 재시작해서 적용할 필요는 없다.**
   이후 Docker 시작 시 guard를 재확인한다. 프로비저닝 실패 시 Docker 시작도 실패하므로
   다른 모든 컨테이너의 의존성까지 포함해 drop-in을 검토한다.
4. 운영 Supabase 디렉터리에 `compose.security-supabase.yml`을 보안 override로
   복사한다. 기존 base, override, client-IP 파일 **뒤에** 마지막 `-f`로 포함한다.
   네트워크의 기존 웹 IPv4를 앱의 기존 `.env`에 `BEANMAP_WEB_AUTH_IP`로 설정하고
   앱 디렉터리에 `compose.security-app.yml`을 `docker-compose.security.yml` 이름으로
   설치한다. 이는 비밀값이 아니며 기존 인증 /32와 반드시 일치해야 한다. 저장소의
   갱신된 `scripts/beanmap-deploy-wrapper.sh`를 기존 위치에 설치한다. wrapper는 보안
   파일이 있으면 base/client-IP 뒤에 자동으로 포함한다. 기존 `.env`의 다른 값은
   변경하거나 출력하지 않는다. 다음 배포에도 마지막 파일이 유지되어야 한다.
   웹 network의 `!override`를 없애면 기존 DB망이 남으므로 일반 YAML 병합으로
   대체하지 않는다. `docker compose ... config --quiet`로 검증한다.
5. 별도 DB 복원 환경에서 같은 image digest, ownership, 볼륨 구조로 아래 제한의
   호환성을 검증한다. 데이터 볼륨을 운영/테스트가 공유하지 않도록 한다.
6. 점검 시간에 DB/Kong을 관리망에 연결하는 보안 overlay를 적용하고 health를 확인한
   뒤 새 private-console Compose를 적용한다. 마지막으로 앱 보안 overlay를 적용한다.
   이 순서는 기존 앱 DB/API 경로를 먼저 제거하지 않는다. DB/Kong 재생성에는 짧은
   서비스 중단이 있으므로 무중단 배포로 표시하지 않는다.

## 런타임 제한과 인증 정책

Kong/Auth/REST는 모든 capability를 제거하고 권한 상승을 막으며 루트 파일시스템을
읽기 전용으로 한다. 제한된 tmpfs만 쓰기를 허용한다. Kong의 생성 설정/LMDB/socket/
인증서는 `KONG_PREFIX=/var/run/kong` 및 `KONG_DECLARATIVE_CONFIG=/var/run/kong/kong.yml`로
옮기고 UID 1001 전용 tmpfs를 제공한다. 기존 `/usr/local/kong`에는 필수 공유 라이브러리도
있어 tmpfs로 가리면 libada 로딩 실패로 시작하지 못한다. 실제 운영 이미지의 별도
컨테이너에서 수정한 경로로 정상 시작 및 `kong health` 통과를 확인했다.

DB는 root entrypoint가 소유권을 조정한 후 postgres(100:101)로 전환한다. 따라서
CHOWN/DAC_OVERRIDE/FOWNER/SETGID/SETUID만 남긴다. DB 데이터 및 기존 설정 볼륨은
유지하고 `/var/run/postgresql`과 `/tmp`에 한정한 tmpfs를 추가한다. 기존 SQL 초기화
bind mount의 쓰기 권한은 이번 overlay에서 바꾸지 않는다. 새 빈 DB 초기화까지
검증한 설정이 아니며 기존 DB 복원 후 재시작을 검증해야 한다.

메모리 상한은 Kong 768 MiB, Auth/REST 각 512 MiB, DB 4 GiB다. PID/CPU 제한도
명시한다. 실제 피크 메모리와 DB shared_buffers/work_mem을 확인하고 OOM 없이
정상 읽기/쓰기/인증/백업을 수행하는지 검증한다. Docker 기본 seccomp와 호스트의
기본 AppArmor를 유지하며 `unconfined`를 추가하지 않는다. 별도 커스텀 프로파일은
호환성 검증 없이 넣지 않는다.

전화 인증과 SMS 자동 확인은 끈다. PostgREST 노출 schema는 `public`만 남긴다.
세션 최대 수명은 30일, 유휴 기간은 7일로 지정한다. 세션 제한은 Auth의 refresh
검사 시 적용되며 이미 발급한 access token을 즉시 폐기하는 기능은 아니다.
비밀번호 변경 재인증 옵션도 켠다. Auth는 최근 생성한 세션을 재인증으로 인정할 수
있으므로 이 옵션만으로 탈취된 모든 세션의 비밀번호 변경을 막았다고 볼 수 없다.
앱의 recovery proof와 [공개 Auth 변경 차단](public-auth-updates.md)을 함께 적용한다.
Caddy 정책까지 적용된 뒤에는 공개 Auth PUT/PATCH 직접 호출이 거부된다.
운영 Caddy 반영 전이나 침해된 컨테이너의 내부 Auth 접근에는 이 차단이 적용되지 않는다.
설정 키는 [배포 버전 Auth v2.195.0 소스](https://github.com/supabase/auth/blob/v2.195.0/internal/conf/configuration.go)
기준으로 확인했다.

## 완료 판정과 복구

- `python3 -m unittest discover -s ops/production -p 'test_*.py'`는 반복 적용,
  앞선 ACCEPT/RETURN 처리, 관리망 소유권 검증, 실제 Compose 병합을 검사한다.
- 격리 복원 환경에서 모든 core healthcheck, 로그인/갱신/복구, 데이터 읽기/쓰기,
  Studio 및 Meta health를 검증한다. read-only 위반, OOM, PID 제한 오류를 확인한다.
- 적용 후 web/API에서 Meta/Studio DNS 및 직접 IP의 TCP 접근이 실패해야 한다.
  웹에서 OCI v2 IMDS에 `Authorization: Bearer Oracle` 헤더를 넣어도 timeout/거부가
  나와야 한다. 본문은 수집하지 않는다. Studio→Meta/DB/Kong 및 웹→Kong/API,
  API→DB는 계속 성공해야 한다. Tailscale 전용 Studio/Caddy도 확인한다.
- 재생성 후 웹에는 DB망이 없어야 하고 Meta/Studio에는 관리망만 있어야 한다.
  다음 정상 앱 배포 후에도 같은 조건을 다시 확인한다.
- 호환성 실패 시 해당 서비스의 보안 overlay만 백업본으로 복구한다. DB 볼륨이나
  네트워크를 삭제하지 않는다. 관리 서비스가 기본망으로 돌아오면 HIGH-1은 다시
  열린 것으로 기록한다. IMDS 규칙은 앱 기능과 무관하므로 유지한다.
- OCI dynamic group/Instance Principal 권한, 일반 egress 목적지 허용목록 및
  Tailscale 전용 SSH 규칙은 별도 운영 검토가 남아 있다.
