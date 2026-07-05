# 비공개 저장소 점검 안정화 설계

## 배경

저장소 보안 점검 도구는 GitHub App 설치 토큰을 사용해 비공개 저장소를 스캔할 수 있다. 다만 현재 실패 메시지는 공개 저장소 없음, 비공개 저장소 인증 누락, GitHub App 설정 누락, 설치 권한 부족을 충분히 구분하지 못한다. 사용자는 실패 후 어떤 조치를 해야 하는지 바로 알기 어렵다.

## 목표

- 비공개 저장소를 installation ID 없이 스캔한 경우 GitHub App 연결이 필요하다는 안내를 제공한다.
- GitHub App 설정 누락, 설치 토큰 생성 실패, 저장소 접근 권한 부족을 구분한다.
- 스캔 API는 원인에 맞는 HTTP 상태와 한글/영어 안내 메시지를 반환한다.
- 화면은 스캔 실패 시 사용자가 취할 다음 액션을 함께 보여준다.
- README에는 지금까지 구현한 제품 흐름, 데이터 흐름, 주요 스펙을 다이어그램과 함께 요약한다.

## 비목표

- GitHub App 설치 화면을 새로 만들지 않는다.
- 사용자 계정, 팀 권한, 원격 저장소 이력 관리는 포함하지 않는다.
- GitHub OAuth 방식은 추가하지 않는다.

## 오류 모델

스캔 API는 기존 `{ error }` 응답에 선택적으로 `action` 필드를 추가한다.

- `repositoryUrl must be a string.`: 요청 형식 오류
- `installationId must be a positive number.`: 설치 ID 형식 오류
- `GitHub App is not configured.`: 서버 설정 누락
- `Repository was not found or private access requires GitHub App installation.`: 저장소 URL 오류, 삭제된 공개 저장소, 또는 비공개 저장소 인증 누락
- `GitHub App permission was denied.`: 설치 권한 부족 또는 잘못된 installation ID
- `GitHub rate limit reached. Try again later.`: GitHub API 제한

`action`은 화면에서 사용자 안내 문구로 표시한다.

## API 흐름

1. `POST /api/scans`가 저장소 URL과 선택적 installation ID를 받는다.
2. installation ID가 있으면 GitHub App JWT와 설치 토큰을 발급한다.
3. 저장소 메타데이터와 파일 트리를 가져온다.
4. GitHub 응답 상태를 안정화된 오류로 변환한다.
5. 스캔 성공 시 기존 규칙, 기준선, 오탐 설정을 반영한다.

## 화면 흐름

- 스캔 실패 시 기존 오류 영역에 `error`를 표시한다.
- API가 `action`을 반환하면 다음 줄에 `조치 / Action: ...` 형태로 표시한다.
- GitHub App 설치 저장소 선택 흐름은 기존 UI를 유지한다.

## README 정리

README에는 다음 항목을 추가 또는 갱신한다.

- 전체 제품 구성 요약
- Mermaid 기반 서비스 구조도
- Mermaid 기반 스캔 실행 흐름도
- 기능 스펙 표
- API 요약 표
- 저장 데이터 요약
- 현재 완료된 로드맵과 다음 단계

## 테스트

- 비공개 저장소를 installation ID 없이 스캔할 때 403과 action을 반환하는지 검증한다.
- GitHub App 권한 부족 오류가 403으로 유지되는지 검증한다.
- GitHub App 설정 누락이 503으로 반환되는지 검증한다.
- 화면에서 action 안내가 표시되는지 검증한다.
- README에 다이어그램과 주요 스펙 섹션이 포함되는지 검증한다.
