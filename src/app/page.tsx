"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Finding, ScanResult, Severity } from "@/lib/scanner/types";
import type { ScanComparison, ScanHistoryEntry } from "@/lib/scanHistory/types";

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

const categoryLabels: Record<Finding["category"], string> = {
  secret: "비밀값 노출",
  "agent-tooling": "에이전트 도구 권한",
  "prompt-injection": "프롬프트 주입",
  mcp: "MCP 설정 위험",
  "dangerous-execution": "위험한 명령 실행"
};

type ScanResponse = {
  scan?: ScanResult;
  history?: ScanHistoryEntry;
  comparison?: ScanComparison;
  error?: string;
};

type SavedScanResponse = ScanResponse;

type ScanHistoryResponse = {
  history?: ScanHistoryEntry[];
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

function summarizeRisk(scan: ScanResult): string {
  if (scan.summary.critical > 0) {
    return `Critical ${scan.summary.critical}개가 발견되어 즉시 조치가 필요합니다.`;
  }

  if (scan.summary.high > 0) {
    return `High ${scan.summary.high}개가 발견되어 우선 검토가 필요합니다.`;
  }

  if (scan.findings.length > 0) {
    return `${scan.findings.length}개 발견 항목을 계획적으로 검토하세요.`;
  }

  return "현재 스캔 범위에서는 조치가 필요한 보안 위험이 발견되지 않았습니다.";
}

function highestRiskFinding(findings: Finding[]): Finding | undefined {
  const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];
  return [...findings].sort((first, second) => {
    return severityOrder.indexOf(first.severity) - severityOrder.indexOf(second.severity);
  })[0];
}

