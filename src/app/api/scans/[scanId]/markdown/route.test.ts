import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  readScanHistory: vi.fn()
}));

vi.mock("@/lib/scanHistory/store", () => ({
  readScanHistory: mocks.readScanHistory
}));

describe("GET /api/scans/[scanId]/markdown", () => {
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

  it("returns a Markdown report for a saved scan", async () => {
    const response = await GET(new Request("http://localhost/api/scans/scan_test/markdown"), {
      params: Promise.resolve({ scanId: "scan_test" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("Content-Disposition")).toContain("scan_test.md");
    expect(body).toContain("# Repository scan: example/repo");
  });

  it("returns 404 when a scan is not saved", async () => {
    const response = await GET(new Request("http://localhost/api/scans/missing/markdown"), {
      params: Promise.resolve({ scanId: "missing" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Scan not found.");
  });
});
