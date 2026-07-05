import type { Finding, ScanResult, Severity } from "@/lib/scanner/types";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info"
};

export function buildSecurityChecklist(scan: ScanResult): string {
  const lines = [
    `# Security checklist: ${scan.repository.owner}/${scan.repository.name}`,
    "",
    `- Scan ID: ${scan.id}`,
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
