import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  readScanHistory: vi.fn(),
  compareScanResults: vi.fn()
}));

vi.mock("@/lib/scanHistory/store", () => ({
  readScanHistory: mocks.readScanHistory,
  compareScanResults: mocks.compareScanResults
}));

const currentScan = {
  id: "scan_current",
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

const previousScan = {
  ...currentScan,
  id: "scan_previous",
  findings: []
};

describe("GET /api/scans/[scanId]", () => {
  it("returns a saved scan with comparison against the previous repository scan", async () => {
    mocks.readScanHistory.mockResolvedValue([
      { savedAt: "2026-07-02T00:10:00.000Z", scan: currentScan },
      { savedAt: "2026-07-02T00:00:00.000Z", scan: previousScan }
    ]);
    mocks.compareScanResults.mockReturnValue({
      previousScanId: "scan_previous",
      newFindings: currentScan.findings,
      resolvedFindings: [],
      unchangedFindings: []
    });

    const response = await GET(new Request("http://localhost/api/scans/scan_current"), {
      params: Promise.resolve({ scanId: "scan_current" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.history.savedAt).toBe("2026-07-02T00:10:00.000Z");
    expect(body.scan.id).toBe("scan_current");
    expect(body.comparison.previousScanId).toBe("scan_previous");
    expect(mocks.compareScanResults).toHaveBeenCalledWith(currentScan, {
      savedAt: "2026-07-02T00:00:00.000Z",
      scan: previousScan
    });
  });

  it("returns 404 when the scan id is not saved", async () => {
    mocks.readScanHistory.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/scans/missing"), {
      params: Promise.resolve({ scanId: "missing" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Scan was not found.");
  });
});
