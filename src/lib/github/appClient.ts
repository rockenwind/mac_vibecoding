export type GitHubAppInstallation = {
  id: number;
  account: string;
  repositories: number;
  repositorySelection: string;
  targetType: string;
};

export type GitHubInstallationRepository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
};

type Fetch = typeof fetch;

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_JSON_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": GITHUB_API_VERSION
};

export class GitHubAppApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "GitHubAppApiError";
    this.status = status;
  }
}

export async function listGitHubAppInstallations(
  appJwt: string,
  fetchImpl: Fetch = fetch
): Promise<GitHubAppInstallation[]> {
  const response = await fetchImpl("https://api.github.com/app/installations", {
    headers: authHeaders(appJwt, "Bearer")
  });

  await throwIfGitHubError(response, "GitHub App installations could not be fetched.");

  const body = (await response.json()) as Array<{
    id: number;
    account?: { login?: string };
    repository_selection?: string;
    target_type?: string;
    repositories?: unknown[];
  }>;

  return body.map((installation) => ({
    id: installation.id,
    account: installation.account?.login ?? "unknown",
    repositories: Array.isArray(installation.repositories) ? installation.repositories.length : 0,
    repositorySelection: installation.repository_selection ?? "unknown",
    targetType: installation.target_type ?? "unknown"
  }));
}

export async function createInstallationAccessToken(
  appJwt: string,
  installationId: number,
  fetchImpl: Fetch = fetch
): Promise<string> {
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: authHeaders(appJwt, "Bearer")
    }
  );

  await throwIfGitHubError(response, "GitHub App installation token could not be created.");

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new GitHubAppApiError("GitHub App installation token response was invalid.");
  }

  return body.token;
}

export async function listInstallationRepositories(
  installationToken: string,
  fetchImpl: Fetch = fetch
): Promise<GitHubInstallationRepository[]> {
  const response = await fetchImpl("https://api.github.com/installation/repositories", {
    headers: authHeaders(installationToken, "token")
  });

  await throwIfGitHubError(response, "GitHub App repositories could not be fetched.");

  const body = (await response.json()) as {
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      html_url: string;
    }>;
  };

  return (body.repositories ?? []).map((repository) => ({
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    private: repository.private,
    defaultBranch: repository.default_branch,
    url: repository.html_url
  }));
}

function authHeaders(token: string, scheme: "Bearer" | "token"): HeadersInit {
  return {
    ...GITHUB_JSON_HEADERS,
    Authorization: `${scheme} ${token}`
  };
}

async function throwIfGitHubError(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return;
  }

  if (response.status === 401 || response.status === 403) {
    throw new GitHubAppApiError("GitHub App permission was denied.");
  }

  throw new GitHubAppApiError(fallbackMessage);
}
