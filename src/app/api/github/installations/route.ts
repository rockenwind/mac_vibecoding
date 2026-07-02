import { createGitHubAppJwt } from "@/lib/github/appAuth";
import { GitHubAppApiError, listGitHubAppInstallations } from "@/lib/github/appClient";
import { readGitHubAppConfig } from "@/lib/github/appConfig";

export async function GET(): Promise<Response> {
  const config = readGitHubAppConfig();

  if (!config.configured) {
    return Response.json(
      { error: "GitHub App is not configured.", missing: config.missing },
      { status: 503 }
    );
  }

  try {
    const jwt = createGitHubAppJwt(config);
    const installations = await listGitHubAppInstallations(jwt);
    return Response.json({ installations });
  } catch (error) {
    return githubErrorResponse(error);
  }
}

function githubErrorResponse(error: unknown): Response {
  if (error instanceof GitHubAppApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "GitHub App request failed.";
  return Response.json({ error: message }, { status: 500 });
}
