import { createInstallationAccessToken } from "@/lib/github/appClient";
import { createGitHubAppJwt } from "@/lib/github/appAuth";
import { readGitHubAppConfig } from "@/lib/github/appConfig";
import { fetchRepositoryFiles } from "@/lib/github/source";
import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import { runScan } from "@/lib/scanner/scan";
import type { ScanResult } from "@/lib/scanner/types";
import {
  compareScanResults,
  findPreviousScan,
  readScanHistory,
  recordScan
} from "@/lib/scanHistory/store";
import type { ScanComparison, ScanHistoryEntry } from "@/lib/scanHistory/types";
import {
  disabledRuleIds,
  readScanSettings,
  repositoryKey,
  suppressedFingerprintsForRepository
} from "@/lib/scanSettings/store";

export type RunRepositoryScanInput = {
  repositoryUrl: string;
  installationId?: number | string | null;
};

export async function runRepositoryScan(input: RunRepositoryScanInput): Promise<{
  scan: ScanResult;
  history: ScanHistoryEntry;
  comparison: ScanComparison;
}> {
  const repository = parseGitHubRepositoryUrl(input.repositoryUrl);
  const settings = await readScanSettings();
  const accessToken = await getInstallationAccessToken(input.installationId);
  const source = await fetchRepositoryFiles(repository, accessToken ? { accessToken } : undefined);
  const scan = runScan(source, { disabledRuleIds: disabledRuleIds(settings) });
  const existingHistory = await readScanHistory();
  const key = repositoryKey(scan.repository);
  const previousScan = findPreviousScan(scan, existingHistory);
  const history = await recordScan(scan);
  const comparison = compareScanResults(scan, previousScan, {
    comparisonSource: previousScan ? "previous" : "none",
    suppressedFingerprints: suppressedFingerprintsForRepository(settings, key)
  });

  return { scan, history, comparison };
}

export function scanErrorResponse(message: string): { status: number; action?: string } {
  if (message.includes("GitHub rate limit")) {
    return {
      status: 429,
      action: "잠시 후 다시 시도하세요. / Try again later."
    };
  }

  if (message === "Repository was not found or private access requires GitHub App installation.") {
    return {
      status: 404,
      action:
        "저장소 URL을 확인하거나 GitHub App 저장소 선택으로 다시 스캔하세요. / Check the repository URL or retry by selecting a GitHub App repository."
    };
  }

  if (message === "GitHub App permission was denied.") {
    return {
      status: 403,
      action:
        "GitHub App 설치 권한과 Repository contents 읽기 권한을 확인하세요. / Check the GitHub App installation and Repository contents read permission."
    };
  }

  if (message === "GitHub App is not configured.") {
    return {
      status: 503,
      action:
        "서버의 GitHub App 환경 변수를 설정한 뒤 다시 시도하세요. / Configure GitHub App environment variables and retry."
    };
  }

  return { status: 400 };
}

async function getInstallationAccessToken(installationId: unknown): Promise<string | null> {
  if (installationId === undefined || installationId === null || installationId === "") {
    return null;
  }

  const parsedInstallationId = Number(installationId);
  if (!Number.isInteger(parsedInstallationId) || parsedInstallationId <= 0) {
    throw new Error("installationId must be a positive number.");
  }

  const config = readGitHubAppConfig();
  if (!config.configured) {
    throw new Error("GitHub App is not configured.");
  }

  const jwt = createGitHubAppJwt(config);
  return createInstallationAccessToken(jwt, parsedInstallationId);
}
