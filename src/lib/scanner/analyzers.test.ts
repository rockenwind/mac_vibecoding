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

  it("does not flag MCP configs with only shell access or only broad filesystem access", () => {
    const findings = analyzeFiles([
      {
        path: "mcp-command-only.json",
        size: 68,
        content: "{\"servers\":{\"local\":{\"command\":\"bash\",\"args\":[\"-lc\",\"echo hi\"]}}}"
      },
      {
        path: "mcp-root-only.json",
        size: 52,
        content: "{\"servers\":{\"local\":{\"roots\":[\"/\"],\"command\":\"node\"}}}"
      }
    ]);

    expect(findings.map((finding) => finding.ruleId)).not.toContain("mcp.broad-filesystem-shell");
  });

  it("flags environment files with backslash paths and mixed-case names", () => {
    const findings = analyzeFiles([
      {
        path: "config\\.env.production",
        size: 0,
        content: ""
      },
      {
        path: ".ENV.local",
        size: 0,
        content: ""
      }
    ]);

    expect(findings.filter((finding) => finding.ruleId === "secret.env-file")).toHaveLength(2);
  });
});
