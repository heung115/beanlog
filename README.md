# beanmap

마신 커피 원두를 다시 찾아볼 수 있게 기록해두려고 만든 서비스입니다. 원두 정보와
테이스팅 노트를 남기고, 블렌드를 구성해 보고, 산지 카탈로그를 둘러보다가 쌓인
기록은 통계로 확인할 수 있습니다. 한국어와 영어를 지원합니다.

## 기능

- 원두 기록을 등록·수정·삭제할 수 있고, 테이스팅 태그와 블렌드 구성요소를 함께 저장합니다.
- 블렌드는 싱글오리진을 비율로 조합하며 합계가 100%가 아니면 저장되지 않습니다.
- 산지 카탈로그에서 국가 → 지역 → 농장/생산자 순서로 탐색할 수 있습니다.
- 산지, 프로세스, 품종, 월별, 점수 분포 통계를 제공합니다.
- 기록 전체를 JSON으로 내려받을 수 있습니다.

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 프런트엔드 | Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS v4, Zustand, Recharts, Zod |
| 백엔드 | Go (Gin) REST API, 학습용 gRPC Stats 서비스 |
| 인증 | Supabase Auth — Google/Kakao OAuth, JWT |
| 데이터베이스 | Supabase / PostgreSQL 17 — RLS, 원자적 저장 함수 |
| 인프라 / 검증 | Docker, Playwright QA 28개 |

## 구조

요청은 Next.js가 받아 Server Action에서 처리하고, 데이터가 필요한 작업은 Go API로
넘깁니다. Go API는 Supabase가 발급한 JWT를 검증한 뒤 트랜잭션 안에서 쿼리를 실행합니다.

데이터 격리에 신경을 썼습니다. 테이블마다 RLS를 걸어서 인증받은 사용자도 자기
데이터만 읽을 수 있고, Go API는 요청마다 권한을 낮춰 모든 쿼리가 RLS를 거칩니다.
원두를 저장할 때는 원두·태그·블렌드 구성요소를 하나의 DB 함수로 묶어 한 트랜잭션에
기록하고, 실패하면 전부 롤백됩니다.

## 실행

Docker Desktop이 필요합니다.

```bash
npm install
npm run staging:up     # 스테이징 실행 → http://localhost:3100
npm run staging:qa     # 전체 QA (28개)
npm run staging:down   # 종료
```

전체 색상 테마는 환경값 하나로 바꿉니다. 사용자 화면에는 테마 선택 기능이 없습니다.

```bash
BEANMAP_THEME=mist     # mist | cream | contrast
```

일상 점검과 심층 감사:

```bash
npm run check          # 타입·린트·단위 테스트·디자인·빌드 전체 실행
npm run check:fast     # 빌드를 제외한 빠른 점검
npm run audit          # 의존성·보안·컨테이너 설정까지 심층 감사
```
