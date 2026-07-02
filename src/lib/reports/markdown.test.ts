import { describe, expect, it } from "vitest";
import { buildScanMarkdown } from "./markdown";
import type { ScanResult } from "@/lib/scanner/types";

const scan: ScanResult = {
  id: "scan_test",
  repository: {
    owner: "example",
    name: "repo",
    url: "https://github.com/example/repo",
    defaultBranch: "main"
  },
  summary: { critical: 1, high: 0, medium: 1, low: 0, info: 0 },
  warnings: [{ message: "Skipped large file dist/app.js" }],
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
};

describe("buildScanMarkdown", () => {
  it("builds a readable Markdown report from a scan", () => {
    const markdown = buildScanMarkdown(scan);

    expect(markdown).toContain("# Repository scan: example/repo");
    expect(markdown).toContain("- Scan ID: scan_test");
    expect(markdown).toContain("| Critical | 1 |");
    expect(markdown).toContain("## Warnings");
    expect(markdown).toContain("Skipped large file dist/app.js");
    expect(markdown).toContain("### Possible exposed credential");
    expect(markdown).toContain("`.env:1`");
  });

  it("states when there are no findings", () => {
    const markdown = buildScanMarkdown({ ...scan, findings: [] });

    expect(markdown).toContain("No findings were detected.");
  });
});
