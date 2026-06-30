import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/github/source", () => ({
  fetchRepositoryFiles: vi.fn(async () => ({
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
  }))
}));

describe("POST /api/scans", () => {
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
});
