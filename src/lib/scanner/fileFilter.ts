const MAX_FILE_SIZE_BYTES = 200_000;

const excludedSegments = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules"
]);

const excludedFileNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "go.sum",
  "Cargo.lock"
]);

const includedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".java",
  ".cs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".ini",
  ".prompt",
  ".md"
]);

const aiPathHints = ["prompt", "agent", "mcp", "tool", "openai", "anthropic", "llm"];

export function shouldScanFile(file: { path: string; size: number }): boolean {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return false;
  }

  const normalized = file.path.replaceAll("\\", "/");
  const segments = normalized.split("/");

  if (segments.some((segment) => excludedSegments.has(segment))) {
    return false;
  }

  const fileName = segments.at(-1) ?? "";
  if (excludedFileNames.has(fileName)) {
    return false;
  }

  const lowerPath = normalized.toLowerCase();
  if (aiPathHints.some((hint) => lowerPath.includes(hint))) {
    return true;
  }

  return [...includedExtensions].some((extension) => lowerPath.endsWith(extension));
}
