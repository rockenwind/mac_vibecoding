# SQLite 스캔 기록 저장 설계

## 목표

Repository scan 기록을 JSON 파일뿐 아니라 SQLite 데이터베이스에도 저장할 수 있게 한다.

## 범위

- `ScanHistoryStore` 인터페이스는 유지한다.
- `createSqliteScanHistoryStore()` 구현을 추가한다.
- `SCAN_HISTORY_DATABASE_URL=sqlite:/path/to/scans.sqlite`가 있으면 SQLite 저장소를 사용한다.
- 기존 `SCAN_HISTORY_FILE` JSON 저장 방식은 유지한다.

## 제외

- 원격 PostgreSQL 저장
- 마이그레이션 CLI
- 기존 JSON 기록 자동 이전

## 저장 구조

SQLite 테이블은 다음 필드를 가진다.

- `id`: 스캔 ID
- `saved_at`: 저장 시각
- `scan_json`: 전체 스캔 결과 JSON

읽기 결과는 기존 `ScanHistoryEntry[]`와 동일하다.
