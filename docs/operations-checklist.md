# 운영 점검 목록

이 문서는 같은 저장소 안에 있는 두 독립 서비스의 운영 점검 항목을 분리해서 정리한다.

## Repository scan

Repository scan은 GitHub 코드 보안 점검 서비스다.

### 로컬 점검

- `http://127.0.0.1:3000` 접속
- 공개 GitHub 저장소 URL 입력 후 스캔 실행
- 최근 스캔 목록 표시 확인
- 스캔 완료 후 Markdown 보고서 다운로드 확인
- JSON 보고서 펼침 확인

### 데이터 점검

- 기본 저장 위치는 `.data/scans.json`이다.
- `SCAN_HISTORY_FILE` 환경 변수로 저장 파일 위치를 바꿀 수 있다.
- 현재 구현은 JSON 파일 저장이며, 저장소 인터페이스를 통해 SQLite 전환을 준비한다.

### 배포 전 점검

```bash
CI=true ./node_modules/.bin/vitest run --passWithNoTests
CI=true ./node_modules/.bin/tsc --noEmit
CI=true ./node_modules/.bin/next build
```

## Security and Network Jobs

Security and Network Jobs는 채용 공고 수집과 운영 대시보드 서비스다. Repository scan과 기능적으로 독립되어 있다.

### 로컬 점검

- `http://127.0.0.1:8000/health/live`
- `http://127.0.0.1:8000/health/ready`
- `http://127.0.0.1:8000/login`

### 자동 실행 점검

```bash
scripts/install-vibecoding-launch-agent.sh
scripts/uninstall-vibecoding-launch-agent.sh
```

### 운영 기준 문서

상세 운영 절차는 `apps/vibecoding/README.md`와 `docs/security-network-jobs-service.md`를 기준으로 한다.
