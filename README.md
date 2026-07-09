# 저장소 보안 점검 도구

이 저장소는 GitHub 저장소의 코드를 점검하는 보안 서비스입니다. 저장소 주소를 직접 입력하거나 GitHub App으로 연결된 저장소를 선택하면 주요 보안 위험을 규칙 기반으로 분석하고, 발견 항목의 증거와 수정 방향을 화면에서 확인할 수 있습니다.

## 주요 기능

- 공개 GitHub 저장소 코드 점검
- GitHub App 설치 목록에서 점검할 저장소 선택
- GitHub App 설치 토큰 기반 비공개 저장소 점검
- 비밀값 노출, 위험한 코드 실행, 프롬프트 노출, 도구 권한, MCP 관련 위험 탐지
- 심각도별 요약 표시
- 발견 항목별 취약점, 영향도, 발견 근거, 필요 조치 제공
- 최근 스캔 이력 저장과 직전 결과 또는 기준선 비교
- 최근 스캔 이력에서 과거 결과 다시 열기
- 최근 스캔 이력 수동 삭제
- 스캔별 기준선 지정
- 새 발견, 해결됨, 유지됨, 오탐 처리 항목 분리
- 규칙별 사용 여부 설정
- 원본 점검 결과를 JSON, Markdown 보고서, 보안 체크리스트로 확인
- GitHub Issue 생성
- GitHub App 설치 목록과 설치 저장소 목록 조회 API

## 제품 요약

이 서비스는 GitHub 저장소의 코드를 가져와 AI 애플리케이션과 개발 도구에서 자주 발생하는 보안 위험을 규칙 기반으로 점검합니다. 공개 저장소는 URL만으로 점검하고, 비공개 저장소는 GitHub App 설치 권한을 사용합니다.

```mermaid
flowchart LR
  User["사용자"] --> Web["웹 화면"]
  Web --> ScanAPI["스캔 API"]
  Web --> GitHubPicker["GitHub App 저장소 선택 API"]
  GitHubPicker --> GitHubApp["GitHub App"]
  ScanAPI --> GitHubSource["GitHub 파일 수집"]
  GitHubSource --> PublicRepo["공개 저장소"]
  GitHubSource --> PrivateRepo["비공개 저장소"]
  ScanAPI --> Scanner["규칙 기반 분석기"]
  Scanner --> History["스캔 이력 저장소"]
  History --> Reports["보고서와 체크리스트"]
  History --> Baseline["기준선과 오탐 설정"]
```

## 스캔 실행 흐름

```mermaid
sequenceDiagram
  participant U as 사용자
  participant W as 웹 화면
  participant A as 스캔 API
  participant G as GitHub
  participant S as 분석기
  participant H as 이력 저장소

  U->>W: 저장소 URL 입력 또는 GitHub App 저장소 선택
  W->>A: POST /api/scans
  A->>G: 저장소 메타데이터와 파일 트리 조회
  G-->>A: 파일 목록과 원문
  A->>S: 규칙 기반 점검 실행
  S-->>A: 발견 항목과 심각도 요약
  A->>H: 스캔 결과 저장
  H-->>A: 직전 스캔 또는 기준선 비교
  A-->>W: 스캔 결과, 비교 결과, 오탐 분리 결과
  W-->>U: 카드형 결과와 보고서 링크 표시
```

## 구현된 기능 스펙

| 영역 | 현재 상태 | 설명 |
| --- | --- | --- |
| 공개 저장소 스캔 | 완료 | `github.com` 저장소 URL을 입력해 스캔합니다. |
| 비공개 저장소 스캔 | 완료 | GitHub App installation ID와 설치 토큰으로 접근합니다. |
| 비공개 저장소 오류 안내 | 완료 | 인증 누락, 권한 부족, 설정 누락, rate limit을 구분합니다. |
| 저장소 선택 UI | 완료 | GitHub App 설치 목록과 접근 가능한 저장소 목록을 불러옵니다. |
| 규칙 기반 분석 | 완료 | 비밀값, 위험한 실행, 프롬프트 주입, MCP, API 인증/권한 검토 항목을 탐지합니다. |
| 상세 카드 | 완료 | 취약점, 우선순위, 위치, 근거, 영향도, 필요 조치를 표시합니다. |
| 스캔 이력 | 완료 | JSON, SQLite 또는 Postgres에 저장하고 과거 결과를 다시 열 수 있습니다. |
| 비교 | 완료 | 기준선이 있으면 기준선과 비교하고, 없으면 직전 스캔과 비교합니다. |
| 오탐 처리 | 완료 | 오탐 항목을 기본 목록과 보고서에서 제외하고 해제할 수 있습니다. |
| 규칙 설정 | 완료 | 규칙별 사용 여부를 조정하고 새 스캔에 반영합니다. |
| 내보내기 | 완료 | Markdown 보고서와 보안 체크리스트를 내려받을 수 있습니다. |
| GitHub Issue 생성 | 완료 | GitHub App 설치 권한으로 현재 스캔 결과를 Issue로 생성합니다. |

