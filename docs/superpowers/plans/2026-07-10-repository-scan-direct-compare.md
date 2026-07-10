# 저장소 스캔 직접 비교 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기준선 중심 비교를 제거하고, 저장된 스캔 결과 두 개를 직접 선택해 비교하며, 스캔 규칙의 출처와 상세 기준을 화면에 표시한다.

**Architecture:** 기존 스캔 이력 저장 구조는 유지하고, 비교 계산은 저장된 두 스캔 결과를 지문 기반으로 계산한다. 규칙 상세 정보는 `src/lib/scanner/analyzers.ts`의 규칙 메타데이터를 확장해 기존 설정 조회 응답으로 내려준다. 화면은 기존 단일 페이지 구조를 유지하되 기준선 조작을 제거하고 직접 비교 선택 상태를 추가한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library, 기존 저장소 스캔 모듈

## Global Constraints

- 기준선 지정, 기준선 필터, 기준선 우선 비교를 사용자 화면과 실행 흐름에서 제거한다.
- 사용자가 저장된 스캔 결과 두 개를 선택해 직접 비교할 수 있게 한다.
- 현재 스캐너가 외부 상용 스캐너나 취약점 데이터베이스가 아니라, 이 저장소 내부의 정적 분석 규칙 기반이라는 점을 명확히 표시한다.
- 기존 운영 데이터베이스의 기준선 테이블을 즉시 삭제하지 않는다.
- 외부 취약점 데이터베이스, 보안 업체 엔진, 실시간 위협 정보 연동은 이번 범위에 포함하지 않는다.
- 두 개를 초과하는 스캔을 한 번에 비교하는 기능은 포함하지 않는다.
- 취약점의 실제 악용 가능성을 동적 실행으로 검증하는 기능은 포함하지 않는다.

---

## File Structure

- `src/lib/scanHistory/store.ts`: 기존 비교 함수에서 기준선 출처 의존을 제거하고, 직접 비교에 필요한 결과 구조를 재사용한다.
- `src/lib/scans/runRepositoryScan.ts`: 새 스캔 실행 후 비교 대상을 기준선이 아닌 같은 저장소의 직전 스캔으로 고정한다.
- `src/app/api/scans/[scanId]/route.ts`: 저장된 스캔 조회 시 기준선 우선 비교를 제거한다.
- `src/app/api/scans/settings/route.ts`: 기준선 변경 액션을 제거하고, 규칙 상세 메타데이터를 계속 반환한다.
- `src/lib/scanner/analyzers.ts`: 규칙 메타데이터에 출처, 탐지 방식, 영향도, 조치, 한계를 추가한다.
- `src/app/page.tsx`: 기준선 UI를 제거하고, 스캔 두 개 직접 선택 비교 UI와 규칙 상세 UI를 추가한다.
- `README.md`: 기준선 설명을 제거하고 직접 비교와 규칙 출처 표시 흐름으로 갱신한다.

## Task 1: 기준선 우선 비교 제거

**Files:**
- Modify: `src/lib/scans/runRepositoryScan.ts`
- Modify: `src/app/api/scans/[scanId]/route.ts`
- Modify: `src/app/api/scans/settings/route.ts`
- Modify: `src/lib/scanHistory/types.ts`
- Test: `src/lib/scans/runRepositoryScan.test.ts`
- Test: `src/app/api/scans/[scanId]/route.test.ts`
- Test: `src/app/api/scans/settings/route.test.ts`

**Interfaces:**
- Consumes: `findPreviousScan(scan, existingHistory)`, `findPreviousSavedScan(selectedEntry, history)`
- Produces: 스캔 응답의 `comparisonSource`는 `"previous"` 또는 `"none"`만 사용한다.

- [ ] **Step 1: Write failing tests**

Add or update tests so a saved baseline no longer controls comparison:

```ts
expect(result.comparison?.comparisonSource).toBe("previous");
expect(result.comparison?.baselineScanId).toBeNull();
```

Add a settings route test that rejects removed baseline actions:

```ts
const response = await PATCH(new Request("http://localhost/api/scans/settings", {
  method: "PATCH",
  body: JSON.stringify({ action: "setBaseline", repositoryKey: "example/repo", scanId: "scan_1" })
}));
expect(response.status).toBe(400);
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
PATH=/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm vitest run src/lib/scans/runRepositoryScan.test.ts src/app/api/scans/[scanId]/route.test.ts src/app/api/scans/settings/route.test.ts
```

Expected: tests fail because baseline comparison and baseline actions still exist.

- [ ] **Step 3: Implement minimal code**

Remove baseline lookup from `runRepositoryScan.ts` and `[scanId]/route.ts`:

```ts
const previousScan = findPreviousScan(scan, existingHistory);
const comparison = compareScans(scan, previousScan?.scan ?? null, {
  baselineScanId: null,
  comparisonSource: previousScan ? "previous" : "none",
  suppressedFingerprints
});
```

Remove `setBaseline` and `clearBaseline` request actions from the settings route union and switch statement.

- [ ] **Step 4: Run tests and verify pass**

Run the same targeted command. Expected: PASS.

## Task 2: 규칙 상세 메타데이터 추가

