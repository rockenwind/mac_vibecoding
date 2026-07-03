import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compareScanResults,
  createJsonScanHistoryStore,
  createSqliteScanHistoryStore,
  deleteScan,
  readScanHistory,
  recordScan
} from "./store";
import type { ScanResult } from "@/lib/scanner/types";

let tempDir: string;

const baseScan: ScanResult = {
  id: "scan_base",
  repository: {
    owner: "example",
    name: "repo",
    url: "https://github.com/example/repo",
    defaultBranch: "main"
  },
  summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
  warnings: [],
  findings: [
    {
      id: "secret.exposed-token:.env:1",
      ruleId: "secret.exposed-token",
      title: "Possible exposed credential",
      severity: "critical",
      category: "secret",
      filePath: ".env",
      lineStart: 1,
      lineEnd: 1,
      evidence: "OPENAI_API_KEY=sk-...redacted...",
      whyItMatters: "Exposed credentials can let attackers access services.",
      fixSuggestion: "Revoke the credential and load it from a secret manager."
    }
  ]
};

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "scan-history-"));
  process.env.SCAN_HISTORY_FILE = join(tempDir, "scans.json");
});

afterEach(async () => {
  delete process.env.SCAN_HISTORY_FILE;
  delete process.env.SCAN_HISTORY_DATABASE_URL;
  await rm(tempDir, { recursive: true, force: true });
});

describe("scan history store", () => {
  it("returns an empty history when the history file does not exist", async () => {
    await expect(readScanHistory()).resolves.toEqual([]);
  });

  it("records scans and returns the newest scan first", async () => {
    const first = await recordScan({ ...baseScan, id: "scan_old" }, new Date("2026-07-01T00:00:00Z"));
    const second = await recordScan({ ...baseScan, id: "scan_new" }, new Date("2026-07-02T00:00:00Z"));

    const history = await readScanHistory();

    expect(first.savedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(second.savedAt).toBe("2026-07-02T00:00:00.000Z");
    expect(history.map((entry) => entry.scan.id)).toEqual(["scan_new", "scan_old"]);
  });

  it("deletes a saved scan from the default JSON history store", async () => {
    await recordScan({ ...baseScan, id: "scan_old" }, new Date("2026-07-01T00:00:00Z"));
    await recordScan({ ...baseScan, id: "scan_new" }, new Date("2026-07-02T00:00:00Z"));

    await expect(deleteScan("scan_old")).resolves.toBe(true);
    await expect(readScanHistory()).resolves.toMatchObject([{ scan: { id: "scan_new" } }]);
    await expect(deleteScan("missing")).resolves.toBe(false);
  });

  it("can read and write through an injected JSON history store", async () => {
    const store = createJsonScanHistoryStore(join(tempDir, "custom", "history.json"));

    await store.record({ ...baseScan, id: "scan_store" }, new Date("2026-07-02T00:00:00Z"));

    await expect(store.read()).resolves.toMatchObject([
      {
        savedAt: "2026-07-02T00:00:00.000Z",
        scan: { id: "scan_store" }
      }
    ]);
  });

  it("can read and write through an injected SQLite history store", async () => {
    const store = createSqliteScanHistoryStore(join(tempDir, "scans.sqlite"));

    await store.record({ ...baseScan, id: "scan_sqlite" }, new Date("2026-07-02T00:00:00Z"));

    await expect(store.read()).resolves.toMatchObject([
      {
        savedAt: "2026-07-02T00:00:00.000Z",
        scan: { id: "scan_sqlite" }
      }
    ]);
  });

  it("can delete a saved scan through an injected SQLite history store", async () => {
    const store = createSqliteScanHistoryStore(join(tempDir, "scans.sqlite"));

    await store.record({ ...baseScan, id: "scan_sqlite_old" }, new Date("2026-07-01T00:00:00Z"));
    await store.record({ ...baseScan, id: "scan_sqlite_new" }, new Date("2026-07-02T00:00:00Z"));

    await expect(store.delete("scan_sqlite_old")).resolves.toBe(true);
    await expect(store.read()).resolves.toMatchObject([{ scan: { id: "scan_sqlite_new" } }]);
    await expect(store.delete("missing")).resolves.toBe(false);
  });

  it("uses SQLite as the default store when SCAN_HISTORY_DATABASE_URL is configured", async () => {
    delete process.env.SCAN_HISTORY_FILE;
    const databaseFile = join(tempDir, "default.sqlite");
    process.env.SCAN_HISTORY_DATABASE_URL = `sqlite:${databaseFile}`;

    await recordScan({ ...baseScan, id: "scan_default_sqlite" }, new Date("2026-07-02T00:00:00Z"));

    await expect(readScanHistory()).resolves.toMatchObject([
      {
        savedAt: "2026-07-02T00:00:00.000Z",
        scan: { id: "scan_default_sqlite" }
      }
    ]);
    await expect(stat(databaseFile)).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  it("compares a scan with the previous scan from the same repository", async () => {
    const previous = await recordScan(
      {
        ...baseScan,
        id: "scan_previous",
        findings: [
          baseScan.findings[0],
          {
            ...baseScan.findings[0],
            id: "dangerous-eval:src/app.ts:10",
            title: "Dangerous eval usage",
            severity: "high",
            filePath: "src/app.ts",
            lineStart: 10,
            lineEnd: 10
          }
        ]
      },
      new Date("2026-07-01T00:00:00Z")
    );
    const current = {
      ...baseScan,
      id: "scan_current",
      findings: [
        baseScan.findings[0],
        {
          ...baseScan.findings[0],
          id: "prompt-injection:src/prompt.ts:4",
          title: "Prompt injection risk",
          severity: "medium" as const,
          filePath: "src/prompt.ts",
          lineStart: 4,
          lineEnd: 4
        }
      ]
    };

    const comparison = compareScanResults(current, previous);

    expect(comparison.previousScanId).toBe("scan_previous");
    expect(comparison.newFindings.map((finding) => finding.id)).toEqual(["prompt-injection:src/prompt.ts:4"]);
    expect(comparison.resolvedFindings.map((finding) => finding.id)).toEqual(["dangerous-eval:src/app.ts:10"]);
    expect(comparison.unchangedFindings.map((finding) => finding.id)).toEqual([
      "secret.exposed-token:.env:1"
    ]);
  });
});
