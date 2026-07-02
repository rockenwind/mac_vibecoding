# 비공개 저장소 스캔 설계

## 목표

Repository scan에서 기존 공개 저장소 URL 스캔을 유지하면서, GitHub App 설치 ID가 제공되면 설치 토큰으로 비공개 저장소 파일을 읽어 스캔한다.

## 범위

- `POST /api/scans` 요청에 선택적 `installationId`를 추가한다.
- `installationId`가 있으면 GitHub App 설정, JWT, 설치 토큰을 사용한다.
- 파일 수집기는 선택적 접근 토큰을 받아 GitHub API와 raw 파일 요청에 인증 헤더를 붙인다.
- 웹 화면에는 선택적 설치 ID 입력란을 추가한다.

## 제외

- 저장소 목록 선택 UI
- GitHub App 설치 화면
- 사용자 세션
- GitHub Issue 생성

## 오류 처리

- `installationId`가 양의 정수가 아니면 400을 반환한다.
- GitHub App 설정이 없으면 503을 반환한다.
- 설치 토큰 발급 또는 GitHub API 권한 오류는 기존 오류 메시지로 반환한다.
