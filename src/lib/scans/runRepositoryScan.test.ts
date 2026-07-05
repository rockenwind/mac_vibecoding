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
  baselineScanIdForRepository: vi.fn(),
  suppressedFingerprintsForRepository: vi.fn(),
  findScanById: vi.fn(),
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
  compareScanResults: mocks.compareScanResults,
  findScanById: mocks.findScanById
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  disabledRuleIds: mocks.disabledRuleIds,
  repositoryKey: mocks.repositoryKey,
  baselineScanIdForRepository: mocks.baselineScanIdForRepository,
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
    mocks.findScanById.mockReturnValue(null);
    mocks.compareScanResults.mockImplementation((scan) => ({
      previousScanId: null,
      baselineScanId: null,
      comparisonSource: "none",
      newFindings: scan.findings,
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings: []
    }));
    mocks.readScanSettings.mockResolvedValue({ baselines: [], suppressions: [], rules: [], schedules: [] });
    mocks.disabledRuleIds.mockReturnValue([]);
    mocks.repositoryKey.mockReturnValue("example/repo");
    mocks.baselineScanIdForRepository.mockReturnValue(null);
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
