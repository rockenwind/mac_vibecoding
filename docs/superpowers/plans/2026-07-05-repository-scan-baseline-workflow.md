# 저장소 스캔 기준선 워크플로 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장소 스캔에 기준선 비교, 오탐 처리, 규칙 설정, 진행 상태 표시를 추가한다.

**Architecture:** 기존 스캔 이력은 유지하고 `scanSettings` 모듈을 새로 추가해 저장소별 기준선, 오탐 지문, 규칙 사용 여부를 관리한다. 비교 로직은 줄 번호가 아닌 발견 항목 지문을 기준으로 개선하고, API는 설정을 반영한 스캔/재조회 결과를 반환한다. 화면은 기존 단일 페이지에 설정 패널, 기준선 버튼, 오탐 처리 버튼, 진행 단계 문구를 추가한다.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, Node JSON 파일 저장, Node SQLite

---

## 파일 구조

- Create: `src/lib/scanSettings/types.ts`
  - 기준선, 오탐, 규칙 설정 타입을 정의한다.
- Create: `src/lib/scanSettings/store.ts`
  - JSON/SQLite 설정 저장소를 구현한다.
- Create: `src/lib/scanSettings/store.test.ts`
  - 기준선, 오탐, 규칙 설정 저장을 검증한다.
- Modify: `src/lib/scanner/analyzers.ts`
  - 규칙 메타데이터를 외부에 공개하고 비활성 규칙 필터를 받는다.
- Modify: `src/lib/scanner/scan.ts`
  - `disabledRuleIds`를 받아 스캔 결과에서 제외한다.
- Modify: `src/lib/scanHistory/types.ts`
  - 기준선, 비교 출처, 오탐 처리 항목 필드를 추가한다.
- Modify: `src/lib/scanHistory/store.ts`
  - 발견 항목 지문 기반 비교와 오탐 분리를 구현한다.
- Modify: `src/app/api/scans/settings/route.ts`
  - 설정 조회/수정 API를 추가한다.
- Modify: `src/app/api/scans/route.ts`
  - 설정을 읽어 스캔, 비교, 오탐 분리를 반영한다.
- Modify: `src/app/api/scans/[scanId]/route.ts`
  - 저장된 스캔 재조회에도 설정을 반영한다.
- Modify: `src/app/page.tsx`
  - 기준선 지정, 규칙 설정, 오탐 처리, 진행 상태 표시를 추가한다.
- Modify: 관련 테스트 파일
  - API와 화면 회귀 테스트를 추가한다.

## Task 1: 설정 저장소와 지문 비교

- [x] `src/lib/scanSettings/types.ts`, `src/lib/scanSettings/store.ts`, `src/lib/scanSettings/store.test.ts`를 추가한다.
- [x] 기준선 저장/조회, 오탐 추가/해제, 규칙 설정 변경 테스트를 먼저 작성한다.
- [x] JSON 저장소와 SQLite 저장소를 구현한다.
- [x] `src/lib/scanHistory/store.test.ts`에 줄 번호가 달라도 같은 지문이면 유지 항목으로 비교되는 테스트를 추가한다.
- [x] 오탐 지문이 새 발견에서 제외되고 `suppressedFindings`로 분리되는 테스트를 추가한다.

## Task 2: 스캐너 규칙 설정

- [x] `src/lib/scanner/analyzers.test.ts`에 비활성 규칙이 결과에서 제외되는 테스트를 추가한다.
- [x] 규칙 메타데이터를 `listAnalyzerRules()`로 공개한다.
- [x] `analyzeFiles(files, { disabledRuleIds })`와 `runScan(..., { disabledRuleIds })`를 구현한다.

## Task 3: 설정 API와 스캔 API

- [x] `src/app/api/scans/settings/route.test.ts`를 추가해 설정 조회/수정 API를 검증한다.
- [x] `src/app/api/scans/settings/route.ts`를 추가한다.
- [x] `src/app/api/scans/route.test.ts`에서 규칙 설정과 기준선 비교를 검증한다.
- [x] `src/app/api/scans/[scanId]/route.test.ts`에서 저장 스캔 재조회가 기준선과 오탐을 반영하는지 검증한다.

## Task 4: 화면 워크플로

- [x] `src/app/page.test.tsx`에 진행 상태, 기준선 지정 버튼, 규칙 설정, 오탐 처리 버튼 표시 테스트를 추가한다.
- [x] `src/app/page.tsx`에 설정 로딩, 기준선 지정, 오탐 처리/해제, 규칙 토글 요청을 구현한다.
- [x] 비교 영역에 기준선 또는 직전 스캔 출처를 표시한다.
- [x] 발견 목록과 비교 목록에서 오탐 처리 항목을 분리 표시한다.

## Task 5: 검증과 게시

- [x] 핵심 테스트를 실행한다.
- [x] 타입 검사를 실행한다.
- [x] 빌드를 실행한다.
- [x] 코드 리뷰를 요청하고 지적 사항을 반영한다.
- [ ] 커밋, 푸시, PR 생성을 진행한다.
