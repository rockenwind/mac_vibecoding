import { analyzeFiles } from "./analyzers";
import { shouldScanFile } from "./fileFilter";
import type { RepositoryFile, RepositoryRef, ScanResult, ScanSummary, ScanWarning, Severity } from "./types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

export function runScan(input: {
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}): ScanResult {
  const selectedFiles = input.files.filter((file) =>
    shouldScanFile({ path: file.path, size: file.size })
  );
  const findings = analyzeFiles(selectedFiles);
  const summary = createEmptySummary();

  for (const finding of findings) {
    summary[finding.severity] += 1;
  }

  return {
    id: `scan_${Date.now().toString(36)}`,
    repository: input.repository,
    summary,
    findings,
    warnings: input.warnings
  };
}

function createEmptySummary(): ScanSummary {
  return Object.fromEntries(severities.map((severity) => [severity, 0])) as ScanSummary;
}
