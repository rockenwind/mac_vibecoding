# 저장소 스캔 규칙 품질 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장소 스캔 결과에 신뢰도를 추가하고, 실제 코드 점검에 필요한 보안 규칙을 1차 확장한다.

**Architecture:** 기존 스캐너의 단일 진입점인 `analyzeFiles()`는 유지한다. `Finding` 타입에 `confidence`를 추가하고, 규칙 정의와 발견 생성 경로에서 항상 값을 채운다. 화면과 마크다운 보고서는 값이 없는 과거 스캔을 `medium`으로 보정해 호환성을 유지한다.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library

---

## 파일 구조

- Modify: `src/lib/scanner/types.ts`
  - `FindingConfidence` 타입을 추가하고 `Finding.confidence`를 선택 필드로 둔다.
- Modify: `src/lib/scanner/analyzers.ts`
  - 규칙 정의에 신뢰도를 추가한다.
  - 데이터베이스 질의 위험, 인증 누락 가능성, 관리자 보호 누락 가능성, 위험한 외부 요청, 넥스트 서버 비밀 노출 규칙을 추가한다.
  - 심각도와 신뢰도 기준으로 발견 항목을 정렬한다.
- Modify: `src/lib/scanner/analyzers.test.ts`
  - 새 규칙과 신뢰도 값을 검증한다.
- Modify: `src/app/page.tsx`
  - 발견 카드와 비교 목록에 신뢰도 라벨을 표시한다.
  - 기존 스캔에 신뢰도가 없으면 `중간`으로 보여준다.
- Modify: `src/app/page.test.tsx`
  - 화면에 `신뢰도 / Confidence`와 한글 신뢰도 값이 표시되는지 검증한다.
- Modify: `src/lib/reports/markdown.ts`
  - 마크다운 보고서에 신뢰도를 포함한다.
- Modify: `src/lib/reports/markdown.test.ts`
  - 보고서에 신뢰도가 들어가는지 검증한다.

## Task 1: 스캐너 신뢰도와 규칙 확장

**Files:**
- Modify: `src/lib/scanner/types.ts`
- Modify: `src/lib/scanner/analyzers.ts`
- Test: `src/lib/scanner/analyzers.test.ts`

- [x] **Step 1: 실패 테스트 작성**

Add tests to `src/lib/scanner/analyzers.test.ts`:

```ts
it("assigns confidence to every new finding", () => {
  const findings = analyzeFiles(sampleFiles);

  expect(findings.length).toBeGreaterThan(0);
  expect(findings.every((finding) => finding.confidence)).toBe(true);
});

it("detects database query construction, missing auth review, admin guard review, unsafe fetch, and client secret exposure", () => {
  const findings = analyzeFiles([
    {
      path: "src/app/api/users/route.ts",
      size: 230,
      content: "export async function GET(request) { return db.query(`select * from users where id = ${request.nextUrl.searchParams.get('id')}`); }"
    },
    {
      path: "src/app/api/admin/users/route.ts",
      size: 120,
      content: "export async function POST(request) { return Response.json({ ok: true }); }"
    },
    {
      path: "src/app/page.tsx",
      size: 80,
      content: "\"use client\";\nconst token = process.env.OPENAI_API_KEY;"
    },
    {
      path: "src/server/proxy.ts",
      size: 90,
      content: "export async function proxy(req) { return fetch(req.query.url); }"
    }
  ]);

  expect(findings.map((finding) => finding.ruleId)).toEqual(
    expect.arrayContaining([
      "database.dynamic-query",
      "api.missing-auth-review",
      "admin.missing-authorization-review",
      "network.user-controlled-request",
      "nextjs.client-secret-exposure"
    ])
  );
  expect(findings.find((finding) => finding.ruleId === "database.dynamic-query")?.confidence).toBe("medium");
  expect(findings.find((finding) => finding.ruleId === "nextjs.client-secret-exposure")?.confidence).toBe("high");
});
```

