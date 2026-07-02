import { createGitHubAppJwt } from "@/lib/github/appAuth";
import {
  GitHubAppApiError,
  createGitHubIssue,
  createInstallationAccessToken
} from "@/lib/github/appClient";
import { readGitHubAppConfig } from "@/lib/github/appConfig";
import { buildScanMarkdown } from "@/lib/reports/markdown";
import { readScanHistory } from "@/lib/scanHistory/store";

type RouteContext = {
  params: Promise<{ scanId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { scanId } = await context.params;
  const body = (await request.json()) as { installationId?: unknown };
  const installationId = parseInstallationId(body.installationId);

  if (!installationId) {
    return Response.json({ error: "installationId must be a positive number." }, { status: 400 });
  }

  const history = await readScanHistory();
  const entry = history.find((candidate) => candidate.scan.id === scanId);

  if (!entry) {
    return Response.json({ error: "Scan not found." }, { status: 404 });
  }

  const config = readGitHubAppConfig();
  if (!config.configured) {
    return Response.json(
      { error: "GitHub App is not configured.", missing: config.missing },
      { status: 503 }
    );
  }

  try {
    const jwt = createGitHubAppJwt(config);
    const installationToken = await createInstallationAccessToken(jwt, installationId);
    const issue = await createGitHubIssue(
      installationToken,
      entry.scan.repository.owner,
      entry.scan.repository.name,
      {
        title: `Security scan report: ${entry.scan.repository.owner}/${entry.scan.repository.name}`,
        body: buildScanMarkdown(entry.scan),
        labels: ["security", "repository-scan"]
      }
    );

    return Response.json({ issue });
  } catch (error) {
    if (error instanceof GitHubAppApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "GitHub Issue could not be created.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseInstallationId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
