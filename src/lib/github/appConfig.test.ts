import { describe, expect, it } from "vitest";
import { readGitHubAppConfig } from "./appConfig";

describe("readGitHubAppConfig", () => {
  it("returns a configured GitHub App config when required values exist", () => {
    expect(
      readGitHubAppConfig({
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        GITHUB_APP_CLIENT_ID: "client-id"
      })
    ).toEqual({
      configured: true,
      appId: "12345",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      clientId: "client-id"
    });
  });

  it("reports missing required values without exposing secrets", () => {
    expect(readGitHubAppConfig({ GITHUB_APP_ID: "12345" })).toEqual({
      configured: false,
      missing: ["GITHUB_APP_PRIVATE_KEY"]
    });
  });
});
