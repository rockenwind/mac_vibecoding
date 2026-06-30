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
const MAX_FILES_TO_FETCH = 200;

export async function fetchRepositoryFiles(repository: RepositoryRef): Promise<{
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}> {
  const encodedOwner = encodeUrlSegment(repository.owner);
  const encodedName = encodeUrlSegment(repository.name);
  const repositoryApiUrl = `https://api.github.com/repos/${encodedOwner}/${encodedName}`;
  const metadataResponse = await fetch(repositoryApiUrl, {
    headers: GITHUB_JSON_HEADERS
  });

  if (metadataResponse.status === 404) {
    throw new Error("Repository was not found or is not public.");
  }

  throwIfRateLimited(metadataResponse);

  if (!metadataResponse.ok) {
    throw new Error("GitHub repository metadata could not be fetched.");
  }

  const metadata = (await metadataResponse.json()) as { default_branch: string };
  const defaultBranch = metadata.default_branch;
  const treeResponse = await fetch(
    `${repositoryApiUrl}/git/trees/${encodeUrlSegment(defaultBranch)}?recursive=1`,
    { headers: GITHUB_JSON_HEADERS }
  );

  throwIfRateLimited(treeResponse);

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
    const rawResponse = await fetch(
      `https://raw.githubusercontent.com/${encodedOwner}/${encodedName}/${encodeUrlSegment(defaultBranch)}/${encodePathSegments(item.path)}`
    );

    throwIfRateLimited(rawResponse);

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

function throwIfRateLimited(response: Response): void {
  if (response.status === 403 || response.status === 429) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
}

function encodeUrlSegment(segment: string): string {
  return encodeURIComponent(segment);
}

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeUrlSegment).join("/");
}
