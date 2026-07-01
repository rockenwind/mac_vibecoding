import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/market-signals") {
          return {
            ok: true,
            json: async () => ({
              generatedAt: "2026-07-01T00:00:00.000Z",
              sampleSize: 12,
              weeklyTrend: {
                currentWeekJobs: 7,
                previousWeekJobs: 4,
                direction: "up",
                summary: "최근 7일 공고 7건, 이전 7일 공고 4건으로 수요가 늘었습니다."
              },
              signals: [
                {
                  area: "클라우드 권한과 비밀값 노출",
                  keywords: ["클라우드 보안", "AWS", "IAM"],
                  score: 8,
                  jobCount: 3,
                  trend: "최근 공고에서 클라우드 보안, AWS, IAM 수요가 확인됩니다.",
                  template: {
                    purpose: "클라우드 권한과 비밀값 노출 위험을 빠르게 확인합니다.",
                    scanKeywords: ["클라우드 보안", "AWS", "IAM"],
                    reviewTargets: ["인프라 설정", "환경 변수"],
                    checklist: [
                      "권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다.",
                      "저장소와 배포 설정에 클라우드 비밀값이 남아 있는지 확인합니다."
                    ]
                  }
                }
              ]
            })
          };
        }

        const requestBody = typeof init?.body === "string" ? JSON.parse(init.body) : {};

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
              focus: requestBody.focus,
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
    expect(screen.getByText("최근 7일 공고 7건, 이전 7일 공고 4건으로 수요가 늘었습니다.")).toBeInTheDocument();
  });

  it("opens a security checklist when a market recommendation is selected", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByRole("button", { name: /클라우드 권한과 비밀값 노출/ }));

    expect(screen.getByText("추천 점검 템플릿")).toBeInTheDocument();
    expect(screen.getByText("클라우드 권한과 비밀값 노출 위험을 빠르게 확인합니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 공고에서 클라우드 보안, AWS, IAM 수요가 확인됩니다.")).toBeInTheDocument();
    expect(screen.getByText("권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다.")).toBeInTheDocument();
    expect(screen.getAllByText("클라우드 보안, AWS, IAM")).toHaveLength(2);
  });

  it("applies a market recommendation to the next repository scan", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Home />);

    fireEvent.click(await screen.findByRole("button", { name: /클라우드 권한과 비밀값 노출/ }));
    fireEvent.click(screen.getByRole("button", { name: "이 기준으로 스캔 준비" }));
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/example/repo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan repository" }));

    await waitFor(() => {
      expect(screen.getByText("Possible exposed credential")).toBeInTheDocument();
    });

    const scanRequest = fetchMock.mock.calls.find(([input]) => input.toString() === "/api/scans");
    expect(JSON.parse(scanRequest?.[1]?.body as string)).toMatchObject({
      repositoryUrl: "https://github.com/example/repo",
      focus: {
        area: "클라우드 권한과 비밀값 노출",
        keywords: ["클라우드 보안", "AWS", "IAM"],
        checklist: expect.arrayContaining(["권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다."])
      }
    });
    expect(screen.getByText("적용된 점검 기준")).toBeInTheDocument();
  });
});