- [x] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/scanner/analyzers.test.ts`

Expected: FAIL because `confidence` and the new rule IDs do not exist yet.

- [x] **Step 3: 최소 구현**

Update `src/lib/scanner/types.ts`:

```ts
export type FindingConfidence = "high" | "medium" | "low";
```

Add `confidence?: FindingConfidence;` to `Finding`.

Update `src/lib/scanner/analyzers.ts`:

- Add `confidence: FindingConfidence` to `RuleMatch`.
- Add `confidence` to every `createFinding()` call.
- Add the five new rules from the test.
- Sort findings by severity first and confidence second before returning.

- [x] **Step 4: 통과 확인**

Run: `pnpm exec vitest run src/lib/scanner/analyzers.test.ts`

Expected: PASS.

## Task 2: 화면 신뢰도 표시

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`

- [x] **Step 1: 실패 테스트 작성**

Update one mocked finding in `src/app/page.test.tsx` to include `confidence: "high"`.

Add assertion to `renders actionable Korean finding details after a scan`:

```ts
expect(screen.getByText("신뢰도 / Confidence")).toBeInTheDocument();
expect(screen.getByText("높음")).toBeInTheDocument();
```

- [x] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/app/page.test.tsx`

Expected: FAIL because the confidence label is not rendered.

- [x] **Step 3: 최소 구현**

Update `src/app/page.tsx`:

```ts
const confidenceLabels: Record<NonNullable<Finding["confidence"]>, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음"
};

function findingConfidence(finding: Finding): NonNullable<Finding["confidence"]> {
  return finding.confidence ?? "medium";
}
```

Render this pair inside the finding details list:

```tsx
<dt>신뢰도 / Confidence</dt>
<dd>{confidenceLabels[findingConfidence(finding)]}</dd>
```

- [x] **Step 4: 통과 확인**

Run: `pnpm exec vitest run src/app/page.test.tsx`

Expected: PASS.

## Task 3: 마크다운 보고서 신뢰도 표시

**Files:**
- Modify: `src/lib/reports/markdown.ts`
- Test: `src/lib/reports/markdown.test.ts`

- [x] **Step 1: 실패 테스트 작성**

Update the test finding in `src/lib/reports/markdown.test.ts` to include `confidence: "high"`.

Add assertion:

```ts
expect(markdown).toContain("- Confidence: High");
```

- [x] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/reports/markdown.test.ts`

Expected: FAIL because confidence is not rendered in Markdown.

- [x] **Step 3: 최소 구현**

Update `src/lib/reports/markdown.ts`:

```ts
const confidenceLabels: Record<NonNullable<Finding["confidence"]>, string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

function findingConfidence(finding: Finding): NonNullable<Finding["confidence"]> {
  return finding.confidence ?? "medium";
}
```

Add this line after severity:

```ts
`- Confidence: ${confidenceLabels[findingConfidence(finding)]}`,
```

- [x] **Step 4: 통과 확인**

Run: `pnpm exec vitest run src/lib/reports/markdown.test.ts`

Expected: PASS.

## Task 4: 전체 검증과 게시

**Files:**
- All changed files

- [x] **Step 1: 핵심 테스트 실행**

Run:

```bash
pnpm exec vitest run src/lib/scanner/analyzers.test.ts src/app/page.test.tsx src/lib/reports/markdown.test.ts
```

Expected: PASS. 최종 확인 결과 30개 테스트가 통과했다.

- [x] **Step 2: 타입 검사 실행**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS. 최종 확인 결과 타입 검사가 통과했다.

- [x] **Step 3: 빌드 실행**

Run:

```bash
pnpm run build
```

Expected: PASS. 최종 확인 결과 빌드가 통과했다.

- [ ] **Step 4: 구현 커밋**

Run:

```bash
git add src/lib/scanner/types.ts src/lib/scanner/analyzers.ts src/lib/scanner/analyzers.test.ts src/app/page.tsx src/app/page.test.tsx src/lib/reports/markdown.ts src/lib/reports/markdown.test.ts docs/superpowers/plans/2026-07-04-repository-scan-rule-quality.md
git commit -m "Improve repository scan rule quality"
```

- [ ] **Step 5: 브랜치 푸시와 PR 생성**

Run:

```bash
git push -u origin codex/improve-repository-scan-rules
gh pr create --base main --head codex/improve-repository-scan-rules --title "[codex] Improve repository scan rule quality" --body "<summary and verification>"
```
