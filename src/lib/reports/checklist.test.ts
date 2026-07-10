import { describe, expect, it } from "vitest";
import { buildSecurityChecklist } from "./checklist";
import type { ScanResult } from "@/lib/scanner/types";

const scan: ScanResult = {
  id: "scan_test",
  repository: {
    owner: "example",
    name: "repo",
    url: "https://github.com/example/repo",
    defaultBranch: "main"
  },
  summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
  warnings: [],
  checks: [
    {
      ruleId: "secret.exposed-token",
      title: "Possible exposed credential",
      severity: "critical",
      category: "secret",
      description: "API 키, 토큰, 비밀번호처럼 코드에 직접 들어간 비밀값을 찾습니다.",
      status: "failed",
      findingCount: 1
    },
    {
      ruleId: "network.user-controlled-request",
      title: "Outbound request uses user-controlled URL",
      severity: "medium",
      category: "dangerous-execution",
      description: "사용자 입력이 서버의 외부 요청 주소로 사용되는지 확인합니다.",
      status: "passed",
      findingCount: 0
    }
  ],
  findings: [
    {
      id: "secret.exposed-token:.env:1",
      ruleId: "secret.exposed-token",
      title: "Possible exposed credential",
      severity: "critical",
      confidence: "high",
      category: "secret",
      filePath: ".env",
      lineStart: 1,
      lineEnd: 1,
      evidence: "OPENAI_API_KEY=sk-...redacted...",
      whyItMatters: "Exposed credentials can let attackers access services.",
      fixSuggestion: "Revoke the credential and load it from a secret manager."
    }
  ]
};

describe("buildSecurityChecklist", () => {
  it("builds actionable checklist items from findings", () => {
    const checklist = buildSecurityChecklist(scan);

    expect(checklist).toContain("# Security checklist: example/repo");
    expect(checklist).toContain("- Findings: 1");
    expect(checklist).toContain("| Critical | 1 |");
    expect(checklist).toContain("## Scan coverage");
    expect(checklist).toContain("- [x] **Passed** Outbound request uses user-controlled URL");
    expect(checklist).toContain("  - Description: 사용자 입력이 서버의 외부 요청 주소로 사용되는지 확인합니다.");
    expect(checklist).toContain("- [ ] **Failed** Possible exposed credential");
    expect(checklist).toContain("- [ ] **Critical** Possible exposed credential");
    expect(checklist).toContain("  - Location: `.env:1`");
    expect(checklist).toContain("  - Evidence:");
    expect(checklist).toContain("    OPENAI_API_KEY=sk-...redacted...");
    expect(checklist).toContain("  - Impact: Exposed credentials can let attackers access services.");
    expect(checklist).toContain("  - Required action: Revoke the credential and load it from a secret manager.");
  });

  it("includes the saved scan time when provided", () => {
    const checklist = buildSecurityChecklist(scan, { savedAt: "2026-07-02T00:00:00.000Z" });

    expect(checklist).toContain("- Scanned at: 2026-07-02T00:00:00.000Z");
  });

  it("states when no checklist items are required", () => {
    const checklist = buildSecurityChecklist({
      ...scan,
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      findings: []
    });

    expect(checklist).toContain("No checklist items are required.");
  });

  it("renders evidence with fenced code blocks so backticks do not break Markdown", () => {
    const checklist = buildSecurityChecklist({
      ...scan,
      findings: [
        {
          ...scan.findings[0],
          evidence: "db.query(`SELECT * FROM users WHERE id = ${request.query.id}`)"
        }
      ]
    });

    expect(checklist).toContain("  - Evidence:");
    expect(checklist).toContain("    ```text");
    expect(checklist).toContain("    db.query(`SELECT * FROM users WHERE id = ${request.query.id}`)");
    expect(checklist).toContain("    ```");
  });

  it("includes warnings before the checklist", () => {
    const checklist = buildSecurityChecklist({
      ...scan,
      warnings: [{ message: "Skipped large file dist/app.js" }]
    });

    expect(checklist).toContain("## Warnings");
    expect(checklist).toContain("- [ ] Review scan warning: Skipped large file dist/app.js");
  });
});
