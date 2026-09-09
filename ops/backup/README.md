# 암호화 외부 백업 준비

사용자가 GCP 무료 티어를 백업 대상으로 선택했다. 이 작업의 암호화 백업은
해당 범위에 맞춰 구성하며, 다른 외부 대상이나 유료 기능으로 확대하지 않는다.
예시 설정에는 실제 개인키가 없으며 도구 추가만으로 예약 작업이 설치되지는 않는다.
GCP 구성과 비용 제한은 아래 별도 절차를 따른다.

## 범위와 완료 조건

백업 원본과 같은 서버의 디스크·볼륨·스냅샷만으로는 서버 계정이나 장치 전체의
손실에 대비했다고 볼 수 없다. 승인된 Mac 또는 별도 저장 장치에 암호화본을
보관한다. 승인된 GCP 무료 범위 이외의 버킷 생성, OCI 정책 변경, 다른 외부 계정 전송은
이 작업의 범위가 아니다. OCI 백업 유무는 실제 계정 정책과 복구 가능성을 별도로 확인해야 한다.

후보 운영 정책은 매일 백업, 30일 보관, 목표 RPO 24시간이다. 확정된 정책이
아니며 사용자 선택을 반영해야 한다. Mac이 꺼져 있거나 잠자기·네트워크 단절
상태이면 이 RPO를 보장할 수 없다. `status`는 마지막 정상본의 생성 시점이
정책을 넘으면 실패 종료하며, 시스템이 다시 켜졌다는 이유로 상태를 정상 처리하지
않는다. 상시 RPO가 필요하면 항상 켜진 별도 장치와 독립 모니터가 필요하다.

전체 서비스 RTO는 아직 측정하지 않았다. 목표를 정한 뒤 운영 환경과 동등한
격리 환경에서 이미지·설정·키·DB·권한을 복구하고 로그인/읽기/쓰기까지 성공한
실측 시간으로 확인한다. 합성 DB 복구 시간은 전체 서비스의 RTO가 아니다.

## 데이터 흐름과 키

1. 서버에는 전용 age **공개 수신 키만** 전달한다. 복구 개인키는 서버에 두지
   않으며 SSH 인증키를 암호화 키로 재사용하지 않는다.
2. 루트가 설치한 `backup.py`의 `export`가 `pg_dump`와 `pg_dumpall --globals-only`
   출력을 age에 바로 연결한다. 파일로 저장되는 DB/역할 데이터는 암호화본뿐이다.
   두 생산 프로세스와 암호화 프로세스 모두 성공해야 완료본을 만든다.
3. Mac의 `pull`은 기존 `oracle` SSH 별칭을 통해 암호화 아카이브를 가져온다.
   허용된 파일명·정규 파일·크기·중복·체크섬을 검사하고 완료 디렉터리로 원자적으로
   이동한다. 중단되거나 불완전한 수신 결과는 정상 백업으로 등록되지 않는다.
4. 30일 등의 확정 보관 정책에 따라 이전 정상본만 삭제한다. 최신 2개는 항상
   남기며 알 수 없는 폴더와 중단 폴더는 임의로 지우지 않는다.

