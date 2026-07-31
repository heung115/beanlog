# Beanlog

커피 원두와 테이스팅 기록을 관리하는 Next.js 애플리케이션입니다.

## 스테이징 개발 환경

별도의 local 개발 환경을 두지 않습니다. Docker Desktop에서 staging 환경 하나를 실행하고,
그 환경에서 개발과 QA를 모두 진행합니다.

```bash
npm install
npm run staging:up
```

기본 체크아웃의 앱은 <http://localhost:3100>에서 열립니다. linked worktree에서는 충돌을 막기 위해
Compose 프로젝트, Supabase 프로젝트, `.staging` 경로와 포트를 자동으로 따로 배정합니다.
`npm run staging:up` 출력이나 `npm run staging:status`에서 현재 worktree의 접속 주소를 확인하세요.

소스 변경을 반영하려고 `staging:up`을 다시 실행할 필요는 없습니다. Next.js 개발 서버가 변경을
자동 반영하며 기존 데이터와 로그인 세션도 유지됩니다. 의존성이나 Docker 구성을 바꾼 경우에만
다시 실행합니다.

```bash
npm run staging:status  # 상태
npm run staging:logs    # 로그
npm run staging:qa      # 전체 QA
npm run staging:down    # 종료, DB 볼륨 보존
```

상세한 포트와 보안 구성은 [docs/STAGING.md](docs/STAGING.md)를 참고하세요.

## 정적 검증

```bash
npm run lint
npm run design:lint
npm run build
```
