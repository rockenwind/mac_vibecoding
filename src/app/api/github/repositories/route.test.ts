import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  readGitHubAppConfig: vi.fn(),
  createGitHubAppJwt: vi.fn(),
  createInstallationAccessToken: vi.fn(),
  listInstallationRepositories: vi.fn()
}));

vi.mock("@/lib/github/appConfig", () => ({
  readGitHubAppConfig: mocks.readGitHubAppConfig
}));

vi.mock("@/lib/github/appAuth", () => ({
  createGitHubAppJwt: mocks.createGitHubAppJwt
}));

vi.mock("@/lib/github/appClient", () => ({
  createInstallationAccessToken: mocks.createInstallationAccessToken,
  listInstallationRepositories: mocks.listInstallationRepositories
}));

describe("GET /api/github/repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readGitHubAppConfig.mockReturnValue({
      configured: true,
      appId: "12345",
      privateKey: "private-key",
      clientId: undefined
    });
    mocks.createGitHubAppJwt.mockReturnValue("jwt-token");
    mocks.createInstallationAccessToken.mockResolvedValue("installation-token");
    mocks.listInstallationRepositories.mockResolvedValue([
      {
        id: 1,
        name: "repo",
        fullName: "example/repo",
        private: true,
        defaultBranch: "main",
        url: "https://github.com/example/repo"
      }
    ]);
  });

  it("returns repositories for a GitHub App installation", async () => {
    const response = await GET(
      new Request("http://localhost/api/github/repositories?installationId=123")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.repositories).toHaveLength(1);
    expect(body.repositories[0].fullName).toBe("example/repo");
  });

  it("returns 400 when installationId is missing", async () => {
    const response = await GET(new Request("http://localhost/api/github/repositories"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("installationId must be a positive number.");
  });

  it("returns 503 when GitHub App config is missing", async () => {
    mocks.readGitHubAppConfig.mockReturnValueOnce({
      configured: false,
      missing: ["GITHUB_APP_PRIVATE_KEY"]
    });

    const response = await GET(
      new Request("http://localhost/api/github/repositories?installationId=123")
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("GitHub App is not configured.");
  });
});
