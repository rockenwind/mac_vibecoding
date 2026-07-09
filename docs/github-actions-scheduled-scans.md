# GitHub Actions 예약 스캔 운영 가이드

Repository scan 서비스는 예약 스캔 실행 API를 제공합니다. GitHub Actions는 이 API를 주기적으로 호출해 실행 시간이 지난 저장소만 점검합니다.

Render Cron Job은 최소 월 비용이 있으므로 기본 운영 방식은 GitHub Actions schedule을 사용합니다.

## 전제 조건

- Repository scan 웹 서비스가 Render에 배포되어 있어야 합니다.
- 웹 서비스 환경 변수에 `SCHEDULE_RUN_TOKEN`이 설정되어 있어야 합니다.
- GitHub 저장소 secret에도 같은 `SCHEDULE_RUN_TOKEN` 값을 설정해야 합니다.
- 웹 서비스 환경 변수에 Postgres 또는 Neon `SCAN_HISTORY_DATABASE_URL`이 설정되어 있어야 합니다.

## GitHub Secret 설정

GitHub 저장소에서 다음 위치로 이동합니다.

```text
Settings > Secrets and variables > Actions > Repository secrets
```

다음 secret을 추가합니다.

```text
SCHEDULE_RUN_TOKEN=웹-서비스와-같은-값
```

`SCHEDULE_RUN_TOKEN` 값은 Render Web Service의 환경 변수와 완전히 같아야 합니다. 값이 다르면 예약 실행 API는 `401`을 반환합니다.

## 워크플로

예약 실행 워크플로는 다음 파일에 있습니다.

```text
.github/workflows/repository-scan-scheduled-runner.yml
```

기본 설정은 1시간마다 실행입니다.

```yaml
schedule:
  - cron: "0 * * * *"
```

GitHub Actions의 cron 시간은 UTC 기준입니다. Cron이 1시간마다 호출되어도 앱은 각 예약의 `nextRunAt`을 다시 확인하므로, 실행 시간이 지난 예약만 스캔합니다.

## 수동 실행

GitHub 저장소에서 다음 위치로 이동합니다.

```text
Actions > Repository scan scheduled runner > Run workflow
```

정상 응답에는 `ranAt`과 `results`가 포함됩니다. 실행할 예약이 없으면 `results`는 빈 배열입니다.

## 호출 대상

현재 운영 URL은 다음과 같습니다.

```text
https://repository-scan.onrender.com/api/scans/schedules/run-due
```

서비스 URL이 바뀌면 `.github/workflows/repository-scan-scheduled-runner.yml`의 `APP_URL` 값을 같이 바꿉니다.
