# Saved Scan Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users reopen saved repository scan results and see comparison results without rescanning.

**Architecture:** Add a `GET /api/scans/[scanId]` route that reads existing history, finds the requested entry, finds the previous scan for the same repository, and returns a comparison. Update the page to fetch that API when a recent scan is selected and reuse the existing result rendering.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library.

---

### Task 1: Saved Scan API

**Files:**
- Create: `src/app/api/scans/[scanId]/route.ts`
- Create: `src/app/api/scans/[scanId]/route.test.ts`

- [ ] Add failing API tests for found and missing saved scan IDs.
- [ ] Implement `GET /api/scans/[scanId]`.
- [ ] Verify focused API tests pass.

### Task 2: Recent Scan Replay UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/globals.css`
- Modify: `README.md`

- [ ] Add failing UI test for clicking a recent scan and seeing detailed findings.
- [ ] Make history entries buttons that load saved scan detail.
- [ ] Show saved scan viewing status and comparison.
- [ ] Verify focused UI tests pass.

### Task 3: Verification

- [ ] Run all tests.
- [ ] Run type check.
- [ ] Run production build.
