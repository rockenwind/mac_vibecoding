# Scheduled Scan Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repository scan 서비스에 저장소별 예약 스캔과 변경 알림 후보를 추가한다.

**Architecture:** 수동 스캔과 예약 스캔이 같은 공용 실행 함수를 사용하게 만든다. 예약 설정은 기존 scan settings 저장소에 `schedules`를 추가해 JSON과 SQLite 양쪽에서 관리한다. 예약 실행 API는 실행 시점이 지난 설정만 스캔하고 결과 비교 요약과 알림 후보를 반환한다.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest, Testing Library, JSON file store, Node SQLite.

---

## 파일 구조

- Modify: `src/lib/scanSettings/types.ts`  
  예약 설정 타입과 저장소 메서드를 추가한다.
- Modify: `src/lib/scanSettings/store.ts`  
  JSON/SQLite 예약 설정 저장, 조회, 삭제, 실행 시각 갱신을 구현한다.
- Modify: `src/lib/scanSettings/store.test.ts`  
  JSON/SQLite 예약 설정 테스트를 추가한다.
- Create: `src/lib/scans/runRepositoryScan.ts`  
  기존 `POST /api/scans`의 스캔 실행 흐름을 공용 함수로 분리한다.
- Create: `src/lib/scans/runRepositoryScan.test.ts`  
  공용 스캔 함수가 설정, 기준선, 오탐 제외를 반영하는지 테스트한다.
- Modify: `src/app/api/scans/route.ts`  
  수동 스캔 API가 공용 스캔 함수를 사용하게 정리한다.
- Create: `src/lib/scanSchedules/notifications.ts`  
  비교 결과에서 알림 후보를 생성한다.
- Create: `src/lib/scanSchedules/notifications.test.ts`  
  새 취약점과 해결된 취약점 알림 후보 테스트를 추가한다.
- Create: `src/lib/scanSchedules/due.ts`  
  실행 대상 예약과 다음 실행 시간을 계산한다.
- Create: `src/lib/scanSchedules/due.test.ts`  
  비활성 예약, 미래 예약, 과거 예약 계산 테스트를 추가한다.
- Create: `src/app/api/scans/schedules/route.ts`  
  예약 설정 조회, 저장, 삭제 API를 추가한다.
- Create: `src/app/api/scans/schedules/route.test.ts`  
  예약 설정 API 테스트를 추가한다.
- Create: `src/app/api/scans/schedules/run-due/route.ts`  
  실행 시간이 지난 예약 스캔 API를 추가한다.
- Create: `src/app/api/scans/schedules/run-due/route.test.ts`  
  예약 실행 성공, 실패, 대상 없음 테스트를 추가한다.
- Modify: `src/app/page.tsx`  
  예약 스캔 패널과 최근 예약 실행 요약을 추가한다.
- Modify: `src/app/page.test.tsx`  
  예약 설정 표시, 저장, 지금 실행 결과 표시 테스트를 추가한다.
- Modify: `src/app/globals.css`  
  예약 패널 스타일을 기존 패널 톤에 맞춰 추가한다.
- Modify: `README.md`  
  예약 스캔 API와 사용 흐름을 한글로 추가한다.

---

### Task 1: 예약 설정 저장소 확장

**Files:**
- Modify: `src/lib/scanSettings/types.ts`
- Modify: `src/lib/scanSettings/store.ts`
- Modify: `src/lib/scanSettings/store.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/scanSettings/store.test.ts`에 다음 테스트를 추가한다.

```ts
it("stores scheduled scans in the default JSON store", async () => {
  await upsertScanSchedule(
    {
      repositoryKey: "example/repo",
      repositoryUrl: "https://github.com/example/repo",
      installationId: 123,
      enabled: true,
      intervalDays: 7,
      nextRunAt: "2026-07-06T00:00:00.000Z",
      notifyOnNewFindings: true,
      notifyOnResolvedFindings: true
    },
    new Date("2026-07-05T00:00:00Z")
  );

  await expect(readScanSettings()).resolves.toMatchObject({
    schedules: [
      {
        repositoryKey: "example/repo",
        repositoryUrl: "https://github.com/example/repo",
        installationId: 123,
        enabled: true,
        intervalDays: 7,
        nextRunAt: "2026-07-06T00:00:00.000Z",
        notifyOnNewFindings: true,
        notifyOnResolvedFindings: true,
        createdAt: "2026-07-05T00:00:00.000Z",
        updatedAt: "2026-07-05T00:00:00.000Z"
      }
    ]
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/lib/scanSettings/store.test.ts`

