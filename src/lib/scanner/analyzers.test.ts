import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analyzers";
import { sampleFiles } from "./__fixtures__/sampleFiles";

describe("analyzeFiles", () => {
  it("detects secrets, dangerous execution, prompt risks, and MCP risks", () => {
    const findings = analyzeFiles(sampleFiles);

    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "secret.env-file",
        "secret.exposed-token",
        "dangerous-execution.child-process",
        "prompt-injection.reveal-system-prompt",
        "mcp.broad-filesystem-shell"
      ])
    );
  });

  it("redacts secret evidence", () => {
    const findings = analyzeFiles(sampleFiles);
    const secretFinding = findings.find((finding) => finding.ruleId === "secret.exposed-token");

    expect(secretFinding?.evidence).toContain("sk-...redacted...");
    expect(secretFinding?.evidence).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });

  it("flags environment variants without exposing compound secret values", () => {
    const findings = analyzeFiles([
      {
        path: ".env.local",
        size: 48,
        content: "SERVICE_API_KEY=abcdefghijklmnopqrstuvwxyz123456\n"
      }
    ]);

    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["secret.env-file", "secret.exposed-token"])
    );
    expect(findings.find((finding) => finding.ruleId === "secret.exposed-token")?.evidence).toBe(
      "SERVICE_API_KEY=...redacted..."
    );
  });
});
