import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import { fetchRepositoryFiles } from "@/lib/github/source";
import { createGitHubAppJwt } from "@/lib/github/appAuth";
import { createInstallationAccessToken } from "@/lib/github/appClient";
import { readGitHubAppConfig } from "@/lib/github/appConfig";
import { runScan } from "@/lib/scanner/scan";
import {
  compareScanResults,
  findScanById,
  findPreviousScan,
  readScanHistory,
  recordScan
} from "@/lib/scanHistory/store";
import {
  baselineScanIdForRepository,
  disabledRuleIds,
  readScanSettings,
  repositoryKey,
  suppressedFingerprintsForRepository
} from "@/lib/scanSettings/store";

export async function GET(): Promise<Response> {
  try {
    const history = await readScanHistory();
    return Response.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read scan history.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { repositoryUrl?: unknown; installationId?: unknown };

    if (typeof body.repositoryUrl !== "string") {
      return Response.json({ error: "repositoryUrl must be a string." }, { status: 400 });
    }

    const repository = parseGitHubRepositoryUrl(body.repositoryUrl);
    const settings = await readScanSettings();
    const accessToken = await getInstallationAccessToken(body.installationId);
    const source = await fetchRepositoryFiles(
      repository,
      accessToken ? { accessToken } : undefined
    );
    const scan = runScan(source, { disabledRuleIds: disabledRuleIds(settings) });
    const existingHistory = await readScanHistory();
    const key = repositoryKey(scan.repository);
    const baselineScanId = baselineScanIdForRepository(settings, key);
    const baselineScanCandidate = findScanById(baselineScanId, existingHistory);
    const baselineScan =
      baselineScanCandidate && repositoryKey(baselineScanCandidate.scan.repository) === key
        ? baselineScanCandidate
        : null;
    const previousScan = baselineScan ?? findPreviousScan(scan, existingHistory);
    const history = await recordScan(scan);
    const comparison = compareScanResults(scan, previousScan, {
      baselineScanId,
      comparisonSource: baselineScan ? "baseline" : previousScan ? "previous" : "none",
      suppressedFingerprints: suppressedFingerprintsForRepository(settings, key)
    });

    return Response.json({ scan, history, comparison });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    const { status, action } = scanErrorResponse(message);
    return Response.json({ error: message, ...(action ? { action } : {}) }, { status });
  }
}

function scanErrorResponse(message: string): { status: number; action?: string } {
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
