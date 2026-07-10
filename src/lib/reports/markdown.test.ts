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

describe("buildScanMarkdown", () => {
  it("builds a readable Markdown report from a scan", () => {
    const markdown = buildScanMarkdown(scan);

    expect(markdown).toContain("# Repository scan: example/repo");
    expect(markdown).toContain("- Scan ID: scan_test");
    expect(markdown).toContain("| Critical | 1 |");
    expect(markdown).toContain("## Warnings");
    expect(markdown).toContain("Skipped large file dist/app.js");
    expect(markdown).toContain("## Scan coverage");
    expect(markdown).toContain("| Status | Rule | Severity | Category | Findings | Description |");
    expect(markdown).toContain("| Failed | Possible exposed credential | Critical | secret | 1 | API 키, 토큰, 비밀번호처럼 코드에 직접 들어간 비밀값을 찾습니다. |");
    expect(markdown).toContain("| Passed | Outbound request uses user-controlled URL | Medium | dangerous-execution | 0 | 사용자 입력이 서버의 외부 요청 주소로 사용되는지 확인합니다. |");
    expect(markdown).toContain("### Possible exposed credential");
    expect(markdown).toContain("- Confidence: High");
    expect(markdown).toContain("`.env:1`");
  });

  it("includes the saved scan time when provided", () => {
    const markdown = buildScanMarkdown(scan, { savedAt: "2026-07-02T00:00:00.000Z" });

    expect(markdown).toContain("- Scanned at: 2026-07-02T00:00:00.000Z");
  });

  it("states when there are no findings", () => {
    const markdown = buildScanMarkdown({ ...scan, findings: [] });

    expect(markdown).toContain("No findings were detected.");
  });
});
