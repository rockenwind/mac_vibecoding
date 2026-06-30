import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redaction";

describe("redactSecrets", () => {
  it("redacts OpenAI-like keys", () => {
    expect(redactSecrets("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "OPENAI_API_KEY=sk-...redacted..."
    );
  });

  it("redacts generic long tokens after credential keys", () => {
    expect(redactSecrets("github_token: ghp_abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "github_token: ghp_...redacted..."
    );
  });

  it("redacts compound credential keys", () => {
    expect(redactSecrets("DATABASE_PASSWORD=supersecretvalue123456")).toBe(
      "DATABASE_PASSWORD=...redacted..."
    );
    expect(redactSecrets('AWS_SECRET_ACCESS_KEY="abcdefghijklmnopqrstuvwxyz123456"')).toBe(
      'AWS_SECRET_ACCESS_KEY="...redacted..."'
    );
  });
});
