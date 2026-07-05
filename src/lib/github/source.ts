import { shouldScanFile } from "@/lib/scanner/fileFilter";
import type { RepositoryFile, RepositoryRef, ScanWarning } from "@/lib/scanner/types";

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
  size?: number;
  url: string;
};

const GITHUB_JSON_HEADERS = { Accept: "application/vnd.github+json" };
const RATE_LIMIT_MESSAGE = "GitHub rate limit reached. Try again later.";
const REPOSITORY_NOT_FOUND_OR_PRIVATE_MESSAGE =
  "Repository was not found or private access requires GitHub App installation.";
const GITHUB_APP_PERMISSION_MESSAGE = "GitHub App permission was denied.";
const MAX_FILES_TO_FETCH = 200;

type FetchRepositoryFilesOptions = {
  accessToken?: string;
};

export async function fetchRepositoryFiles(
  repository: RepositoryRef,
  options: FetchRepositoryFilesOptions = {}
): Promise<{
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}> {
  const encodedOwner = encodeUrlSegment(repository.owner);
  const encodedName = encodeUrlSegment(repository.name);
  const repositoryApiUrl = `https://api.github.com/repos/${encodedOwner}/${encodedName}`;
  const jsonHeaders = githubJsonHeaders(options.accessToken);
  const metadataResponse = await fetch(repositoryApiUrl, {
    headers: jsonHeaders
  });

  await throwIfGitHubAccessFailed(metadataResponse, options.accessToken);

  if (!metadataResponse.ok) {
    throw new Error("GitHub repository metadata could not be fetched.");
  }

  const metadata = (await metadataResponse.json()) as { default_branch: string };
  const defaultBranch = metadata.default_branch;
  const treeResponse = await fetch(
    `${repositoryApiUrl}/git/trees/${encodeUrlSegment(defaultBranch)}?recursive=1`,
    { headers: jsonHeaders }
  );

  await throwIfGitHubAccessFailed(treeResponse, options.accessToken);

  if (!treeResponse.ok) {
    throw new Error("GitHub repository file tree could not be fetched.");
  }

  const treeBody = (await treeResponse.json()) as { tree: GitHubTreeItem[]; truncated?: boolean };
  const warnings: ScanWarning[] = treeBody.truncated
    ? [{ message: "GitHub returned a truncated file tree, so some files were not scanned." }]
    : [];

  const candidateFiles = treeBody.tree.filter((item) => {
    return item.type === "blob" && shouldScanFile({ path: item.path, size: item.size ?? 0 });
  });

  if (candidateFiles.length > MAX_FILES_TO_FETCH) {
    warnings.push({ message: "Only the first 200 matching files were scanned." });
  }

  const files: RepositoryFile[] = [];

  for (const item of candidateFiles.slice(0, MAX_FILES_TO_FETCH)) {
    const rawUrl = `https://raw.githubusercontent.com/${encodedOwner}/${encodedName}/${encodeUrlSegment(defaultBranch)}/${encodePathSegments(item.path)}`;
    const rawResponse = options.accessToken
      ? await fetch(rawUrl, { headers: { Authorization: `Bearer ${options.accessToken}` } })
      : await fetch(rawUrl);

    await throwIfGitHubAccessFailed(rawResponse, options.accessToken);

    if (!rawResponse.ok) {
      warnings.push({ message: `Could not fetch ${item.path}.` });
      continue;
    }

    const content = await rawResponse.text();
    files.push({
      path: item.path,
      content,
      size: item.size ?? content.length
    });
  }

  return {
    repository: {
      owner: repository.owner,
      name: repository.name,
      url: repository.url,
      defaultBranch
    },
    files,
    warnings
  };
}

async function throwIfGitHubAccessFailed(response: Response, accessToken?: string): Promise<void> {
  if (response.status === 429) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const message = await readGitHubErrorMessage(response);
    if (rateLimitRemaining === "0" || isRateLimitMessage(message)) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }
    throw new Error(accessToken ? GITHUB_APP_PERMISSION_MESSAGE : REPOSITORY_NOT_FOUND_OR_PRIVATE_MESSAGE);
  }

  if (response.status === 404) {
    throw new Error(accessToken ? GITHUB_APP_PERMISSION_MESSAGE : REPOSITORY_NOT_FOUND_OR_PRIVATE_MESSAGE);
  }
}

async function readGitHubErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : "";
  } catch {
    return "";
  }
}

function isRateLimitMessage(message: string): boolean {
  return /rate limit|secondary rate limit|abuse detection/i.test(message);
}

function githubJsonHeaders(accessToken?: string): HeadersInit {
  return accessToken
    ? { ...GITHUB_JSON_HEADERS, Authorization: `Bearer ${accessToken}` }
    : GITHUB_JSON_HEADERS;
}

function encodeUrlSegment(segment: string): string {
  return encodeURIComponent(segment);
}

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeUrlSegment).join("/");
}
