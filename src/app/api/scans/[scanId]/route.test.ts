import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

const mocks = vi.hoisted(() => ({
  readScanHistory: vi.fn(),
  compareScanResults: vi.fn(),
  readScanSettings: vi.fn(),
  repositoryKey: vi.fn(),
  suppressedFingerprintsForRepository: vi.fn(),
  deleteScan: vi.fn()
}));

vi.mock("@/lib/scanHistory/store", () => ({
  readScanHistory: mocks.readScanHistory,
  compareScanResults: mocks.compareScanResults,
  deleteScan: mocks.deleteScan
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  repositoryKey: mocks.repositoryKey,
  suppressedFingerprintsForRepository: mocks.suppressedFingerprintsForRepository
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
  beforeEach(() => {
    delete process.env.SCAN_ADMIN_TOKEN;
    vi.clearAllMocks();
  });

  it("returns a saved scan with comparison against the previous repository scan", async () => {
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });
    mocks.repositoryKey.mockReturnValue("example/repo");
    mocks.suppressedFingerprintsForRepository.mockReturnValue([]);
    mocks.readScanHistory.mockResolvedValue([
      { savedAt: "2026-07-02T00:10:00.000Z", scan: currentScan },
      { savedAt: "2026-07-02T00:00:00.000Z", scan: previousScan }
    ]);
    mocks.compareScanResults.mockReturnValue({
      previousScanId: "scan_previous",
      comparisonSource: "previous",
      newFindings: currentScan.findings,
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings: []
    });

    const response = await GET(new Request("http://localhost/api/scans/scan_current"), {
      params: Promise.resolve({ scanId: "scan_current" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.history.savedAt).toBe("2026-07-02T00:10:00.000Z");
    expect(body.scan.id).toBe("scan_current");
    expect(body.comparison.previousScanId).toBe("scan_previous");
    expect(mocks.compareScanResults).toHaveBeenCalledWith(
      currentScan,
      {
        savedAt: "2026-07-02T00:00:00.000Z",
        scan: previousScan
      },
      expect.objectContaining({ comparisonSource: "previous", suppressedFingerprints: [] })
    );
  });

  it("uses the previous scan instead of a stored baseline", async () => {
    const baselineScan = { ...previousScan, id: "scan_baseline" };
    mocks.readScanSettings.mockResolvedValue({
      baselines: [{ repositoryKey: "example/repo", scanId: "scan_baseline", updatedAt: "2026-07-01T00:00:00.000Z" }],
      suppressions: [],
      rules: []
    });
    mocks.repositoryKey.mockReturnValue("example/repo");
    mocks.suppressedFingerprintsForRepository.mockReturnValue(["fp"]);
    mocks.readScanHistory.mockResolvedValue([
      { savedAt: "2026-07-02T00:10:00.000Z", scan: currentScan },
      { savedAt: "2026-07-02T00:00:00.000Z", scan: previousScan },
      { savedAt: "2026-07-01T00:00:00.000Z", scan: baselineScan }
    ]);
    mocks.compareScanResults.mockReturnValue({
      previousScanId: "scan_previous",
      comparisonSource: "previous",
      newFindings: [],
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings: currentScan.findings
    });

    const response = await GET(new Request("http://localhost/api/scans/scan_current"), {
      params: Promise.resolve({ scanId: "scan_current" })
    });

    expect(response.status).toBe(200);
    expect(mocks.compareScanResults).toHaveBeenCalledWith(
      currentScan,
      expect.objectContaining({ scan: previousScan }),
      expect.objectContaining({
        comparisonSource: "previous",
        suppressedFingerprints: ["fp"]
      })
    );
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

describe("DELETE /api/scans/[scanId]", () => {
  beforeEach(() => {
    delete process.env.SCAN_ADMIN_TOKEN;
    vi.clearAllMocks();
  });

  it("deletes a saved scan", async () => {
    mocks.deleteScan.mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost/api/scans/scan_current"), {
      params: Promise.resolve({ scanId: "scan_current" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mocks.deleteScan).toHaveBeenCalledWith("scan_current");
  });

  it("returns 404 when the scan id is not saved", async () => {
    mocks.deleteScan.mockResolvedValue(false);

    const response = await DELETE(new Request("http://localhost/api/scans/missing"), {
      params: Promise.resolve({ scanId: "missing" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Scan was not found.");
  });

  it("requires an admin bearer token before deleting a saved scan when configured", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await DELETE(new Request("http://localhost/api/scans/scan_current"), {
      params: Promise.resolve({ scanId: "scan_current" })
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Admin token is required.");
    expect(mocks.deleteScan).not.toHaveBeenCalled();
  });
});
