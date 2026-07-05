import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { RepositoryRef } from "@/lib/scanner/types";
import type {
  FindingSuppression,
  RepositoryKey,
  RuleSetting,
  ScanBaselineSetting,
  ScanSettings,
  ScanSettingsStore
} from "./types";

const defaultSettingsFile = join(process.cwd(), ".data", "scan-settings.json");

const emptySettings: ScanSettings = {
  baselines: [],
  suppressions: [],
  rules: []
};

export async function readScanSettings(): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().read();
}

export async function setBaselineScan(repositoryKey: RepositoryKey, scanId: string, now = new Date()): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().setBaseline(repositoryKey, scanId, now);
}

export async function clearBaselineScan(repositoryKey: RepositoryKey): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().clearBaseline(repositoryKey);
}

export async function suppressFinding(
  input: { repositoryKey: RepositoryKey; fingerprint: string; reason?: string },
  now = new Date()
): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().suppressFinding({ ...input, now });
}

export async function unsuppressFinding(repositoryKey: RepositoryKey, fingerprint: string): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().unsuppressFinding(repositoryKey, fingerprint);
}

export async function setRuleEnabled(ruleId: string, enabled: boolean, now = new Date()): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().setRuleEnabled(ruleId, enabled, now);
}

export function repositoryKey(repository: Pick<RepositoryRef, "owner" | "name">): RepositoryKey {
  return `${repository.owner}/${repository.name}`;
}

export function disabledRuleIds(settings: ScanSettings): string[] {
  return settings.rules.filter((rule) => !rule.enabled).map((rule) => rule.ruleId);
}

export function suppressedFingerprintsForRepository(
  settings: ScanSettings,
  key: RepositoryKey
): string[] {
  return settings.suppressions
    .filter((suppression) => suppression.repositoryKey === key)
    .map((suppression) => suppression.fingerprint);
}

export function baselineScanIdForRepository(settings: ScanSettings, key: RepositoryKey): string | null {
  return settings.baselines.find((baseline) => baseline.repositoryKey === key)?.scanId ?? null;
}

export function createDefaultScanSettingsStore(): ScanSettingsStore {
  const databaseFile = getSqliteDatabaseFile();
  if (databaseFile) {
    return createSqliteScanSettingsStore(databaseFile);
  }

  return createJsonScanSettingsStore(getSettingsFile());
}

export function createJsonScanSettingsStore(settingsFile: string): ScanSettingsStore {
  async function read(): Promise<ScanSettings> {
    try {
      const raw = await readFile(settingsFile, "utf8");
      if (!raw.trim()) {
        return empty();
      }
      return normalizeSettings(JSON.parse(raw) as Partial<ScanSettings>);
    } catch (error) {
      if (isNotFoundError(error)) {
        return empty();
      }
      if (error instanceof SyntaxError) {
        throw new Error("Scan settings file is not valid JSON.");
      }
      throw error;
    }
  }

  async function write(settings: ScanSettings): Promise<ScanSettings> {
    await mkdir(dirname(settingsFile), { recursive: true });
    await writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return settings;
  }

  return {
    read,
    async setBaseline(key, scanId, now = new Date()) {
      const settings = await read();
      return write({
        ...settings,
        baselines: upsertBaseline(settings.baselines, key, scanId, now)
      });
    },
    async clearBaseline(key) {
      const settings = await read();
      return write({
        ...settings,
        baselines: settings.baselines.filter((baseline) => baseline.repositoryKey !== key)
      });
    },
    async suppressFinding(input) {
      const settings = await read();
      return write({
        ...settings,
        suppressions: upsertSuppression(settings.suppressions, input)
      });
    },
    async unsuppressFinding(key, fingerprint) {
      const settings = await read();
      return write({
        ...settings,
        suppressions: settings.suppressions.filter(
          (suppression) => suppression.repositoryKey !== key || suppression.fingerprint !== fingerprint
        )
      });
    },
    async setRuleEnabled(ruleId, enabled, now = new Date()) {
      const settings = await read();
      return write({
        ...settings,
        rules: upsertRule(settings.rules, ruleId, enabled, now)
      });
    }
  };
}

