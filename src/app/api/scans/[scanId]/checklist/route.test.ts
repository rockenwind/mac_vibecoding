import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  readScanHistory: vi.fn(),
  readScanSettings: vi.fn(),
  repositoryKey: vi.fn(),
  suppressedFingerprintsForRepository: vi.fn()
}));

vi.mock("@/lib/scanHistory/store", () => ({
  findingFingerprint: (finding: { ruleId: string; filePath: string; title: string; evidence: string }) =>
    [finding.ruleId, finding.filePath, finding.title, finding.evidence].join(":").toLowerCase(),
  readScanHistory: mocks.readScanHistory
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  repositoryKey: mocks.repositoryKey,
  suppressedFingerprintsForRepository: mocks.suppressedFingerprintsForRepository
}));

describe("GET /api/scans/[scanId]/checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });
    mocks.repositoryKey.mockReturnValue("example/repo");
    mocks.suppressedFingerprintsForRepository.mockReturnValue([]);
    mocks.readScanHistory.mockResolvedValue([
      {
        savedAt: "2026-07-02T00:00:00.000Z",
        scan: {
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
        }
      }
    ]);
  });

  it("returns a security checklist for a saved scan", async () => {
    const response = await GET(new Request("http://localhost/api/scans/scan_test/checklist"), {
      params: Promise.resolve({ scanId: "scan_test" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("Content-Disposition")).toContain("scan_test-checklist.md");
    expect(body).toContain("# Security checklist: example/repo");
    expect(body).toContain("- [ ] **Critical** Possible exposed credential");
  });

  it("excludes suppressed findings from the checklist", async () => {
    mocks.suppressedFingerprintsForRepository.mockReturnValue([
      "secret.exposed-token:.env:possible exposed credential:openai_api_key=sk-...redacted..."
    ]);

    const response = await GET(new Request("http://localhost/api/scans/scan_test/checklist"), {
      params: Promise.resolve({ scanId: "scan_test" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("| Critical | 0 |");
    expect(body).toContain("No checklist items are required.");
    expect(body).not.toContain("Possible exposed credential");
  });

  it("returns 404 when a scan is not saved", async () => {
    const response = await GET(new Request("http://localhost/api/scans/missing/checklist"), {
      params: Promise.resolve({ scanId: "missing" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Scan not found.");
  });
});
