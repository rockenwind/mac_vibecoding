# 맥 바이브코딩 AI 보안 점검 도구

이 저장소는 채용 공고 데이터와 저장소 보안 점검을 연결하는 AI 보안 서비스 MVP입니다. Vibecoding이 수집한 보안/개발 채용 공고에서 시장 수요를 읽고, 그 수요를 바탕으로 저장소에서 먼저 확인해야 할 보안 점검 항목을 추천합니다.

## 주요 기능

- 공개 GitHub 저장소 보안 스캔
- 비밀값 노출, 위험한 실행, 프롬프트 노출, 도구 권한, MCP 관련 위험 탐지
- Vibecoding 채용 공고 데이터 기반 보안 수요 추천
- 추천 항목 선택 시 바로 사용할 수 있는 점검 템플릿 제공
- 심각도 요약, 증거, 위험 설명, 수정 가이드, JSON 보고서 표시
- 맥 환경에서 Vibecoding 백엔드 자동 실행 지원

## 화면에서 할 수 있는 일

1. Vibecoding이 수집한 최근 공고를 기준으로 보안 수요를 확인합니다.
2. 추천 점검 항목을 선택해 목적, 확인 대상, 추천 키워드, 체크리스트를 확인합니다.
3. 공개 GitHub 저장소 주소를 입력해 AI 보안 위험을 스캔합니다.
4. 발견 항목의 증거와 수정 가이드를 확인합니다.

## 데이터 연동

시장 수요 추천은 Vibecoding 데이터베이스의 `jobs` 데이터를 읽어 만듭니다. API는 다음 순서로 데이터베이스 주소를 찾습니다.

1. `VIBECODING_DATABASE_URL`
2. `DATABASE_URL`
3. `apps/vibecoding/.env.local`

Neon에서 받은 주소가 `postgresql+psycopg://...` 형식이면, 웹 API에서 Node.js용 `postgresql://...` 형식으로 자동 변환합니다.

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

## Vibecoding 자동 실행

맥에서 Vibecoding 백엔드를 자동 실행하려면 설치 스크립트를 사용합니다.

```bash
scripts/install-vibecoding-launch-agent.sh
```

자동 실행을 해제하려면 다음 스크립트를 사용합니다.

```bash
scripts/uninstall-vibecoding-launch-agent.sh
```

Vibecoding 대시보드는 기본적으로 다음 주소에서 확인합니다.

```text
http://127.0.0.1:8000/login
```

## 개발 명령

전체 시험을 실행합니다.

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

## 현재 MVP 범위

- 공개 `github.com` 저장소만 스캔합니다.
- 저장소 스캔은 규칙 기반으로 동작합니다.
- 시장 수요 추천은 최근 공고의 키워드, 최근성, 회사 중복 완화를 반영합니다.
- 아직 사용자 계정, 비공개 저장소 스캔, AI 모델 호출은 포함하지 않습니다.

## 다음 로드맵

- 추천 점검 템플릿에서 바로 스캔 조건을 채우는 흐름
- 날짜별 수요 저장과 주간 추세 비교
- 회사/직무군/키워드별 가중치 조정 화면
- 스캔 결과를 이슈나 운영 체크리스트로 내보내는 기능
