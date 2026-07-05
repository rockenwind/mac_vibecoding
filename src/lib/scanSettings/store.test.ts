import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createJsonScanSettingsStore,
  createSqliteScanSettingsStore,
  readScanSettings,
  repositoryKey,
  setBaselineScan,
  setRuleEnabled,
  suppressFinding,
  unsuppressFinding
} from "./store";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "scan-settings-"));
  process.env.SCAN_SETTINGS_FILE = join(tempDir, "settings.json");
});

afterEach(async () => {
  delete process.env.SCAN_SETTINGS_FILE;
  delete process.env.SCAN_HISTORY_DATABASE_URL;
  await rm(tempDir, { recursive: true, force: true });
});

describe("scan settings store", () => {
  it("returns empty settings when no settings file exists", async () => {
    await expect(readScanSettings()).resolves.toEqual({
      baselines: [],
      suppressions: [],
      rules: []
    });
  });

  it("stores baseline, suppression, and rule settings in the default JSON store", async () => {
    const repo = repositoryKey({ owner: "example", name: "repo" });

    await setBaselineScan(repo, "scan_base", new Date("2026-07-05T00:00:00Z"));
    await suppressFinding(
      { repositoryKey: repo, fingerprint: "secret:.env:key", reason: "test fixture" },
      new Date("2026-07-05T00:01:00Z")
    );
    await setRuleEnabled("secret.exposed-token", false, new Date("2026-07-05T00:02:00Z"));

    await expect(readScanSettings()).resolves.toEqual({
      baselines: [{ repositoryKey: repo, scanId: "scan_base", updatedAt: "2026-07-05T00:00:00.000Z" }],
      suppressions: [
        {
          repositoryKey: repo,
          fingerprint: "secret:.env:key",
          reason: "test fixture",
          createdAt: "2026-07-05T00:01:00.000Z"
        }
      ],
      rules: [{ ruleId: "secret.exposed-token", enabled: false, updatedAt: "2026-07-05T00:02:00.000Z" }]
    });
  });

  it("can unsuppress findings and clear baselines", async () => {
    const repo = "example/repo";

    await setBaselineScan(repo, "scan_base");
    await suppressFinding({ repositoryKey: repo, fingerprint: "fp" });
    await unsuppressFinding(repo, "fp");
    const store = createJsonScanSettingsStore(join(tempDir, "settings.json"));
    await store.clearBaseline(repo);

    await expect(readScanSettings()).resolves.toMatchObject({
      suppressions: [],
      baselines: []
    });
  });

  it("can store settings through SQLite", async () => {
    const store = createSqliteScanSettingsStore(join(tempDir, "settings.sqlite"));

    await store.setBaseline("example/repo", "scan_sqlite", new Date("2026-07-05T00:00:00Z"));
    await store.suppressFinding({
      repositoryKey: "example/repo",
      fingerprint: "fp",
      now: new Date("2026-07-05T00:01:00Z")
    });
    await store.setRuleEnabled("network.user-controlled-request", false, new Date("2026-07-05T00:02:00Z"));

    await expect(store.read()).resolves.toEqual({
      baselines: [{ repositoryKey: "example/repo", scanId: "scan_sqlite", updatedAt: "2026-07-05T00:00:00.000Z" }],
      suppressions: [{ repositoryKey: "example/repo", fingerprint: "fp", createdAt: "2026-07-05T00:01:00.000Z" }],
      rules: [
        {
          ruleId: "network.user-controlled-request",
          enabled: false,
          updatedAt: "2026-07-05T00:02:00.000Z"
        }
      ]
    });
  });
});
