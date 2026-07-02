# SQLite Scan History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SQLite-backed scan history store while preserving the existing JSON store.

**Architecture:** Keep `ScanHistoryStore` as the boundary. Add a SQLite implementation behind the same interface and select it only when `SCAN_HISTORY_DATABASE_URL` starts with `sqlite:`.

**Tech Stack:** TypeScript, Node `node:sqlite`, Vitest.

---

### Task 1: SQLite Store

**Files:**
- Modify: `src/lib/scanHistory/store.ts`
- Modify: `src/lib/scanHistory/store.test.ts`

- [ ] Add a failing test for `createSqliteScanHistoryStore()`.
- [ ] Implement the SQLite table creation, insert, and read path.
- [ ] Verify store tests pass.

### Task 2: Default Store Selection

**Files:**
- Modify: `src/lib/scanHistory/store.ts`
- Modify: `src/lib/scanHistory/store.test.ts`

- [ ] Add a failing test for `SCAN_HISTORY_DATABASE_URL=sqlite:...`.
- [ ] Select SQLite when the environment variable is present.
- [ ] Verify store tests pass.

### Task 3: Documentation and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/operations-checklist.md`

- [ ] Document the SQLite database URL.
- [ ] Run all tests, type checks, and build.
