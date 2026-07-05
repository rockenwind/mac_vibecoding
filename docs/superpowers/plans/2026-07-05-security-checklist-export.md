# 보안 체크리스트 내보내기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장된 저장소 스캔 결과를 보안 조치 체크리스트 마크다운으로 내려받을 수 있게 한다.

**Architecture:** 새 보고서 빌더 `buildSecurityChecklist(scan)`이 스캔 결과를 체크박스 중심의 마크다운으로 변환한다. 새 API 라우트는 저장된 스캔을 읽고 기존 오탐 설정을 적용한 뒤 체크리스트를 반환한다. 화면은 기존 보고서 액션 영역에 체크리스트 링크를 추가한다.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React Testing Library

---

## 파일 구조

- Create: `src/lib/reports/checklist.ts`
  - 스캔 결과를 체크리스트 마크다운으로 변환한다.
- Create: `src/lib/reports/checklist.test.ts`
  - 체크리스트 형식, 빈 상태, 조치 내용 포함 여부를 검증한다.
- Create: `src/app/api/scans/[scanId]/checklist/route.ts`
  - 저장된 스캔을 체크리스트 마크다운으로 반환한다.
- Create: `src/app/api/scans/[scanId]/checklist/route.test.ts`
  - 정상 응답, 404, 오탐 제외를 검증한다.
- Modify: `src/app/page.tsx`
  - 결과 액션에 체크리스트 다운로드 링크를 추가한다.
- Modify: `src/app/page.test.tsx`
  - 체크리스트 링크 표시와 URL을 검증한다.

## Task 1: 체크리스트 빌더

- [x] `src/lib/reports/checklist.test.ts`에 체크박스 형식 테스트를 추가한다.
- [x] 테스트를 실행해 `buildSecurityChecklist`가 없어서 실패하는지 확인한다.
- [x] `src/lib/reports/checklist.ts`에 `buildSecurityChecklist(scan)`을 구현한다.
- [x] 체크리스트 빌더 테스트가 통과하는지 확인한다.

## Task 2: 체크리스트 API

- [x] `src/app/api/scans/[scanId]/checklist/route.test.ts`에 정상 응답, 404, 오탐 제외 테스트를 추가한다.
- [x] 테스트를 실행해 라우트가 없어서 실패하는지 확인한다.
- [x] `src/app/api/scans/[scanId]/checklist/route.ts`를 구현한다.
- [x] 체크리스트 API 테스트가 통과하는지 확인한다.

## Task 3: 화면 링크

- [x] `src/app/page.test.tsx`에 `체크리스트 / Checklist` 링크 테스트를 추가한다.
- [x] 테스트를 실행해 링크가 없어서 실패하는지 확인한다.
- [x] `src/app/page.tsx`의 보고서 액션 영역에 체크리스트 링크를 추가한다.
- [x] 화면 테스트가 통과하는지 확인한다.

## Task 4: 검증과 게시

- [x] 관련 테스트 전체를 실행한다.
- [x] 타입 검사를 실행한다.
- [x] 빌드를 실행한다.
- [x] 커밋, 푸시, PR 생성을 진행한다.