Expected: FAIL because `upsertScanSchedule` is not exported.

- [ ] **Step 3: 타입과 JSON 저장 구현**

`src/lib/scanSettings/types.ts`에 `ScanScheduleSetting`을 추가하고 `ScanSettings`에 `schedules`를 추가한다. `src/lib/scanSettings/store.ts`에 `upsertScanSchedule`, `deleteScanSchedule`, `markScheduleRun`을 추가한다. `emptySettings`, `empty()`, `normalizeSettings()`는 `schedules: []`를 반환해야 한다.

- [ ] **Step 4: SQLite 저장 구현**

`openScanSettingsDatabase()`에 `scan_schedules` 테이블을 추가한다. SQLite store의 `read`, `upsertSchedule`, `deleteSchedule`, `markScheduleRun`이 JSON store와 같은 응답 구조를 반환해야 한다.

- [ ] **Step 5: 통과 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/lib/scanSettings/store.test.ts`

Expected: PASS.

---

### Task 2: 공용 스캔 실행 함수 분리

**Files:**
- Create: `src/lib/scans/runRepositoryScan.ts`
- Create: `src/lib/scans/runRepositoryScan.test.ts`
- Modify: `src/app/api/scans/route.ts`
- Modify: `src/app/api/scans/route.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/scans/runRepositoryScan.test.ts`를 만들고 `runRepositoryScan({ repositoryUrl, installationId })`가 `scan`, `history`, `comparison`을 반환하는지 테스트한다.

```ts
await expect(
  runRepositoryScan({ repositoryUrl: "https://github.com/example/repo" })
).resolves.toMatchObject({
  scan: { repository: { owner: "example", name: "repo" } },
  history: { savedAt: "2026-07-02T00:00:00.000Z" },
  comparison: { comparisonSource: "none" }
});
```

- [ ] **Step 2: 실패 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/lib/scans/runRepositoryScan.test.ts`

Expected: FAIL because `src/lib/scans/runRepositoryScan.ts` does not exist.

- [ ] **Step 3: 공용 함수 구현**

`src/lib/scans/runRepositoryScan.ts`에 다음 공개 함수를 만든다.

```ts
export type RunRepositoryScanInput = {
  repositoryUrl: string;
  installationId?: number | string | null;
};

export async function runRepositoryScan(input: RunRepositoryScanInput): Promise<{
  scan: ScanResult;
  history: ScanHistoryEntry;
  comparison: ScanComparison;
}> {
  // 기존 POST /api/scans 흐름을 이동한다.
}

export function scanErrorResponse(message: string): { status: number; action?: string } {
  // 기존 오류 응답 매핑을 이동한다.
}
```

- [ ] **Step 4: API 라우트 정리**

`src/app/api/scans/route.ts`의 `POST`는 입력 검증 뒤 `runRepositoryScan()`만 호출한다. 기존 오류 응답은 `scanErrorResponse()`를 사용한다.

- [ ] **Step 5: 통과 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/lib/scans/runRepositoryScan.test.ts src/app/api/scans/route.test.ts`

Expected: PASS.

---

### Task 3: 예약 대상 계산과 알림 후보

**Files:**
- Create: `src/lib/scanSchedules/due.ts`
- Create: `src/lib/scanSchedules/due.test.ts`
- Create: `src/lib/scanSchedules/notifications.ts`
- Create: `src/lib/scanSchedules/notifications.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`due.test.ts`는 `enabled`가 꺼진 예약과 미래 `nextRunAt`을 제외하고, 과거 `nextRunAt`만 반환하는지 확인한다. `notifications.test.ts`는 새 취약점 또는 해결된 취약점이 있을 때만 알림 후보를 만드는지 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/lib/scanSchedules/due.test.ts src/lib/scanSchedules/notifications.test.ts`

Expected: FAIL because both modules do not exist.

- [ ] **Step 3: 계산 함수 구현**

`src/lib/scanSchedules/due.ts`에 `findDueSchedules(schedules, now)`와 `nextRunAtFor(schedule, from)`을 만든다. `nextRunAtFor`는 `from + intervalDays`를 ISO 문자열로 반환한다.

- [ ] **Step 4: 알림 함수 구현**

`src/lib/scanSchedules/notifications.ts`에 `buildScheduleNotifications(schedule, scan, comparison)`을 만든다. 반환 항목은 `repositoryKey`, `scanId`, `newFindings`, `resolvedFindings`, `highestSeverity`, `message`를 포함한다.

- [ ] **Step 5: 통과 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/lib/scanSchedules/due.test.ts src/lib/scanSchedules/notifications.test.ts`

