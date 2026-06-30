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
});
