# 비공개 관리자 운영

관리 도구는 Oracle 서버의 Tailscale HTTPS 주소로 접속한다. 공개 웹에서는 관리자
화면과 관리자 API를 제공하지 않는다. 상세 설치·접속·배포 절차는
[비공개 운영 콘솔 배포 안내](ops/private-console/deploy/README.md)를 따른다.

| 접속 위치 | 용도 | 접근 권한 |
|---|---|---|
| Tailscale HTTPS `443` | 운영 홈, 서버 상태와 로그 | 지정한 본인 Tailscale 계정 |
| Tailscale HTTPS `8443` | Supabase Studio: 테이블 조회·SQL 등 DB 운영 | 지정한 본인 Tailscale 계정, Studio 접근 설정 |
| Tailscale HTTPS `9443/ko/admin` 또는 `9443/en/admin` | 서비스 집계, 산지 한국어 표기 수정, 수정 이력 | 본인 Tailscale 계정 + 서비스 로그인 + DB 관리자 허용 목록 |

Studio는 DB를 직접 운영하는 도구다. 서비스 관리자 화면의 제한된 권한이나 개인 기록
RLS와 같은 범위로 이해하면 안 된다. Studio에서 실행하는 SQL은 연결된 DB 운영 역할의
권한을 사용하므로 실제 데이터와 스키마를 변경할 수 있다.

Mac에서 내부 주소가 조회되지 않으면 Tailscale의 DNS 설정 사용을 켠다.
이 서버는 일반 인터넷에 공개되지 않으며, 접속 기기도 본인 Tailscale 계정으로 연결되어 있어야 한다.

## 접근 경계

비공개 입구는 신뢰할 수 있는 Tailscale 연결에서 확인한 사용자 계정이 지정된 본인과
정확히 일치해야 요청을 통과시킨다. 브라우저가 임의로 보낸 Tailscale 사용자 헤더나
`X-Forwarded-For`, 호스트 이름만으로 접근을 허용하지 않는다.

관리자 웹과 Go API는 `ADMIN_INGRESS_SECRET_FILE`로 마운트한 비밀값을 사용한다.
32바이트 이상인 값이 읽혀야 관리자 접근이 활성화된다. 공개 요청의 헤더로 대신할 수
없으며, 이 값은 브라우저나 공개 환경 변수에 보내지 않는다. Go API는 서버 간
`X-Beanmap-Admin-Secret`을 constant-time 비교하고, 없거나 잘못되면 JWT·DB 검사 전에
`404`를 반환한다. 관리자 응답에는 실패한 요청까지 `Cache-Control: no-store`가 적용된다.

비공개 입구를 통과해도 서비스 웹·API의 로그인 검사는 유지된다. Go가 Supabase JWT를
검증하고 DB 요청 역할을 `authenticated`로 낮춘 뒤, `auth.uid()`가
`beanmap_private.admin_users`에 등록됐는지 매번 확인한다. 사용자 메타데이터의
`role`, `is_admin`, 표시 이름이나 이메일은 권한을 부여하지 않는다.

관리자 DB 함수 네 개는 모두 `beanmap_private`에 있으며, 공개 PostgREST 스키마에
함수나 호환 wrapper를 두지 않는다. **관리자 JWT를 가지고 있어도 공개 RPC로 호출할
수 없어야 한다.** PostgREST 노출 스키마에 `beanmap_private`를 추가하지 않는다.
`authenticated`에는 스키마 `USAGE`와 지정된 함수의 `EXECUTE`만 주고, private 테이블과
시퀀스의 직접 접근 권한은 주지 않는다. 함수는 `SECURITY DEFINER`, 빈 `search_path`,
내부 관리자 허용 목록 검사를 유지한다.

## DB 적용

`00024_admin_console.sql`은 관리자 테이블과 기능을 만들고,
`00025_private_admin_boundary.sql`은 관리자 함수를 비공개 스키마로 옮긴다. 운영 DB가
`00023`까지 적용된 상태라면 **두 파일을 한 트랜잭션으로 적용한다.** `00024`만 먼저
확정하지 않는다. 앱 배포 도구는 이 DB 마이그레이션을 자동으로 적용하지 않는다.

[적용 보조 도구](ops/private-console/apply-admin-migrations.py)는 기본적으로 SQL만
출력한다. 저장소 밖에서 실행해도 자기 파일 위치를 기준으로 마이그레이션을 찾는다.
운영 적용 상태와 복구 가능한 백업을 확인한 뒤 실행한다.

```bash
python3 ops/private-console/apply-admin-migrations.py > /tmp/beanmap-admin-migrations.sql
# 위 SQL을 검토한 뒤 실제 적용할 때만:
python3 ops/private-console/apply-admin-migrations.py --apply
```

