"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  Finding,
  FindingConfidence,
  ScanCheckResult,
  ScanCheckStatus,
  ScanResult,
  ScanSummary,
  Severity
} from "@/lib/scanner/types";
import type { ScanComparison, ScanHistoryEntry } from "@/lib/scanHistory/types";
import { findingFingerprint } from "@/lib/scanHistory/fingerprint";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info"
};

const severityPriorityLabels: Record<Severity, string> = {
  critical: "즉시 조치 필요",
  high: "우선 검토 필요",
  medium: "계획 조치 필요",
  low: "정기 개선 대상",
  info: "참고 정보"
};

const severityImpactLabels: Record<Severity, string> = {
  critical: "서비스 권한 탈취, 비밀값 유출, 원격 코드 실행으로 이어질 수 있는 최고 위험입니다.",
  high: "공격자가 권한 상승이나 임의 실행 경로를 만들 수 있어 빠른 검토가 필요합니다.",
  medium: "조건이 맞으면 보안 사고로 확장될 수 있어 계획된 수정이 필요합니다.",
  low: "직접적인 악용 가능성은 낮지만 보안 품질 개선이 필요합니다.",
  info: "즉시 위험은 낮지만 추적하면 좋은 보안 참고 항목입니다."
};

const confidenceLabels: Record<FindingConfidence, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음"
};

const categoryLabels: Record<Finding["category"], string> = {
  secret: "비밀값 노출",
  "agent-tooling": "에이전트 도구 권한",
  "prompt-injection": "프롬프트 주입",
  mcp: "MCP 설정 위험",
  "dangerous-execution": "위험한 명령 실행"
};

const checkStatusLabels: Record<ScanCheckStatus, string> = {
  failed: "발견 / Findings",
  passed: "통과 / Passed",
  disabled: "비활성 / Disabled"
};

const adminTokenStorageKey = "repositoryScanAdminToken";

type ScanResponse = {
  scan?: ScanResult;
  history?: ScanHistoryEntry;
  comparison?: ScanComparison;
  error?: string;
  action?: string;
};

type SavedScanResponse = ScanResponse;

type ScanHistoryResponse = {
  history?: ScanHistoryEntry[];
  error?: string;
};

type DeleteScanResponse = {
  deleted?: boolean;
  error?: string;
};

type ScanSettings = {
  baselines: Array<{ repositoryKey: string; scanId: string; updatedAt: string }>;
  suppressions: Array<{ repositoryKey: string; fingerprint: string; reason?: string; createdAt: string }>;
  rules: Array<{ ruleId: string; enabled: boolean; updatedAt: string }>;
};

type AnalyzerRule = {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Finding["category"];
  description: string;
};

type ScanSettingsResponse = {
  settings?: ScanSettings;
  rules?: AnalyzerRule[];
  error?: string;
};

type ScanSchedule = {
  repositoryKey: string;
  repositoryUrl: string;
  installationId?: number;
  enabled: boolean;
  intervalDays: number;
  nextRunAt: string;
  lastRunAt?: string;
  lastScanId?: string;
  notifyOnNewFindings: boolean;
  notifyOnResolvedFindings: boolean;
  createdAt: string;
  updatedAt: string;
};

type ScanSchedulesResponse = {
  schedules?: ScanSchedule[];
  error?: string;
};

type ScheduleRunResult = {
  repositoryKey: string;
  status: "success" | "failed";
  scanId?: string;
  savedAt?: string;
  nextRunAt?: string;
  error?: string;
  action?: string;
  notifications?: Array<{
    repositoryKey: string;
    scanId: string;
    newFindings: number;
    resolvedFindings: number;
    highestSeverity: Severity | null;
    message: string;
  }>;
};

type ScheduleRunResponse = {
  ranAt?: string;
  results?: ScheduleRunResult[];
  error?: string;
};

type GitHubInstallation = {
  id: number;
  account: string;
  repositories: number;
  repositorySelection: string;
  targetType: string;
};

type GitHubInstallationsResponse = {
  installations?: GitHubInstallation[];
  error?: string;
};

type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
};

type GitHubRepositoriesResponse = {
  repositories?: GitHubRepository[];
  error?: string;
};

function formatLocation(filePath: string, lineStart?: number, lineEnd?: number): string {
  if (lineStart === undefined) {
    return filePath;
  }

  if (lineEnd !== undefined && lineEnd !== lineStart) {
    return `${filePath}:${lineStart}-${lineEnd}`;
  }

  return `${filePath}:${lineStart}`;
}

function confidenceLabel(finding: Finding): string {
  return confidenceLabels[finding.confidence ?? "medium"];
}

function repositoryKeyForScan(scan: ScanResult): string {
  return `${scan.repository.owner}/${scan.repository.name}`;
}

function summarizeFindings(summary: ScanSummary, findings: Finding[]): string {
  if (summary.critical > 0) {
    return `Critical ${summary.critical}개가 발견되어 즉시 조치가 필요합니다.`;
  }

  if (summary.high > 0) {
    return `High ${summary.high}개가 발견되어 우선 검토가 필요합니다.`;
  }

  if (findings.length > 0) {
    return `${findings.length}개 발견 항목을 계획적으로 검토하세요.`;
  }

  return "현재 스캔 범위에서는 조치가 필요한 보안 위험이 발견되지 않았습니다.";
}

function summarizeVisibleFindings(findings: Finding[]): ScanSummary {
  return findings.reduce<ScanSummary>(
    (summary, finding) => ({
      ...summary,
      [finding.severity]: summary[finding.severity] + 1
    }),
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );
}

function scanRuleSettingsById(settings: ScanSettings): Map<string, boolean> {
  return new Map(settings.rules.map((rule) => [rule.ruleId, rule.enabled]));
}