age는 [공식 프로젝트](https://github.com/FiloSottile/age)의 검증된 배포본을
두 장치에 설치한다. 테스트는 공식 Go 모듈 `filippo.io/age@v1.3.2`로 빌드한
임시 도구를 사용하며 전역 설정이나 운영 설치를 변경하지 않는다.

실제 키는 승인 후 독립적으로 생성한다. 개인키를 백업 데이터와 같은 폴더,
운영 서버, Git, 일반 로그에 저장하지 않는다. 별도 암호화 매체 또는 승인된
개인 비밀 저장소에 보관하고, 장치 분실에 대비한 두 번째 안전한 사본을 준비한다.
자동 백업에는 공개키만 필요하다. 키 분실 시 암호화본을 복구할 수 없다.

## 무엇을 보관하는가

| 파일 | 포함 내용 | 한계 |
| --- | --- | --- |
| `database.dump.age` | postgres DB의 스키마·데이터·객체 소유권·권한 | 다른 DB와 파일 저장소는 포함하지 않음 |
| `roles.sql.age` | 전역 역할·멤버십·역할 암호 해시 | 복구 시 격리 환경과 기존 bootstrap 역할을 검토해야 함 |
| `recovery-config.tar.age` | 선택한 운영 환경·비밀·Compose·Caddy·Kong 설정 | 현재 경로 허용 목록을 검토하고 새 설정 경로는 추가해야 함 |
| `postgres-config.tar.age` | `/etc/postgresql-custom` 전용 볼륨 | Vault/확장 키 관련 복구에서 누락하면 안 됨 |
| `tailscale-serve.json.age` | 현재 Tailscale Serve 경로 선언 | 노드 인증 상태/개인키는 포함하지 않으며 새 노드 가입 후 검토해 적용 |
| `runtime-inventory.json.age` | 8개 실행 컨테이너의 이미지·마운트·환경 정보 | 설정·비밀 포함; 반드시 암호화 유지 |
| `images.tar.gz.age` | 선택 시 현재 실행 중인 커스텀 이미지들(암호화 전 gzip 압축) | 용량이 큼; 보관 용량·빈도를 승인받아야 함 |
| `manifest.json` | 암호화본 크기·해시·생성 시각·범위 | 개인 정보와 키를 포함하지 않음; 복호화/복구 성공을 뜻하지 않음 |

현재 커스텀 Supabase 이미지에는 추가 패치와 확장이 있다. DB만 표준 PostgreSQL에
복구해도 전체 서비스 복구가 된다고 주장하지 않는다. Vault 데이터에는 원래
키와 확장, 인증에는 해당 설정과 키가 필요하다. 이미지를 제외한 매일 백업은
그 시점의 이미지 ID와 일치하는 별도 승인된 암호화 이미지 기준본이 있어야
완전한 복구 후보가 된다. 기준본을 잃거나 이미지가 바뀌면 다시 보관한다.
파일 업로드, Studio 파일, 외부 DNS·메일 서비스, Tailscale 가입, 인증서 재발급,
호스트 방화벽·Docker 네트워크 재구성도 실제 서비스 복구 점검에 포함한다.
이 도구는 이를 자동 복원하거나 비용이 드는 서버를 생성하지 않는다.

## 승인 후 설치 순서

1. 저장 위치, 상시 가용성, 보관 기간, RPO/RTO 목표와 개인키 보관 방법을 확정한다.
   DB·인증 정보·설정 비밀·선택한 이미지가 해당 장치로 이동하는 범위를 확인한다.
2. 공개 수신 키를 사용해 예시 설정을 실제 값으로 채우고 설정 파일은 `0600`,
   저장 디렉터리는 사용자 소유 `0700`으로 만든다. 저장 공간은 이미지 기준본과
   보관 기간을 고려해 확인한다.
3. 서버에 검토한 age와 `backup.py`를 root 소유의
   `/usr/local/libexec/beanmap-backup-source`로 설치한다. 원본 운영 변경과 백업은
   기존 `deploy-execution.lock`을 공유해 동시 배포/마이그레이션을 막는다.
4. 승인된 Mac에서 최초 수동 실행 후 `status`를 확인한다.

```sh
python3 ops/backup/backup.py pull --config /PRIVATE/PATH/backup.json --approved-production-transfer
python3 ops/backup/backup.py status --config /PRIVATE/PATH/backup.json
```

5. 승인된 별도 복구 환경에서 개인키로 모든 `.age`를 끝까지 복호화해 무결성을
   확인한다. **SQL 실행 전에** 이 검사를 완료한다. 그 후 대상 네트워크를 격리한
   상태에서 원래 이미지/확장/키를 준비하고 역할→DB→애플리케이션 순서로 복구한다.
   역할 이름 충돌을 무시하거나 ACL을 삭제하지 않는다. 기존 PostgreSQL 전환의
   bootstrap 역할 처리 기록을 참고해 명시적으로 검토한다.
6. 테이블 지문, 역할·RLS·함수 ACL, 현재 세션 거부, 정상 사용자 기능을 확인한다.
   운영과 외부 메일·웹훅을 연결하기 전에 테스트 결과와 실측 시간을 기록한다.
   대상이 검증용일 때는 실제 사용자에게 메일을 발송하지 않는다.
7. 첫 백업과 복구를 통과한 뒤에만 사용자가 승인한 스케줄을 설치한다. 이 저장소는
   예약 작업을 자동 설치하지 않는다. 실패/RPO 초과는 독립 상태 점검에서 관찰하고
   사용자에게 알리는 실제 경로까지 확인해야 모니터링 완료로 기록한다.

`status`는 정상 0, 누락/오래된 백업 2, 형식·무결성·기타 오류 1을 반환한다.
백업 성공과 복구 성공을 혼동하지 않도록 출력의 `restore_verified`는 항상 false다.
복구 기록은 별도의 검사 결과로 남긴다. 실제 운영 데이터/개인키/설정은 Git에
추가하지 않는다. 테스트 보고서도 `synthetic_only` 여부를 유지한다.

## 로컬 합성 복구 검사

```sh
python3 -m unittest discover -s ops/backup -p 'test_*.py'
python3 ops/backup/synthetic_restore.py \
  --age /PATH/TO/age --age-keygen /PATH/TO/age-keygen \
  --image postgres:17-alpine --report /PRIVATE/TEMP/synthetic-backup-report.json
```

독립적인 임시 키를 생성하고 네트워크가 없는 두 새 DB를 만든다. DB·역할
암호화, 잘못된 키·변조 거부, 새 DB로 역할/스키마/데이터 복구, 전체 행 지문,
제한된 역할의 RLS 읽기를 검사한다. DB 데이터는 컨테이너 tmpfs에만 두고 테스트
종료 시 두 컨테이너와 임시 키를 제거한다. 운영 접근이나 실제 데이터 전송은 없다.

PostgreSQL 역할 백업/복구 동작은 [공식 pg_dumpall 문서](https://www.postgresql.org/docs/17/app-pg-dumpall.html)를 따른다.


## GCP 무료 범위의 운영 구성

대상은 `gcp-free-deploy` 프로젝트의 미국 서부 `us-west1` Standard 전용 버킷이다.
사용 중인 gcloud 인증을 Mac에서 이용하며 운영 서버에 서비스 계정 키나 GCP
자격 증명을 두지 않는다. 키를 새로 발급하는 자동화도 없다. 일상 uploader의
필요 권한은 대상 객체의 create/get/list 및 버킷 정책 읽기이며 삭제/overwrite는
업로드에 필요하지 않다. 현재 설치는 사용자가 이미 가진 인증 범위로 실행되므로
새로운 최소권한 계정이 구성됐다고 주장하지 않는다.

- Uniform bucket-level access와 public access prevention을 강제한다.
- soft delete, versioning, Autoclass, retention lock을 사용하지 않는다.
- `beanmap/daily/` 객체만 30일 수명주기 삭제 대상이다. 이미지 기준본은
  `beanmap/baseline/`에 두고 일일 백업에 다시 넣지 않는다.
- 생성 직후 검토한 버킷 metageneration을 설정에 고정한다. 설정이 바뀌거나
  같은 결제 계정에 미검토 버킷이 생기면 자동 업로드가 중단된다. 이전에
  soft delete를 사용했던 버킷을 재사용한다고 가정하지 않는다.
- 공유 결제 범위의 모든 프로젝트를 다시 조회하고 객체의 모든 일반 버전을
  합산한다. 조회 실패·부분 페이지·비공개 조건 실패는 업로드 거부로 처리한다.
- 계정 전체 보관량을 이 도구에서는 4,000,000,000바이트 이하로 제한한다.
  한 번의 이미지 기준본은 최대 1.6GB, 일일 백업은 최대 50MB다. 이를 넘으면
  유료 확장 없이 중단한다. 이 제한은 GCP의 결제 차단 기능이 아니라 이 작업의
  전송 제한이며, 다른 관리자가 동시에 만든 리소스/요청까지 통제하지 못한다.
- 암호화 객체를 generation=0 조건으로 생성하고 크기·MD5·SHA256 메타데이터를
  확인한다. 마지막에 manifest를 올려 완료본을 표시한다. 실패한 기준본 일부는
  임의로 삭제하지 않고 조사하며, 용량 계산에는 포함한다.

공식 무료 범위는 세 미국 리전 합산 Standard 5GB-month, Class A 5,000회,
Class B 50,000회, 북미발 전송 100GB(중국·호주 제외)다. 작업의 보관량·일일
요청은 이보다 작게 설계하지만 계정의 다른 사용량까지 무료라고 보장하지 않는다.
[공식 가격·무료 한도](https://cloud.google.com/storage/pricing)를 변경 시 다시 확인한다.

```sh
python3 ops/backup/gcs.py preflight --config /PRIVATE/PATH/gcs.json
python3 ops/backup/gcs.py upload --config /PRIVATE/PATH/gcs.json \
  --directory /PRIVATE/CACHE/backup-TIMESTAMP-ID --mode baseline --approved-gcp-backup
python3 ops/backup/gcs.py status --config /PRIVATE/PATH/gcs.json
```

GCP에서 별도 디렉터리로 다운로드한 실제 암호화본으로 복구 검사까지 통과한 뒤
`daily.py`를 매시간 실행하도록 설치할 수 있다. GCS의 정상 완료본이 23시간보다
새로우면 복사하지 않고, 오래되었거나 없을 때만 일일 백업을 실행한다. 깨운 뒤
catch-up은 가능하지만 Mac이 꺼져 있는 동안의 24시간 RPO는 보장하지 않는다.
개인키는 Mac의 저장소 밖 비공개 설정 디렉터리에, 암호화 캐시는 별도 디렉터리에
둔다. 복구키의 독립된 두 번째 보관본은 별도로 마련해야 한다.

큰 복구 파일은 `gcs_download.py`로 다시 내려받을 수 있다. 먼저 완료본의 작은
`manifest.json`을 비공개 복구 디렉터리에 받은 뒤 실행한다. 이 도구는 같은 GCS
객체 세대를 고정하고 32MiB 범위별 응답, 전체 크기·MD5·SHA256을 검사한 후에만
완료 파일명으로 바꾼다. 요청별 30초, 객체 전체 30분 제한을 두며 다른 호스트나
HTTP로 인증 헤더를 전달하지 않는다. 기존에 검증된 작은 파일은 다시 받지 않는다.

```sh
python3 ops/backup/gcs_download.py --config /PRIVATE/PATH/gcs.json \
  --directory /PRIVATE/RESTORE/backup-TIMESTAMP-ID \
  --remote-prefix beanmap/baseline/backup-TIMESTAMP-ID
```

관리 콘솔 복구 설정에는 전송 경계 root helper, 해당 systemd unit, Docker/Caddy
drop-in도 포함한다. 복원 시 새 호스트의 Caddy UID와 Tailscale 주소로 helper를
다시 실행하고 unit을 enable해야 한다. 과거 방화벽 규칙 전체나 `/run` 소켓을
복사하지 않는다. Serve 선언을 검토해 기존 다른 경로를 보존하며 Funnel은 켜지 않는다.

### 백업 전용 인증과 용량 조회 계정

개인 gcloud 세션은 백업·복구 경로에서 사용하지 않는다. `gcs-config.example.json`의
`identities.writer`와 `identities.auditor`에 서로 다른 서비스 계정 이메일과
각 계정 전용 `gcloud_config` 절대 경로를 지정한다. 디렉터리는 실행 사용자 소유의
0700이어야 하고 심볼릭 링크나 개인 기본 `~/.config/gcloud` 경로는 거부한다.
각 전용 디렉터리의 `default` 구성에는 지정한 서비스 계정 하나만 등록한다.
실제 키 발급·IAM 설정은 별도 관리자 작업이며, 이 도구는 계정·키·버킷을 만들지 않는다.

- writer: 대상 버킷의 `storage.buckets.get`, `storage.buckets.getIamPolicy`,
  `storage.objects.list`와 `beanmap/` 객체의 `storage.objects.create/get`만 필요하다.
  업로드는 generation=0으로 새 객체만 만들고 복합 업로드를 끈다. 기존 객체 수정·삭제,
  버킷 설정·IAM 변경 권한을 요구하지 않는다.
- auditor: 연결된 전체 결제 범위의 프로젝트 목록과 각 프로젝트 버킷 목록을 읽고,
  대상 버킷 메타데이터·IAM·객체 목록을 조회한다. 객체 본문 읽기·생성·수정·삭제
  권한은 주지 않는다. 연결 프로젝트 조회에 필요한 billing/resource-manager 권한은
  실제 API가 요구하는 최소 읽기 권한으로 별도 검토한다.

전송·상태·다운로드는 writer 인증을 쓰고, 기존 전체 결제 범위의 용량 합산은
매번 auditor 인증으로 실행한다. 다른 버킷·알 수 없는 프로젝트·조회 실패·불완전한
목록은 계속 실패 처리하므로, 대상 버킷만 조회하는 방식으로 무료 4GB 보호를
축소하지 않는다. auditor가 접근할 수 없는 새 프로젝트가 연결되어도 백업을 중단한다.
관리자 로그인이나 주기적인 수동 인증 갱신에 의존하는 검토 스냅샷은 사용하지 않는다.

각 실행은 양쪽 계정의 읽기 권한과 금지 권한을 `testIamPermissions`로 확인한다.
`objects.update/delete`, `buckets.setIamPolicy/update/delete` 등이 확인되면 전송 전에
실패한다. auditor의 객체 get/create 권한도 실패 사유다. 이 조회는 버킷 리소스에
대한 검사라 객체 prefix 조건부 권한을 모두 증명하지 못할 수 있다. 배포 시 사용자 지정
IAM 역할 정의와 조건을 별도로 검토하고, 조건부 수정·삭제 권한을 주지 않는다.
검사 통과를 모든 상속·조건부 권한의 완전한 부재 증명으로 표현하지 않는다.
필수 설정인 uniform bucket-level access에서는 객체 ACL 자체가 비활성화되며,
GCS가 `objects.getIamPolicy/setIamPolicy` 검사 요청을 400으로 거부한다. 이 두 객체
ACL 권한은 API 검사에 넣지 않고 역할 정의 검토로 확인한다. 버킷의
`buckets.setIamPolicy` 금지 검사는 그대로 유지한다.

모든 gcloud 호출에 같은 전용 환경·고정 account·`default` 구성을 명시한다. 외부
`CLOUDSDK_*`, ADC, impersonation, access-token, proxy/CA 환경 덮어쓰기는 거부한다.
저장된 구성의 자격 증명 대체·impersonation·토큰 파일·인증 생략·별도 API endpoint도
거부한다. 파일 업로드, API 조회, 다운로드가 서로 다른 계정으로 실행되는 경로는 없다.
API 리디렉션에서 다른 호스트로 인증 헤더를 전달하지 않는다. 실패 출력에는 토큰·키나
gcloud 원문 오류를 포함하지 않는다.

인증 우선순위는 [gcloud 인증 문서](https://docs.cloud.google.com/sdk/docs/authenticate),
버킷 권한 검사는 [testIamPermissions 문서](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets/testIamPermissions),
객체 prefix·목록 권한의 차이는 [Cloud Storage IAM 조건](https://docs.cloud.google.com/storage/docs/access-control/iam)에 따른다.