**Files:**
- Modify: `src/lib/scanner/analyzers.ts`
- Modify: `src/app/page.tsx`
- Test: `src/lib/scanner/analyzers.test.ts`
- Test: `src/app/api/scans/settings/route.test.ts`

**Interfaces:**
- Produces: `AnalyzerRuleMetadata` includes `sourcePath`, `detectionType`, `detectionSummary`, `impact`, `remediation`, `limitations`.
- Consumes: existing `GET /api/scans/settings` response.

- [ ] **Step 1: Write failing tests**

Add analyzer metadata expectations:

```ts
const rules = listAnalyzerRules();
expect(rules.every((rule) => rule.sourcePath === "src/lib/scanner/analyzers.ts")).toBe(true);
expect(rules.find((rule) => rule.ruleId === "secret.exposed-token")).toEqual(
  expect.objectContaining({
    detectionType: "정규식 기반",
    impact: expect.any(String),
    remediation: expect.any(String),
    limitations: expect.any(String)
  })
);
```

Add settings route assertion that returned rules contain these fields.

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
PATH=/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm vitest run src/lib/scanner/analyzers.test.ts src/app/api/scans/settings/route.test.ts
```

Expected: FAIL because metadata fields are missing.

- [ ] **Step 3: Implement minimal code**

Extend `AnalyzerRuleMetadata`:

```ts
export type AnalyzerRuleMetadata = {
  ruleId: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  sourcePath: string;
  detectionType: string;
  detectionSummary: string;
  impact: string;
  remediation: string;
  limitations: string;
};
```

Fill all regular and special rule metadata. Use `sourcePath: "src/lib/scanner/analyzers.ts"` for current rules.

- [ ] **Step 4: Run tests and verify pass**

Run the same targeted command. Expected: PASS.

## Task 3: 직접 비교 화면 전환

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: saved scan entries from existing scan history state.
- Produces: two selected scan identifiers and a client-side direct comparison panel.

- [ ] **Step 1: Write failing UI tests**

Add tests that baseline UI is gone:

```ts
expect(screen.queryByText("기준선 지정 / Set baseline")).not.toBeInTheDocument();
expect(screen.queryByRole("option", { name: "기준선 / Baseline" })).not.toBeInTheDocument();
```

Add tests that two scans can be selected and compared:

```ts
fireEvent.click(await screen.findByRole("button", { name: "비교 A 선택 scan_previous" }));
fireEvent.click(await screen.findByRole("button", { name: "비교 B 선택 scan_current" }));
expect(await screen.findByText("스캔 결과 직접 비교")).toBeInTheDocument();
expect(screen.getByText("새로 발견")).toBeInTheDocument();
expect(screen.getByText("해결됨")).toBeInTheDocument();
expect(screen.getByText("계속 남음")).toBeInTheDocument();
```

Add a test that rule details show source and detection type:

```ts
expect(await screen.findByText("스캔 규칙과 분석 기준")).toBeInTheDocument();
expect(screen.getByText("src/lib/scanner/analyzers.ts")).toBeInTheDocument();
expect(screen.getByText("정규식 기반")).toBeInTheDocument();
```

- [ ] **Step 2: Run targeted UI test and verify failure**

Run:

```bash
PATH=/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm vitest run src/app/page.test.tsx
```

Expected: FAIL because baseline UI still exists and direct comparison controls are missing.

- [ ] **Step 3: Implement minimal UI**

Remove baseline filtering, baseline button props, and baseline status labels. Add `compareLeftScanId` and `compareRightScanId` state. Add comparison buttons to scan history cards. Compute direct comparison using existing `compareScans` output or a client helper that groups findings by `findingFingerprint`.

Add a rules detail area that renders each rule metadata field in Korean labels.

- [ ] **Step 4: Run targeted UI test and verify pass**

Run the same UI test command. Expected: PASS.

## Task 4: 문서와 전체 검증

**Files:**
- Modify: `README.md`
- Optional Modify: existing specs or plans only if they are directly contradicted by README references.

**Interfaces:**
- Consumes: implemented behavior from Tasks 1-3.
- Produces: Korean README summary with diagram, flow graph, and specification notes updated away from 기준선.

- [ ] **Step 1: Update README**

Remove 기준선 중심 descriptions and replace them with:

```md
- 저장된 스캔 결과 두 개 직접 비교
- 새로 발견, 해결, 계속 남음 취약점 구분
- 스캔 규칙의 구현 출처와 탐지 기준 표시
```

Update diagrams so history flows into direct comparison, not 기준선 comparison.

- [ ] **Step 2: Run full verification**

Run:

```bash
PATH=/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm test
PATH=/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm run lint
PATH=/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Commit**

Commit only the intended changes:

```bash
git add README.md src/lib/scans/runRepositoryScan.ts src/app/api/scans/[scanId]/route.ts src/app/api/scans/settings/route.ts src/lib/scanHistory/types.ts src/lib/scanner/analyzers.ts src/app/page.tsx src/lib/scans/runRepositoryScan.test.ts src/app/api/scans/[scanId]/route.test.ts src/app/api/scans/settings/route.test.ts src/lib/scanner/analyzers.test.ts src/app/page.test.tsx docs/superpowers/plans/2026-07-10-repository-scan-direct-compare.md
git commit -m "Replace baseline scans with direct comparison"
```
