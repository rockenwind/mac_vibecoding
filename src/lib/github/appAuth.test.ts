import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGitHubAppJwt } from "./appAuth";

describe("createGitHubAppJwt", () => {
  it("creates a GitHub App JWT with app issuer and short expiry", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = createGitHubAppJwt(
      {
        configured: true,
        appId: "12345",
        privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
        clientId: undefined
      },
      new Date("2026-07-02T00:00:00Z")
    );

    const [header, payload, signature] = jwt.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString("utf8"))).toEqual({
      alg: "RS256",
      typ: "JWT"
    });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))).toEqual({
      iss: "12345",
      iat: 1782950340,
      exp: 1782950940
    });
    expect(signature.length).toBeGreaterThan(0);
  });
});
