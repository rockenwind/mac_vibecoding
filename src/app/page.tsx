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

type ScanResponse = {
  scan?: ScanResult;
  history?: ScanHistoryEntry;
  comparison?: ScanComparison;
  error?: string;
};

type ScanHistoryResponse = {
  history?: ScanHistoryEntry[];
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

export default function Home() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [comparison, setComparison] = useState<ScanComparison | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

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

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIssueError(null);
    setIssueUrl(null);
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

  return (
    <main className="app-shell">
      <section className="scan-workspace" aria-labelledby="scanner-title">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">AI Security Inspector</p>
            <h1 id="scanner-title">Repository scan</h1>
          </div>
          <p className="workspace-note">Public GitHub repositories only</p>
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
                <li key={`${entry.savedAt}-${entry.scan.id}`}>
                  <div>
                    <strong>
                      {entry.scan.repository.owner}/{entry.scan.repository.name}
                    </strong>
                    <span>{entry.scan.id}</span>
                  </div>
                  <small>
                    {entry.scan.findings.length} findings · {entry.scan.summary.critical + entry.scan.summary.high} high risk
                  </small>
                </li>
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
                      <p className="finding-meta">
                        <span>
                          {finding.ruleId} · {finding.category}
                        </span>
                        <span>{formatLocation(finding.filePath, finding.lineStart, finding.lineEnd)}</span>
                      </p>
                      <dl className="finding-details">
                        <div>
                          <dt>Evidence</dt>
                          <dd>
                            <code>{finding.evidence}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Why it matters</dt>
                          <dd>{finding.whyItMatters}</dd>
                        </div>
                        <div>
                          <dt>Fix</dt>
                          <dd>{finding.fixSuggestion}</dd>
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
