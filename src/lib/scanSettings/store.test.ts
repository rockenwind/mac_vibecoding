import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createJsonScanSettingsStore,
  createPostgresScanSettingsStore,
  createSqliteScanSettingsStore,
  readScanSettings,
  repositoryKey,
  setBaselineScan,
  upsertScanSchedule,
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
      rules: [],
      schedules: []
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
      rules: [{ ruleId: "secret.exposed-token", enabled: false, updatedAt: "2026-07-05T00:02:00.000Z" }],
      schedules: []
    });
  });

  it("stores scheduled scans in the default JSON store", async () => {
    await upsertScanSchedule(
      {
        repositoryKey: "example/repo",
        repositoryUrl: "https://github.com/example/repo",
        installationId: 123,
        enabled: true,
        intervalDays: 7,
        nextRunAt: "2026-07-06T00:00:00.000Z",
        notifyOnNewFindings: true,
        notifyOnResolvedFindings: true
      },
      new Date("2026-07-05T00:00:00Z")
    );

    await expect(readScanSettings()).resolves.toMatchObject({
      schedules: [
        {
          repositoryKey: "example/repo",
          repositoryUrl: "https://github.com/example/repo",
          installationId: 123,
          enabled: true,
          intervalDays: 7,
          nextRunAt: "2026-07-06T00:00:00.000Z",
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true,
          createdAt: "2026-07-05T00:00:00.000Z",
          updatedAt: "2026-07-05T00:00:00.000Z"
        }
      ]
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
      ],
      schedules: []
    });
  });

  it("can store settings through Postgres", async () => {
    const tables = {
      baselines: new Map<string, { repository_key: string; scan_id: string; updated_at: string }>(),
      suppressions: new Map<string, { repository_key: string; fingerprint: string; reason: string | null; created_at: string }>(),
      rules: new Map<string, { rule_id: string; enabled: boolean; updated_at: string }>(),
      schedules: new Map<
        string,
        {
          repository_key: string;
          repository_url: string;
          installation_id: number | null;
          enabled: boolean;
          interval_days: number;
          next_run_at: string;
          last_run_at: string | null;
          last_scan_id: string | null;
          notify_on_new_findings: boolean;
          notify_on_resolved_findings: boolean;
          created_at: string;
          updated_at: string;
        }
      >()
    };
    const store = createPostgresScanSettingsStore("postgresql://example", () => ({
      async query<Row = Record<string, unknown>>(sql: string, params: unknown[] = []) {
        if (sql.includes("CREATE TABLE")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("INSERT INTO scan_baselines")) {
          tables.baselines.set(String(params[0]), {
            repository_key: String(params[0]),
            scan_id: String(params[1]),
            updated_at: String(params[2])
          });
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO scan_suppressions")) {
          tables.suppressions.set(`${params[0]}:${params[1]}`, {
            repository_key: String(params[0]),
            fingerprint: String(params[1]),
            reason: params[2] ? String(params[2]) : null,
            created_at: String(params[3])
          });
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO scan_rule_settings")) {
          tables.rules.set(String(params[0]), {
            rule_id: String(params[0]),
            enabled: Boolean(params[1]),
            updated_at: String(params[2])
          });
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO scan_schedules")) {
          tables.schedules.set(String(params[0]), {
            repository_key: String(params[0]),
            repository_url: String(params[1]),
            installation_id: typeof params[2] === "number" ? params[2] : null,
            enabled: Boolean(params[3]),
            interval_days: Number(params[4]),
            next_run_at: String(params[5]),
            last_run_at: params[6] ? String(params[6]) : null,
            last_scan_id: params[7] ? String(params[7]) : null,
            notify_on_new_findings: Boolean(params[8]),
            notify_on_resolved_findings: Boolean(params[9]),
            created_at: String(params[10]),
            updated_at: String(params[11])
          });
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("SELECT repository_key, scan_id")) {
          return { rows: [...tables.baselines.values()] as Row[], rowCount: tables.baselines.size };
        }
        if (sql.includes("SELECT repository_key, fingerprint")) {
          return { rows: [...tables.suppressions.values()] as Row[], rowCount: tables.suppressions.size };
        }
        if (sql.includes("SELECT rule_id, enabled")) {
          return { rows: [...tables.rules.values()] as Row[], rowCount: tables.rules.size };
        }
        if (sql.includes("SELECT repository_key, repository_url")) {
          return { rows: [...tables.schedules.values()] as Row[], rowCount: tables.schedules.size };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    }));

    await store.setBaseline("example/repo", "scan_postgres", new Date("2026-07-05T00:00:00Z"));
    await store.suppressFinding({
      repositoryKey: "example/repo",
      fingerprint: "fp",
      now: new Date("2026-07-05T00:01:00Z")
    });
    await store.setRuleEnabled("secret.exposed-token", false, new Date("2026-07-05T00:02:00Z"));
    await store.upsertSchedule(
      {
        repositoryKey: "example/repo",
        repositoryUrl: "https://github.com/example/repo",
        installationId: 123,
        enabled: true,
        intervalDays: 7,
        nextRunAt: "2026-07-06T00:00:00.000Z",
        notifyOnNewFindings: true,
        notifyOnResolvedFindings: true
      },
      new Date("2026-07-05T00:03:00Z")
    );

    await expect(store.read()).resolves.toMatchObject({
      baselines: [{ repositoryKey: "example/repo", scanId: "scan_postgres" }],
      suppressions: [{ repositoryKey: "example/repo", fingerprint: "fp" }],
      rules: [{ ruleId: "secret.exposed-token", enabled: false }],
      schedules: [{ repositoryKey: "example/repo", installationId: 123, intervalDays: 7 }]
    });
  });
});
