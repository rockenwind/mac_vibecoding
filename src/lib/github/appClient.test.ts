import { describe, expect, it, vi } from "vitest";
import {
  GitHubAppApiError,
  createInstallationAccessToken,
  listGitHubAppInstallations,
  listInstallationRepositories
} from "./appClient";

describe("GitHub App client", () => {
  it("lists GitHub App installations", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json([
        {
          id: 123,
          account: { login: "example" },
          repository_selection: "selected",
          repositories_url: "https://api.github.com/installation/repositories",
          target_type: "Organization",
          app_id: 456
        }
      ])
    );

    await expect(listGitHubAppInstallations("jwt-token", fetchMock)).resolves.toEqual([
      {
        id: 123,
        account: "example",
        repositories: 0,
        repositorySelection: "selected",
        targetType: "Organization"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/app/installations", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer jwt-token",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
  });

  it("creates an installation access token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ token: "installation-token" }));

    await expect(createInstallationAccessToken("jwt-token", 123, fetchMock)).resolves.toBe(
      "installation-token"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/123/access_tokens",
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer jwt-token",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
  });

  it("lists repositories for an installation token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        repositories: [
          {
            id: 1,
            name: "repo",
            full_name: "example/repo",
            private: true,
            default_branch: "main",
            html_url: "https://github.com/example/repo"
          }
        ]
      })
    );

    await expect(listInstallationRepositories("installation-token", fetchMock)).resolves.toEqual([
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

  it("maps GitHub permission failures to an API error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 403 }));

    await expect(listGitHubAppInstallations("jwt-token", fetchMock)).rejects.toMatchObject({
      status: 502,
      message: "GitHub App permission was denied."
    });
  });

  it("maps unexpected GitHub failures to an API error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(listGitHubAppInstallations("jwt-token", fetchMock)).rejects.toBeInstanceOf(
      GitHubAppApiError
    );
  });
});