## API 요약

| API | 용도 |
| --- | --- |
| `GET /api/github/installations` | GitHub App 설치 목록 조회 |
| `GET /api/github/repositories?installationId=123` | 설치별 접근 가능 저장소 목록 조회 |
| `GET /api/scans` | 최근 스캔 이력 조회 |
| `POST /api/scans` | 저장소 스캔 실행 |
| `GET /api/scans/{scanId}` | 저장된 스캔 상세 재조회 |
| `DELETE /api/scans/{scanId}` | 저장된 스캔 삭제 |
| `GET /api/scans/{scanId}/markdown` | Markdown 상세 보고서 다운로드 |
| `GET /api/scans/{scanId}/checklist` | 보안 조치 체크리스트 다운로드 |
| `POST /api/scans/{scanId}/github-issue` | 스캔 결과 GitHub Issue 생성 |
| `GET /api/scans/settings` | 기준선, 오탐, 규칙 설정 조회 |
| `PATCH /api/scans/settings` | 기준선 지정, 오탐 처리, 규칙 사용 여부 변경 |
| `GET /api/scans/schedules` | 예약 스캔 설정 조회 |
| `POST /api/scans/schedules` | 저장소별 예약 스캔 생성 또는 갱신 |
| `DELETE /api/scans/schedules?repositoryKey=owner/name` | 저장소 예약 스캔 삭제 |
| `POST /api/scans/schedules/run-due` | 실행 시간이 지난 예약 스캔 실행 |

## 데이터 흐름과 저장 항목

```mermaid
flowchart TD
  Scan["스캔 결과"] --> HistoryJson[".data/scans.json"]
  Scan --> HistorySqlite["SQLite 선택 저장"]
  Scan --> HistoryPostgres["Postgres 운영 저장"]
  Settings["스캔 설정"] --> SettingsJson[".data/scan-settings.json"]
  Settings --> SettingsSqlite["SQLite 선택 저장"]
  Settings --> SettingsPostgres["Postgres 운영 저장"]
  HistoryJson --> Replay["과거 스캔 재조회"]
  HistoryPostgres --> Replay
  SettingsJson --> BaselineCompare["기준선 비교"]
  SettingsPostgres --> BaselineCompare
  SettingsJson --> Suppression["오탐 제외"]
  SettingsJson --> RuleToggle["규칙 사용 여부"]
  SettingsJson --> Schedules["예약 스캔 설정"]
  Schedules --> ScheduledRun["예약 실행 API"]
  ScheduledRun --> HistoryJson
```

## 화면에서 할 수 있는 일

1. 공개 GitHub 저장소 주소를 입력하거나 GitHub App 설치 목록에서 저장소를 선택합니다.
2. 저장소 점검을 실행합니다.
3. 심각도 요약과 발견 항목 목록을 확인합니다.
4. 위험 요약에서 즉시 조치 대상과 우선 검토 대상을 확인합니다.
5. 각 항목의 취약점, 영향도, 발견 위치, 발견 근거, 필요 조치를 검토합니다.
6. 직전 스캔과 비교해 새 발견, 해결됨, 유지 중 항목을 확인합니다.
7. 최근 스캔 이력을 클릭해 과거 결과와 비교 내용을 다시 확인합니다.
8. 더 이상 필요 없는 최근 스캔 이력은 삭제 버튼으로 정리합니다.
9. 기준선 지정, 오탐 처리, 규칙 사용 여부를 조정합니다.
10. 필요하면 JSON 보고서를 열거나 Markdown 보고서와 보안 체크리스트를 내려받아 상세 결과를 확인합니다.
11. GitHub App installation ID가 있으면 GitHub Issue를 생성합니다.
12. 예약 스캔을 저장하고 실행 시간이 지난 예약을 수동으로 실행해 새 취약점과 해결된 취약점 알림 후보를 확인합니다.

## 예약 스캔과 변경 알림

예약 스캔은 Repository scan 서비스 안에서 저장소별 점검 주기를 관리합니다. 현재 단계에서는 화면과 API에서 예약을 저장하고, `run-due` API를 호출해 실행 시간이 지난 저장소를 점검합니다.

예약 실행 결과는 기존 스캔 이력에 저장되며, 기준선 또는 이전 스캔과 비교해 다음 내용을 보여줍니다.

