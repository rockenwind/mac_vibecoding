# 스캔 결과 저장과 이력 비교 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repository scan 결과를 로컬 파일에 저장하고, 최근 이력과 직전 스캔 대비 변경 요약을 화면에 보여준다.

**Architecture:** 스캔 이력은 `src/lib/scanHistory` 모듈에서 파일 저장과 비교 계산을 담당한다. `POST /api/scans`는 스캔 성공 후 저장과 비교 결과를 반환하고, `GET /api/scans`는 최신 이력을 반환한다. 화면은 초기 로딩에서 이력을 가져오고, 스캔 후 비교 요약을 표시한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Node.js `fs/promises`, Vitest

---

### Task 1: 스캔 이력 저장 모듈

**Files:**
- Create: `src/lib/scanHistory/types.ts`
- Create: `src/lib/scanHistory/store.ts`
- Create: `src/lib/scanHistory/store.test.ts`
- Modify: `.gitignore`

- [x] 파일이 없으면 빈 이력을 반환하는 실패 테스트를 작성한다.
- [x] 스캔 결과를 저장하고 최신순으로 읽는 실패 테스트를 작성한다.
- [x] 직전 동일 저장소 스캔과 비교하는 실패 테스트를 작성한다.
- [x] `readScanHistory`, `recordScan`, `compareScanResults`를 구현한다.
- [x] `src/lib/scanHistory/store.test.ts`를 통과시킨다.

### Task 2: 스캔 API 이력 연동

**Files:**
- Modify: `src/app/api/scans/route.ts`
- Modify: `src/app/api/scans/route.test.ts`

- [x] `GET /api/scans`가 최근 이력을 반환하는 실패 테스트를 작성한다.
- [x] `POST /api/scans`가 저장된 스캔과 비교 결과를 반환하는 실패 테스트를 작성한다.
- [x] API에서 스캔 성공 시 `recordScan`을 호출하고 `history`와 `comparison`을 응답에 포함한다.
- [x] `src/app/api/scans/route.test.ts`를 통과시킨다.

### Task 3: 화면 이력과 비교 요약

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/globals.css`

- [x] 화면이 최근 스캔 이력을 불러와 표시하는 실패 테스트를 작성한다.
- [x] 스캔 후 새 발견, 해결됨, 유지 중 숫자를 표시하는 실패 테스트를 작성한다.
- [x] 이력 패널과 비교 요약 UI를 구현한다.
- [x] `src/app/page.test.tsx`를 통과시킨다.

### Task 4: 문서와 검증

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-02-scan-history.md`

- [x] README에 스캔 이력 저장과 로컬 데이터 위치를 추가한다.
- [x] 계획 체크박스를 완료 상태로 갱신한다.
- [x] 전체 테스트, 타입 검사, 빌드를 통과시킨다.
