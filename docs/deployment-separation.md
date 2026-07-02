# 배포 구조 분리

이 저장소에는 독립적인 두 서비스가 있습니다.

1. Repository scan
2. Security and Network Jobs

두 서비스는 배포 단위, 런타임, 데이터 저장소가 다르므로 같은 배포 파이프라인으로 묶지 않습니다.

## Repository scan 배포

Repository scan은 Next.js 앱입니다.

| 항목 | 값 |
| --- | --- |
| 런타임 | Node.js |
| 개발 서버 | `http://127.0.0.1:3000` |
| 빌드 명령 | `pnpm run build` |
| 시작 명령 | `pnpm run start` |
| 주요 API | `/api/scans` |
| 로컬 데이터 | `.data/scans.json` |

배포 환경에서는 `.data/scans.json`이 인스턴스 로컬 파일이라는 점을 고려해야 합니다. 여러 인스턴스나 장기 보관이 필요해지면 SQLite 또는 PostgreSQL 저장소로 옮깁니다.

## Security and Network Jobs 배포

Security and Network Jobs는 FastAPI 앱입니다.

| 항목 | 값 |
| --- | --- |
| 런타임 | Python |
| 개발 서버 | `http://127.0.0.1:8000` |
| Render 설정 | `apps/vibecoding/render.yaml` |
| 운영 DB | Neon PostgreSQL |
| 로컬 fallback | SQLite |
| 주요 화면 | `/login`, `/jobs`, `/runs` |

운영 배포와 수집 스케줄은 `apps/vibecoding/README.md`를 기준으로 관리합니다.

## 로컬 포트

동시에 실행할 때 포트는 다음처럼 분리합니다.

```text
Repository scan: http://127.0.0.1:3000
Security and Network Jobs: http://127.0.0.1:8000/login
```

## 환경 변수 원칙

- Repository scan은 Jobs 서비스의 `DATABASE_URL`을 읽지 않습니다.
- Security and Network Jobs는 Repository scan의 `.data/scans.json`을 읽지 않습니다.
- 각 서비스의 비밀값과 운영 설정은 각 서비스 런타임에만 주입합니다.

## 권장 배포 순서

1. Repository scan Next.js 배포를 독립적으로 구성합니다.
2. Security and Network Jobs Render 배포는 `apps/vibecoding/render.yaml` 기준으로 유지합니다.
3. 각 서비스의 health check와 로그를 별도로 확인합니다.
4. 장애 대응 문서도 서비스별로 분리합니다.