`--apply`는 `ssh oracle`을 통해 `supabase-db`의 `psql`에 SQL을 표준 입력으로 전달한다.
기존 private 스키마나 관리자 함수가 있으면 중단한다. `00025`의 바깥 `BEGIN`/`COMMIT`만
제거하고 전체를 한 트랜잭션으로 감싸며, 함수 위치·권한·테이블 RLS와 일반 사용자 거절을
확인한 뒤 커밋한다. 커밋 전에 SQL 오류나 잠금 시간 초과가 발생하면 두 파일의 변경을
함께 롤백한다. 연결이 끊겨 결과가 불명확하면 DB 상태를 확인하고 재실행 여부를 판단한다.
Supabase CLI 마이그레이션 이력은 자동 갱신하지 않으므로 별도로 운영 이력을 유지한다.
이미 하나라도 적용된 DB에는 이 보조 도구를 재실행하지 않는다.

적용 후에는 신뢰할 수 있는 DB 운영 세션에서 함수 위치와 권한을 다시 확인한다.

```sql
SELECT n.nspname, p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('beanmap_is_admin', 'beanmap_admin_overview',
                    'beanmap_admin_update_catalog', 'beanmap_admin_audit');
```

결과는 `beanmap_private`의 네 행이며 실행 권한은 각각 `true / false / false`여야 한다.
관리자 함수를 `public`으로 되돌리는 방식으로 앱 문제를 복구하지 않는다. 커밋 후 앱
문제가 생기면 비공개 관리자 입구를 비활성화하고 앱을 이전 버전으로 복구하되, 허용
목록과 수정 이력은 보존한다. 급히 DB 접근도 닫아야 하면 운영 세션에서
`REVOKE USAGE ON SCHEMA beanmap_private FROM authenticated;`로 차단할 수 있다.
DB 전체 복원은 이후 정상 사용자의 변경을 덮어쓸 수 있으므로 별도 복구 작업으로 다룬다.

## 서비스 관리자 지정·해제

Tailscale 본인 계정과 서비스 로그인 계정은 별개다. 마이그레이션이 첫 가입자나 특정
이메일을 자동 지정하지 않으며 허용 목록은 처음에 비어 있다. 운영 DB 세션은 다음처럼
연다. SSH 별칭이 Tailscale 연결을 사용하므로 공인 SSH 포트를 열 필요가 없다.

```bash
ssh -t oracle 'sudo docker exec -it supabase-db psql -X -U postgres -d postgres'
```

로그인에 사용할 본인 계정을 정확히 조회해 UUID를 확인한다. 아래 자리표시는 실제로
확인한 값으로 바꾸며, 사용자 목록 전체를 문서나 로그에 복사하지 않는다.

```sql
SELECT id FROM auth.users WHERE lower(email) = lower('operator@example.invalid');

INSERT INTO beanmap_private.admin_users (user_id)
VALUES ('<확인한 본인 UUID>'::uuid)
ON CONFLICT (user_id) DO NOTHING;

-- 해제할 때만 실행한다. 다음 관리자 요청부터 접근이 거절된다.
DELETE FROM beanmap_private.admin_users WHERE user_id = '<해제할 UUID>'::uuid;
```

## 서비스 관리자 화면의 범위

관리자 화면에서는 가입자·원두 기록의 집계, 산지 카탈로그의 한국어 표기와 수정 이력을
확인한다. 사용자별 메모나 이메일 조회, 계정 삭제, 관리자 지정, 임의 SQL 실행은 제공하지
않는다. DB 운영이 필요하면 별도 Studio를 이용한다.

국가의 `name_ko`, 지역의 `display_name_ko`와 `name_ko`, 농장·생산자의 `name_ko`를
수정한다. 한국어 표기는 최대 120자이며 빈 값은 표기를 지운다. 수정 사유는 3~300자다.
수정 전 값과 현재 값을 비교해 동시 수정을 차단하고, 변경과 이력을 함께 저장한다.
영문 이름, 카탈로그 ID, 개인 기록은 바꾸지 않는다. 계정 탈퇴 시 감사 이력의 작성자
참조만 비워지고 수정 이력은 남는다.

공개 산지 소개는 `src/data/origin-presets.ts`의 정적 콘텐츠이므로 관리자 DB 수정과
자동 연동되지 않는다. 카탈로그 생성 스크립트를 다시 실행할 때는 기존 운영 수정과
이력을 대조한다.

## 배포 검증

- 공개 호스트의 관리자 화면·API는 거절되고, 위조한 사용자·프록시 헤더로 우회되지 않는다.
- 비공개 입구에서도 본인 이외의 Tailscale 계정은 거절된다.
- 관리자 API는 비밀값, 유효한 JWT, 현재 DB 허용 목록을 각각 요구한다.
- 일반 사용자와 실제 관리자 JWT 모두 공개 관리자 RPC를 호출할 수 없고, private 스키마 REST 요청도 거절된다.
- 허용 목록 제거 후 접근 거절, 직접 테이블 쓰기 차단, 개인정보 RLS, 동시 수정 충돌과 감사 이력을 확인한다.

`scripts/audit.sh`는 민감한 함수의 정확한 스키마·서명·실행 권한, 함수 누락과 예상치
못한 관리자 overload, private 스키마 접근 권한을 검사한다. Studio 접속 검증은 직접
DB 운영 권한을 다루므로 서비스 관리자 화면의 권한 검증과 구분한다.
