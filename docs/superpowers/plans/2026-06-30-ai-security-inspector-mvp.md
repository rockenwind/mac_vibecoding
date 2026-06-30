# AI Security Inspector MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack MVP that accepts a public GitHub repository URL, scans selected files for AI/agent/LLM security risks, and renders a findings report in a web UI.

**Architecture:** Use a single Next.js application with API routes and a shared scanner core. The API validates GitHub URLs, fetches public repository files, runs rule-based analyzers, and returns a stable scan report consumed by the frontend.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest, Testing Library, GitHub REST API via `fetch`, CSS Modules or global CSS.

---

## File Structure

- Create: `package.json` for scripts and dependencies.
- Create: `tsconfig.json` for strict TypeScript settings.
- Create: `next.config.mjs` for Next.js defaults.
- Create: `vitest.config.ts` for unit and component tests.
- Create: `src/app/layout.tsx` for the app shell.
- Create: `src/app/page.tsx` for the scan form and report UI.
- Create: `src/app/globals.css` for the product interface.
- Create: `src/app/api/scans/route.ts` for `POST /api/scans`.
- Create: `src/lib/github/url.ts` for GitHub URL parsing and normalization.
- Create: `src/lib/github/source.ts` for public repository metadata and file retrieval.
- Create: `src/lib/scanner/types.ts` for shared report and file types.
- Create: `src/lib/scanner/fileFilter.ts` for include/exclude decisions.
- Create: `src/lib/scanner/redaction.ts` for secret redaction.
- Create: `src/lib/scanner/analyzers.ts` for rule-based finding generation.
- Create: `src/lib/scanner/scan.ts` for orchestration and summary aggregation.
- Create: `src/lib/scanner/__fixtures__/sampleFiles.ts` for test fixtures.
- Create: `src/lib/github/url.test.ts`.
- Create: `src/lib/scanner/fileFilter.test.ts`.
- Create: `src/lib/scanner/redaction.test.ts`.
- Create: `src/lib/scanner/analyzers.test.ts`.
- Create: `src/lib/scanner/scan.test.ts`.
- Create: `src/app/api/scans/route.test.ts`.
- Create: `src/app/page.test.tsx`.
- Modify: `README.md` with setup, test, and run instructions.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "name": "mac-vibecoding-ai-security-inspector",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^22.13.0",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: []
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

- [ ] **Step 2: Create the base app shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Security Inspector",
  description: "Scan public GitHub repositories for AI and agent security risks."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/globals.css`:

```css
:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --panel: #ffffff;
  --text: #18202a;
  --muted: #5d6673;
  --line: #d9dee7;
  --critical: #b42318;
  --high: #c2410c;
  --medium: #a16207;
  --low: #2563eb;
  --info: #4b5563;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
