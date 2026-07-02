export type GitHubAppConfig =
  | {
      configured: true;
      appId: string;
      privateKey: string;
      clientId?: string;
    }
  | {
      configured: false;
      missing: string[];
    };

type GitHubAppEnv = Record<string, string | undefined>;

export function readGitHubAppConfig(env: GitHubAppEnv = process.env): GitHubAppConfig {
  const missing: string[] = [];
  const appId = env.GITHUB_APP_ID?.trim();
  const privateKey = normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  const clientId = env.GITHUB_APP_CLIENT_ID?.trim() || undefined;

  if (!appId) {
    missing.push("GITHUB_APP_ID");
  }
  if (!privateKey) {
    missing.push("GITHUB_APP_PRIVATE_KEY");
  }

  if (missing.length) {
    return { configured: false, missing };
  }

  return {
    configured: true,
    appId: appId as string,
    privateKey: privateKey as string,
    clientId
  };
}

function normalizePrivateKey(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\\n/g, "\n") : undefined;
}
