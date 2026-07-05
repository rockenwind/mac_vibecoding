import { describe, expect, it } from "vitest";
import { runScan } from "./scan";
import { sampleFiles } from "./__fixtures__/sampleFiles";

describe("runScan", () => {
  it("filters files, runs analyzers, and aggregates severity counts", () => {
    const scan = runScan({
      repository: {
        owner: "example",
        name: "repo",
        url: "https://github.com/example/repo",
        defaultBranch: "main"
      },
      files: [
        ...sampleFiles,
        { path: "node_modules/ignored/index.js", size: 20, content: "eval(userInput)" }
      ],
      warnings: []
    });

    expect(scan.id).toMatch(/^scan_/);
    expect(scan.repository.name).toBe("repo");
    expect(scan.summary.critical).toBeGreaterThan(0);
    expect(scan.summary.high).toBeGreaterThan(0);
    expect(scan.findings.some((finding) => finding.filePath.includes("node_modules"))).toBe(false);
  });

  it("does not attach job signal metadata to repository scan results", () => {
    const scan = runScan({
      repository: {
        owner: "example",
        name: "repo",
        url: "https://github.com/example/repo",
        defaultBranch: "main"
      },
      files: sampleFiles,
      warnings: [],
      focus: {
        area: "클라우드 권한과 비밀값 노출",
        keywords: ["클라우드 보안", "AWS", "IAM"],
        checklist: ["권한 상승이 가능한 IAM 정책과 장기 접근 키를 확인합니다."]
      }
    } as Parameters<typeof runScan>[0] & { focus: unknown });

    expect("focus" in scan).toBe(false);
  });

  it("excludes disabled rules from scan results and summary", () => {
    const scan = runScan(
      {
        repository: {
          owner: "example",
          name: "repo",
          url: "https://github.com/example/repo",
          defaultBranch: "main"
        },
        files: sampleFiles,
        warnings: []
      },
      { disabledRuleIds: ["secret.exposed-token", "secret.env-file"] }
    );

    expect(scan.findings.map((finding) => finding.ruleId)).not.toEqual(
      expect.arrayContaining(["secret.exposed-token", "secret.env-file"])
    );
    expect(scan.summary.critical).toBe(0);
  });
});
