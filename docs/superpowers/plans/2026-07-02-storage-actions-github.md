# Repository scan 저장 구조와 내보내기 구현 계획

## 1. 저장소 인터페이스 분리

- `ScanHistoryStore` 타입을 추가한다.
- JSON 파일 저장 구현을 `createJsonScanHistoryStore()`로 분리한다.
- 기존 `readScanHistory()`와 `recordScan()` 공개 함수는 유지한다.

## 2. Markdown 보고서 추가

- 스캔 결과를 Markdown으로 바꾸는 순수 함수를 만든다.
- 스캔 요약, 심각도별 개수, 경고, 발견 항목을 포함한다.
- 발견 항목이 없을 때도 읽을 수 있는 보고서를 만든다.

## 3. Markdown 다운로드 API 추가

- `GET /api/scans/{scanId}/markdown`을 추가한다.
- 저장된 스캔이 없으면 404를 반환한다.
- 저장된 스캔이 있으면 Markdown 파일로 내려준다.

## 4. 화면 연결

- 스캔 완료 후 Markdown 보고서 다운로드 링크를 표시한다.
- 기존 JSON 보고서 확인 기능은 유지한다.

## 5. GitHub 연동 설계 문서화

- GitHub App 방식과 OAuth 방식의 차이를 정리한다.
- MVP 이후 필요한 API 계약과 환경 변수를 정리한다.

## 6. 운영 문서 보강

- Repository scan과 Jobs 서비스의 운영 점검 항목을 분리해서 정리한다.
- Jobs 운영 문서는 독립 서비스 문서로 유지한다.

## 7. 검증

- 프론트엔드와 API 테스트를 실행한다.
- 타입 검사를 실행한다.
- Next.js 빌드를 실행한다.
- Jobs 자동 실행 스크립트 문법 검사를 실행한다.
