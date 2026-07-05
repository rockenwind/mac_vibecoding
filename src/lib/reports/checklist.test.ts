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
    expect(checklist).toContain("- [ ] **Critical** Possible exposed credential");
    expect(checklist).toContain("  - Location: `.env:1`");
    expect(checklist).toContain("  - Evidence:");
    expect(checklist).toContain("    OPENAI_API_KEY=sk-...redacted...");
    expect(checklist).toContain("  - Impact: Exposed credentials can let attackers access services.");
    expect(checklist).toContain("  - Required action: Revoke the credential and load it from a secret manager.");
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
