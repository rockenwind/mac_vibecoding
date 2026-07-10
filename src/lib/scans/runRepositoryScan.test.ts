import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRepositoryScan, scanErrorResponse } from "./runRepositoryScan";

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

describe("runRepositoryScan", () => {
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
      comparisonSource: "none",
      newFindings: scan.findings,
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings: []
    }));
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [], schedules: [] });
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

  it("runs a repository scan and returns saved history with comparison", async () => {
    await expect(
      runRepositoryScan({ repositoryUrl: "https://github.com/example/repo" })
    ).resolves.toMatchObject({
      scan: { repository: { owner: "example", name: "repo" } },
      history: { savedAt: "2026-07-02T00:00:00.000Z" },
      comparison: { comparisonSource: "none" }
    });
  });

  it("compares a new scan with the previous scan when a baseline is stored", async () => {
    const previousScan = {
      id: "scan_previous",
      repository: {
        owner: "example",
        name: "repo",
        url: "https://github.com/example/repo",
        defaultBranch: "main"
      },
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      warnings: [],
      findings: []
    };
    const previousEntry = { savedAt: "2026-07-01T00:00:00.000Z", scan: previousScan };

    mocks.readScanSettings.mockResolvedValue({
      baselines: [{ repositoryKey: "example/repo", scanId: "scan_baseline", updatedAt: "2026-07-01T00:00:00.000Z" }],
      suppressions: [],
      rules: [],
      schedules: []
    });
    mocks.readScanHistory.mockResolvedValue([previousEntry]);
    mocks.findPreviousScan.mockReturnValue(previousEntry);

    await runRepositoryScan({ repositoryUrl: "https://github.com/example/repo" });

    expect(mocks.compareScanResults).toHaveBeenCalledWith(
      expect.any(Object),
      previousEntry,
      expect.objectContaining({ comparisonSource: "previous" })
    );
  });

  it("uses a GitHub App token when installationId is present", async () => {
    await runRepositoryScan({ repositoryUrl: "https://github.com/example/repo", installationId: 123 });

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

  it("maps known scan errors to status and user action", () => {
    expect(scanErrorResponse("GitHub App permission was denied.")).toEqual({
      status: 403,
      action:
        "GitHub App 설치 권한과 Repository contents 읽기 권한을 확인하세요. / Check the GitHub App installation and Repository contents read permission."
    });
  });
});
