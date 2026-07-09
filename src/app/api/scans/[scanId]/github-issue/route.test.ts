import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  readScanHistory: vi.fn(),
  readGitHubAppConfig: vi.fn(),
  createGitHubAppJwt: vi.fn(),
  createInstallationAccessToken: vi.fn(),
  createGitHubIssue: vi.fn()
}));

vi.mock("@/lib/scanHistory/store", () => ({
  readScanHistory: mocks.readScanHistory
}));

vi.mock("@/lib/github/appConfig", () => ({
  readGitHubAppConfig: mocks.readGitHubAppConfig
}));

vi.mock("@/lib/github/appAuth", () => ({
  createGitHubAppJwt: mocks.createGitHubAppJwt
}));

vi.mock("@/lib/github/appClient", () => ({
  createInstallationAccessToken: mocks.createInstallationAccessToken,
  createGitHubIssue: mocks.createGitHubIssue
}));

describe("POST /api/scans/[scanId]/github-issue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCAN_ADMIN_TOKEN;
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
    mocks.readGitHubAppConfig.mockReturnValue({
      configured: true,
      appId: "12345",
      privateKey: "private-key",
      clientId: undefined
    });
    mocks.createGitHubAppJwt.mockReturnValue("jwt-token");
    mocks.createInstallationAccessToken.mockResolvedValue("installation-token");
    mocks.createGitHubIssue.mockResolvedValue({ url: "https://github.com/example/repo/issues/1" });
  });

  it("creates a GitHub Issue for a saved scan", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans/scan_test/github-issue", {
        method: "POST",
        body: JSON.stringify({ installationId: 123 })
      }),
      { params: Promise.resolve({ scanId: "scan_test" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.issue.url).toBe("https://github.com/example/repo/issues/1");
    expect(mocks.createGitHubIssue).toHaveBeenCalledWith(
      "installation-token",
      "example",
      "repo",
      expect.objectContaining({
        title: "Security scan report: example/repo",
        labels: ["security", "repository-scan"]
      })
    );
  });

  it("requires an admin bearer token before creating a GitHub Issue when configured", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await POST(
      new Request("http://localhost/api/scans/scan_test/github-issue", {
        method: "POST",
        body: JSON.stringify({ installationId: 123 })
      }),
      { params: Promise.resolve({ scanId: "scan_test" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Admin token is required.");
    expect(mocks.createGitHubIssue).not.toHaveBeenCalled();
  });

  it("accepts the configured admin bearer token before creating a GitHub Issue", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await POST(
      new Request("http://localhost/api/scans/scan_test/github-issue", {
        method: "POST",
        headers: { Authorization: "Bearer admin-token" },
        body: JSON.stringify({ installationId: 123 })
      }),
      { params: Promise.resolve({ scanId: "scan_test" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.createGitHubIssue).toHaveBeenCalled();
  });

  it("returns 404 when the scan is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans/missing/github-issue", {
        method: "POST",
        body: JSON.stringify({ installationId: 123 })
      }),
      { params: Promise.resolve({ scanId: "missing" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 when installationId is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans/scan_test/github-issue", {
        method: "POST",
        body: JSON.stringify({ installationId: "abc" })
      }),
      { params: Promise.resolve({ scanId: "scan_test" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("installationId must be a positive number.");
  });
});
