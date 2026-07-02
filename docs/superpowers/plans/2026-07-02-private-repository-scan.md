# Private Repository Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Repository scan to use a GitHub App installation token when scanning private repositories.

**Architecture:** Extend the existing scanner API with an optional installation ID. Keep public scanning unchanged; when an installation ID is supplied, create a GitHub App JWT, mint an installation token, and pass it to the GitHub source adapter.

**Tech Stack:** Next.js App Router, TypeScript, GitHub App APIs, Vitest.

---

### Task 1: Authenticated Source Fetch

**Files:**
- Modify: `src/lib/github/source.ts`
- Modify: `src/lib/github/source.test.ts`

- [ ] Add a failing test showing authenticated requests include Authorization headers.
- [ ] Add an optional `accessToken` source option.
- [ ] Verify source tests pass.

### Task 2: Scan API Installation ID

**Files:**
- Modify: `src/app/api/scans/route.ts`
- Modify: `src/app/api/scans/route.test.ts`

- [ ] Add failing tests for installation ID scanning and invalid installation ID.
- [ ] Create an installation token when installation ID exists.
- [ ] Verify route tests pass.

### Task 3: Screen Input

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/globals.css`

- [ ] Add a failing test that optional installation ID is submitted.
- [ ] Add the optional installation ID input.
- [ ] Verify page tests pass.

### Task 4: Verification

- [ ] Run the full test suite.
- [ ] Run TypeScript checks.
- [ ] Run the Next.js build.
