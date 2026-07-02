import { createGitHubAppJwt } from "@/lib/github/appAuth";
import {
  GitHubAppApiError,
  createInstallationAccessToken,
  listInstallationRepositories
} from "@/lib/github/appClient";
import { readGitHubAppConfig } from "@/lib/github/appConfig";

export async function GET(request: Request): Promise<Response> {
  const installationId = parseInstallationId(new URL(request.url).searchParams.get("installationId"));

  if (!installationId) {
    return Response.json({ error: "installationId must be a positive number." }, { status: 400 });
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
    const repositories = await listInstallationRepositories(installationToken);
    return Response.json({ repositories });
  } catch (error) {
    return githubErrorResponse(error);
  }
}

function parseInstallationId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function githubErrorResponse(error: unknown): Response {
  if (error instanceof GitHubAppApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "GitHub App request failed.";
  return Response.json({ error: message }, { status: 500 });
}