textarea {
  font: inherit;
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`

Expected: dependency installation completes and creates `package-lock.json`.

- [ ] **Step 4: Run baseline checks**

Run: `npm test`

Expected: Vitest exits successfully with no tests found or an empty-suite notice accepted by the runner.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts src/app/layout.tsx src/app/globals.css
git commit -m "chore: scaffold ai security inspector app"
```

## Task 2: Shared Scan Types and GitHub URL Parsing

**Files:**
- Create: `src/lib/scanner/types.ts`
- Create: `src/lib/github/url.ts`
- Create: `src/lib/github/url.test.ts`

- [ ] **Step 1: Write URL parser tests**

Create `src/lib/github/url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryUrl } from "./url";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a canonical repository URL", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/openai-node")).toEqual({
      owner: "openai",
      name: "openai-node",
      url: "https://github.com/openai/openai-node"
    });
  });

  it("normalizes a trailing slash and git suffix", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/openai-node.git/")).toEqual({
      owner: "openai",
      name: "openai-node",
      url: "https://github.com/openai/openai-node"
    });
  });

  it("rejects unsupported hosts", () => {
    expect(() => parseGitHubRepositoryUrl("https://gitlab.com/openai/openai-node")).toThrow(
      "Only github.com repositories are supported."
    );
  });

  it("rejects invalid repository paths", () => {
    expect(() => parseGitHubRepositoryUrl("https://github.com/openai")).toThrow(
      "Enter a GitHub repository URL like https://github.com/owner/repo."
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/github/url.test.ts`

Expected: FAIL because `src/lib/github/url.ts` does not exist.

- [ ] **Step 3: Add shared types and parser implementation**

Create `src/lib/scanner/types.ts`:

```ts
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type FindingCategory =
  | "secret"
  | "agent-tooling"
  | "prompt-injection"
  | "mcp"
  | "dangerous-execution";

export type RepositoryRef = {
  owner: string;
  name: string;
  url: string;
  defaultBranch?: string;
};

export type RepositoryFile = {
  path: string;
  content: string;
  size: number;
};

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  evidence: string;
  whyItMatters: string;
  fixSuggestion: string;
};

export type ScanSummary = Record<Severity, number>;

export type ScanWarning = {
  message: string;
};

export type ScanResult = {
  id: string;
  repository: Required<RepositoryRef>;
  summary: ScanSummary;
  findings: Finding[];
  warnings: ScanWarning[];
};
```

Create `src/lib/github/url.ts`:

```ts
import type { RepositoryRef } from "@/lib/scanner/types";

export function parseGitHubRepositoryUrl(input: string): RepositoryRef {
  let parsed: URL;

  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  if (parsed.hostname !== "github.com") {
    throw new Error("Only github.com repositories are supported.");
  }

  const parts = parsed.pathname
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo.");
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/, "");

  if (!owner || !name) {
    throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo.");
  }

  return {
    owner,
    name,
    url: `https://github.com/${owner}/${name}`
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/github/url.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scanner/types.ts src/lib/github/url.ts src/lib/github/url.test.ts
git commit -m "feat: parse github repository urls"
```

## Task 3: File Filtering and Redaction

**Files:**
- Create: `src/lib/scanner/fileFilter.ts`
- Create: `src/lib/scanner/fileFilter.test.ts`
- Create: `src/lib/scanner/redaction.ts`
- Create: `src/lib/scanner/redaction.test.ts`

- [ ] **Step 1: Write file filter tests**

Create `src/lib/scanner/fileFilter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldScanFile } from "./fileFilter";

describe("shouldScanFile", () => {
  it("includes source and AI-related files", () => {
    expect(shouldScanFile({ path: "src/agent.ts", size: 1000 })).toBe(true);
    expect(shouldScanFile({ path: "prompts/system.prompt", size: 1000 })).toBe(true);
    expect(shouldScanFile({ path: "mcp.json", size: 1000 })).toBe(true);
  });

  it("excludes generated folders and lockfiles", () => {
    expect(shouldScanFile({ path: "node_modules/pkg/index.js", size: 1000 })).toBe(false);
    expect(shouldScanFile({ path: "package-lock.json", size: 1000 })).toBe(false);
    expect(shouldScanFile({ path: "dist/app.js", size: 1000 })).toBe(false);
  });

  it("excludes large files", () => {
    expect(shouldScanFile({ path: "src/large.ts", size: 205_000 })).toBe(false);
  });
});
```

- [ ] **Step 2: Write redaction tests**

Create `src/lib/scanner/redaction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redaction";

