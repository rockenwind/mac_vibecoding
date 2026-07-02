# Scan Comparison UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the scan comparison panel so users can clearly inspect new, resolved, and unchanged findings.

**Architecture:** Keep comparison data unchanged. Replace the compact list rendering with a reusable comparison section that shows count, severity, title, and location for each group.

**Tech Stack:** React, CSS, React Testing Library, Vitest.

---

### Task 1: Comparison Panel Tests

**Files:**
- Modify: `src/app/page.test.tsx`

- [ ] Add a failing test for previous scan ID and unchanged finding details.

### Task 2: Comparison Panel UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Render previous scan ID.
- [ ] Render all three comparison groups.
- [ ] Add empty states for groups with no items.

### Task 3: Verification

- [ ] Run page tests.
- [ ] Run all tests, type checks, and build.