- 새 취약점
- 해결된 취약점
- 유지 중인 취약점
- 오탐 처리된 항목
- 알림 후보 메시지

운영 환경에서는 GitHub Actions schedule로 `run-due` API를 주기 호출합니다. 이 API는 `SCHEDULE_RUN_TOKEN`이 설정되어 있으면 `Authorization` 헤더의 Bearer 토큰이 일치할 때만 실행됩니다.

Render 웹 서비스 환경 변수와 GitHub repository secret에 같은 값을 추가합니다.

```text
SCHEDULE_RUN_TOKEN=충분히-긴-무작위-문자열
```

GitHub Actions 워크플로는 다음 파일에 있습니다.

```text
.github/workflows/repository-scan-scheduled-runner.yml
```

권장 주기는 1시간입니다. 스캔 실행 여부는 각 저장소의 `nextRunAt`으로 다시 판단하므로, 워크플로가 자주 호출되어도 실행 시간이 지난 예약만 스캔합니다.

자세한 GitHub Actions 설정 절차는 `docs/github-actions-scheduled-scans.md`를 참고합니다.

## 스캔 이력 저장

스캔 결과는 로컬 실행 환경의 다음 파일에 저장됩니다.

```text
.data/scans.json
```

`.data` 디렉터리는 런타임 생성물이며 git에는 포함하지 않습니다. 이 파일을 지우면 저장된 스캔 이력도 초기화됩니다.

웹 화면의 최근 스캔 목록에서 개별 스캔 이력을 삭제할 수 있습니다. 현재 열어둔 저장 스캔을 삭제하면 상세 결과 화면도 함께 비워집니다.

개별 스캔 이력 삭제 API는 다음과 같습니다.

```text
DELETE /api/scans/{scanId}
```

로컬에서 SQLite로 저장하려면 다음 환경 변수를 사용합니다.

```text
SCAN_HISTORY_DATABASE_URL=sqlite:.data/scans.sqlite
```

Render 같은 운영 환경에서는 Postgres 또는 Neon 연결 문자열을 같은 환경 변수에 넣습니다.

```text
SCAN_HISTORY_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

이 값이 있으면 JSON 파일 대신 데이터베이스에 스캔 이력과 설정을 저장합니다. 저장되는 설정에는 기준선, 오탐 처리, 규칙 사용 여부, 예약 스캔 정보가 포함됩니다.

## GitHub App 연동 기반

GitHub App으로 연결된 저장소를 화면에서 고를 수 있습니다. 설치 항목을 선택하면 접근 가능한 저장소 목록을 불러오고, 저장소를 선택하면 점검 입력값이 자동으로 채워집니다.

```text
GET /api/github/installations
GET /api/github/repositories?installationId=123
```

필수 환경 변수는 다음과 같습니다.

```text
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
```

`GITHUB_APP_PRIVATE_KEY`는 줄바꿈을 `\n` 문자열로 넣어도 서버에서 실제 줄바꿈으로 변환합니다.

로컬에서는 예시 파일을 복사해 값을 채웁니다.

```bash
cp .env.example .env.local
```

설정값이 준비됐는지 확인합니다.

```bash
pnpm run github:check
```

준비가 끝나면 웹 화면에서 GitHub App 설치 목록이 표시됩니다. 설정값이 없으면 설치 목록 API는 `GitHub App is not configured.`와 빠진 항목 목록을 반환합니다.

## 로컬 실행

의존성을 설치합니다.

```bash
pnpm install
```

웹 화면을 실행합니다.

```bash
pnpm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000
```

## 개발 명령

전체 테스트를 실행합니다.

```bash
CI=true pnpm test
```

타입 검사를 실행합니다.

```bash
CI=true pnpm lint
```

배포 빌드를 확인합니다.

```bash
CI=true pnpm run build
```

GitHub App 로컬 설정을 확인합니다.

```bash
pnpm run github:check
```

## 현재 범위

- 공개 `github.com` 저장소는 주소 입력만으로 점검합니다.
- GitHub App 설치가 설정된 경우 권한이 있는 저장소를 선택해 점검할 수 있습니다.
- 비공개 저장소는 GitHub App installation ID가 있어야 점검할 수 있습니다.
- 점검은 규칙 기반으로 동작합니다.
- 스캔 이력과 설정은 로컬 파일, SQLite 또는 Postgres에 저장합니다.
- 사용자 계정, 팀 권한 관리, 원격 저장 결과 관리는 아직 포함하지 않습니다.
- 외부 대시보드나 별도 업무 데이터 없이 독립적으로 동작합니다.

## 다음 로드맵

- 팀별 규칙 설정과 예외 관리
- 예약 스캔과 변경 알림
- PR 체크 또는 코멘트 연동
