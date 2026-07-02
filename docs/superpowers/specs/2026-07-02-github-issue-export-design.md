# GitHub Issue 내보내기 설계

## 목표

저장된 Repository scan 결과를 Markdown 보고서로 변환해 GitHub Issue로 생성한다.

## 범위

- `POST /api/scans/{scanId}/github-issue` API 추가
- 저장된 스캔 ID 기준 보고서 조회
- GitHub App 설치 토큰으로 Issue 생성
- 화면에서 installation ID가 입력된 경우 Issue 생성 버튼 제공

## 제외

- 라벨 관리 UI
- 이슈 템플릿 선택
- 사용자 로그인
- 생성된 이슈 동기화 저장
 
## 오류 처리

- 스캔 ID가 없으면 404를 반환한다.
- installation ID가 없거나 양의 정수가 아니면 400을 반환한다.
- GitHub App 설정이 없으면 503을 반환한다.
