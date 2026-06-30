import { shouldScanFile } from "@/lib/scanner/fileFilter";
import type { RepositoryFile, RepositoryRef, ScanWarning } from "@/lib/scanner/types";

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
  size?: number;
  url: string;
};

export async function fetchRepositoryFiles(repository: RepositoryRef): Promise<{
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}> {
  const metadataResponse = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.name}`, {
    headers: { Accept: "application/vnd.github+json" }
  });

  if (metadataResponse.status === 404) {
    throw new Error("Repository was not found or is not public.");
  }

  if (metadataResponse.status === 403) {
    throw new Error("GitHub rate limit reached. Try again later.");
  }

  if (!metadataResponse.ok) {
    throw new Error("GitHub repository metadata could not be fetched.");
  }

  const metadata = (await metadataResponse.json()) as { default_branch: string };
  const defaultBranch = metadata.default_branch;
  const treeResponse = await fetch(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${defaultBranch}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" } }
  );

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

  const files: RepositoryFile[] = [];

  for (const item of candidateFiles.slice(0, 200)) {
    const rawResponse = await fetch(
      `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${defaultBranch}/${item.path}`
    );

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
