# Security and Network Jobs 서비스 정리

`Security and Network Jobs`는 `Repository scan`과 독립된 채용 공고 수집 및 운영 대시보드 서비스입니다.

## 서비스 위치

```text
apps/vibecoding
```

이 서비스의 상세 기능, 운영 상태, 수집 출처, 데이터 구조, Render/Neon/GitHub Actions 설정은 `apps/vibecoding/README.md`를 기준 문서로 봅니다.

## 역할

- 보안 및 네트워크 관련 채용 공고 수집
- 키워드 기반 필터링
- 중복 공고 병합
- Neon PostgreSQL 또는 로컬 SQLite 저장
- FastAPI 기반 운영 대시보드 제공
- GitHub Actions 기반 수집/정리 스케줄 실행
- Slack 알림 발송

## Repository scan과의 경계

두 서비스는 같은 상위 저장소 안에 있을 수 있지만 제품 기능은 독립적입니다.

| 구분 | Repository scan | Security and Network Jobs |
| --- | --- | --- |
| 목적 | GitHub 코드 보안 점검 | 채용 공고 수집과 운영 확인 |
| 런타임 | Next.js | FastAPI, Python |
| 기본 포트 | `3000` | `8000` |
| 데이터 | `.data/scans.json` | Neon PostgreSQL 또는 SQLite |
| 주요 API | `/api/scans` | `/jobs`, `/runs`, `/health/*` |

Repository scan 화면과 API는 Jobs 서비스의 채용 공고 데이터, 시장 신호, 운영 대시보드에 의존하지 않습니다.

## 로컬 실행

상위 저장소 기준으로 다음 스크립트를 사용합니다.

```bash
scripts/start-vibecoding-local.sh
```

자동 실행 등록은 다음 스크립트를 사용합니다.

```bash
scripts/install-vibecoding-launch-agent.sh
```

자동 실행 해제는 다음 스크립트를 사용합니다.

```bash
scripts/uninstall-vibecoding-launch-agent.sh
```

대시보드는 기본적으로 다음 주소에서 확인합니다.

```text
http://127.0.0.1:8000/login
```

## 운영 확인

로컬에서는 다음 항목을 확인합니다.

- `http://127.0.0.1:8000/health/live`
- `http://127.0.0.1:8000/health/ready`
- `http://127.0.0.1:8000/login`

운영 환경에서는 Render 서비스와 Neon 데이터베이스 상태를 `apps/vibecoding/README.md`의 운영 절차에 따라 확인합니다.

## 관련 문서

- `apps/vibecoding/README.md`: Jobs 서비스 기준 문서
- `docs/operations-checklist.md`: Repository scan과 Jobs 서비스 운영 점검 목록
- `docs/deployment-separation.md`: 두 서비스의 배포 경계
