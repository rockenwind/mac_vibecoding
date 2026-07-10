import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  fetchRepositoryFiles: vi.fn(),
  readScanHistory: vi.fn(),
  recordScan: vi.fn(),
  findPreviousScan: vi.fn(),
  compareScanResults: vi.fn(),
  readScanSettings: vi.fn(),
  disabledRuleIds: vi.fn(),
  repositoryKey: vi.fn(),
  suppressedFingerprintsForRepository: vi.fn(),
  readGitHubAppConfig: vi.fn(),
  createGitHubAppJwt: vi.fn(),
  createInstallationAccessToken: vi.fn()
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

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  disabledRuleIds: mocks.disabledRuleIds,
  repositoryKey: mocks.repositoryKey,
  suppressedFingerprintsForRepository: mocks.suppressedFingerprintsForRepository
}));

vi.mock("@/lib/github/appConfig", () => ({
  readGitHubAppConfig: mocks.readGitHubAppConfig
}));

vi.mock("@/lib/github/appAuth", () => ({
  createGitHubAppJwt: mocks.createGitHubAppJwt
}));

vi.mock("@/lib/github/appClient", () => ({
  createInstallationAccessToken: mocks.createInstallationAccessToken
}));

describe("POST /api/scans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCAN_ADMIN_TOKEN;
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
      comparisonSource: "none",
      newFindings: scan.findings,
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings: []
    }));
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [] });
    mocks.disabledRuleIds.mockReturnValue([]);
    mocks.repositoryKey.mockReturnValue("example/repo");
    mocks.suppressedFingerprintsForRepository.mockReturnValue([]);
    mocks.readGitHubAppConfig.mockReturnValue({
      configured: true,
      appId: "12345",
      privateKey: "private-key",
      clientId: undefined
    });
    mocks.createGitHubAppJwt.mockReturnValue("jwt-token");
    mocks.createInstallationAccessToken.mockResolvedValue("installation-token");
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

  it("requires an admin bearer token before running a scan when configured", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Admin token is required.");
    expect(mocks.fetchRepositoryFiles).not.toHaveBeenCalled();
  });

  it("accepts the configured admin bearer token before running a scan", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        headers: { Authorization: "Bearer admin-token" },
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchRepositoryFiles).toHaveBeenCalled();
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

  it("uses a GitHub App installation token when installationId is provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          installationId: 123
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.createInstallationAccessToken).toHaveBeenCalledWith("jwt-token", 123);
    expect(mocks.fetchRepositoryFiles).toHaveBeenCalledWith(
      {
        owner: "example",
        name: "repo",
        url: "https://github.com/example/repo"
      },
      { accessToken: "installation-token" }
    );
  });

  it("applies rule settings and previous scan comparison when scanning", async () => {
    mocks.disabledRuleIds.mockReturnValue(["secret.exposed-token"]);
    mocks.findPreviousScan.mockReturnValue({
      savedAt: "2026-07-01T00:00:00.000Z",
      scan: { id: "scan_previous", repository: { owner: "example", name: "repo", url: "", defaultBranch: "main" }, summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, warnings: [], findings: [] }
    });

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.disabledRuleIds).toHaveBeenCalled();
    expect(mocks.compareScanResults).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scan: expect.objectContaining({ id: "scan_previous" }) }),
      expect.objectContaining({
        comparisonSource: "previous",
        suppressedFingerprints: []
      })
    );
  });

  it("returns 400 for an invalid installationId", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          installationId: "abc"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("installationId must be a positive number.");
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

  it("returns 404 with action when a repository is missing or private access needs GitHub App installation", async () => {
    mocks.fetchRepositoryFiles.mockRejectedValueOnce(
      new Error("Repository was not found or private access requires GitHub App installation.")
    );

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/private-repo" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Repository was not found or private access requires GitHub App installation.");
    expect(body.action).toBe("저장소 URL을 확인하거나 GitHub App 저장소 선택으로 다시 스캔하세요. / Check the repository URL or retry by selecting a GitHub App repository.");
  });

  it("returns 403 with action when GitHub App permission is denied", async () => {
    mocks.fetchRepositoryFiles.mockRejectedValueOnce(new Error("GitHub App permission was denied."));

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/private-repo", installationId: 123 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("GitHub App permission was denied.");
    expect(body.action).toBe("GitHub App 설치 권한과 Repository contents 읽기 권한을 확인하세요. / Check the GitHub App installation and Repository contents read permission.");
  });

  it("returns 503 with action when GitHub App is not configured for private scans", async () => {
    mocks.readGitHubAppConfig.mockReturnValue({
      configured: false,
      missing: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY"]
    });

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/private-repo", installationId: 123 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("GitHub App is not configured.");
    expect(body.action).toBe("서버의 GitHub App 환경 변수를 설정한 뒤 다시 시도하세요. / Configure GitHub App environment variables and retry.");
  });
});

describe("GET /api/scans", () => {
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
  });

  it("returns recent scan history", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.history).toHaveLength(1);
    expect(body.history[0].scan.repository.name).toBe("repo");
  });
});