function buildFallbackChecks(
  rules: AnalyzerRule[],
  findings: Finding[],
  settings: ScanSettings
): ScanCheckResult[] {
  const ruleSettings = scanRuleSettingsById(settings);
  const countsByRule = findings.reduce<Map<string, number>>((counts, finding) => {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
    return counts;
  }, new Map());

  return rules.map((rule) => {
    const findingCount = countsByRule.get(rule.ruleId) ?? 0;
    const isDisabled = ruleSettings.get(rule.ruleId) === false;

    return {
      ...rule,
      findingCount,
      status: isDisabled ? "disabled" : findingCount > 0 ? "failed" : "passed"
    };
  });
}

function highestRiskFinding(findings: Finding[]): Finding | undefined {
  const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];
  return [...findings].sort((first, second) => {
    return severityOrder.indexOf(first.severity) - severityOrder.indexOf(second.severity);
  })[0];
}

function readStoredAdminToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(adminTokenStorageKey) ?? "";
}

export default function Home() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [comparison, setComparison] = useState<ScanComparison | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [savedScanError, setSavedScanError] = useState<string | null>(null);
  const [deleteScanError, setDeleteScanError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [selectedSavedAt, setSelectedSavedAt] = useState<string | null>(null);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingSavedScanId, setIsLoadingSavedScanId] = useState<string | null>(null);
  const [isDeletingScanId, setIsDeletingScanId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState("");
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepositoryUrl, setSelectedRepositoryUrl] = useState("");
  const [githubStatus, setGithubStatus] = useState<string | null>(null);
  const [repositoryStatus, setRepositoryStatus] = useState<string | null>(null);
  const [isLoadingInstallations, setIsLoadingInstallations] = useState(false);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [scanSettings, setScanSettings] = useState<ScanSettings>({ baselines: [], suppressions: [], rules: [] });
  const [analyzerRules, setAnalyzerRules] = useState<AnalyzerRule[]>([]);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [historyRepositoryFilter, setHistoryRepositoryFilter] = useState("");
  const [historyResultFilter, setHistoryResultFilter] = useState("all");
  const [scanProgress, setScanProgress] = useState<string | null>(null);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [scheduledScans, setScheduledScans] = useState<ScanSchedule[]>([]);
  const [scheduleIntervalDays, setScheduleIntervalDays] = useState("7");
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleRunResults, setScheduleRunResults] = useState<ScheduleRunResult[]>([]);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isRunningSchedules, setIsRunningSchedules] = useState(false);
  const [adminToken, setAdminToken] = useState(readStoredAdminToken);

  const suppressedFingerprints = useMemo(
    () => new Set((comparison?.suppressedFindings ?? []).map((finding) => findingFingerprint(finding))),
    [comparison]
  );
  const visibleFindings = useMemo(
    () => (scan?.findings ?? []).filter((finding) => !suppressedFingerprints.has(findingFingerprint(finding))),
    [scan, suppressedFingerprints]
  );
  const visibleSummary = useMemo(() => summarizeVisibleFindings(visibleFindings), [visibleFindings]);
  const scanChecks = useMemo(
    () => (scan ? scan.checks ?? buildFallbackChecks(analyzerRules, scan.findings, scanSettings) : []),
    [analyzerRules, scan, scanSettings]
  );
  const hasFindings = Boolean(visibleFindings.length);
  const findingCount = visibleFindings.length;
  const reportJson = useMemo(() => (scan ? JSON.stringify(scan, null, 2) : ""), [scan]);
  const filteredHistory = useMemo(
    () =>
      scanHistory.filter((entry) => {
        const repositoryKey = repositoryKeyForScan(entry.scan).toLowerCase();
        const query = historyRepositoryFilter.trim().toLowerCase();
        const matchesRepository = !query || repositoryKey.includes(query) || entry.scan.id.toLowerCase().includes(query);
        const isBaseline = scanSettings.baselines.some(
          (baseline) => baseline.repositoryKey === repositoryKeyForScan(entry.scan) && baseline.scanId === entry.scan.id
        );
        const matchesResult =
          historyResultFilter === "all" ||
          (historyResultFilter === "with-findings" && entry.scan.findings.length > 0) ||
          (historyResultFilter === "clean" && entry.scan.findings.length === 0) ||
          (historyResultFilter === "baseline" && isBaseline);

        return matchesRepository && matchesResult;
      }),
    [historyRepositoryFilter, historyResultFilter, scanHistory, scanSettings.baselines]
  );
  const recentHistory = filteredHistory.slice(0, 10);
  const comparedScanSavedAt = useMemo(() => {
    if (!comparison?.previousScanId) {
      return null;
    }
    return scanHistory.find((entry) => entry.scan.id === comparison.previousScanId)?.savedAt ?? "unknown";
  }, [comparison?.previousScanId, scanHistory]);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const response = await fetch("/api/scans");
        const data = (await response.json()) as ScanHistoryResponse;
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load scan history.");
        }
        if (isMounted) {
          setScanHistory(data.history ?? []);
          setHistoryError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          const message = loadError instanceof Error ? loadError.message : "Could not load scan history.";
          setHistoryError(message);
        }
      }
    }

    async function loadInstallations() {
      setIsLoadingInstallations(true);
      try {
        const response = await fetch("/api/github/installations");
        const data = (await response.json()) as GitHubInstallationsResponse;
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load GitHub App installations.");
        }
        if (isMounted) {
          const loadedInstallations = data.installations ?? [];
          setInstallations(loadedInstallations);
          setGithubStatus(loadedInstallations.length ? null : "No GitHub App installations found.");
        }
      } catch (loadError) {
        if (isMounted) {
          const message =
            loadError instanceof Error ? loadError.message : "Could not load GitHub App installations.";
          setGithubStatus(message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingInstallations(false);
        }
      }
    }

    async function loadSettings() {
      try {
        const response = await fetch("/api/scans/settings");
        const data = (await response.json()) as ScanSettingsResponse;
        if (!response.ok || !data.settings) {
          throw new Error(data.error ?? "Could not load scan settings.");
        }
        if (isMounted) {
          setScanSettings(data.settings);
          setAnalyzerRules(data.rules ?? []);
          setSettingsError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          const message = loadError instanceof Error ? loadError.message : "Could not load scan settings.";
          setSettingsError(message);
        }
      }
    }

    async function loadSchedules() {
      try {
        const response = await fetch("/api/scans/schedules");
        const data = (await response.json()) as ScanSchedulesResponse;
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load scheduled scans.");
        }
        if (isMounted) {
          setScheduledScans(data.schedules ?? []);
          setScheduleError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          const message = loadError instanceof Error ? loadError.message : "Could not load scheduled scans.";
          setScheduleError(message);
        }
      }
    }

    void loadHistory();
    void loadInstallations();
    void loadSettings();
    void loadSchedules();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadRepositories(nextInstallationId: string) {
    setRepositoryStatus(null);
    setIsLoadingRepositories(true);

    try {
      const response = await fetch(
        `/api/github/repositories?installationId=${encodeURIComponent(nextInstallationId)}`
      );
      const data = (await response.json()) as GitHubRepositoriesResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load GitHub App repositories.");
      }

      const loadedRepositories = data.repositories ?? [];
      setRepositories(loadedRepositories);
      setRepositoryStatus(loadedRepositories.length ? null : "No repositories are available for this installation.");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load GitHub App repositories.";
      setRepositories([]);
      setRepositoryStatus(message);
    } finally {
      setIsLoadingRepositories(false);
    }
  }

  function handleInstallationSelect(nextInstallationId: string) {
    setSelectedInstallationId(nextInstallationId);
    setInstallationId(nextInstallationId);
    setSelectedRepositoryUrl("");
    setRepositories([]);
    setRepositoryStatus(null);

    if (nextInstallationId) {
      void loadRepositories(nextInstallationId);
    }
  }

  function handleRepositorySelect(nextRepositoryUrl: string) {
    setSelectedRepositoryUrl(nextRepositoryUrl);

    const repository = repositories.find((candidate) => candidate.url === nextRepositoryUrl);
    if (repository) {
      setRepositoryUrl(repository.url);
    }
  }

  function handleAdminTokenChange(nextToken: string) {
    setAdminToken(nextToken);

    if (nextToken.trim()) {
      window.localStorage.setItem(adminTokenStorageKey, nextToken);
    } else {
      window.localStorage.removeItem(adminTokenStorageKey);
    }
  }

  function protectedHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
    const headers = { ...extraHeaders } as Record<string, string>;
    const token = adminToken.trim();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async function updateScanSettings(payload: Record<string, unknown>) {
    setIsUpdatingSettings(true);
    setSettingsError(null);
    try {
      const response = await fetch("/api/scans/settings", {
        method: "PATCH",
        headers: protectedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as ScanSettingsResponse;
      if (!response.ok || !data.settings) {
        throw new Error(data.error ?? "Scan settings could not be updated.");
      }
      setScanSettings(data.settings);
      setAnalyzerRules(data.rules ?? analyzerRules);
      return data.settings;
    } catch (settingsUpdateError) {
      const message =
        settingsUpdateError instanceof Error ? settingsUpdateError.message : "Scan settings could not be updated.";
      setSettingsError(message);
      return null;
    } finally {
      setIsUpdatingSettings(false);
    }
  }

  async function handleSetBaseline(scanId: string, repositoryKey: string) {
    await updateScanSettings({ action: "setBaseline", repositoryKey, scanId });
  }

  async function handleRuleToggle(ruleId: string, enabled: boolean) {
    await updateScanSettings({ action: "setRuleEnabled", ruleId, enabled });
  }

  async function handleSuppressFinding(finding: Finding) {
    if (!scan) {
      return;
    }

    const settings = await updateScanSettings({
      action: "suppressFinding",
      repositoryKey: repositoryKeyForScan(scan),
      fingerprint: findingFingerprint(finding),
      reason: "사용자가 오탐으로 처리"
    });

    if (settings) {
      setComparison((current) =>
        current
          ? {
              ...current,
              newFindings: current.newFindings.filter(
                (candidate) => findingFingerprint(candidate) !== findingFingerprint(finding)
              ),
              unchangedFindings: current.unchangedFindings.filter(
                (candidate) => findingFingerprint(candidate) !== findingFingerprint(finding)
              ),
              suppressedFindings: [...(current.suppressedFindings ?? []), finding]
            }
          : current
      );
    }
  }

  async function handleUnsuppressFinding(finding: Finding) {
    if (!scan) {
      return;
    }

    const currentScanId = scan.id;
    const settings = await updateScanSettings({
      action: "unsuppressFinding",
      repositoryKey: repositoryKeyForScan(scan),
      fingerprint: findingFingerprint(finding)
    });

    if (settings) {
      try {
        await refreshCurrentScan(currentScanId);
      } catch (refreshError) {
        const message = refreshError instanceof Error ? refreshError.message : "Scan could not be refreshed.";
        setSettingsError(message);
      }
    }
  }

  async function refreshCurrentScan(scanId: string) {
    const response = await fetch(`/api/scans/${encodeURIComponent(scanId)}`);
    const data = (await response.json()) as SavedScanResponse;

    if (!response.ok || !data.scan) {
      throw new Error(data.error ?? "Scan could not be refreshed.");
    }

    setScan(data.scan);
    setComparison(data.comparison ?? null);
  }

  async function handleSaveSchedule() {
    setScheduleError(null);
    setScheduleStatus(null);
    setIsUpdatingSchedule(true);

    try {
      const intervalDays = Number(scheduleIntervalDays);
      const nextRunAt = new Date();
      nextRunAt.setUTCDate(nextRunAt.getUTCDate() + intervalDays);
      const response = await fetch("/api/scans/schedules", {
        method: "POST",
        headers: protectedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          repositoryUrl,
          ...(installationId.trim() ? { installationId: Number(installationId) } : {}),
          enabled: true,
          intervalDays,
          nextRunAt: nextRunAt.toISOString(),
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true
        })
      });
      const data = (await response.json()) as ScanSchedulesResponse;
      if (!response.ok || !data.schedules) {
        throw new Error(data.error ?? "Scheduled scan could not be saved.");
      }
      setScheduledScans(data.schedules);
      setScheduleStatus("예약이 저장되었습니다. / Schedule saved.");
    } catch (scheduleSaveError) {
      const message =
        scheduleSaveError instanceof Error ? scheduleSaveError.message : "Scheduled scan could not be saved.";
      setScheduleError(message);
    } finally {
      setIsUpdatingSchedule(false);
    }
  }

  async function handleDeleteSchedule(repositoryKey: string) {
    setScheduleError(null);
    setScheduleStatus(null);
    setIsUpdatingSchedule(true);

    try {
      const response = await fetch(`/api/scans/schedules?repositoryKey=${encodeURIComponent(repositoryKey)}`, {
        method: "DELETE",
        headers: protectedHeaders()
      });
      const data = (await response.json()) as ScanSchedulesResponse;
      if (!response.ok || !data.schedules) {
        throw new Error(data.error ?? "Scheduled scan could not be deleted.");
      }
      setScheduledScans(data.schedules);
      setScheduleStatus("예약이 해제되었습니다. / Schedule removed.");
    } catch (scheduleDeleteError) {
      const message =
        scheduleDeleteError instanceof Error ? scheduleDeleteError.message : "Scheduled scan could not be deleted.";
      setScheduleError(message);
    } finally {
      setIsUpdatingSchedule(false);
    }
  }

  async function handleRunDueSchedules() {
    setScheduleError(null);
    setScheduleStatus(null);
    setIsRunningSchedules(true);

    try {
      const response = await fetch("/api/scans/schedules/run-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = (await response.json()) as ScheduleRunResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Scheduled scans could not run.");
      }
      setScheduleRunResults(data.results ?? []);
      setScheduleStatus(`예약 실행 완료 / Scheduled run complete: ${data.results?.length ?? 0}`);
    } catch (scheduleRunError) {
      const message =
        scheduleRunError instanceof Error ? scheduleRunError.message : "Scheduled scans could not run.";
      setScheduleError(message);
    } finally {
      setIsRunningSchedules(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorAction(null);
    setSavedScanError(null);
    setDeleteScanError(null);
    setIssueError(null);
    setIssueUrl(null);
    setSelectedSavedAt(null);
    setIsScanning(true);
    setScanProgress("저장소 확인 중 / Checking repository");

    try {
      setScanProgress("파일 가져오는 중 / Fetching files");
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: protectedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          repositoryUrl,
          ...(installationId.trim() ? { installationId: Number(installationId) } : {})
        })
      });
      const data = (await response.json()) as ScanResponse;

      if (!response.ok) {
        setErrorAction(data.action ?? null);
        throw new Error(data.error ?? "Scan failed. Check the repository URL and try again.");
      }

      if (!data.scan) {
        throw new Error("Scan response did not include a report.");
      }

      setScanProgress("규칙 점검 중 / Running rules");
      setScan(data.scan);
      setScanProgress("결과 저장 중 / Saving result");
      setComparison(data.comparison ?? null);
      setSelectedSavedAt(data.history?.savedAt ?? null);
      if (data.history) {
        setScanHistory((currentHistory) => [
          data.history as ScanHistoryEntry,
          ...currentHistory.filter((entry) => entry.scan.id !== data.history?.scan.id)
        ]);
      }
      setScanProgress("완료 / Complete");
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Scan failed.";
      setScan(null);
      setComparison(null);
      setError(message);
      setErrorAction((current) => current ?? null);
      setScanProgress("실패 / Failed");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleCreateIssue() {
    if (!scan || !installationId.trim()) {
      return;
    }

    setIssueError(null);
    setIssueUrl(null);
    setIsCreatingIssue(true);

    try {
      const response = await fetch(`/api/scans/${encodeURIComponent(scan.id)}/github-issue`, {
        method: "POST",
        headers: protectedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ installationId: Number(installationId) })
      });
      const data = (await response.json()) as { issue?: { url?: string }; error?: string };

      if (!response.ok || !data.issue?.url) {
        throw new Error(data.error ?? "GitHub Issue could not be created.");
      }

      setIssueUrl(data.issue.url);
    } catch (createIssueError) {
      const message =
        createIssueError instanceof Error ? createIssueError.message : "GitHub Issue could not be created.";
      setIssueError(message);
    } finally {
      setIsCreatingIssue(false);
    }
  }

  async function handleOpenSavedScan(scanId: string) {
    setSavedScanError(null);
    setDeleteScanError(null);
    setError(null);
    setErrorAction(null);
    setIssueError(null);
    setIssueUrl(null);
    setIsLoadingSavedScanId(scanId);

    try {
      const response = await fetch(`/api/scans/${encodeURIComponent(scanId)}`);
      const data = (await response.json()) as SavedScanResponse;

      if (!response.ok || !data.scan || !data.history) {
        throw new Error(data.error ?? "Saved scan could not be loaded.");
      }

      setScan(data.scan);
      setComparison(data.comparison ?? null);
      setSelectedSavedAt(data.history.savedAt);
      setRepositoryUrl(data.scan.repository.url);
    } catch (openError) {
      const message = openError instanceof Error ? openError.message : "Saved scan could not be loaded.";
      setSavedScanError(message);
    } finally {
      setIsLoadingSavedScanId(null);
    }
  }

  async function handleDeleteSavedScan(scanId: string) {
    setDeleteScanError(null);
    setSavedScanError(null);
    setIsDeletingScanId(scanId);

    try {
      const response = await fetch(`/api/scans/${encodeURIComponent(scanId)}`, {
        method: "DELETE",
        headers: protectedHeaders()
      });
      const data = (await response.json()) as DeleteScanResponse;

      if (!response.ok || !data.deleted) {
        throw new Error(data.error ?? "Saved scan could not be deleted.");
      }

      setScanHistory((currentHistory) => currentHistory.filter((entry) => entry.scan.id !== scanId));

      if (scan?.id === scanId) {
        setScan(null);
        setComparison(null);
        setSelectedSavedAt(null);
        setIssueError(null);
        setIssueUrl(null);
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Saved scan could not be deleted.";
      setDeleteScanError(message);
    } finally {
      setIsDeletingScanId(null);
    }
  }

  return (
    <main className="app-shell">
      <section className="scan-workspace" aria-labelledby="scanner-title">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">AI Security Inspector</p>
            <h1 id="scanner-title">저장소 스캔 / Repository scan</h1>
          </div>
          <p className="workspace-note">공개 저장소 또는 GitHub App 접근 / Public repositories or GitHub App access</p>
        </header>

        <section className="admin-token-panel" aria-labelledby="admin-token-title">
          <div>
            <h2 id="admin-token-title">관리자 접근 / Admin access</h2>
            <p>변경 요청 보호 / Protected mutation requests</p>
          </div>
          <label htmlFor="admin-token">관리자 토큰 / Admin token</label>
          <input
            autoComplete="off"
            id="admin-token"
            onChange={(event) => handleAdminTokenChange(event.target.value)}
            placeholder="SCAN_ADMIN_TOKEN"
            type="password"
            value={adminToken}
          />
        </section>

        <form className="scan-form" onSubmit={handleSubmit}>
          <label htmlFor="repository-url">GitHub repository URL</label>
          <div className="input-row">
            <input
              id="repository-url"
              name="repositoryUrl"
              type="url"
              inputMode="url"
              placeholder="https://github.com/owner/repository"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              required
            />
            <button type="submit" disabled={isScanning}>
              {isScanning ? "Scanning..." : "Scan repository"}
            </button>
          </div>
          <section className="github-picker" aria-labelledby="github-picker-title">
            <div className="github-picker-heading">
              <h2 id="github-picker-title">GitHub App repository picker</h2>
              {isLoadingInstallations ? <span>Loading installations</span> : null}
            </div>
            {githubStatus ? (
              <p className="picker-status" role="status">
                {githubStatus}
              </p>
            ) : null}
            {installations.length ? (
              <div className="picker-grid">
                <div className="picker-field">
                  <label htmlFor="github-installation">GitHub App installation</label>
                  <select
                    id="github-installation"
                    value={selectedInstallationId}
                    onChange={(event) => handleInstallationSelect(event.target.value)}
                  >
                    <option value="">Select installation</option>
                    {installations.map((installation) => (
                      <option key={installation.id} value={installation.id}>
                        {installation.account} · {installation.repositories} repositories
                      </option>
                    ))}
                  </select>
                </div>
                <div className="picker-field">
                  <label htmlFor="github-repository">GitHub App repository</label>
                  <select
                    id="github-repository"
                    value={selectedRepositoryUrl}
                    onChange={(event) => handleRepositorySelect(event.target.value)}
                    disabled={!selectedInstallationId || isLoadingRepositories || !repositories.length}
                  >
                    <option value="">
                      {isLoadingRepositories ? "Loading repositories" : "Select repository"}
                    </option>
                    {repositories.map((repository) => (
                      <option key={repository.id} value={repository.url}>
                        {repository.fullName} · {repository.private ? "private" : "public"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            {repositoryStatus ? (
              <p className="picker-status" role="status">
                {repositoryStatus}
              </p>
            ) : null}
          </section>
          <div className="secondary-input-row">
            <label htmlFor="installation-id">GitHub App installation ID</label>
            <input
              id="installation-id"
              name="installationId"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Optional for private repositories"
              value={installationId}
              onChange={(event) => setInstallationId(event.target.value)}
            />
          </div>
        </form>

        <section className="panel settings-panel" aria-labelledby="settings-title">
          <div className="panel-heading">
            <h2 id="settings-title">스캔 설정 / Scan settings</h2>
            <span className="scan-id">{isUpdatingSettings ? "저장 중 / Saving" : "저장됨 / Saved"}</span>
          </div>
          {settingsError ? (
            <p className="history-error" role="status">{settingsError}</p>
          ) : null}
          <div className="rule-settings" aria-label="규칙별 사용 여부 / Rule toggles">
            {analyzerRules.map((rule) => {
              const setting = scanSettings.rules.find((candidate) => candidate.ruleId === rule.ruleId);
              const enabled = setting?.enabled ?? true;
              return (
                <label className="rule-toggle" key={rule.ruleId}>
                  <input
                    checked={enabled}
                    disabled={isUpdatingSettings}
                    onChange={(event) => void handleRuleToggle(rule.ruleId, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{rule.title}</span>
                  <small>{rule.ruleId}</small>
                </label>
              );
            })}
          </div>
        </section>

        <section className="panel schedule-panel" aria-labelledby="schedule-title">
          <div className="panel-heading">
            <h2 id="schedule-title">예약 스캔 / Scheduled scan</h2>
            <span className="scan-id">{scheduledScans.length} active / 활성</span>
          </div>
          <div className="schedule-controls">
            <label htmlFor="schedule-interval">실행 주기 / Interval</label>
            <select
              id="schedule-interval"
              value={scheduleIntervalDays}
              onChange={(event) => setScheduleIntervalDays(event.target.value)}
            >
              <option value="1">매일 / Daily</option>
              <option value="3">3일마다 / Every 3 days</option>
              <option value="7">7일마다 / Weekly</option>
              <option value="14">14일마다 / Every 14 days</option>
            </select>
            <div className="schedule-actions">
              <button
                disabled={isUpdatingSchedule || !repositoryUrl.trim()}
                onClick={() => void handleSaveSchedule()}
                type="button"
              >
                예약 저장 / Save schedule
              </button>
              <button
                disabled={isRunningSchedules}
                onClick={() => void handleRunDueSchedules()}
                type="button"
              >
                지금 실행 / Run due scans
              </button>
            </div>
          </div>
          {scheduleStatus ? <p className="picker-status">{scheduleStatus}</p> : null}
          {scheduleError ? <p className="history-error" role="alert">{scheduleError}</p> : null}
          {scheduledScans.length ? (
            <ul className="schedule-list">
              {scheduledScans.map((schedule) => (
                <li key={schedule.repositoryKey}>
                  <div>
                    <strong>{schedule.repositoryKey}</strong>
                    <span>다음 실행 / Next: {new Date(schedule.nextRunAt).toLocaleString()}</span>
                    {schedule.lastScanId ? <span>마지막 스캔 / Last scan: {schedule.lastScanId}</span> : null}
                  </div>
                  <button
                    className="history-delete-button"
                    disabled={isUpdatingSchedule}
                    onClick={() => void handleDeleteSchedule(schedule.repositoryKey)}
                    type="button"
                  >
                    예약 해제 / Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">등록된 예약 스캔이 없습니다. / No scheduled scans.</p>
          )}
          {scheduleRunResults.length ? (
            <div className="schedule-results">
              <h3>최근 예약 실행 / Latest scheduled run</h3>
              <ul>
                {scheduleRunResults.map((result) => (
                  <li key={`${result.repositoryKey}-${result.scanId ?? result.error}`}>
                    <strong>{result.repositoryKey}</strong>
                    <span>{result.status === "success" ? "성공 / Success" : "실패 / Failed"}</span>
                    {result.scanId ? <span>{result.scanId}</span> : null}
                    {result.error ? <span>{result.error}</span> : null}
                    {result.notifications?.map((notification) => (
                      <span key={`${notification.scanId}-${notification.message}`}>{notification.message}</span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {scanProgress ? (
          <div className="status-message" role="status">
            진행 상태 / Progress: {scanProgress}
          </div>
        ) : null}

        {error ? (
          <div className="status-message status-error" role="alert">
            {error}
            {errorAction ? <p>조치 / Action: {errorAction}</p> : null}
          </div>
        ) : null}

        {savedScanError ? (
          <div className="status-message status-error" role="alert">
            {savedScanError}
          </div>
        ) : null}

        {deleteScanError ? (
          <div className="status-message status-error" role="alert">
            {deleteScanError}
          </div>
        ) : null}

        <section className="panel history-panel" aria-labelledby="history-title">
          <div className="panel-heading">
            <h2 id="history-title">최근 스캔 / Recent scans</h2>
            <span className="scan-id">
              {recentHistory.length}/{scanHistory.length} saved / 저장됨
            </span>
          </div>
          <div className="history-filters">
            <label htmlFor="history-repository-filter">
              히스토리 저장소 필터 / History repository filter
            </label>
            <input
              id="history-repository-filter"
              onChange={(event) => setHistoryRepositoryFilter(event.target.value)}
              placeholder="owner/repo or scan id"
              type="search"
              value={historyRepositoryFilter}
            />
            <label htmlFor="history-result-filter">
              히스토리 결과 필터 / History result filter
            </label>
            <select
              id="history-result-filter"
              onChange={(event) => setHistoryResultFilter(event.target.value)}
              value={historyResultFilter}
            >
              <option value="all">전체 / All</option>
              <option value="with-findings">발견 있음 / With findings</option>
              <option value="clean">발견 없음 / Clean</option>
              <option value="baseline">기준선 / Baseline</option>
            </select>
          </div>
          {historyError ? (
            <p className="history-error" role="status">
              {historyError}
            </p>
          ) : recentHistory.length ? (
            <ul className="history-list">
              {recentHistory.map((entry) => (
                <HistoryEntryItem
                  entry={entry}
                  baselineScanId={
                    scanSettings.baselines.find(
                      (baseline) => baseline.repositoryKey === repositoryKeyForScan(entry.scan)
                    )?.scanId ?? null
                  }
                  isDeleting={isDeletingScanId === entry.scan.id}
                  isLoading={isLoadingSavedScanId === entry.scan.id}
                  isUpdatingSettings={isUpdatingSettings}
                  key={`${entry.savedAt}-${entry.scan.id}`}
                  onDelete={handleDeleteSavedScan}
                  onOpen={handleOpenSavedScan}
                  onSetBaseline={handleSetBaseline}
                />
              ))}
            </ul>
          ) : scanHistory.length ? (
            <p className="empty-state">필터 조건에 맞는 저장 스캔이 없습니다. / No saved scans match the filters.</p>
          ) : (
            <p className="empty-state">저장된 스캔이 아직 없습니다. / No saved scans yet.</p>
          )}
        </section>

        {scan ? (
          <div className="results-grid">
            <section className="panel summary-panel" aria-labelledby="summary-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{scan.repository.owner}/{scan.repository.name}</p>
                  <h2 id="summary-title">스캔 요약 / Scan summary</h2>
                </div>
                <span className="scan-id">{scan.id}</span>
              </div>

              <div className="severity-grid" aria-label="심각도 요약 / Severity summary">
                {severities.map((severity) => (
                  <div className="severity-cell" key={severity}>
                    <span className="summary-label">{severity}</span>
                    <strong className={`summary-count severity-${severity}`}>
                      {visibleSummary[severity]}
                    </strong>
                  </div>
                ))}
              </div>

              <p className="result-count">
                발견 항목 / Findings: {findingCount} · Branch:{" "}
                {scan.repository.defaultBranch}
              </p>

              {selectedSavedAt ? (
                <p className="saved-scan-note">
                  저장된 스캔을 보는 중 / Saved scan · 스캔 일시 / Scanned at:{" "}
                  {new Date(selectedSavedAt).toLocaleString()}
                </p>
              ) : null}

              <section className="risk-summary" aria-labelledby="risk-summary-title">
                <h3 id="risk-summary-title">위험 요약 / Risk summary</h3>
                <p>{summarizeFindings(visibleSummary, visibleFindings)}</p>
                <div className="risk-summary-grid">
                  <div>
                    <span>즉시 조치 / Immediate</span>
                    <strong>{visibleSummary.critical}</strong>
                    <small>Critical</small>
                  </div>
                  <div>
                    <span>우선 검토 / Priority</span>
                    <strong>{visibleSummary.high}</strong>
                    <small>High</small>
                  </div>
                </div>
              </section>

              {scanChecks.length ? (
                <ScanCoverage checks={scanChecks} />
              ) : null}

              {comparison ? (
                <section className="comparison-panel" aria-labelledby="comparison-title">
                  <h3 id="comparison-title">비교 / Comparison</h3>
                  {comparison.previousScanId ? (
                    <p className="comparison-source">
                      비교 기준 / Compared with {comparison.previousScanId}
                      {comparison.comparisonSource === "baseline" ? " · 기준선 / Baseline" : " · 직전 스캔 / Previous scan"}
                    </p>
                  ) : (
                    <p className="comparison-source">이 저장소의 이전 스캔이 없습니다. / No previous scan for this repository.</p>
                  )}
                  {comparedScanSavedAt ? (
                    <p className="comparison-source">
                      비교 대상 일시 / Compared scan time:{" "}
                      {comparedScanSavedAt === "unknown"
                        ? "알 수 없음 / Unknown"
                        : new Date(comparedScanSavedAt).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="comparison-grid">
                    <div>
                      <span>새로 발견 / New</span>
                      <strong>{comparison.newFindings.length}</strong>
                    </div>
                    <div>
                      <span>해결됨 / Resolved</span>
                      <strong>{comparison.resolvedFindings.length}</strong>
                    </div>
                    <div>
                      <span>유지됨 / Unchanged</span>
                      <strong>{comparison.unchangedFindings.length}</strong>
                    </div>
                  </div>
                  <ComparisonList
                    title="새 발견 항목 / New findings"
                    emptyText="새 발견 항목이 없습니다. / No new findings."
                    findings={comparison.newFindings}
                  />
                  <ComparisonList
                    title="해결된 항목 / Resolved findings"
                    emptyText="해결된 항목이 없습니다. / No resolved findings."
                    findings={comparison.resolvedFindings}
                  />
                  <ComparisonList
                    title="유지된 항목 / Unchanged findings"
                    emptyText="유지된 항목이 없습니다. / No unchanged findings."
                    findings={comparison.unchangedFindings}
                  />
                  <ComparisonList
                    title="오탐 처리됨 / Suppressed findings"
                    emptyText="오탐 처리된 항목이 없습니다. / No suppressed findings."
                    findings={comparison.suppressedFindings ?? []}
                  />
                </section>
              ) : null}

              {scan.warnings.length ? (
                <div className="warnings" role="status" aria-label="Scan warnings">
                  <h3>경고 / Warnings</h3>
                  <ul>
                    {scan.warnings.map((warning) => (
                      <li key={warning.message}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="panel findings-panel" aria-labelledby="findings-title">
              <div className="panel-heading">
                <h2 id="findings-title">발견 항목 / Findings</h2>
              </div>

              {hasFindings ? (
                <ul className="findings-list">
                  {visibleFindings.map((finding) => (
                    <li className="finding-item" key={finding.id}>
                      <div className="finding-title-row">
                        <span className={`severity-badge severity-${finding.severity}`}>
                          {severityLabels[finding.severity]}
                        </span>
                        <h3>{finding.title}</h3>
                      </div>
                      <div className="finding-priority-row">
                        <span>{severityPriorityLabels[finding.severity]}</span>
                        <span>{categoryLabels[finding.category]}</span>
                      </div>
                      <p className="finding-meta">
                        <span>
                          {finding.ruleId} · {finding.category}
                        </span>
                        <span>{formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)}</span>
                      </p>
                      <dl className="finding-details">
                        <div>
                          <dt>취약점 / Vulnerability</dt>
                          <dd>{categoryLabels[finding.category]}: {finding.title}</dd>
                        </div>
                        <div>
                          <dt>우선순위 / Priority</dt>
                          <dd>
                            {severityLabels[finding.severity]} · {severityPriorityLabels[finding.severity]}
                          </dd>
                        </div>
                        <div>
                          <dt>신뢰도 / Confidence</dt>
                          <dd>{confidenceLabel(finding)}</dd>
                        </div>
                        <div>
                          <dt>발견 위치 / Location</dt>
                          <dd>{formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)}</dd>
                        </div>
                        <div>
                          <dt>발견 근거 / Evidence</dt>
                          <dd>
                            <code>{finding.evidence}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>영향도 / Impact</dt>
                          <dd>
                            {severityImpactLabels[finding.severity]} {finding.whyItMatters}
                          </dd>
                        </div>
                        <div>
                          <dt>필요 조치 / Required action</dt>
                          <dd>{finding.fixSuggestion}</dd>
                        </div>
                        <div>
                          <dt>원본 규칙 / Source rule</dt>
                          <dd>{finding.ruleId}</dd>
                        </div>
                      </dl>
                      <button
                        className="secondary-action"
                        disabled={isUpdatingSettings}
                        onClick={() => void handleSuppressFinding(finding)}
                        type="button"
                      >
                        오탐 처리 / Mark false positive
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">스캔한 파일에서 발견 항목이 없습니다. / No findings were detected in the scanned files.</p>
              )}
            </section>

            {comparison?.suppressedFindings?.length ? (
              <section className="panel findings-panel" aria-labelledby="suppressed-title">
                <div className="panel-heading">
                  <h2 id="suppressed-title">오탐 처리됨 / Suppressed findings</h2>
                </div>
                <ul className="findings-list">
                  {comparison.suppressedFindings.map((finding) => (
                    <li className="finding-item" key={`suppressed-${finding.id}`}>
                      <div className="finding-title-row">
                        <span className={`severity-badge severity-${finding.severity}`}>
                          {severityLabels[finding.severity]}
                        </span>
                        <h3>{finding.title}</h3>
                      </div>
                      <p className="finding-meta">
                        <span>{finding.ruleId}</span>
                        <span>{formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)}</span>
                      </p>
                      <button
                        className="secondary-action"
                        disabled={isUpdatingSettings}
                        onClick={() => void handleUnsuppressFinding(finding)}
                        type="button"
                      >
                        오탐 해제 / Restore finding
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="panel report-panel" aria-labelledby="report-title">
              <div className="report-actions">
                <a className="report-link" href={`/api/scans/${encodeURIComponent(scan.id)}/markdown`}>
                  마크다운 보고서 / Markdown report
                </a>
                <a className="report-link" href={`/api/scans/${encodeURIComponent(scan.id)}/checklist`}>
                  체크리스트 / Checklist
                </a>
                {installationId.trim() ? (
                  <button type="button" onClick={handleCreateIssue} disabled={isCreatingIssue}>
                    {isCreatingIssue ? "Creating issue..." : "Create GitHub issue"}
                  </button>
                ) : null}
              </div>
              {issueUrl ? (
                <p className="issue-status">
                  <a href={issueUrl}>GitHub issue created</a>
                </p>
              ) : null}
              {issueError ? (
                <p className="issue-error" role="alert">
                  {issueError}
                </p>
              ) : null}
              <details>
                <summary id="report-title">JSON 보고서 / JSON report</summary>
                <pre>{reportJson}</pre>
              </details>
            </section>
          </div>
        ) : (
          <section className="panel empty-panel" aria-label="No scan results">
            <h2>스캔 준비 / Ready to scan</h2>
            <p>GitHub 저장소 URL을 입력해 AI 애플리케이션의 주요 보안 위험을 점검하세요. / Enter a GitHub repository URL to inspect common AI application security risks.</p>
          </section>
        )}
      </section>
    </main>
  );
}

function ComparisonList({
  title,
  emptyText,
  findings
}: {
  title: string;
  emptyText: string;
  findings: Finding[];
}) {
  if (!findings.length) {
    return (
      <div className="comparison-list">
        <h4>{title}</h4>
        <p className="comparison-empty">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="comparison-list">
      <h4>{title}</h4>
      <ul>
        {findings.slice(0, 3).map((finding) => (
          <li key={finding.id}>
            <span className={`severity-badge severity-${finding.severity}`}>
              {severityLabels[finding.severity]}
            </span>
            <span>{finding.title}</span>
            <small>
              {formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)} · 신뢰도 {confidenceLabel(finding)}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScanCoverage({ checks }: { checks: ScanCheckResult[] }) {
  const totals = checks.reduce<Record<ScanCheckStatus, number>>(
    (counts, check) => ({ ...counts, [check.status]: counts[check.status] + 1 }),
    { failed: 0, passed: 0, disabled: 0 }
  );

  return (
    <section className="scan-coverage" aria-labelledby="scan-coverage-title">
      <div className="scan-coverage-heading">
        <h3 id="scan-coverage-title">점검 항목 / Scan coverage</h3>
        <span>{checks.length} rules / 규칙</span>
      </div>
      <div className="coverage-summary" aria-label="점검 상태 요약 / Coverage status summary">
        <div>
          <span>발견 / Findings</span>
          <strong>{totals.failed}</strong>
        </div>
        <div>
          <span>통과 / Passed</span>
          <strong>{totals.passed}</strong>
        </div>
        <div>
          <span>비활성 / Disabled</span>
          <strong>{totals.disabled}</strong>
        </div>
      </div>
      <ul className="coverage-list">
        {checks.map((check) => (
          <li className={`coverage-item coverage-${check.status}`} key={check.ruleId}>
            <div className="coverage-title-row">
              <span className={`coverage-status coverage-status-${check.status}`}>
                {checkStatusLabels[check.status]}
              </span>
              <strong>{check.title}</strong>
            </div>
            <p>{check.description}</p>
            <div className="coverage-meta">
              <span>{check.ruleId}</span>
              <span>{categoryLabels[check.category]}</span>
              <span>{severityLabels[check.severity]}</span>
              <span>{check.findingCount} found / 발견</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryEntryItem({
  baselineScanId,
  entry,
  isDeleting,
  isLoading,
  isUpdatingSettings,
  onDelete,
  onOpen,
  onSetBaseline
}: {
  baselineScanId: string | null;
  entry: ScanHistoryEntry;
  isDeleting: boolean;
  isLoading: boolean;
  isUpdatingSettings: boolean;
  onDelete(scanId: string): void;
  onOpen(scanId: string): void;
  onSetBaseline(scanId: string, repositoryKey: string): void;
}) {
  const topFinding = highestRiskFinding(entry.scan.findings);
  const highRiskCount = entry.scan.summary.critical + entry.scan.summary.high;
  const isBaseline = baselineScanId === entry.scan.id;
  const key = repositoryKeyForScan(entry.scan);

  return (
    <li>
      <button
        aria-label={`열기 / Open ${entry.scan.id}`}
        className="history-button"
        disabled={isLoading || isDeleting}
        onClick={() => onOpen(entry.scan.id)}
        type="button"
      >
        <div>
          <strong>
            {entry.scan.repository.owner}/{entry.scan.repository.name}
          </strong>
          <span>{entry.scan.id}</span>
          <span className="history-scan-date">
            스캔 일시 / Scanned at: {new Date(entry.savedAt).toLocaleString()}
          </span>
          {topFinding ? (
            <span className="history-top-risk">
              최고 위험: {categoryLabels[topFinding.category]} · {topFinding.title}
            </span>
          ) : null}
        </div>
        <small>
          {isLoading
            ? "저장된 스캔 불러오는 중... / Loading saved scan..."
            : `${entry.scan.findings.length} findings / 발견 · ${highRiskCount} high risk / 고위험`}
          {!isLoading && topFinding ? ` · ${severityPriorityLabels[topFinding.severity]}` : ""}
        </small>
      </button>
      <button
        aria-label={`기준선 지정 / Set baseline ${entry.scan.id}`}
        className="history-delete-button"
        disabled={isUpdatingSettings || isBaseline}
        onClick={() => onSetBaseline(entry.scan.id, key)}
        type="button"
      >
        {isBaseline ? "기준선 / Baseline" : "기준선 지정 / Set baseline"}
      </button>
      <button
        aria-label={`삭제 / Delete ${entry.scan.id}`}
        className="history-delete-button"
        disabled={isDeleting}
        onClick={() => onDelete(entry.scan.id)}
        type="button"
      >
        {isDeleting ? "삭제 중... / Deleting..." : "삭제 / Delete"}
      </button>
    </li>
  );
}
