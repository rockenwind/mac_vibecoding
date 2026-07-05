import { describe, expect, it } from "vitest";
import type { ScanComparison } from "@/lib/scanHistory/types";
import type { Finding, ScanResult } from "@/lib/scanner/types";
import type { ScanScheduleSetting } from "@/lib/scanSettings/types";
import { buildScheduleNotifications } from "./notifications";

const finding: Finding = {
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
};

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
  findings: [finding]
};

const schedule: ScanScheduleSetting = {
  repositoryKey: "example/repo",
  repositoryUrl: "https://github.com/example/repo",
  enabled: true,
  intervalDays: 7,
  nextRunAt: "2026-07-05T00:00:00.000Z",
  notifyOnNewFindings: true,
  notifyOnResolvedFindings: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
};

describe("scheduled scan notifications", () => {
  it("creates a notification candidate for new findings", () => {
    const comparison: ScanComparison = {
      previousScanId: "scan_previous",
      comparisonSource: "previous",
      newFindings: [finding],
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings: []
    };

    expect(buildScheduleNotifications(schedule, scan, comparison)).toEqual([
      {
        repositoryKey: "example/repo",
        scanId: "scan_test",
        newFindings: 1,
        resolvedFindings: 0,
        highestSeverity: "critical",
        message: "새 취약점 1개가 발견되었습니다. / 1 new finding was detected."
      }
    ]);
  });

  it("does not create notification candidates when notification toggles are disabled", () => {
    const comparison: ScanComparison = {
      previousScanId: "scan_previous",
      comparisonSource: "previous",
      newFindings: [finding],
      resolvedFindings: [finding],
      unchangedFindings: [],
      suppressedFindings: []
    };

    expect(
      buildScheduleNotifications(
        { ...schedule, notifyOnNewFindings: false, notifyOnResolvedFindings: false },
        scan,
        comparison
      )
    ).toEqual([]);
  });
});
