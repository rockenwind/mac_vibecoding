import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  fetchRepositoryFiles: vi.fn(),
  readScanHistory: vi.fn(),
  recordScan: vi.fn(),
  findPreviousScan: vi.fn(),
  compareScanResults: vi.fn()
}));

vi.mock("@/lib/github/source", () => ({
  fetchRepositoryFiles: mocks.fetchRepositoryFiles
}));

vi.mock("@/lib/scanHistory/store", () => ({
  readScanHistory: mocks.readScanHistory,
  recordScan: mocks.recordScan,
  findPreviousScan: mocks.findPreviousScan,
  compareScanResults: mocks.compareScanResults
}));

describe("POST /api/scans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRepositoryFiles.mockResolvedValue({
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
    });
    mocks.readScanHistory.mockResolvedValue([]);
    mocks.recordScan.mockImplementation(async (scan) => ({ savedAt: "2026-07-02T00:00:00.000Z", scan }));
    mocks.findPreviousScan.mockReturnValue(null);
    mocks.compareScanResults.mockImplementation((scan) => ({
      previousScanId: null,
      newFindings: scan.findings,
      resolvedFindings: [],
      unchangedFindings: []
    }));
  });

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
    expect(body.history.savedAt).toBe("2026-07-02T00:00:00.000Z");
    expect(body.comparison.newFindings.length).toBeGreaterThan(0);
  });

  it("keeps repository scan results independent from job signal metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          focus: {
            area: "클라우드 권한과 비밀값 노출",
            keywords: ["클라우드 보안", "AWS", "IAM"],
            checklist: ["권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다."]
          }
        })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scan.focus).toBeUndefined();
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

  it("returns 400 for a non-string repository URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: 123 })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("repositoryUrl must be a string.");
  });

  it("returns 429 when GitHub rate limits the source adapter", async () => {
    mocks.fetchRepositoryFiles.mockRejectedValueOnce(
      new Error("GitHub rate limit reached. Try again later.")
    );

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("GitHub rate limit reached. Try again later.");
  });
});

describe("GET /api/scans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          findings: []
        }
      }
    ]);
  });

  it("returns recent scan history", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.history).toHaveLength(1);
    expect(body.history[0].scan.repository.name).toBe("repo");
  });
});
