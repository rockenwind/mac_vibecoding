import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
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
              newFindings: [
                {
                  id: "secret.exposed-token:.env:1",
                  ruleId: "secret.exposed-token",
                  title: "Possible exposed credential",
                  severity: "critical",
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
              unchangedFindings: []
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

  it("loads and renders recent scan history", async () => {
    render(<Home />);

    expect(await screen.findByText("Recent scans")).toBeInTheDocument();
    expect(screen.getAllByText("example/repo").length).toBeGreaterThan(0);
    expect(screen.getByText("scan_previous")).toBeInTheDocument();
  });

  it("does not show Security and Network Jobs content", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    await screen.findByText("Recent scans");
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
      expect(screen.getByText("Comparison")).toBeInTheDocument();
    });

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Unchanged")).toBeInTheDocument();
    expect(screen.getAllByText("Possible exposed credential").length).toBeGreaterThan(0);
  });

  it("renders detailed comparison groups", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getByText("Compared with scan_previous")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "New findings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resolved findings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unchanged findings" })).toBeInTheDocument();
    expect(screen.getByText("No resolved findings.")).toBeInTheDocument();
    expect(screen.getByText("No unchanged findings.")).toBeInTheDocument();
  });

  it("shows a Markdown report download link after a repository scan", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    const link = await screen.findByRole("link", { name: "Markdown report" });

    expect(link).toHaveAttribute("href", "/api/scans/scan_test/markdown");
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
          comparison: { previousScanId: null, newFindings: [], resolvedFindings: [], unchangedFindings: [] },
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
