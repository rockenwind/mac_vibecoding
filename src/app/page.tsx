"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ScanResult, Severity } from "@/lib/scanner/types";
import type { MarketSignal, MarketSignalsReport } from "@/lib/marketSignals/signals";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];
const vibecodingDashboardUrl =
  process.env.NEXT_PUBLIC_VIBECODING_URL ?? "http://127.0.0.1:8000/login";

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info"
};

type ScanResponse = {
  scan?: ScanResult;
  error?: string;
};

type MarketSignalsResponse = MarketSignalsReport;

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
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [marketSignals, setMarketSignals] = useState<MarketSignalsResponse | null>(null);
  const [selectedSignalArea, setSelectedSignalArea] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const hasFindings = Boolean(scan?.findings.length);
  const findingCount = scan?.findings.length ?? 0;
  const reportJson = useMemo(() => (scan ? JSON.stringify(scan, null, 2) : ""), [scan]);
  const recommendedSignals = marketSignals?.signals.slice(0, 3) ?? [];
  const selectedSignal: MarketSignal | null =
    recommendedSignals.find((signal) => signal.area === selectedSignalArea) ?? recommendedSignals[0] ?? null;

  useEffect(() => {
    let isMounted = true;

    async function loadMarketSignals() {
      try {
        const response = await fetch("/api/market-signals");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as MarketSignalsResponse;
        if (isMounted) {
          setMarketSignals(data);
        }
      } catch {
        if (isMounted) {
          setMarketSignals(null);
        }
      }
    }

    void loadMarketSignals();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsScanning(true);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl })
      });
      const data = (await response.json()) as ScanResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Scan failed. Check the repository URL and try again.");
      }

      if (!data.scan) {
        throw new Error("Scan response did not include a report.");
      }

      setScan(data.scan);
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Scan failed.";
      setScan(null);
      setError(message);
    } finally {
      setIsScanning(false);
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
          <div className="workspace-actions">
            <a className="dashboard-link" href={vibecodingDashboardUrl}>
              Job dashboard
            </a>
            <p className="workspace-note">Public GitHub repositories only</p>
          </div>
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
        </form>

        {error ? (
          <div className="status-message status-error" role="alert">
            {error}
          </div>
        ) : null}

        {marketSignals && marketSignals.signals.length ? (
          <section className="panel market-panel" aria-labelledby="market-title">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Market signals</p>
                <h2 id="market-title">시장 수요 기반 추천 점검</h2>
              </div>
              <span className="scan-id">최근 공고 {marketSignals.sampleSize}건 기준</span>
            </div>
            <ul className="market-list">
              {recommendedSignals.map((signal) => (
                <li key={signal.area}>
                  <button
                    aria-pressed={selectedSignal?.area === signal.area}
                    className="market-signal-button"
                    type="button"
                    onClick={() => setSelectedSignalArea(signal.area)}
                  >
                    <strong>{signal.area}</strong>
                    <span>{signal.keywords.join(", ")}</span>
                    <small>수요 {signal.jobCount}개 회사 · 점수 {signal.score}</small>
                  </button>
                </li>
              ))}
            </ul>
            {selectedSignal ? (
              <section className="market-template" aria-labelledby="market-template-title">
                <div>
                  <p className="panel-kicker">Recommended checklist</p>
                  <h3 id="market-template-title">추천 점검 템플릿</h3>
                  <p className="market-trend">{selectedSignal.trend}</p>
                </div>
                <p>{selectedSignal.template.purpose}</p>
                <dl className="template-grid">
                  <div>
                    <dt>추천 키워드</dt>
                    <dd>{selectedSignal.template.scanKeywords.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>확인 대상</dt>
                    <dd>{selectedSignal.template.reviewTargets.join(", ")}</dd>
                  </div>
                </dl>
                <ul className="template-checklist">
                  {selectedSignal.template.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        ) : null}

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
