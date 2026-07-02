# GitHub 연동 설계

이 문서는 Repository scan 서비스의 GitHub 연동 방향을 정리한다. Security and Network Jobs 서비스와는 무관하다.

## 현재 상태

현재 Repository scan은 공개 GitHub 저장소 URL을 입력받아 코드를 내려받고 점검한다.

```text
POST /api/scans
```

요청 본문은 다음과 같다.

```json
{
  "repositoryUrl": "https://github.com/owner/repository"
}
```

## 다음 단계 목표

- 비공개 저장소 점검
- 사용자가 접근 가능한 저장소 목록 조회
- 저장된 스캔 결과의 GitHub Issue 생성
- 조직 또는 개인 계정별 설치 상태 확인

## 추천 방식

MVP 이후에는 GitHub App 방식을 우선 추천한다.

| 항목 | GitHub App | OAuth App |
| --- | --- | --- |
| 권한 범위 | 설치 저장소 단위로 제한 가능 | 사용자 권한에 더 강하게 의존 |
| 조직 적용 | 조직 설치와 저장소 선택에 적합 | 개인 사용자 인증에 적합 |
| Issue 생성 | 설치 저장소 권한으로 처리 가능 | 사용자 토큰으로 처리 |
| 운영 보안 | 토큰 수명이 짧고 회전하기 쉬움 | 장기 사용자 토큰 관리 부담 |

OAuth는 개인 계정 중심의 빠른 인증에는 단순하지만, 저장소 보안 점검 서비스에는 GitHub App이 더 적합하다.

## 필요한 권한

초기 GitHub App 권한은 최소 권한으로 시작한다.

- Repository contents: read
- Metadata: read
- Issues: read and write

Pull request 분석을 추가할 때만 Pull requests 권한을 별도로 추가한다.

## 환경 변수

```text
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_WEBHOOK_SECRET
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_CALLBACK_URL
```

## API 계약 초안

### 설치 상태 조회

```text
GET /api/github/installations
```

응답 예시는 다음과 같다.

```json
{
  "installations": [
    {
      "id": 123,
      "account": "owner",
      "repositories": 12
    }
  ]
}
```

### 설치 저장소 조회

```text
GET /api/github/repositories?installationId=123
```

### GitHub Issue 생성

```text
POST /api/scans/{scanId}/github-issue
```

요청 본문은 다음과 같다.

```json
{
  "installationId": 123,
  "repository": "owner/repository",
  "title": "Security scan report",
  "labels": ["security", "repository-scan"]
}
```

초기 구현에서는 Markdown 보고서 생성 함수를 재사용해 Issue 본문을 만든다.

## 토큰 저장

GitHub App 설치 토큰은 짧은 수명으로 발급되므로 데이터베이스에 장기 저장하지 않는다. 설치 ID와 계정 정보만 저장하고, 요청 시 서버에서 설치 토큰을 발급한다.

## 보안 원칙

- 비밀값은 서버 환경 변수에만 둔다.
- GitHub 개인 토큰을 브라우저에 노출하지 않는다.
- Issue 생성 전 사용자가 저장소와 제목을 확인하게 한다.
- 저장소 접근 실패와 권한 부족은 명확히 구분해 표시한다.
