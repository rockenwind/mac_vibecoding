import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  readGitHubAppConfig: vi.fn(),
  createGitHubAppJwt: vi.fn(),
  listGitHubAppInstallations: vi.fn()
}));

vi.mock("@/lib/github/appConfig", () => ({
  readGitHubAppConfig: mocks.readGitHubAppConfig
}));

vi.mock("@/lib/github/appAuth", () => ({
  createGitHubAppJwt: mocks.createGitHubAppJwt
}));

vi.mock("@/lib/github/appClient", () => ({
  listGitHubAppInstallations: mocks.listGitHubAppInstallations
}));

describe("GET /api/github/installations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readGitHubAppConfig.mockReturnValue({
      configured: true,
      appId: "12345",
      privateKey: "private-key",
      clientId: undefined
    });
    mocks.createGitHubAppJwt.mockReturnValue("jwt-token");
    mocks.listGitHubAppInstallations.mockResolvedValue([
      {
        id: 123,
        account: "example",
        repositories: 0,
        repositorySelection: "selected",
        targetType: "Organization"
      }
    ]);
  });

  it("returns GitHub App installations", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.installations).toHaveLength(1);
    expect(body.installations[0].account).toBe("example");
  });

  it("returns 503 when GitHub App config is missing", async () => {
    mocks.readGitHubAppConfig.mockReturnValueOnce({
      configured: false,
      missing: ["GITHUB_APP_PRIVATE_KEY"]
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("GitHub App is not configured.");
    expect(body.missing).toEqual(["GITHUB_APP_PRIVATE_KEY"]);
  });
});