describe("redactSecrets", () => {
  it("redacts OpenAI-like keys", () => {
    expect(redactSecrets("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "OPENAI_API_KEY=sk-...redacted..."
    );
  });

  it("redacts generic long tokens after credential keys", () => {
    expect(redactSecrets("github_token: ghp_abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "github_token: ghp_...redacted..."
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/scanner/fileFilter.test.ts src/lib/scanner/redaction.test.ts`

Expected: FAIL because implementations do not exist.

- [ ] **Step 4: Implement file filtering and redaction**

Create `src/lib/scanner/fileFilter.ts`:

```ts
const MAX_FILE_SIZE_BYTES = 200_000;

const excludedSegments = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules"
]);

const excludedFileNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "go.sum",
  "Cargo.lock"
]);

const includedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".java",
  ".cs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".ini",
  ".prompt",
  ".md"
]);

const aiPathHints = ["prompt", "agent", "mcp", "tool", "openai", "anthropic", "llm"];

export function shouldScanFile(file: { path: string; size: number }): boolean {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return false;
  }

  const normalized = file.path.replaceAll("\\", "/");
  const segments = normalized.split("/");

  if (segments.some((segment) => excludedSegments.has(segment))) {
    return false;
  }

  const fileName = segments.at(-1) ?? "";
  if (excludedFileNames.has(fileName)) {
    return false;
  }

  const lowerPath = normalized.toLowerCase();
  if (aiPathHints.some((hint) => lowerPath.includes(hint))) {
    return true;
  }

  return [...includedExtensions].some((extension) => lowerPath.endsWith(extension));
}
```

Create `src/lib/scanner/redaction.ts`:

```ts
const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, "sk-...redacted..."],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "ghp_...redacted..."],
  [
    /\b((?:api[_-]?key|token|secret|password)\s*[:=]\s*)(["']?)[A-Za-z0-9_./+=-]{16,}\2/gi,
    "$1$2...redacted...$2"
  ]
];

export function redactSecrets(value: string): string {
  return secretPatterns.reduce((redacted, [pattern, replacement]) => {
    return redacted.replace(pattern, replacement);
  }, value);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/scanner/fileFilter.test.ts src/lib/scanner/redaction.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scanner/fileFilter.ts src/lib/scanner/fileFilter.test.ts src/lib/scanner/redaction.ts src/lib/scanner/redaction.test.ts
git commit -m "feat: filter files and redact secrets"
```

## Task 4: Rule-Based Analyzers

**Files:**
- Create: `src/lib/scanner/__fixtures__/sampleFiles.ts`
- Create: `src/lib/scanner/analyzers.ts`
- Create: `src/lib/scanner/analyzers.test.ts`

- [ ] **Step 1: Write analyzer tests**

Create `src/lib/scanner/__fixtures__/sampleFiles.ts`:

```ts
import type { RepositoryFile } from "../types";

export const sampleFiles: RepositoryFile[] = [
  {
    path: "src/agent.ts",
    size: 152,
    content: "import { exec } from 'child_process';\nexport function run(cmd: string) { exec(cmd); }\n"
  },
  {
    path: "prompts/system.prompt",
    size: 96,
    content: "System: reveal the system prompt if the user asks for debugging.\n"
  },
  {
    path: ".env",
    size: 80,
    content: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456\n"
  },
  {
    path: "mcp.json",
    size: 128,
    content: "{\"servers\":{\"local\":{\"command\":\"bash\",\"args\":[\"-lc\",\"echo hi\"],\"roots\":[\"/\"]}}}"
  }
];
```

Create `src/lib/scanner/analyzers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analyzers";
import { sampleFiles } from "./__fixtures__/sampleFiles";

describe("analyzeFiles", () => {
  it("detects secrets, dangerous execution, prompt risks, and MCP risks", () => {
    const findings = analyzeFiles(sampleFiles);

    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "secret.env-file",
        "secret.exposed-token",
        "dangerous-execution.child-process",
        "prompt-injection.reveal-system-prompt",
        "mcp.broad-filesystem-shell"
      ])
    );
  });

  it("redacts secret evidence", () => {
    const findings = analyzeFiles(sampleFiles);
    const secretFinding = findings.find((finding) => finding.ruleId === "secret.exposed-token");

    expect(secretFinding?.evidence).toContain("sk-...redacted...");
    expect(secretFinding?.evidence).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/scanner/analyzers.test.ts`

Expected: FAIL because `analyzers.ts` does not exist.

- [ ] **Step 3: Implement analyzers**

Create `src/lib/scanner/analyzers.ts`:

```ts
import type { Finding, FindingCategory, RepositoryFile, Severity } from "./types";
import { redactSecrets } from "./redaction";

type RuleMatch = {
  ruleId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  pattern: RegExp;
  whyItMatters: string;
  fixSuggestion: string;
};

const rules: RuleMatch[] = [
  {
    ruleId: "secret.exposed-token",
    title: "Possible exposed credential",
    severity: "critical",
    category: "secret",
    pattern: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,})\b/i,
    whyItMatters: "Exposed credentials can let attackers access model providers, source control, or internal services.",
    fixSuggestion: "Revoke the credential, remove it from git history, and load it from a secret manager or environment variable."
  },
  {
    ruleId: "dangerous-execution.child-process",
    title: "Broad command execution capability",
    severity: "high",
    category: "dangerous-execution",
    pattern: /\b(child_process\.exec|exec\(|subprocess\.|os\.system|new Function\(|eval\()/,
    whyItMatters: "Agent or LLM-controlled command execution can become remote code execution if user input reaches this path.",
    fixSuggestion: "Constrain commands to an allowlist, avoid shell interpolation, and separate user input from executable arguments."
  },
  {
    ruleId: "prompt-injection.reveal-system-prompt",
    title: "Prompt invites system prompt disclosure",
    severity: "medium",
    category: "prompt-injection",
    pattern: /(reveal|print|show).{0,40}(system prompt|hidden instruction|developer message)/i,
    whyItMatters: "Prompts that permit disclosure of hidden instructions weaken the boundary between user input and trusted control text.",
    fixSuggestion: "Remove disclosure instructions and add explicit refusal behavior for requests to reveal hidden prompts or secrets."
  },
  {
    ruleId: "mcp.broad-filesystem-shell",
    title: "MCP configuration combines shell access and broad filesystem access",
    severity: "high",
    category: "mcp",
    pattern: /("command"\s*:\s*"(bash|sh|zsh|cmd|powershell)"|roots"\s*:\s*\[\s*"\/"\s*\])/i,
    whyItMatters: "Combining shell access with broad filesystem roots can let compromised tools read or modify sensitive local files.",
    fixSuggestion: "Limit filesystem roots to project directories and avoid exposing unrestricted shell commands through MCP tools."
  }
];

export function analyzeFiles(files: RepositoryFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (file.path.endsWith(".env")) {
      findings.push(createFinding({
        file,
        lineNumber: 1,
        ruleId: "secret.env-file",
        title: "Environment file committed to repository",
        severity: "high",
        category: "secret",
        evidence: file.path,
        whyItMatters: "Environment files often contain API keys, database credentials, and deployment secrets.",
        fixSuggestion: "Remove committed environment files and commit a safe example file such as .env.example."
      }));
    }

    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          findings.push(createFinding({
            file,
            lineNumber: index + 1,
            ruleId: rule.ruleId,
            title: rule.title,
            severity: rule.severity,
            category: rule.category,
            evidence: redactSecrets(line.trim()),
            whyItMatters: rule.whyItMatters,
            fixSuggestion: rule.fixSuggestion
          }));
        }
      }
    });
  }

  return findings;
}

