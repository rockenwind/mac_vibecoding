import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === "/api/market-signals") {
          return {
            ok: true,
            json: async () => ({
              generatedAt: "2026-07-01T00:00:00.000Z",
              sampleSize: 12,
              signals: [
                {
                  area: "클라우드 권한과 비밀값 노출",
                  keywords: ["클라우드 보안", "AWS", "IAM"],
                  score: 8
                }
              ]
            })
          };
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

  it("links to the local job dashboard", async () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Job dashboard" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:8000/login"
    );
    await screen.findByText("시장 수요 기반 추천 점검");
  });

  it("renders market-based security recommendations", async () => {
    render(<Home />);

    expect(await screen.findByText("시장 수요 기반 추천 점검")).toBeInTheDocument();
    expect(screen.getByText("클라우드 권한과 비밀값 노출")).toBeInTheDocument();
    expect(screen.getByText("최근 공고 12건 기준")).toBeInTheDocument();
  });
});
