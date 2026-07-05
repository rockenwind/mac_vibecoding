import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/github/installations") {
          return {
            ok: true,
            json: async () => ({
              installations: [
                {
                  id: 123,
                  account: "example",
                  repositories: 1,
                  repositorySelection: "selected",
                  targetType: "Organization"
                }
              ]
            })
          };
        }
        if (url === "/api/github/repositories?installationId=123") {
          return {
            ok: true,
            json: async () => ({
              repositories: [
                {
                  id: 1,
                  name: "repo",
                  fullName: "example/repo",
                  private: true,
                  defaultBranch: "main",
                  url: "https://github.com/example/repo"
                }
              ]
            })
          };
        }
        if (url === "/api/scans/settings") {
          if (init?.method === "PATCH") {
            const payload = JSON.parse(String(init.body ?? "{}")) as { action?: string; ruleId?: string; enabled?: boolean; repositoryKey?: string; scanId?: string };
            return {
              ok: true,
              json: async () => ({
                settings: {
                  baselines:
                    payload.action === "setBaseline"
                      ? [{ repositoryKey: payload.repositoryKey, scanId: payload.scanId, updatedAt: "2026-07-02T00:10:00.000Z" }]
                      : [],
                  suppressions: [],
                  rules:
                    payload.action === "setRuleEnabled" && payload.ruleId
                      ? [{ ruleId: payload.ruleId, enabled: Boolean(payload.enabled), updatedAt: "2026-07-02T00:10:00.000Z" }]
                      : []
                },
                rules: [
                  {
                    ruleId: "secret.exposed-token",
                    title: "Possible exposed credential",
                    severity: "critical",
                    category: "secret"
                  }
                ]
              })
            };
          }
          return {
            ok: true,
            json: async () => ({
              settings: { baselines: [], suppressions: [], rules: [] },
              rules: [
                {
                  ruleId: "secret.exposed-token",
                  title: "Possible exposed credential",
                  severity: "critical",
                  category: "secret"
                }
              ]
            })
          };
        }
        if (url === "/api/scans/scan_test") {
          return {
            ok: true,
            json: async () => ({
              scan: {
                id: "scan_test",
                repository: {
                  owner: "example",
                  name: "repo",
                  url: "https://github.com/example/repo",
                  defaultBranch: "main"
                },
                summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
                warnings: [],
                findings: [
                  {
                    id: "secret.exposed-token:.env:1",
                    ruleId: "secret.exposed-token",
                    title: "Possible exposed credential",
                    severity: "critical",
                    confidence: "high",
                    category: "secret",
                    filePath: ".env",
                    lineStart: 1,
                    lineEnd: 1,
                    evidence: "OPENAI_API_KEY=sk-...redacted...",
                    whyItMatters: "Exposed credentials can let attackers access services.",
                    fixSuggestion: "Revoke the credential and load it from a secret manager."
                  }
                ]
              },
              history: {
                savedAt: "2026-07-02T00:05:00.000Z",
                scan: {
                  id: "scan_test",
                  repository: {
                    owner: "example",
                    name: "repo",
                    url: "https://github.com/example/repo",
                    defaultBranch: "main"
                  },
                  summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
                  warnings: [],
                  findings: []
                }
              },
              comparison: {
                previousScanId: "scan_previous",
                comparisonSource: "previous",
                newFindings: [
                  {
                    id: "secret.exposed-token:.env:1",
                    ruleId: "secret.exposed-token",
                    title: "Possible exposed credential",
                    severity: "critical",
                    confidence: "high",
                    category: "secret",
                    filePath: ".env",
                    lineStart: 1,
                    lineEnd: 1,
                    evidence: "OPENAI_API_KEY=sk-...redacted...",
                    whyItMatters: "Exposed credentials can let attackers access services.",
                    fixSuggestion: "Revoke the credential and load it from a secret manager."
                  }
                ],
                resolvedFindings: [],
                unchangedFindings: [],
                suppressedFindings: []
              }
            })
          };
        }
        if (url === "/api/scans/scan_previous" && init?.method === "DELETE") {
          return {
            ok: true,
            json: async () => ({ deleted: true })
          };
        }
        if (url === "/api/scans/scan_previous") {
          return {
            ok: true,
            json: async () => ({
              scan: {
                id: "scan_previous",
                repository: {
                  owner: "example",
                  name: "repo",
                  url: "https://github.com/example/repo",
                  defaultBranch: "main"
                },
                summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
                warnings: [],
                findings: [
                  {
                    id: "secret.exposed-token:.env:1",
                    ruleId: "secret.exposed-token",
                    title: "Possible exposed credential",
                    severity: "critical",
                    confidence: "high",
                    category: "secret",
                    filePath: ".env",
                    lineStart: 1,
                    lineEnd: 1,
                    evidence: "OPENAI_API_KEY=sk-...redacted...",
                    whyItMatters: "Exposed credentials can let attackers access services.",
                    fixSuggestion: "Revoke the credential and load it from a secret manager."
                  }
                ]
              },
              history: {
                savedAt: "2026-07-02T00:00:00.000Z",
                scan: {
                  id: "scan_previous",
                  repository: {
                    owner: "example",
                    name: "repo",
                    url: "https://github.com/example/repo",
                    defaultBranch: "main"
                  },
                  summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
                  warnings: [],
                  findings: []
                }
              },
              comparison: {
                previousScanId: "scan_older",
                comparisonSource: "previous",
                newFindings: [
                  {
                    id: "secret.exposed-token:.env:1",
                    ruleId: "secret.exposed-token",
                    title: "Possible exposed credential",
                    severity: "critical",
                    confidence: "high",
                    category: "secret",
                    filePath: ".env",
                    lineStart: 1,
                    lineEnd: 1,
                    evidence: "OPENAI_API_KEY=sk-...redacted...",
                    whyItMatters: "Exposed credentials can let attackers access services.",
                    fixSuggestion: "Revoke the credential and load it from a secret manager."
                  }
                ],
                resolvedFindings: [],
                unchangedFindings: [],
                suppressedFindings: []
              }
            })
          };
        }
        if (url === "/api/scans" && !init) {
          return {
            ok: true,
            json: async () => ({
              history: [
                {
                  savedAt: "2026-07-02T00:00:00.000Z",
                  scan: {
                    id: "scan_previous",
                    repository: {
                      owner: "example",
                      name: "repo",
                      url: "https://github.com/example/repo",
                      defaultBranch: "main"
                    },
                    summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
                    warnings: [],
                    findings: []
                  }
                }
              ]
            })
          };
        }
        expect(url).toBe("/api/scans");

        return {
          ok: true,
          json: async () => ({
            scan: {
              id: "scan_test",
              repository: {
                owner: "example",
                name: "repo",
                url: "https://github.com/example/repo",
                defaultBranch: "main"
              },
              summary: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
              warnings: [],
              findings: [
                {
                  id: "secret.exposed-token:.env:1",
                  ruleId: "secret.exposed-token",
                  title: "Possible exposed credential",
                  severity: "critical",
                  confidence: "high",
                  category: "secret",
                  filePath: ".env",
                  lineStart: 1,
                  lineEnd: 1,
                  evidence: "OPENAI_API_KEY=sk-...redacted...",
                  whyItMatters: "Exposed credentials can let attackers access services.",
                  fixSuggestion: "Revoke the credential and load it from a secret manager."
                }
              ]
            },
            comparison: {
              previousScanId: "scan_previous",
              comparisonSource: "previous",
              newFindings: [
                {
                  id: "secret.exposed-token:.env:1",
                  ruleId: "secret.exposed-token",
                  title: "Possible exposed credential",
                  severity: "critical",
                  confidence: "high",
                  category: "secret",
                  filePath: ".env",
                  lineStart: 1,
                  lineEnd: 1,
                  evidence: "OPENAI_API_KEY=sk-...redacted...",
                  whyItMatters: "Exposed credentials can let attackers access services.",
                  fixSuggestion: "Revoke the credential and load it from a secret manager."
                }
              ],
              resolvedFindings: [],
              unchangedFindings: [],
              suppressedFindings: []
            },
            history: {
              savedAt: "2026-07-02T00:05:00.000Z",
              scan: {
                id: "scan_test",
                repository: {
                  owner: "example",
                  name: "repo",
                  url: "https://github.com/example/repo",
                  defaultBranch: "main"
                },
                summary: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
                warnings: [],
                findings: []
              }
            }
          })
        };
      })
    );
  });

  it("submits a GitHub URL and renders findings", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getAllByText("Possible exposed credential").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText(".env:1").length).toBeGreaterThan(0);
  });

  it("renders actionable Korean finding details after a scan", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    expect(await screen.findByRole("heading", { name: "위험 요약 / Risk summary" })).toBeInTheDocument();
    expect(screen.getByText("즉시 조치 필요")).toBeInTheDocument();
    expect(screen.getByText("영향도 / Impact")).toBeInTheDocument();
    expect(screen.getByText("필요 조치 / Required action")).toBeInTheDocument();
    expect(screen.getByText("발견 근거 / Evidence")).toBeInTheDocument();
    expect(screen.getByText("발견 위치 / Location")).toBeInTheDocument();
    expect(screen.getByText("취약점 / Vulnerability")).toBeInTheDocument();
    expect(screen.getByText("우선순위 / Priority")).toBeInTheDocument();
    expect(screen.getByText("신뢰도 / Confidence")).toBeInTheDocument();
    expect(screen.getByText("높음")).toBeInTheDocument();
  });

  it("renders core scan result labels in Korean and English", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    expect(await screen.findByRole("heading", { name: "위험 요약 / Risk summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "비교 / Comparison" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "발견 항목 / Findings" })).toBeInTheDocument();
    expect(screen.getByText("취약점 / Vulnerability")).toBeInTheDocument();
    expect(screen.getByText("필요 조치 / Required action")).toBeInTheDocument();
    expect(screen.getByText("새로 발견 / New")).toBeInTheDocument();
    expect(screen.getByText("해결됨 / Resolved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "마크다운 보고서 / Markdown report" })).toBeInTheDocument();
  });

  it("renders rule settings and can toggle a rule", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    expect(await screen.findByRole("heading", { name: "스캔 설정 / Scan settings" })).toBeInTheDocument();
    const ruleToggle = await screen.findByLabelText(/Possible exposed credential/);

    fireEvent.click(ruleToggle);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scans/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("setRuleEnabled")
        })
      );
    });
  });

  it("shows scan progress while scanning", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    expect(await screen.findByText(/진행 상태 \/ Progress/)).toBeInTheDocument();
  });

  it("loads and renders recent scan history", async () => {
    render(<Home />);

    expect(await screen.findByText("최근 스캔 / Recent scans")).toBeInTheDocument();
    expect(screen.getAllByText("example/repo").length).toBeGreaterThan(0);
    expect(screen.getByText("scan_previous")).toBeInTheDocument();
  });

  it("can mark a recent scan as baseline", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    fireEvent.click(await screen.findByRole("button", { name: "기준선 지정 / Set baseline scan_previous" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scans/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("setBaseline")
        })
      );
    });
    expect(await screen.findByRole("button", { name: "기준선 지정 / Set baseline scan_previous" })).toBeDisabled();
  });

  it("opens a saved scan from recent history with details and comparison", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByRole("button", { name: "열기 / Open scan_previous" }));

    expect(await screen.findByText(/저장된 스캔을 보는 중/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "위험 요약 / Risk summary" })).toBeInTheDocument();
    expect(screen.getByText("필요 조치 / Required action")).toBeInTheDocument();
    expect(screen.getByText(/Compared with scan_older/)).toBeInTheDocument();
    expect(screen.getAllByText("Possible exposed credential").length).toBeGreaterThan(0);
  });

  it("deletes the open saved scan from recent history and clears the report", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByRole("button", { name: "열기 / Open scan_previous" }));
    expect(await screen.findByText(/저장된 스캔을 보는 중/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "삭제 / Delete scan_previous" }));

    await waitFor(() => {
      expect(screen.queryByText("scan_previous")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "스캔 준비 / Ready to scan" })).toBeInTheDocument();
  });

  it("selects a GitHub App repository and fills scan inputs", async () => {
    render(<Home />);

    const installationSelect = await screen.findByLabelText("GitHub App installation");
    fireEvent.change(installationSelect, { target: { value: "123" } });

    const repositorySelect = await screen.findByLabelText("GitHub App repository");
    fireEvent.change(repositorySelect, { target: { value: "https://github.com/example/repo" } });

    expect(screen.getByLabelText("GitHub repository URL")).toHaveValue("https://github.com/example/repo");
    expect(screen.getByLabelText("GitHub App installation ID")).toHaveValue(123);
  });

  it("shows GitHub App configuration status when installations cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === "/api/github/installations") {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: "GitHub App is not configured." })
          };
        }
        if (url === "/api/scans") {
          return { ok: true, json: async () => ({ history: [] }) };
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    render(<Home />);

    expect(await screen.findByText("GitHub App is not configured.")).toBeInTheDocument();
  });

  it("does not show Security and Network Jobs content", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    await screen.findByText("최근 스캔 / Recent scans");
    expect(fetchMock).toHaveBeenCalledWith("/api/scans");
    expect(screen.queryByRole("link", { name: "Job dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("시장 수요 기반 추천 점검")).not.toBeInTheDocument();
    expect(screen.queryByText("추천 점검 템플릿")).not.toBeInTheDocument();
    expect(screen.queryByText("주간 수요 추세")).not.toBeInTheDocument();
  });

  it("renders scan comparison after a repository scan", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getByText("비교 / Comparison")).toBeInTheDocument();
    });

    expect(screen.getByText("새로 발견 / New")).toBeInTheDocument();
    expect(screen.getByText("해결됨 / Resolved")).toBeInTheDocument();
    expect(screen.getByText("유지됨 / Unchanged")).toBeInTheDocument();
    expect(screen.getAllByText("Possible exposed credential").length).toBeGreaterThan(0);
  });

  it("can mark a finding as false positive", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    fireEvent.click(await screen.findByRole("button", { name: "오탐 처리 / Mark false positive" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scans/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("suppressFinding")
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/발견 항목 \/ Findings: 0/)).toBeInTheDocument();
    });

    fireEvent.click(await screen.findByRole("button", { name: "오탐 해제 / Restore finding" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scans/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("unsuppressFinding")
        })
      );
    });
    expect(await screen.findByText(/발견 항목 \/ Findings: 1/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "새 발견 항목 / New findings" })).toBeInTheDocument();
  });

  it("renders detailed comparison groups", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getByText(/Compared with scan_previous/)).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "새 발견 항목 / New findings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "해결된 항목 / Resolved findings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "유지된 항목 / Unchanged findings" })).toBeInTheDocument();
    expect(screen.getByText("해결된 항목이 없습니다. / No resolved findings.")).toBeInTheDocument();
    expect(screen.getByText("유지된 항목이 없습니다. / No unchanged findings.")).toBeInTheDocument();
  });

  it("shows a Markdown report download link after a repository scan", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    const link = await screen.findByRole("link", { name: "마크다운 보고서 / Markdown report" });

    expect(link).toHaveAttribute("href", "/api/scans/scan_test/markdown");
  });

  it("shows a security checklist download link after a repository scan", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    const link = await screen.findByRole("link", { name: "체크리스트 / Checklist" });

    expect(link).toHaveAttribute("href", "/api/scans/scan_test/checklist");
  });

  it("submits only repository scan input", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getAllByText("Possible exposed credential").length).toBeGreaterThan(0);
    });

    const scanRequest = fetchMock.mock.calls.find(
      ([input, init]) => input.toString() === "/api/scans" && init?.method === "POST"
    );
    expect(JSON.parse(scanRequest?.[1]?.body as string)).toEqual({
      repositoryUrl: "https://github.com/example/repo"
    });
    expect(screen.queryByText("적용된 점검 기준")).not.toBeInTheDocument();
  });

  it("submits an optional GitHub App installation ID", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.change(screen.getByLabelText("GitHub App installation ID"), {
      target: { value: "123" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getAllByText("Possible exposed credential").length).toBeGreaterThan(0);
    });

    const scanRequest = fetchMock.mock.calls.find(
      ([input, init]) => input.toString() === "/api/scans" && init?.method === "POST"
    );
    expect(JSON.parse(scanRequest?.[1]?.body as string)).toEqual({
      repositoryUrl: "https://github.com/example/repo",
      installationId: 123
    });
  });

  it("creates a GitHub Issue from the current scan when installation ID is set", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === "/api/scans" && !init) {
        return { ok: true, json: async () => ({ history: [] }) } as Response;
      }
      if (url === "/api/scans/scan_test/github-issue") {
        return {
          ok: true,
          json: async () => ({ issue: { url: "https://github.com/example/repo/issues/1" } })
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          scan: {
            id: "scan_test",
            repository: {
              owner: "example",
              name: "repo",
              url: "https://github.com/example/repo",
              defaultBranch: "main"
            },
            summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            warnings: [],
            findings: []
          },
          comparison: {
            previousScanId: null,
            baselineScanId: null,
            comparisonSource: "none",
            newFindings: [],
            resolvedFindings: [],
            unchangedFindings: [],
            suppressedFindings: []
          },
          history: {
            savedAt: "2026-07-02T00:00:00.000Z",
            scan: {
              id: "scan_test",
              repository: {
                owner: "example",
                name: "repo",
                url: "https://github.com/example/repo",
                defaultBranch: "main"
              },
              summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
              warnings: [],
              findings: []
            }
          }
        })
      } as Response;
    });

    render(<Home />);
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.change(screen.getByLabelText("GitHub App installation ID"), {
      target: { value: "123" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    const button = await screen.findByRole("button", { name: "Create GitHub issue" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "GitHub issue created" })).toHaveAttribute(
        "href",
        "https://github.com/example/repo/issues/1"
      );
    });
  });
});
