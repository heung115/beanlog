# PostgreSQL 17.11 보안 이미지와 복원 검증

2026-09-07 운영의 `beanlog-postgres:17.6.1.136-p1`을 기준으로 준비했다.
2026-09-07 08:56–08:57 UTC에 운영 DB 전환을 완료했다. 전체 보안 변경의 최종
적용 상태는 `SECURITY_HARDENING_2026-09-07.md`의 운영 검증 기록을 확인한다.

## 이미지와 출처

- 후보: `beanlog-postgres:17.11-supabase136-p1`
- 이미지 ID: `sha256:c61e973bda4604a04677fa7aeacc49928d5e0a5ef0eb66c9ca426723b3ae6bf3`
- 기반 이미지 ID: `sha256:7383f3aa50be9ea0c38fe0a3b5360cc651d511364fe424375650f0efe699eca6`
- 공식 소스: <https://ftp.postgresql.org/pub/source/v17.11/postgresql-17.11.tar.bz2>
- 공식 `.sha256`와 대조한 SHA-256:
  `dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979`
- [PostgreSQL 17.11 릴리스 노트](https://www.postgresql.org/docs/17/release-17-11.html),
  [17 계열 보안 수정 목록](https://www.postgresql.org/support/security/17/).

확인 당시 공식 Supabase Docker Hub에는 `17.11` 태그가 없었다. 일반 PostgreSQL
이미지로 교체하면 Supabase 확장과 키 처리 설정을 잃으므로, 기존 이미지의 Nix
derivation·컴파일 옵션·패치를 사용해 PostgreSQL 코어, libpq, contrib를 17.11
공식 소스로 다시 빌드했다. GCC 15.2.0, ICU 75.1 및 기존 라이브러리를 유지했다.
Nix 빌드 의존성 추가량은 약 356 MiB였고 최종 이미지에는 새 코어·라이브러리
출력 경로 두 개만 추가했다. 컴파일러와 소스는 운영 이미지에 포함하지 않았다.

기존 Supabase 확장 파일과 설정은 그대로 유지한다. 확장의 RPATH까지 패치된
libpq를 사용하도록 기존 코어·라이브러리 경로를 새 출력으로 연결하고, Supabase
패키지가 별도로 복사한 postgres/pg_ctl/pg_config도 교체했다. postgres 실행
래퍼의 `NIX_PGLIBDIR` 설정은 유지했다. Nix 경로 이름 일부가 17.6으로 남아도
실제로 실행되는 서버·psql·pg_dump는 모두 17.11이다.

## 비공개 백업과 빌드 재현 자료

서버 경로: `/srv/beanlog/security-postgres-20260907` (root 소유, mode 0700).
DB 백업·설정·키·복원 로그는 서버 밖으로 내보내거나 Git에 추가하지 않는다.

- `cluster.sql`: 당시 전체 `pg_dumpall --clean --if-exists` 백업, 약 1.1 MiB.
- `original-derivation.json`, `build-attrs.json`, `postgresql-17.11.nix`:
  원본 및 수정 빌드 정의.
- `restore-build-deps.sh`, 공식 소스 아카이브와 `source-sha256.txt`, `build.log`.
- `image/manifest.json`, `image/Dockerfile`: 기반·출력 경로·이미지 생성 기록.
- `restore-before.json`, `restore-after.json`: 업데이트 전후 테이블 지문.
- `restore-data-v2`, `restore-custom`: 운영 볼륨과 분리된 검증용 복원본.

빌드 컨테이너 `beanmap-pg1711-builder`는 운영 볼륨을 마운트하지 않았다. 외부
다운로드를 위한 host network를 사용했지만 sleep/컴파일 프로세스만 실행하며
서버 포트를 열지 않았다. 최종 이미지 패키징은 네트워크 없이 실행했다.

완료된 빌드의 패키징 도구:

```sh
sudo python3 package-postgres-security-image.py \
  --directory /srv/beanlog/security-postgres-20260907/image
```

이 도구는 이미지만 만들며 운영 서비스 시작·중지·교체를 하지 않는다.
현재 기반 이미지의 경로에 맞춘 도구이므로 다른 Supabase 기반으로 바꿀 때는
Nix 출력 및 plugin union 경로를 새로 조사해야 한다.

## 복원·업그레이드 검증 결과

1. 기존 HBA에 replication 접속 허용 규칙이 없어 `pg_basebackup`은 거부됐다.
   운영 HBA는 변경하지 않고 전체 논리 백업을 생성했다.
2. 별도 디렉터리에 17.6으로 초기화하고 전체 백업을 복원했다. 초기 bootstrap
   역할 이름을 운영과 같은 `supabase_admin`으로 유지해야 PostgreSQL의
   `GRANTED BY` 역할 복원이 성공한다. 원본 백업은 그대로 보관하고 복원용
   사본에서 해당 역할의 DROP/CREATE 두 줄만 제외했다.
3. pg_net/pg_cron이 빈 기본 DB에 연결하므로 복원용 사본의 기본 postgres DB
   DROP에만 `WITH (FORCE)`를 적용했다. **이 조정은 격리된 복원본에만 적용했다.**
   전체 복원은 `ON_ERROR_STOP=1`로 실행해 오류 0건을 확인했다.
4. 동일 복원 볼륨을 17.11 후보 이미지로 재시작했다. 운영 데이터 볼륨은 이
   과정에서 읽거나 쓰지 않았다. 17.11 서버가 healthy 상태가 됐다.
5. public/auth/Vault의 33개 테이블에서 행 수와 정렬된 행 지문을 비교했다.
   **17.6 → 17.11 전환 전후 전부 일치했다.** 인증 사용자 수 6, RLS 테이블 수
   38, 설치 확장 6개가 유지됐다. 이 수치는 복원 시점의 검증용 값이다.
6. 설치된 pg_net 0.20.3, pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0,
   supabase_vault 0.3.1, uuid-ossp 1.1을 확인했다. 운영의 11개 preload 모듈이
   모두 로드됐고 pg_stat_statements 조회·pgcrypto SHA-256 계산도 성공했다.
7. 모든 DB의 기록된/실제 ICU collation 버전은 153.121로 일치했다. 복제 슬롯
   0개이며, 17.11 별도 재색인 대상인 btree_gist/ltree는 설치되지 않았다.
   새 output_plugin_libraries 기본값은 `pgoutput, test_decoding`이다.
8. `compose.security-supabase.yml`과 같은 read_only, /tmp·소켓 tmpfs,
   no-new-privileges, 제한된 5개 capability, PID 512, 메모리 4GiB, CPU 2 조건을
   실제 복원 컨테이너에 적용했다. 추가 writable 경로는 필요하지 않았다.

upstream PostgreSQL 자체 전체 회귀 시험은 이 빌드에서 실행하지 않았다.
대신 실제 운영 전체 백업 복원, 확장/콜레이션/데이터 지문 확인, 보안 제한을
적용한 재시작을 수행했다. 인증 후보는 이 17.11 복원 DB에서 제한된 컨테이너
시작, 로그인·refresh·복구·일회성 토큰·비밀번호 교체·세션 만료 등 18개 검사를
모두 통과했다. 검증용 사용자는 삭제했고 임시 컨테이너와 네트워크를 정리했다.

## 운영 전환 결과

- `apply-postgres-security-upgrade.py --apply`로 DB 서비스만 전환했다. 명시적
  `.env`와 base/override/client-ip/security 네 파일을 모두 사용했고
  `--no-deps --pull never db`로 다른 서비스의 재생성을 막았다.
- 전환 직전 최신 논리 백업과 정상 종료 상태의 물리 데이터·db-config 백업을
  `/srv/beanlog/security-postgres-20260907/live-changeover`에 보관했다.
  디렉터리는 root 0700, 파일은 root 0600이며 SHA256SUMS 검증이 통과했다.
- 실제 운영 서버 버전 170011, 위 후보 이미지 ID, healthy 상태를 확인했다.
  기존 PGDATA bind와 db-config named volume을 그대로 사용했다.
- read_only/no-new-privileges/5개 capability 제한을 확인했다. DB는 기존 runtime
  망과 새 management 망에 연결된다. 웹에서 DB에 직접 연결하는 권한은 별도
  앱·관리망 배포에서 제한한다.
- 설치 확장 6개·preload 11개·사용자 6명·RLS 테이블 38개가 유지되고 암호화
  함수 호출이 성공했다. 연결 가능한 모든 DB의 collation 버전이 일치했다.
  연결 불가 `template0`의 NULL collation 기록은 재색인 대상 불일치로 보지 않는다.
- 롤백 없이 정상 적용됐다. DB 전환 동안 다른 운영 컨테이너를 변경하지 않았고
  전환 직후 모두 healthy 상태를 확인했다.

## 운영 전환 절차

1. 후보 이미지와 최종 Compose 병합 결과를 고정하고 롤백 이미지 ID를 보관한다.
2. **최종 전환 직전에 최신 전체 논리 백업을 다시 생성한다.** 위 최초 백업
   이후 적용한 ACL 마이그레이션과 새 쓰기가 포함되어야 한다.
3. coordinated maintenance에서 DB 연결 클라이언트를 중지하고 DB를 정상
   종료한 뒤, 데이터 디렉터리와 db-config 볼륨의 비공개 물리 사본을 보관한다.
4. 같은 major 17 데이터 볼륨으로 검증된 17.11 이미지와 보안 overlay를 시작한다.
   image만 바꾸고 초기화·복원·삭제 명령을 운영 데이터에 실행하지 않는다.
5. DB healthy/실제 버전/확장/콜레이션/ACL을 확인한 후 클라이언트를 시작하고
   애플리케이션·인증의 상태와 인증 동작을 재검증한다.
6. 실패 시 새 쓰기를 허용하기 전에 중지하고 보관한 이전 이미지·설정을 사용해
   복구한다. 데이터 복원은 별도 판단하며 최신 사용자 쓰기를 덮어쓰지 않는다.
