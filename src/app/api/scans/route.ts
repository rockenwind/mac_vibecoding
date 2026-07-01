import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import { fetchRepositoryFiles } from "@/lib/github/source";
import { runScan } from "@/lib/scanner/scan";
import type { ScanFocus } from "@/lib/scanner/types";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { repositoryUrl?: unknown; focus?: unknown };

    if (typeof body.repositoryUrl !== "string") {
      return Response.json({ error: "repositoryUrl must be a string." }, { status: 400 });
    }

    const repository = parseGitHubRepositoryUrl(body.repositoryUrl);
    const source = await fetchRepositoryFiles(repository);
    const scan = runScan({ ...source, focus: parseScanFocus(body.focus) });

    return Response.json({ scan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    const status = message.includes("GitHub rate limit") ? 429 : 400;
    return Response.json({ error: message }, { status });
  }
}

function parseScanFocus(value: unknown): ScanFocus | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.area !== "string" ||
    !Array.isArray(candidate.keywords) ||
    !Array.isArray(candidate.checklist)
  ) {
    return undefined;
  }

  return {
    area: candidate.area,
    keywords: candidate.keywords.filter((keyword): keyword is string => typeof keyword === "string"),
    checklist: candidate.checklist.filter((item): item is string => typeof item === "string")
  };
}