export default function Home() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [comparison, setComparison] = useState<ScanComparison | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedScanError, setSavedScanError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [selectedSavedAt, setSelectedSavedAt] = useState<string | null>(null);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingSavedScanId, setIsLoadingSavedScanId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState("");
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepositoryUrl, setSelectedRepositoryUrl] = useState("");
  const [githubStatus, setGithubStatus] = useState<string | null>(null);
  const [repositoryStatus, setRepositoryStatus] = useState<string | null>(null);
  const [isLoadingInstallations, setIsLoadingInstallations] = useState(false);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);

  const hasFindings = Boolean(scan?.findings.length);
  const findingCount = scan?.findings.length ?? 0;
  const reportJson = useMemo(() => (scan ? JSON.stringify(scan, null, 2) : ""), [scan]);
  const recentHistory = scanHistory.slice(0, 5);

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

    void loadHistory();
    void loadInstallations();

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedScanError(null);
    setIssueError(null);
    setIssueUrl(null);
    setSelectedSavedAt(null);
    setIsScanning(true);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryUrl,
          ...(installationId.trim() ? { installationId: Number(installationId) } : {})
        })
      });
      const data = (await response.json()) as ScanResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Scan failed. Check the repository URL and try again.");
      }

      if (!data.scan) {
        throw new Error("Scan response did not include a report.");
      }

      setScan(data.scan);
      setComparison(data.comparison ?? null);
      setSelectedSavedAt(null);
      if (data.history) {
        setScanHistory((currentHistory) => [
          data.history as ScanHistoryEntry,
          ...currentHistory.filter((entry) => entry.scan.id !== data.history?.scan.id)
        ]);
      }
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Scan failed.";
      setScan(null);
      setComparison(null);
      setError(message);
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
        headers: { "Content-Type": "application/json" },
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
    setError(null);
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

  return (
    <main className="app-shell">
      <section className="scan-workspace" aria-labelledby="scanner-title">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">AI Security Inspector</p>
            <h1 id="scanner-title">Repository scan</h1>
          </div>
          <p className="workspace-note">Public repositories or GitHub App access</p>
        </header>

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

        {error ? (
          <div className="status-message status-error" role="alert">
            {error}
          </div>
        ) : null}

        {savedScanError ? (
          <div className="status-message status-error" role="alert">
            {savedScanError}
          </div>
        ) : null}

        <section className="panel history-panel" aria-labelledby="history-title">
          <div className="panel-heading">
            <h2 id="history-title">Recent scans</h2>
            <span className="scan-id">{recentHistory.length} saved</span>
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
                  isLoading={isLoadingSavedScanId === entry.scan.id}
                  key={`${entry.savedAt}-${entry.scan.id}`}
                  onOpen={handleOpenSavedScan}
                />
              ))}
            </ul>
          ) : (
            <p className="empty-state">No saved scans yet.</p>
          )}
        </section>

        {scan ? (
          <div className="results-grid">
            <section className="panel summary-panel" aria-labelledby="summary-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{scan.repository.owner}/{scan.repository.name}</p>
                  <h2 id="summary-title">Scan summary</h2>
                </div>
                <span className="scan-id">{scan.id}</span>
              </div>

              <div className="severity-grid" aria-label="Severity summary">
                {severities.map((severity) => (
                  <div className="severity-cell" key={severity}>
                    <span className="summary-label">{severity}</span>
                    <strong className={`summary-count severity-${severity}`}>
                      {scan.summary[severity]}
                    </strong>
                  </div>
                ))}
              </div>

              <p className="result-count">
                {findingCount === 1 ? "1 finding" : `${findingCount} findings`} on{" "}
                {scan.repository.defaultBranch}
              </p>

              {selectedSavedAt ? (
                <p className="saved-scan-note">
                  저장된 스캔을 보는 중 · {new Date(selectedSavedAt).toLocaleString()}
                </p>
              ) : null}

              <section className="risk-summary" aria-labelledby="risk-summary-title">
                <h3 id="risk-summary-title">위험 요약</h3>
                <p>{summarizeRisk(scan)}</p>
                <div className="risk-summary-grid">
                  <div>
                    <span>즉시 조치</span>
                    <strong>{scan.summary.critical}</strong>
                    <small>Critical</small>
                  </div>
                  <div>
                    <span>우선 검토</span>
                    <strong>{scan.summary.high}</strong>
                    <small>High</small>
                  </div>
                </div>
              </section>

              {comparison ? (
                <section className="comparison-panel" aria-labelledby="comparison-title">
                  <h3 id="comparison-title">Comparison</h3>
                  {comparison.previousScanId ? (
                    <p className="comparison-source">Compared with {comparison.previousScanId}</p>
                  ) : (
                    <p className="comparison-source">No previous scan for this repository.</p>
                  )}
                  <div className="comparison-grid">
                    <div>
                      <span>New</span>
                      <strong>{comparison.newFindings.length}</strong>
                    </div>
                    <div>
                      <span>Resolved</span>
                      <strong>{comparison.resolvedFindings.length}</strong>
                    </div>
                    <div>
                      <span>Unchanged</span>
                      <strong>{comparison.unchangedFindings.length}</strong>
                    </div>
                  </div>
                  <ComparisonList
                    title="New findings"
                    emptyText="No new findings."
                    findings={comparison.newFindings}
                  />
                  <ComparisonList
                    title="Resolved findings"
                    emptyText="No resolved findings."
                    findings={comparison.resolvedFindings}
                  />
                  <ComparisonList
                    title="Unchanged findings"
                    emptyText="No unchanged findings."
                    findings={comparison.unchangedFindings}
                  />
                </section>
              ) : null}

              {scan.warnings.length ? (
                <div className="warnings" role="status" aria-label="Scan warnings">
                  <h3>Warnings</h3>
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
                <h2 id="findings-title">Findings</h2>
              </div>

              {hasFindings ? (
                <ul className="findings-list">
                  {scan.findings.map((finding) => (
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
                          <dt>취약점</dt>
                          <dd>{categoryLabels[finding.category]}: {finding.title}</dd>
                        </div>
                        <div>
                          <dt>우선순위</dt>
                          <dd>
                            {severityLabels[finding.severity]} · {severityPriorityLabels[finding.severity]}
                          </dd>
                        </div>
                        <div>
                          <dt>발견 위치</dt>
                          <dd>{formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)}</dd>
                        </div>
                        <div>
                          <dt>발견 근거</dt>
                          <dd>
                            <code>{finding.evidence}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>영향도</dt>
                          <dd>
                            {severityImpactLabels[finding.severity]} {finding.whyItMatters}
                          </dd>
                        </div>
                        <div>
                          <dt>필요 조치</dt>
                          <dd>{finding.fixSuggestion}</dd>
                        </div>
                        <div>
                          <dt>원본 규칙</dt>
                          <dd>{finding.ruleId}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">No findings were detected in the scanned files.</p>
              )}
            </section>

            <section className="panel report-panel" aria-labelledby="report-title">
              <div className="report-actions">
                <a className="report-link" href={`/api/scans/${encodeURIComponent(scan.id)}/markdown`}>
                  Markdown report
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
                <summary id="report-title">JSON report</summary>
                <pre>{reportJson}</pre>
              </details>
            </section>
          </div>
        ) : (
          <section className="panel empty-panel" aria-label="No scan results">
            <h2>Ready to scan</h2>
            <p>Enter a GitHub repository URL to inspect common AI application security risks.</p>
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
            <small>{formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryEntryItem({
  entry,
  isLoading,
  onOpen
}: {
  entry: ScanHistoryEntry;
  isLoading: boolean;
  onOpen(scanId: string): void;
}) {
  const topFinding = highestRiskFinding(entry.scan.findings);
  const highRiskCount = entry.scan.summary.critical + entry.scan.summary.high;

  return (
    <li>
      <button
        className="history-button"
        disabled={isLoading}
        onClick={() => onOpen(entry.scan.id)}
        type="button"
      >
        <div>
          <strong>
            {entry.scan.repository.owner}/{entry.scan.repository.name}
          </strong>
          <span>{entry.scan.id}</span>
          {topFinding ? (
            <span className="history-top-risk">
              최고 위험: {categoryLabels[topFinding.category]} · {topFinding.title}
            </span>
          ) : null}
        </div>
        <small>
          {isLoading ? "Loading saved scan..." : `${entry.scan.findings.length} findings · ${highRiskCount} high risk`}
          {!isLoading && topFinding ? ` · ${severityPriorityLabels[topFinding.severity]}` : ""}
        </small>
      </button>
    </li>
  );
}
