import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
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
      expect(screen.getByText("Possible exposed credential")).toBeInTheDocument();
    });
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText(".env:1")).toBeInTheDocument();
  });

  it("does not load or show Security and Network Jobs content", () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Job dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("시장 수요 기반 추천 점검")).not.toBeInTheDocument();
    expect(screen.queryByText("추천 점검 템플릿")).not.toBeInTheDocument();
    expect(screen.queryByText("주간 수요 추세")).not.toBeInTheDocument();
  });

  it("submits only repository scan input", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getByText("Possible exposed credential")).toBeInTheDocument();
    });

    const scanRequest = fetchMock.mock.calls.find(([input]) => input.toString() === "/api/scans");
    expect(JSON.parse(scanRequest?.[1]?.body as string)).toEqual({
      repositoryUrl: "https://github.com/example/repo"
    });
    expect(screen.queryByText("적용된 점검 기준")).not.toBeInTheDocument();
  });
});
