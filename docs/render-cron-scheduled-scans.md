# Render Cron 예약 스캔 운영 가이드

Repository scan 서비스는 예약 스캔 실행 API를 제공합니다. Render Cron은 이 API를 주기적으로 호출해 실행 시간이 지난 저장소만 점검합니다.

## 전제 조건

- Repository scan 웹 서비스가 Render에 배포되어 있어야 합니다.
- 웹 서비스 환경 변수에 GitHub App 설정이 있어야 합니다.
- 웹 서비스와 Cron Job이 같은 `SCHEDULE_RUN_TOKEN` 값을 사용해야 합니다.
- 웹 서비스 환경 변수에 Postgres 또는 Neon `SCAN_HISTORY_DATABASE_URL`이 설정되어 있어야 합니다.

## 환경 변수

웹 서비스에 다음 값을 추가합니다.

```text
SCAN_HISTORY_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
SCHEDULE_RUN_TOKEN=충분히-긴-무작위-문자열
```

Cron Job에는 다음 값을 추가합니다.

```text
APP_URL=https://your-repository-scan-service.onrender.com
SCHEDULE_RUN_TOKEN=웹-서비스와-같은-값
```

`SCAN_HISTORY_DATABASE_URL`은 예약 스캔 이력과 예약 설정을 안정적으로 보관하는 운영 데이터베이스입니다. `SCHEDULE_RUN_TOKEN`은 외부에 노출하지 않습니다. 값이 다르면 예약 실행 API는 `401`을 반환합니다.

## Cron Job 설정

Render 대시보드에서 새 Cron Job을 만들고 다음처럼 설정합니다.

```text
Name: repository-scan-scheduled-runner
Runtime: Node
Schedule: 0 * * * *
Build Command: corepack enable && pnpm install --frozen-lockfile
Start Command: bash scripts/run-scheduled-scans-cron.sh
```

권장 주기는 1시간입니다. Cron이 1시간마다 호출되어도 앱은 각 예약의 `nextRunAt`을 다시 확인하므로, 실행 시간이 지난 예약만 스캔합니다.

## Blueprint 예시

Render Blueprint를 사용할 경우 다음 항목을 `services`에 추가할 수 있습니다.

```yaml
  - type: cron
    name: repository-scan-scheduled-runner
    runtime: node
    plan: free
    region: singapore
    schedule: "0 * * * *"
    buildCommand: corepack enable && pnpm install --frozen-lockfile
    startCommand: bash scripts/run-scheduled-scans-cron.sh
    envVars:
      - key: APP_URL
        sync: false
      - key: SCHEDULE_RUN_TOKEN
        sync: false
```

## 수동 확인

Render Shell 또는 로컬에서 다음 명령으로 같은 호출을 확인할 수 있습니다.

```bash
APP_URL="https://your-repository-scan-service.onrender.com" \
SCHEDULE_RUN_TOKEN="같은-토큰-값" \
bash scripts/run-scheduled-scans-cron.sh
```

정상 응답에는 `ranAt`과 `results`가 포함됩니다. 실행할 예약이 없으면 `results`는 빈 배열입니다.
