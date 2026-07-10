import type { Finding, ScanCheckStatus, ScanResult, Severity } from "@/lib/scanner/types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info"
};

const checkStatusLabels: Record<ScanCheckStatus, string> = {
  failed: "Failed",
  passed: "Passed",
  disabled: "Disabled"
};

const checkMarks: Record<ScanCheckStatus, " " | "x" | "-"> = {
  failed: " ",
  passed: "x",
  disabled: "-"
};

type ChecklistOptions = {
  savedAt?: string;
};

export function buildSecurityChecklist(scan: ScanResult, options: ChecklistOptions = {}): string {
  const lines = [
    `# Security checklist: ${scan.repository.owner}/${scan.repository.name}`,
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
      lines.push(`- [ ] Review scan warning: ${warning.message}`);
    }
    lines.push("");
  }

  if (scan.checks?.length) {
    lines.push("## Scan coverage", "");
    for (const check of scan.checks) {
      lines.push(
        `- [${checkMarks[check.status]}] **${checkStatusLabels[check.status]}** ${check.title}`,
        `  - Rule: ${check.ruleId}`,
        `  - Severity: ${severityLabels[check.severity]}`,
        `  - Category: ${check.category}`,
        `  - Findings: ${check.findingCount}`,
        `  - Description: ${check.description}`
      );
    }
    lines.push("");
  }

  lines.push("## Checklist", "");

  if (!scan.findings.length) {
    lines.push("No checklist items are required.", "");
    return `${lines.join("\n")}\n`;
  }

  scan.findings.forEach((finding, index) => {
    lines.push(
      `- [ ] **${severityLabels[finding.severity]}** ${finding.title}`,
      `  - Rule: ${finding.ruleId}`,
      `  - Location: \`${formatLocation(finding)}\``,
      "  - Evidence:",
      "    ```text",
      `    ${finding.evidence}`,
      "    ```",
      `  - Impact: ${finding.whyItMatters}`,
      `  - Required action: ${finding.fixSuggestion}`
    );

    if (index < scan.findings.length - 1) {
      lines.push("");
    }
  });

  return `${lines.join("\n")}\n`;
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
