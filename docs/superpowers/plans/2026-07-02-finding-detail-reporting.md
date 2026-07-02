# Finding Detail Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repository scan findings explain vulnerability details, impact, and required action directly in the web UI.

**Architecture:** Keep the existing scan data model and improve presentation in `src/app/page.tsx`. Use small UI helper functions for severity priority labels and render the existing finding fields with clearer Korean labels.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library.

---

### Task 1: Add Detailed Finding UI

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `README.md`

- [ ] Add a failing page test that expects `위험 요약`, `영향도`, `필요 조치`, and a severity priority phrase after a scan.
- [ ] Update the scan result UI to render a risk summary and finding cards with Korean report labels.
- [ ] Update CSS so the additional detail remains readable on desktop and mobile.
- [ ] Update README to describe the detailed result view.
- [ ] Run focused page tests, full tests, type check, and production build.