export function createSqliteScanSettingsStore(databaseFile: string): ScanSettingsStore {
  return {
    async read() {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        const baselines = database
          .prepare("SELECT repository_key, scan_id, updated_at FROM scan_baselines ORDER BY repository_key")
          .all() as Array<{ repository_key: string; scan_id: string; updated_at: string }>;
        const suppressions = database
          .prepare("SELECT repository_key, fingerprint, reason, created_at FROM scan_suppressions ORDER BY repository_key, fingerprint")
          .all() as Array<{ repository_key: string; fingerprint: string; reason: string | null; created_at: string }>;
        const rules = database
          .prepare("SELECT rule_id, enabled, updated_at FROM scan_rule_settings ORDER BY rule_id")
          .all() as Array<{ rule_id: string; enabled: number; updated_at: string }>;

        return {
          baselines: baselines.map((row) => ({
            repositoryKey: row.repository_key,
            scanId: row.scan_id,
            updatedAt: row.updated_at
          })),
          suppressions: suppressions.map((row) => ({
            repositoryKey: row.repository_key,
            fingerprint: row.fingerprint,
            ...(row.reason ? { reason: row.reason } : {}),
            createdAt: row.created_at
          })),
          rules: rules.map((row) => ({
            ruleId: row.rule_id,
            enabled: Boolean(row.enabled),
            updatedAt: row.updated_at
          }))
        };
      } finally {
        database.close();
      }
    },
    async setBaseline(key, scanId, now = new Date()) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database
          .prepare(
            `INSERT INTO scan_baselines (repository_key, scan_id, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(repository_key) DO UPDATE SET scan_id = excluded.scan_id, updated_at = excluded.updated_at`
          )
          .run(key, scanId, now.toISOString());
      } finally {
        database.close();
      }
      return this.read();
    },
    async clearBaseline(key) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database.prepare("DELETE FROM scan_baselines WHERE repository_key = ?").run(key);
      } finally {
        database.close();
      }
      return this.read();
    },
    async suppressFinding(input) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database
          .prepare(
            `INSERT INTO scan_suppressions (repository_key, fingerprint, reason, created_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(repository_key, fingerprint) DO UPDATE SET reason = excluded.reason`
          )
          .run(input.repositoryKey, input.fingerprint, input.reason ?? null, (input.now ?? new Date()).toISOString());
      } finally {
        database.close();
      }
      return this.read();
    },
    async unsuppressFinding(key, fingerprint) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database.prepare("DELETE FROM scan_suppressions WHERE repository_key = ? AND fingerprint = ?").run(key, fingerprint);
      } finally {
        database.close();
      }
      return this.read();
    },
    async setRuleEnabled(ruleId, enabled, now = new Date()) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database
          .prepare(
            `INSERT INTO scan_rule_settings (rule_id, enabled, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(rule_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`
          )
          .run(ruleId, enabled ? 1 : 0, now.toISOString());
      } finally {
        database.close();
      }
      return this.read();
    }
  };
}

function upsertBaseline(
  baselines: ScanBaselineSetting[],
  key: RepositoryKey,
  scanId: string,
  now: Date
): ScanBaselineSetting[] {
  return [
    { repositoryKey: key, scanId, updatedAt: now.toISOString() },
    ...baselines.filter((baseline) => baseline.repositoryKey !== key)
  ].sort((left, right) => left.repositoryKey.localeCompare(right.repositoryKey));
}

function upsertSuppression(
  suppressions: FindingSuppression[],
  input: { repositoryKey: RepositoryKey; fingerprint: string; reason?: string; now?: Date }
): FindingSuppression[] {
  return [
    {
      repositoryKey: input.repositoryKey,
      fingerprint: input.fingerprint,
      ...(input.reason ? { reason: input.reason } : {}),
      createdAt: (input.now ?? new Date()).toISOString()
    },
    ...suppressions.filter(
      (suppression) =>
        suppression.repositoryKey !== input.repositoryKey || suppression.fingerprint !== input.fingerprint
    )
  ].sort((left, right) => left.repositoryKey.localeCompare(right.repositoryKey) || left.fingerprint.localeCompare(right.fingerprint));
}

function upsertRule(rules: RuleSetting[], ruleId: string, enabled: boolean, now: Date): RuleSetting[] {
  return [
    { ruleId, enabled, updatedAt: now.toISOString() },
    ...rules.filter((rule) => rule.ruleId !== ruleId)
  ].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function normalizeSettings(settings: Partial<ScanSettings>): ScanSettings {
  return {
    baselines: Array.isArray(settings.baselines) ? settings.baselines : [],
    suppressions: Array.isArray(settings.suppressions) ? settings.suppressions : [],
    rules: Array.isArray(settings.rules) ? settings.rules : []
  };
}

function empty(): ScanSettings {
  return {
    baselines: [],
    suppressions: [],
    rules: []
  };
}

function getSettingsFile(): string {
  return process.env.SCAN_SETTINGS_FILE ?? defaultSettingsFile;
}

function getSqliteDatabaseFile(): string | null {
  const value = process.env.SCAN_HISTORY_DATABASE_URL;
  if (!value?.startsWith("sqlite:")) {
    return null;
  }
  const databaseFile = value.slice("sqlite:".length).trim();
  if (!databaseFile) {
    throw new Error("SCAN_HISTORY_DATABASE_URL must include a SQLite file path.");
  }
  return databaseFile;
}

async function openScanSettingsDatabase(databaseFile: string): Promise<DatabaseSync> {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS scan_baselines (
      repository_key TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_suppressions (
      repository_key TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (repository_key, fingerprint)
    );
    CREATE TABLE IF NOT EXISTS scan_rule_settings (
      rule_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
