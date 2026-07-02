# GitHub Repository Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub App installation and repository picker to the Repository scan screen.

**Architecture:** Keep the existing scan API unchanged. Add client-side state to load installations and repositories from existing API routes, then populate the existing repository URL and installation ID fields when a repository is selected.

**Tech Stack:** React, Next.js App Router client component, React Testing Library, Vitest.

---

### Task 1: Picker Tests

**Files:**
- Modify: `src/app/page.test.tsx`

- [ ] Add a failing test that loads installations, selects one, loads repositories, and fills scan inputs.
- [ ] Add a failing test for GitHub App not configured state.

### Task 2: Picker UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Add installation and repository response types.
- [ ] Load installations on page mount.
- [ ] Load repositories when an installation is selected.
- [ ] Fill `repositoryUrl` and `installationId` when a repository is selected.
- [ ] Add loading, empty, and error states.

### Task 3: Documentation and Verification

**Files:**
- Modify: `README.md`

- [ ] Document selecting repositories from GitHub App installations.
- [ ] Run page tests.
- [ ] Run all tests, type checks, and build.
