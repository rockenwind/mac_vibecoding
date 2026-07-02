# GitHub App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side GitHub App foundation for installation and repository discovery.

**Architecture:** Keep GitHub App code separate from the existing public repository scanner. Add focused modules for environment config, JWT auth, and GitHub API calls, then expose small App Router endpoints for installations and repositories.

**Tech Stack:** Next.js App Router, TypeScript, Node crypto, Vitest.

---

### Task 1: GitHub App Config

**Files:**
- Create: `src/lib/github/appConfig.ts`
- Create: `src/lib/github/appConfig.test.ts`

- [ ] Add tests for configured and missing environment values.
- [ ] Implement `readGitHubAppConfig()`.
- [ ] Verify with `CI=true ./node_modules/.bin/vitest run src/lib/github/appConfig.test.ts`.

### Task 2: GitHub App JWT

**Files:**
- Create: `src/lib/github/appAuth.ts`
- Create: `src/lib/github/appAuth.test.ts`

- [ ] Add a test that generates a JWT with `iss`, `iat`, and `exp`.
- [ ] Implement RS256 signing using Node crypto.
- [ ] Verify with `CI=true ./node_modules/.bin/vitest run src/lib/github/appAuth.test.ts`.

### Task 3: GitHub App Client

**Files:**
- Create: `src/lib/github/appClient.ts`
- Create: `src/lib/github/appClient.test.ts`

- [ ] Add tests for listing installations and repositories.
- [ ] Add tests for permission and API errors.
- [ ] Implement client functions with injectable `fetch`.
- [ ] Verify with `CI=true ./node_modules/.bin/vitest run src/lib/github/appClient.test.ts`.

### Task 4: API Routes

**Files:**
- Create: `src/app/api/github/installations/route.ts`
- Create: `src/app/api/github/installations/route.test.ts`
- Create: `src/app/api/github/repositories/route.ts`
- Create: `src/app/api/github/repositories/route.test.ts`

- [ ] Add tests for success, missing config, and invalid installation ID.
- [ ] Implement route handlers.
- [ ] Verify with route tests.

### Task 5: Documentation and Verification

**Files:**
- Modify: `docs/github-connection-design.md`
- Modify: `README.md`

- [ ] Document implemented API endpoints and required environment variables.
- [ ] Run the full test suite.
- [ ] Run TypeScript checks.
- [ ] Run the Next.js build.
