import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import { fetchRepositoryFiles } from "@/lib/github/source";
import { runScan } from "@/lib/scanner/scan";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { repositoryUrl?: unknown };

    if (typeof body.repositoryUrl !== "string") {
      return Response.json({ error: "repositoryUrl must be a string." }, { status: 400 });
    }

    const repository = parseGitHubRepositoryUrl(body.repositoryUrl);
    const source = await fetchRepositoryFiles(repository);
    const scan = runScan(source);

    return Response.json({ scan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    const status = message.includes("GitHub rate limit") ? 429 : 400;
    return Response.json({ error: message }, { status });
  }
}
