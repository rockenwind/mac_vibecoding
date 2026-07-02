# Repository scan 저장 구조와 내보내기 설계

## 목표

Repository scan은 GitHub 저장소 코드 점검 서비스로 유지한다. Security and Network Jobs 서비스와 데이터, 화면, API를 섞지 않는다.

이번 단계의 목표는 다음과 같다.

- 스캔 기록 저장 코드를 저장소 인터페이스로 분리한다.
- 현재 JSON 파일 저장은 유지하되 SQLite 전환이 가능한 구조로 만든다.
- 저장된 스캔 결과를 Markdown 보고서로 내려받을 수 있게 한다.
- GitHub App 또는 OAuth 연동은 실제 인증 구현 전 설계와 API 계약을 먼저 정리한다.
- Jobs 서비스 운영 문서는 별도 문서에서만 보강한다.

## 범위

### 포함

- Repository scan 저장소 인터페이스
- JSON 기반 기본 저장소 구현
- Markdown 보고서 생성 함수
- 저장된 스캔의 Markdown 다운로드 API
- Repository scan 화면의 Markdown 다운로드 링크
- GitHub 연동 설계 문서
- 운영 점검 문서 보강

### 제외

- 실제 SQLite 패키지 도입
- GitHub App 설치 플로우 구현
- GitHub Issue 자동 생성
- Jobs 데이터를 Repository scan 화면에 노출하는 기능

## 저장 구조

현재 `.data/scans.json`은 그대로 사용한다. 다만 화면과 API가 파일 구현에 직접 묶이지 않도록 `ScanHistoryStore` 인터페이스를 둔다.

구현체는 우선 `createJsonScanHistoryStore()`로 제공한다. 이후 SQLite 전환 시 `createSqliteScanHistoryStore()`를 추가하고 기본 저장소 선택만 바꾸면 된다.

## Markdown 내보내기

저장된 스캔 ID를 기준으로 Markdown 보고서를 내려받는다.

```text
GET /api/scans/{scanId}/markdown
```

응답은 `text/markdown`이며 파일 다운로드가 가능하도록 `Content-Disposition` 헤더를 포함한다.

## GitHub 연동 방향

초기 MVP는 공개 저장소 URL 기반 점검을 유지한다. 다음 단계에서 GitHub App 또는 OAuth를 붙여 비공개 저장소, 설치 저장소 목록, Issue 생성 권한을 다룬다.

우선 설계 문서에는 권한 범위, 토큰 저장 방식, 콜백 흐름, API 계약을 남긴다.

## 성공 기준

- 기존 `/api/scans` 동작이 유지된다.
- 스캔 기록 저장 테스트가 저장소 인터페이스를 검증한다.
- Markdown 보고서 생성과 다운로드 API 테스트가 통과한다.
- 화면에서 최신 스캔의 Markdown 다운로드 링크가 보인다.
- Jobs 관련 문서는 별도 운영 문서에만 존재한다.
