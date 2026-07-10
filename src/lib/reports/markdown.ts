import type { Finding, FindingConfidence, ScanCheckStatus, ScanResult, Severity } from "@/lib/scanner/types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info"
};

const confidenceLabels: Record<FindingConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

const checkStatusLabels: Record<ScanCheckStatus, string> = {
  failed: "Failed",
  passed: "Passed",
  disabled: "Disabled"
};

type ReportOptions = {
  savedAt?: string;
};

export function buildScanMarkdown(scan: ScanResult, options: ReportOptions = {}): string {
  const lines = [
    `# Repository scan: ${scan.repository.owner}/${scan.repository.name}`,
    "",
    `- Scan ID: ${scan.id}`,
    ...(options.savedAt ? [`- Scanned at: ${options.savedAt}`] : []),
    `- Repository: ${scan.repository.url}`,
    `- Branch: ${scan.repository.defaultBranch}`,
    `- Findings: ${scan.findings.length}`,
    "",
    "## Severity summary",
    "",
    "| Severity | Count |",
    "| --- | ---: |",
    ...severities.map((severity) => `| ${severityLabels[severity]} | ${scan.summary[severity]} |`),
    ""
  ];

  if (scan.warnings.length) {
    lines.push("## Warnings", "");
    for (const warning of scan.warnings) {
      lines.push(`- ${warning.message}`);
    }
    lines.push("");
  }

  if (scan.checks?.length) {
    lines.push(
      "## Scan coverage",
      "",
      "| Status | Rule | Severity | Category | Findings | Description |",
      "| --- | --- | --- | --- | ---: | --- |",
      ...scan.checks.map(
        (check) =>
          `| ${checkStatusLabels[check.status]} | ${escapeTableCell(check.title)} | ${severityLabels[check.severity]} | ${check.category} | ${check.findingCount} | ${escapeTableCell(check.description)} |`
      ),
      ""
    );
  }

  lines.push("## Findings", "");

  if (!scan.findings.length) {
    lines.push("No findings were detected.", "");
    return `${lines.join("\n")}\n`;
  }

  scan.findings.forEach((finding, index) => {
    lines.push(
      `### ${finding.title}`,
      "",
      `- ID: ${finding.id}`,
      `- Rule: ${finding.ruleId}`,
      `- Severity: ${severityLabels[finding.severity]}`,
      `- Confidence: ${confidenceLabels[finding.confidence ?? "medium"]}`,
      `- Category: ${finding.category}`,
      `- Location: \`${formatLocation(finding)}\``,
      "",
      "**Evidence**",
      "",
      "```text",
      finding.evidence,
      "```",
      "",
      "**Why it matters**",
      "",
      finding.whyItMatters,
      "",
      "**Fix**",
      "",
      finding.fixSuggestion
    );

    if (index < scan.findings.length - 1) {
      lines.push("");
    }
  });

  return `${lines.join("\n")}\n`;
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function formatLocation(finding: Finding): string {
  if (finding.lineStart === undefined) {
    return finding.filePath;
  }

  if (finding.lineEnd !== undefined && finding.lineEnd !== finding.lineStart) {
    return `${finding.filePath}:${finding.lineStart}-${finding.lineEnd}`;
  }

  return `${finding.filePath}:${finding.lineStart}`;
}