Expected: PASS.

---

### Task 4: 예약 API 추가

**Files:**
- Create: `src/app/api/scans/schedules/route.ts`
- Create: `src/app/api/scans/schedules/route.test.ts`
- Create: `src/app/api/scans/schedules/run-due/route.ts`
- Create: `src/app/api/scans/schedules/run-due/route.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`route.test.ts`는 `GET`, `POST`, `DELETE`가 예약 설정을 반환하는지 확인한다. `run-due/route.test.ts`는 대상 없음, 성공 실행, 실패 실행을 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/app/api/scans/schedules/route.test.ts src/app/api/scans/schedules/run-due/route.test.ts`

Expected: FAIL because route modules do not exist.

- [ ] **Step 3: 설정 API 구현**

`GET`은 `{ schedules }`를 반환한다. `POST`는 `repositoryUrl`, `enabled`, `intervalDays`, `installationId`, `notifyOnNewFindings`, `notifyOnResolvedFindings`, `nextRunAt`을 받아 저장한다. `DELETE`는 `repositoryKey`로 삭제한다.

- [ ] **Step 4: 실행 API 구현**

`POST /api/scans/schedules/run-due`는 `findDueSchedules()`로 대상을 고르고 각 대상에 대해 `runRepositoryScan()`을 호출한다. 성공 시 `markScheduleRun()`으로 `lastRunAt`, `lastScanId`, `nextRunAt`을 갱신한다. 실패 시 실패 결과를 응답에 담고 다음 대상은 계속 실행한다.

- [ ] **Step 5: 통과 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/app/api/scans/schedules/route.test.ts src/app/api/scans/schedules/run-due/route.test.ts`

Expected: PASS.

---

### Task 5: 화면 패널과 문서 추가

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/globals.css`
- Modify: `README.md`

- [ ] **Step 1: 실패 테스트 작성**

`src/app/page.test.tsx`에 예약 스캔 영역이 보이고, 저장 버튼을 누르면 `/api/scans/schedules`로 저장 요청이 가며, 지금 실행 버튼을 누르면 `/api/scans/schedules/run-due` 결과가 화면에 표시되는 테스트를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/app/page.test.tsx`

Expected: FAIL because the scheduled scan panel is not rendered.

- [ ] **Step 3: 화면 구현**

`src/app/page.tsx`에 `scheduledScans`, `scheduleStatus`, `scheduleRunResults`, `isUpdatingSchedule`, `isRunningSchedules` 상태를 추가한다. 초기 로딩에서 `/api/scans/schedules`를 조회한다. 입력된 저장소 URL과 설치 ID를 사용해 예약 저장, 해제, 지금 실행 버튼을 제공한다.

- [ ] **Step 4: 스타일과 README 갱신**

`src/app/globals.css`에 `.schedule-panel`, `.schedule-actions`, `.schedule-results` 스타일을 추가한다. `README.md`에는 예약 스캔 API, 화면 사용 흐름, 외부 자동 호출은 후속 단계라는 설명을 한글로 추가한다.

- [ ] **Step 5: 통과 확인**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test src/app/page.test.tsx`

Expected: PASS.

---

### Task 6: 전체 검증과 PR 준비

**Files:**
- Verify all changed files

- [ ] **Step 1: 타입 검사**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm run lint`

Expected: PASS.

- [ ] **Step 2: 전체 테스트**

Run: `PATH="/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" pnpm test`

Expected: PASS.

- [ ] **Step 3: 로컬 화면 확인**

Open: `http://localhost:3000`

Expected: Repository scan 화면에 `예약 스캔 / Scheduled scan` 패널이 보이고 저장소 URL 입력 후 예약 저장과 지금 실행을 사용할 수 있다.

- [ ] **Step 4: 커밋과 PR**

Commit message: `feat: add scheduled repository scans`

PR summary must include:

- 예약 스캔 설정 저장
- 예약 실행 API
- 변경 알림 후보
- 화면 패널
- README 한글 설명