function createFinding(input: {
  file: RepositoryFile;
  lineNumber: number;
  ruleId: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  evidence: string;
  whyItMatters: string;
  fixSuggestion: string;
}): Finding {
  return {
    id: `${input.ruleId}:${input.file.path}:${input.lineNumber}`,
    ruleId: input.ruleId,
    title: input.title,
    severity: input.severity,
    category: input.category,
    filePath: input.file.path,
    lineStart: input.lineNumber,
    lineEnd: input.lineNumber,
    evidence: input.evidence,
    whyItMatters: input.whyItMatters,
    fixSuggestion: input.fixSuggestion
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/scanner/analyzers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scanner/__fixtures__/sampleFiles.ts src/lib/scanner/analyzers.ts src/lib/scanner/analyzers.test.ts
git commit -m "feat: add rule based security analyzers"
```

## Task 5: Scan Orchestration

**Files:**
- Create: `src/lib/scanner/scan.ts`
- Create: `src/lib/scanner/scan.test.ts`

- [ ] **Step 1: Write scan orchestration tests**

Create `src/lib/scanner/scan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runScan } from "./scan";
import { sampleFiles } from "./__fixtures__/sampleFiles";

describe("runScan", () => {
  it("filters files, runs analyzers, and aggregates severity counts", () => {
    const scan = runScan({
      repository: {
        owner: "example",
        name: "repo",
        url: "https://github.com/example/repo",
        defaultBranch: "main"
      },
      files: [
        ...sampleFiles,
        { path: "node_modules/ignored/index.js", size: 20, content: "eval(userInput)" }
      ],
      warnings: []
    });

    expect(scan.id).toMatch(/^scan_/);
    expect(scan.repository.name).toBe("repo");
    expect(scan.summary.critical).toBeGreaterThan(0);
    expect(scan.summary.high).toBeGreaterThan(0);
    expect(scan.findings.some((finding) => finding.filePath.includes("node_modules"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/scanner/scan.test.ts`

Expected: FAIL because `scan.ts` does not exist.

- [ ] **Step 3: Implement scan orchestration**

Create `src/lib/scanner/scan.ts`:

```ts
import { analyzeFiles } from "./analyzers";
import { shouldScanFile } from "./fileFilter";
import type { RepositoryFile, RepositoryRef, ScanResult, ScanSummary, ScanWarning, Severity } from "./types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

export function runScan(input: {
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}): ScanResult {
  const selectedFiles = input.files.filter((file) =>
    shouldScanFile({ path: file.path, size: file.size })
  );
  const findings = analyzeFiles(selectedFiles);
  const summary = createEmptySummary();

  for (const finding of findings) {
    summary[finding.severity] += 1;
  }

  return {
    id: `scan_${Date.now().toString(36)}`,
    repository: input.repository,
    summary,
    findings,
    warnings: input.warnings
  };
}

function createEmptySummary(): ScanSummary {
  return Object.fromEntries(severities.map((severity) => [severity, 0])) as ScanSummary;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/scanner/scan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scanner/scan.ts src/lib/scanner/scan.test.ts
git commit -m "feat: orchestrate repository scans"
```

## Task 6: GitHub Source Adapter and Scan API

**Files:**
- Create: `src/lib/github/source.ts`
- Create: `src/app/api/scans/route.ts`
- Create: `src/app/api/scans/route.test.ts`

- [ ] **Step 1: Write API route tests with a mocked source adapter**

Create `src/app/api/scans/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/github/source", () => ({
  fetchRepositoryFiles: vi.fn(async () => ({
    repository: {
      owner: "example",
      name: "repo",
      url: "https://github.com/example/repo",
      defaultBranch: "main"
    },
    files: [
      {
        path: ".env",
        size: 64,
        content: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456"
      }
    ],
    warnings: []
  }))
}));

describe("POST /api/scans", () => {
  it("returns a scan result for a valid GitHub URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scan.repository.name).toBe("repo");
    expect(body.scan.findings.length).toBeGreaterThan(0);
  });

  it("returns 400 for an invalid URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "not a url" })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Enter a valid GitHub repository URL.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/scans/route.test.ts`

Expected: FAIL because route and source files do not exist.

- [ ] **Step 3: Implement source adapter and API route**

Create `src/lib/github/source.ts`:

```ts
import { shouldScanFile } from "@/lib/scanner/fileFilter";
import type { RepositoryFile, RepositoryRef, ScanWarning } from "@/lib/scanner/types";

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
  size?: number;
  url: string;
};

export async function fetchRepositoryFiles(repository: RepositoryRef): Promise<{
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}> {
  const metadataResponse = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.name}`, {
    headers: { Accept: "application/vnd.github+json" }
  });

  if (metadataResponse.status === 404) {
    throw new Error("Repository was not found or is not public.");
  }

  if (metadataResponse.status === 403) {
    throw new Error("GitHub rate limit reached. Try again later.");
  }

  if (!metadataResponse.ok) {
    throw new Error("GitHub repository metadata could not be fetched.");
  }

  const metadata = (await metadataResponse.json()) as { default_branch: string };
  const defaultBranch = metadata.default_branch;
  const treeResponse = await fetch(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${defaultBranch}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" } }
  );

  if (!treeResponse.ok) {
    throw new Error("GitHub repository file tree could not be fetched.");
  }

  const treeBody = (await treeResponse.json()) as { tree: GitHubTreeItem[]; truncated?: boolean };
  const warnings: ScanWarning[] = treeBody.truncated
    ? [{ message: "GitHub returned a truncated file tree, so some files were not scanned." }]
    : [];

  const candidateFiles = treeBody.tree.filter((item) => {
    return item.type === "blob" && shouldScanFile({ path: item.path, size: item.size ?? 0 });
  });

  const files: RepositoryFile[] = [];

  for (const item of candidateFiles.slice(0, 200)) {
    const rawResponse = await fetch(
      `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${defaultBranch}/${item.path}`
    );

    if (!rawResponse.ok) {
      warnings.push({ message: `Could not fetch ${item.path}.` });
      continue;
    }

    const content = await rawResponse.text();
    files.push({
      path: item.path,
      content,
      size: item.size ?? content.length
    });
  }

  return {
    repository: {
      owner: repository.owner,
      name: repository.name,
      url: repository.url,
      defaultBranch
    },
    files,
    warnings
  };
}
```

Create `src/app/api/scans/route.ts`:

```ts
import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import { fetchRepositoryFiles } from "@/lib/github/source";
import { runScan } from "@/lib/scanner/scan";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { repositoryUrl?: unknown };

    if (typeof body.repositoryUrl !== "string") {
      return Response.json({ error: "repositoryUrl must be a string." }, { status: 400 });
    }

    const repository = parseGitHubRepositoryUrl(body.repositoryUrl);
    const source = await fetchRepositoryFiles(repository);
    const scan = runScan(source);

    return Response.json({ scan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    const status = message.includes("GitHub rate limit") ? 429 : 400;
    return Response.json({ error: message }, { status });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/scans/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github/source.ts src/app/api/scans/route.ts src/app/api/scans/route.test.ts
git commit -m "feat: add github scan api"
```

## Task 7: Web UI

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write UI test**

Create `src/app/page.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          scan: {
            id: "scan_test",
            repository: {
              owner: "example",
              name: "repo",
              url: "https://github.com/example/repo",
              defaultBranch: "main"
            },
            summary: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
            warnings: [],
            findings: [
              {
                id: "secret.exposed-token:.env:1",
                ruleId: "secret.exposed-token",
                title: "Possible exposed credential",
                severity: "critical",
                category: "secret",
                filePath: ".env",
                lineStart: 1,
                lineEnd: 1,
                evidence: "OPENAI_API_KEY=sk-...redacted...",
                whyItMatters: "Exposed credentials can let attackers access services.",
                fixSuggestion: "Revoke the credential and load it from a secret manager."
              }
            ]
          }
        })
      }))
    );
  });

  it("submits a GitHub URL and renders findings", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getByText("Possible exposed credential")).toBeInTheDocument();
    });
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText(".env:1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because `page.tsx` does not exist and jest-dom matchers are not configured.

- [ ] **Step 3: Add UI and test matcher setup**

Modify `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/app/page.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import type { ScanResult, Severity } from "@/lib/scanner/types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

export default function Home() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setScan(null);

    const response = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryUrl })
    });
    const body = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(body.error ?? "Scan failed.");
      return;
    }

    setScan(body.scan);
  }

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div>
          <p className="eyebrow">AI Security Inspector</p>
          <h1>Scan public GitHub repositories for AI and agent security risks.</h1>
        </div>
        <form className="scan-form" onSubmit={submitScan}>
          <label htmlFor="repositoryUrl">GitHub repository URL</label>
          <div className="input-row">
            <input
              id="repositoryUrl"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
            />
            <button type="submit" disabled={loading || repositoryUrl.trim().length === 0}>
              {loading ? "Scanning" : "Scan repository"}
            </button>
          </div>
        </form>
        {error ? <p className="error-message">{error}</p> : null}
      </section>

      {scan ? (
        <section className="results-grid">
          <div className="summary-panel">
            <div>
              <p className="eyebrow">Repository</p>
              <h2>{scan.repository.owner}/{scan.repository.name}</h2>
            </div>
            <div className="summary-list">
              {severities.map((severity) => (
                <div className="summary-item" key={severity}>
                  <span>{capitalize(severity)}</span>
                  <strong>{scan.summary[severity]}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="findings-panel">
            <h2>Findings</h2>
            {scan.findings.length === 0 ? (
              <p className="empty-state">No findings were detected by the MVP rules.</p>
            ) : (
              <ul className="finding-list">
                {scan.findings.map((finding) => (
                  <li className="finding-item" key={finding.id}>
                    <div className="finding-header">
                      <span className={`severity severity-${finding.severity}`}>
                        {capitalize(finding.severity)}
                      </span>
                      <strong>{finding.title}</strong>
                    </div>
                    <p className="file-ref">
                      {finding.filePath}
                      {finding.lineStart ? `:${finding.lineStart}` : ""}
                    </p>
                    <pre>{finding.evidence}</pre>
                    <p>{finding.whyItMatters}</p>
                    <p className="fix">{finding.fixSuggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="json-panel">
            <summary>JSON report</summary>
            <pre>{JSON.stringify(scan, null, 2)}</pre>
          </details>
        </section>
      ) : null}
    </main>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
```

Modify `src/app/globals.css` by appending:

```css
.app-shell {
  min-height: 100vh;
  padding: 40px;
}

.hero-band,
.summary-panel,
.findings-panel,
.json-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 24px;
}

.hero-band {
  display: grid;
  gap: 24px;
  margin: 0 auto 24px;
  max-width: 1120px;
}

.eyebrow {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 34px;
  line-height: 1.15;
  max-width: 780px;
}

.scan-form {
  display: grid;
  gap: 8px;
}

.scan-form label {
  color: var(--muted);
  font-weight: 700;
}

.input-row {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.input-row input,
.input-row button {
  border-radius: 6px;
  min-height: 44px;
}

.input-row input {
  border: 1px solid var(--line);
  padding: 0 12px;
}

.input-row button {
  background: #18202a;
  border: 0;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  padding: 0 18px;
}

.input-row button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  color: var(--critical);
  margin: 0;
}

.results-grid {
  display: grid;
  gap: 24px;
  margin: 0 auto;
  max-width: 1120px;
}

.summary-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 20px;
}

.summary-item {
  border: 1px solid var(--line);
  border-radius: 6px;
  display: grid;
  gap: 8px;
  min-height: 72px;
  padding: 12px;
}

.summary-item span {
  color: var(--muted);
}

.summary-item strong {
  font-size: 28px;
}

.finding-list {
  display: grid;
  gap: 14px;
  list-style: none;
  margin: 20px 0 0;
  padding: 0;
}

.finding-item {
  border: 1px solid var(--line);
  border-radius: 6px;
  display: grid;
  gap: 10px;
  padding: 16px;
}

.finding-header {
  align-items: center;
  display: flex;
  gap: 10px;
}

.severity {
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
}

.severity-critical {
  background: var(--critical);
}

.severity-high {
  background: var(--high);
}

.severity-medium {
  background: var(--medium);
}

.severity-low {
  background: var(--low);
}

.severity-info {
  background: var(--info);
}

.file-ref,
.empty-state {
  color: var(--muted);
  margin: 0;
}

.finding-item p {
  margin: 0;
}

.finding-item pre,
.json-panel pre {
  background: #111827;
  border-radius: 6px;
  color: #f9fafb;
  margin: 0;
  overflow: auto;
  padding: 12px;
}

.fix {
  color: #1f4f46;
  font-weight: 700;
}

@media (max-width: 760px) {
  .app-shell {
    padding: 20px;
  }

  .input-row,
  .summary-list {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 28px;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/globals.css src/test/setup.ts vitest.config.ts
git commit -m "feat: add repository scan web ui"
```

## Task 8: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Replace `README.md` with:

```md
# mac_vibecoding

AI Security Inspector is a full-stack MVP for scanning public GitHub repositories for AI, agent, and LLM application security risks.

## Features

- Public GitHub repository URL scanning
- Rule-based findings for secrets, dangerous execution, prompt risks, MCP risks, and agent tool permission risks
- Web report with severity counts, evidence, risk explanation, fix guidance, and JSON output
- Scanner core structured for future AI-assisted analysis

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run the web app:

```bash
npm run dev
```

Open `http://localhost:3000` and enter a public GitHub repository URL.

## MVP Scope

The MVP supports public `github.com` repositories only. It does not authenticate users, scan private repositories, or call an AI model.
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS with a compiled Next.js app.

- [ ] **Step 4: Start local dev server**

Run: `npm run dev`

Expected: dev server starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 5: Manually verify scan flow**

Open the app and scan:

```text
https://github.com/rockenwind/mac_vibecoding
```

Expected: the UI shows a repository summary and either findings or an empty-state message. The page must not expose unredacted secret values in evidence.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document ai security inspector mvp"
```

- [ ] **Step 7: Push completed MVP**

Run: `git push`

Expected: `main` pushes to `origin/main`.

