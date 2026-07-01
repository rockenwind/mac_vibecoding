# 시장 수요 기반 보안 점검 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시장 추천 신호를 사용자가 바로 활용할 수 있는 보안 점검 흐름과 한글 GitHub 문서로 확장한다.

**Architecture:** 시장 신호 계산은 `src/lib/marketSignals/signals.ts`에 유지하고, 화면은 API 응답을 선택 가능한 추천 항목과 점검 템플릿으로 표현한다. 데이터베이스 API는 기존 구조를 유지하되 공고 날짜와 회사명을 계산 입력으로 넘긴다.

**Tech Stack:** Next.js, React, TypeScript, Vitest, PostgreSQL `pg`

---

### Task 1: 시장 신호 모델 확장

**Files:**
- Modify: `src/lib/marketSignals/signals.ts`
- Modify: `src/lib/marketSignals/signals.test.ts`

- [ ] 실패하는 테스트를 추가한다. `MarketJob`에 `company`, `firstSeenAt`을 넣고 최근 공고가 오래된 공고보다 높은 점수를 받는지 확인한다.
- [ ] 테스트를 실행해 실패를 확인한다.
- [ ] `MarketSignal`에 `template`, `trend`, `jobCount`를 추가하고 점수 계산에 최근성, 강한 키워드, 회사 중복 완화를 반영한다.
- [ ] 테스트를 다시 실행해 통과를 확인한다.

### Task 2: API 응답 확장

**Files:**
- Modify: `src/app/api/market-signals/route.ts`
- Modify: `src/app/api/market-signals/route.test.ts`

- [ ] 실패하는 테스트를 추가해 `company`와 `first_seen_at`이 계산 함수로 전달되는지 확인한다.
- [ ] 테스트를 실행해 실패를 확인한다.
- [ ] SQL 조회와 매핑 로직을 확장한다.
- [ ] API 테스트를 다시 실행해 통과를 확인한다.

### Task 3: 화면 흐름 확장

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.test.tsx`

- [ ] 실패하는 화면 테스트를 추가해 추천 항목 선택 후 점검 템플릿과 추세 요약이 보이는지 확인한다.
- [ ] 테스트를 실행해 실패를 확인한다.
- [ ] 추천 항목을 버튼으로 바꾸고 선택 상태, 점검 템플릿, 추세 요약을 추가한다.
- [ ] 화면 테스트를 다시 실행해 통과를 확인한다.

### Task 4: 한글 README 작성

**Files:**
- Modify: `README.md`

- [ ] 서비스 목적, 실행 방법, 데이터 연동, 주요 기능, 개발 명령, 로드맵을 한글로 작성한다.
- [ ] 문서에 필요한 명령과 환경 변수 이름이 실제 코드와 맞는지 확인한다.

### Task 5: 전체 검증과 PR

**Files:**
- No code files

- [ ] `CI=true pnpm test`를 실행한다.
- [ ] `CI=true pnpm lint`를 실행한다.
- [ ] `CI=true pnpm run build`를 실행한다.
- [ ] 로컬 API와 화면을 확인한다.
- [ ] 커밋, 푸시, PR 생성을 진행한다.
