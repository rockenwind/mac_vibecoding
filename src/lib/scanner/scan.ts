import { analyzeFiles, listAnalyzerRules } from "./analyzers";
import { shouldScanFile } from "./fileFilter";
import type {
  Finding,
  RepositoryFile,
  RepositoryRef,
  ScanCheckResult,
  ScanResult,
  ScanSummary,
  ScanWarning,
  Severity
} from "./types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

export function runScan(input: {
  repository: Required<RepositoryRef>;
  files: RepositoryFile[];
  warnings: ScanWarning[];
}, options: { disabledRuleIds?: string[] } = {}): ScanResult {
  const selectedFiles = input.files.filter((file) =>
    shouldScanFile({ path: file.path, size: file.size })
  );
  const findings = analyzeFiles(selectedFiles, { disabledRuleIds: options.disabledRuleIds });
  const summary = createEmptySummary();

  for (const finding of findings) {
    summary[finding.severity] += 1;
  }

  const checks = createCheckResults(findings, options.disabledRuleIds ?? []);

  return {
    id: `scan_${Date.now().toString(36)}`,
    repository: input.repository,
    summary,
    findings,
    checks,
    warnings: input.warnings
  };
}

function createEmptySummary(): ScanSummary {
  return Object.fromEntries(severities.map((severity) => [severity, 0])) as ScanSummary;
}

function createCheckResults(findings: Finding[], disabledRuleIds: string[]): ScanCheckResult[] {
  const disabledRules = new Set(disabledRuleIds);
  const countsByRule = findings.reduce<Map<string, number>>((counts, finding) => {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
    return counts;
  }, new Map());

  return listAnalyzerRules().map((rule) => {
    const findingCount = countsByRule.get(rule.ruleId) ?? 0;
    const isDisabled = disabledRules.has(rule.ruleId);

    return {
      ...rule,
      findingCount,
      status: isDisabled ? "disabled" : findingCount > 0 ? "failed" : "passed"
    };
  });
}
