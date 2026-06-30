import type { RepositoryRef } from "@/lib/scanner/types";

export function parseGitHubRepositoryUrl(input: string): RepositoryRef {
  let parsed: URL;

  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  if (parsed.hostname !== "github.com") {
    throw new Error("Only github.com repositories are supported.");
  }

  const parts = parsed.pathname
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo.");
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/, "");

  if (!owner || !name) {
    throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo.");
  }

  return {
    owner,
    name,
    url: `https://github.com/${owner}/${name}`
  };
}
