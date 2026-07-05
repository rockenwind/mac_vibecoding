# 비공개 저장소 점검 안정화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비공개 저장소 스캔 실패 원인을 명확히 구분하고 README에 현재 제품 흐름을 다이어그램과 스펙으로 정리한다.

**Architecture:** GitHub 파일 수집 계층에서 GitHub 응답 상태를 안정화된 오류로 변환하고, 스캔 API는 해당 오류를 상태 코드와 사용자 액션으로 반환한다. 화면은 API의 action 필드를 오류 안내에 함께 표시한다. README는 현재 저장소 스캔 서비스의 구조, 흐름, API, 저장 데이터, 로드맵을 한글 중심으로 요약한다.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React Testing Library, Mermaid Markdown

---

## 파일 구조

- Modify: `src/lib/github/source.ts`
  - GitHub 접근 오류를 원인별 메시지로 변환한다.
- Modify: `src/lib/github/source.test.ts`
  - 비공개 저장소 인증 누락과 권한 부족 오류 테스트를 추가한다.
- Modify: `src/app/api/scans/route.ts`
  - 오류 메시지별 HTTP 상태와 action 필드를 반환한다.
- Modify: `src/app/api/scans/route.test.ts`
  - 설정 누락, 권한 부족, 비공개 저장소 인증 누락 응답을 검증한다.
- Modify: `src/app/page.tsx`
  - 스캔 실패 action 안내를 표시한다.
- Modify: `src/app/page.test.tsx`
  - action 안내 표시 테스트를 추가한다.
- Modify: `README.md`
  - 다이어그램, 플로우, 스펙, API 요약을 추가한다.
- Create: `docs/superpowers/specs/2026-07-05-private-scan-stability-design.md`
  - 승인된 설계를 기록한다.
- Create: `docs/superpowers/plans/2026-07-05-private-scan-stability.md`
  - 구현 계획을 기록한다.

## Task 1: GitHub 접근 오류 안정화

- [x] `src/lib/github/source.test.ts`에 private 404와 token 403 테스트를 추가한다.
- [x] 테스트를 실행해 기존 메시지와 상태 구분이 부족해 실패하는지 확인한다.
- [x] `src/lib/github/source.ts`에서 404와 인증 여부를 구분하고 403 권한 오류 메시지를 유지한다.
- [x] GitHub source 테스트를 통과시킨다.

## Task 2: 스캔 API 오류 응답

- [x] `src/app/api/scans/route.test.ts`에 action 필드와 상태 코드 테스트를 추가한다.
- [x] 테스트를 실행해 action 필드가 없어서 실패하는지 확인한다.
- [x] `src/app/api/scans/route.ts`에서 오류별 상태와 action을 반환한다.
- [x] 스캔 API 테스트를 통과시킨다.

## Task 3: 화면 오류 안내

- [x] `src/app/page.test.tsx`에 action 안내 표시 테스트를 추가한다.
- [x] 테스트를 실행해 action 안내가 없어 실패하는지 확인한다.
- [x] `src/app/page.tsx`에서 스캔 실패 action 안내를 표시한다.
- [x] 화면 테스트를 통과시킨다.

## Task 4: README 제품 요약

- [x] README에 서비스 구조도, 스캔 흐름도, 기능 스펙 표, API 표, 로드맵 상태를 추가한다.
- [x] README 내용이 현재 구현과 일치하는지 확인한다.

## Task 5: 검증과 게시

- [x] 관련 테스트 전체를 실행한다.
- [x] 타입 검사를 실행한다.
- [x] 빌드를 실행한다.
- [ ] 커밋, 푸시, PR 생성을 진행한다.
