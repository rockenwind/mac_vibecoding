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
    const status = message.includes("GitHub rate limit") ? 429 : 400;
    return Response.json({ error: message }, { status });
  }
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
