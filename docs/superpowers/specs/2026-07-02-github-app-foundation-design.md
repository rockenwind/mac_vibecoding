# GitHub App 연동 기반 설계

## 목표

Repository scan 서비스에 GitHub App 연동의 서버 기반 골격을 추가한다. 이 단계는 비공개 저장소 스캔과 GitHub Issue 생성의 선행 작업이며, Security and Network Jobs 서비스와는 무관하다.

## 범위

### 포함

- GitHub App 환경 변수 검증
- GitHub App JWT 생성
- 설치 목록 조회 API
- 설치 저장소 목록 조회 API
- 권한 부족, 미설정, GitHub API 오류의 명확한 응답
- 테스트와 문서 보강

### 제외

- 실제 GitHub App 설치 화면
- 비공개 저장소 파일 수집
- 스캔 결과 GitHub Issue 생성
- 사용자 계정 로그인 또는 세션 관리

## 구조

GitHub App 코드는 기존 공개 저장소 파일 수집기와 분리한다.

- `src/lib/github/appConfig.ts`: 서버 환경 변수에서 GitHub App 설정을 읽고 검증한다.
- `src/lib/github/appAuth.ts`: GitHub App JWT를 생성한다.
- `src/lib/github/appClient.ts`: GitHub App API 호출을 감싼다.
- `src/app/api/github/installations/route.ts`: 설치 목록을 반환한다.
- `src/app/api/github/repositories/route.ts`: 설치 ID 기준 저장소 목록을 반환한다.

## API

### 설치 목록 조회

```text
GET /api/github/installations
```

성공 응답:

```json
{
  "installations": [
    {
      "id": 123,
      "account": "owner",
      "repositories": 8
    }
  ]
}
```

### 설치 저장소 조회

```text
GET /api/github/repositories?installationId=123
```

성공 응답:

```json
{
  "repositories": [
    {
      "id": 1,
      "name": "repo",
      "fullName": "owner/repo",
      "private": true,
      "defaultBranch": "main",
      "url": "https://github.com/owner/repo"
    }
  ]
}
```

## 오류 처리

- GitHub App 환경 변수가 없으면 503을 반환한다.
- `installationId`가 없거나 숫자가 아니면 400을 반환한다.
- GitHub API가 401 또는 403을 반환하면 502와 권한 관련 메시지를 반환한다.
- 그 외 GitHub API 실패도 502로 반환한다.

## 보안 원칙

- 개인 토큰을 사용하지 않는다.
- 브라우저에 GitHub App 개인 키나 설치 토큰을 노출하지 않는다.
- 설치 토큰은 요청마다 서버에서 발급하고 저장하지 않는다.
- 공개 저장소 스캔 API는 기존 동작을 유지한다.
