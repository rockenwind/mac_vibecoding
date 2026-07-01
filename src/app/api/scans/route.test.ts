import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  fetchRepositoryFiles: vi.fn()
}));

vi.mock("@/lib/github/source", () => ({
  fetchRepositoryFiles: mocks.fetchRepositoryFiles
}));

describe("POST /api/scans", () => {
  beforeEach(() => {
    mocks.fetchRepositoryFiles.mockResolvedValue({
    repository: {
      owner: "example",
      name: "repo",
      url: "https://github.com/example/repo",
      defaultBranch: "main"
    },
    files: [
      {
        path: ".env",
        size: 64,
        content: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456"
      }
    ],
    warnings: []
    });
  });

  it("returns a scan result for a valid GitHub URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scan.repository.name).toBe("repo");
    expect(body.scan.findings.length).toBeGreaterThan(0);
  });

  it("accepts market signal focus metadata for a scan", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          focus: {
            area: "클라우드 권한과 비밀값 노출",
            keywords: ["클라우드 보안", "AWS", "IAM"],
            checklist: ["권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다."]
          }
        })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scan.focus).toEqual({
      area: "클라우드 권한과 비밀값 노출",
      keywords: ["클라우드 보안", "AWS", "IAM"],
      checklist: ["권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다."]
    });
  });

  it("returns 400 for an invalid URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "not a url" })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Enter a valid GitHub repository URL.");
  });

  it("returns 400 for a non-string repository URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: 123 })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("repositoryUrl must be a string.");
  });

  it("returns 429 when GitHub rate limits the source adapter", async () => {
    mocks.fetchRepositoryFiles.mockRejectedValueOnce(
      new Error("GitHub rate limit reached. Try again later.")
    );

    const response = await POST(
      new Request("http://localhost/api/scans", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/repo" })
      })
    );

    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("GitHub rate limit reached. Try again later.");
  });
});
