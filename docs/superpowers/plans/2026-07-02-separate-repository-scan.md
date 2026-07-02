# Repository Scan 분리 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repository scan 서비스를 Security and Network Jobs와 독립된 GitHub 코드 점검 서비스로 정리한다.

**Architecture:** `mac_vibecoding`의 Next.js 화면과 API에서 채용 공고/시장 신호 관련 코드를 제거한다. `apps/vibecoding` submodule은 별도 서비스로 남기되 Repository scan UI, API, README에서 결합 설명을 제거한다.

**Tech Stack:** Next.js, React, TypeScript, Vitest

---

### Task 1: 화면 분리

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [x] Jobs/market 관련 UI가 보이지 않고 `/api/market-signals`를 호출하지 않는 실패 테스트를 작성한다.
- [x] market panel, job dashboard link, template/focus UI를 제거한다.
- [x] 화면 테스트를 통과시킨다.

### Task 2: API와 스캔 모델 분리

**Files:**
- Modify: `src/app/api/scans/route.test.ts`
- Modify: `src/app/api/scans/route.ts`
- Modify: `src/lib/scanner/scan.test.ts`
- Modify: `src/lib/scanner/scan.ts`
- Modify: `src/lib/scanner/types.ts`
- Delete: `src/app/api/market-signals/*`
- Delete: `src/lib/marketSignals/*`

- [x] 스캔 API가 `repositoryUrl`만 받는 기대 테스트를 작성한다.
- [x] scan focus 메타데이터와 market signals API를 제거한다.
- [x] 관련 테스트를 통과시킨다.

### Task 3: 문서와 의존성 정리

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete or rewrite: Jobs 결합을 설명하는 문서

- [x] README를 Repository scan 전용 한글 문서로 정리한다.
- [x] `pg`, `@types/pg` 의존성을 제거한다.
- [x] 전체 테스트, 타입 검사, 빌드를 통과시킨다.
