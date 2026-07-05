import type { ScanComparison } from "@/lib/scanHistory/types";
import type { ScanResult, Severity } from "@/lib/scanner/types";
import type { ScanScheduleSetting } from "@/lib/scanSettings/types";

export type ScheduleNotification = {
  repositoryKey: string;
  scanId: string;
  newFindings: number;
  resolvedFindings: number;
  highestSeverity: Severity | null;
  message: string;
};

const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

export function buildScheduleNotifications(
  schedule: ScanScheduleSetting,
  scan: ScanResult,
  comparison: ScanComparison
): ScheduleNotification[] {
  const shouldNotifyNew = schedule.notifyOnNewFindings && comparison.newFindings.length > 0;
  const shouldNotifyResolved = schedule.notifyOnResolvedFindings && comparison.resolvedFindings.length > 0;

  if (!shouldNotifyNew && !shouldNotifyResolved) {
    return [];
  }

  return [
    {
      repositoryKey: schedule.repositoryKey,
      scanId: scan.id,
      newFindings: shouldNotifyNew ? comparison.newFindings.length : 0,
      resolvedFindings: shouldNotifyResolved ? comparison.resolvedFindings.length : 0,
      highestSeverity: highestSeverity([...comparison.newFindings, ...comparison.resolvedFindings]),
      message: buildMessage(
        shouldNotifyNew ? comparison.newFindings.length : 0,
        shouldNotifyResolved ? comparison.resolvedFindings.length : 0
      )
    }
  ];
}

function highestSeverity(findings: Array<{ severity: Severity }>): Severity | null {
  return (
    [...findings].sort(
      (left, right) => severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity)
    )[0]?.severity ?? null
  );
}

function buildMessage(newFindings: number, resolvedFindings: number): string {
  if (newFindings > 0 && resolvedFindings > 0) {
    return `새 취약점 ${newFindings}개, 해결된 취약점 ${resolvedFindings}개가 있습니다. / ${newFindings} new and ${resolvedFindings} resolved findings.`;
  }

  if (newFindings > 0) {
    return `새 취약점 ${newFindings}개가 발견되었습니다. / ${newFindings} new finding was detected.`;
  }

  return `취약점 ${resolvedFindings}개가 해결되었습니다. / ${resolvedFindings} finding was resolved.`;
}
