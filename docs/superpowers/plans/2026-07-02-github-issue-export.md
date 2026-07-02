# GitHub Issue Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create GitHub Issues from saved Repository scan Markdown reports.

**Architecture:** Reuse scan history and Markdown report generation. Add one GitHub App client method for Issue creation, one route for saved scan export, and a small screen action that is enabled when an installation ID is available.

**Tech Stack:** Next.js App Router, TypeScript, GitHub App APIs, Vitest, React Testing Library.

---

### Task 1: GitHub Issue Client

**Files:**
- Modify: `src/lib/github/appClient.ts`
- Modify: `src/lib/github/appClient.test.ts`

- [ ] Add a failing test for creating a GitHub Issue.
- [ ] Implement the client method.

### Task 2: Issue API Route

**Files:**
- Create: `src/app/api/scans/[scanId]/github-issue/route.ts`
- Create: `src/app/api/scans/[scanId]/github-issue/route.test.ts`

- [ ] Add tests for success, missing scan, and invalid installation ID.
- [ ] Implement the route.

### Task 3: Screen Action

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

- [ ] Add a failing test that the Issue button posts to the route.
- [ ] Implement the button and status message.

### Task 4: Verification

- [ ] Run all tests.
- [ ] Run TypeScript checks.
- [ ] Run Next.js build.
