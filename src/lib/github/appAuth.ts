import { createSign } from "node:crypto";
import type { GitHubAppConfig } from "./appConfig";

export function createGitHubAppJwt(
  config: Extract<GitHubAppConfig, { configured: true }>,
  now = new Date()
): string {
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const expiresAt = issuedAt + 600;
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const payload = encodeJson({ iss: config.appId, iat: issuedAt, exp: expiresAt });
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");

  signer.update(signingInput);
  signer.end();

  return `${signingInput}.${signer.sign(config.privateKey, "base64url")}`;
}

function encodeJson(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
