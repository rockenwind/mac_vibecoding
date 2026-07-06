import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { RepositoryRef } from "@/lib/scanner/types";
import type {
  FindingSuppression,
  RepositoryKey,
  RuleSetting,
  ScanBaselineSetting,
  ScanScheduleSetting,
  ScanSettings,
  ScanSettingsStore
} from "./types";

const defaultSettingsFile = join(process.cwd(), ".data", "scan-settings.json");

const emptySettings: ScanSettings = {
  baselines: [],
  suppressions: [],
  rules: [],
  schedules: []
};

type QueryResult<Row> = {
  rows: Row[];
  rowCount?: number | null;
};

type PostgresPoolLike = {
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<Row>>;
};

type PostgresPoolFactory = (connectionString: string) => PostgresPoolLike | Promise<PostgresPoolLike>;

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

export async function upsertScanSchedule(
  input: Omit<ScanScheduleSetting, "createdAt" | "updatedAt" | "lastRunAt" | "lastScanId"> & {
    lastRunAt?: string;
    lastScanId?: string;
  },
  now = new Date()
): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().upsertSchedule(input, now);
}

export async function deleteScanSchedule(repositoryKey: RepositoryKey): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().deleteSchedule(repositoryKey);
}

export async function markScanScheduleRun(
  repositoryKey: RepositoryKey,
  input: { lastRunAt: string; lastScanId: string; nextRunAt: string },
  now = new Date()
): Promise<ScanSettings> {
  return createDefaultScanSettingsStore().markScheduleRun(repositoryKey, input, now);
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
  const databaseUrl = process.env.SCAN_HISTORY_DATABASE_URL;
  if (isPostgresUrl(databaseUrl)) {
    return createPostgresScanSettingsStore(databaseUrl);
  }

  const sqliteDatabaseFile = getSqliteDatabaseFile(databaseUrl);
  if (sqliteDatabaseFile) {
    return createSqliteScanSettingsStore(sqliteDatabaseFile);
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
    },
    async upsertSchedule(input, now = new Date()) {
      const settings = await read();
      return write({
        ...settings,
        schedules: upsertSchedule(settings.schedules, input, now)
      });
    },
    async deleteSchedule(key) {
      const settings = await read();
      return write({
        ...settings,
        schedules: settings.schedules.filter((schedule) => schedule.repositoryKey !== key)
      });
    },
    async markScheduleRun(key, input, now = new Date()) {
      const settings = await read();
      return write({
        ...settings,
        schedules: settings.schedules.map((schedule) =>
          schedule.repositoryKey === key
            ? {
                ...schedule,
                lastRunAt: input.lastRunAt,
                lastScanId: input.lastScanId,
                nextRunAt: input.nextRunAt,
                updatedAt: now.toISOString()
              }
            : schedule
        )
      });
    }
  };
}

export function createPostgresScanSettingsStore(
  connectionString: string,
  poolFactory: PostgresPoolFactory = createPostgresPool
): ScanSettingsStore {
  let poolPromise: Promise<PostgresPoolLike> | null = null;

  async function pool(): Promise<PostgresPoolLike> {
    poolPromise ??= Promise.resolve(poolFactory(connectionString)).then(async (created) => {
      await ensurePostgresScanSettingsSchema(created);
      return created;
    });
    return poolPromise;
  }

  async function read(): Promise<ScanSettings> {
    const database = await pool();
    const baselines = await database.query<{ repository_key: string; scan_id: string; updated_at: string }>(
      "SELECT repository_key, scan_id, updated_at FROM scan_baselines ORDER BY repository_key"
    );
    const suppressions = await database.query<{
      repository_key: string;
      fingerprint: string;
      reason: string | null;
      created_at: string;
    }>("SELECT repository_key, fingerprint, reason, created_at FROM scan_suppressions ORDER BY repository_key, fingerprint");
    const rules = await database.query<{ rule_id: string; enabled: boolean | number; updated_at: string }>(
      "SELECT rule_id, enabled, updated_at FROM scan_rule_settings ORDER BY rule_id"
    );
    const schedules = await database.query<{
      repository_key: string;
      repository_url: string;
      installation_id: number | string | null;
      enabled: boolean | number;
      interval_days: number | string;
      next_run_at: string;
      last_run_at: string | null;
      last_scan_id: string | null;
      notify_on_new_findings: boolean | number;
      notify_on_resolved_findings: boolean | number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT repository_key, repository_url, installation_id, enabled, interval_days, next_run_at,
              last_run_at, last_scan_id, notify_on_new_findings, notify_on_resolved_findings,
              created_at, updated_at
       FROM scan_schedules
       ORDER BY repository_key`
    );

    return {
      baselines: baselines.rows.map((row) => ({
        repositoryKey: row.repository_key,
        scanId: row.scan_id,
        updatedAt: row.updated_at
      })),
      suppressions: suppressions.rows.map((row) => ({
        repositoryKey: row.repository_key,
        fingerprint: row.fingerprint,
        ...(row.reason ? { reason: row.reason } : {}),
        createdAt: row.created_at
      })),
      rules: rules.rows.map((row) => ({
        ruleId: row.rule_id,
        enabled: Boolean(row.enabled),
        updatedAt: row.updated_at
      })),
      schedules: schedules.rows.map((row) => ({
        repositoryKey: row.repository_key,
        repositoryUrl: row.repository_url,
        ...(row.installation_id ? { installationId: Number(row.installation_id) } : {}),
        enabled: Boolean(row.enabled),
        intervalDays: Number(row.interval_days),
        nextRunAt: row.next_run_at,
        ...(row.last_run_at ? { lastRunAt: row.last_run_at } : {}),
        ...(row.last_scan_id ? { lastScanId: row.last_scan_id } : {}),
        notifyOnNewFindings: Boolean(row.notify_on_new_findings),
        notifyOnResolvedFindings: Boolean(row.notify_on_resolved_findings),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    };
  }

  return {
    read,
    async setBaseline(key, scanId, now = new Date()) {
      const database = await pool();
      await database.query(
        `INSERT INTO scan_baselines (repository_key, scan_id, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT(repository_key) DO UPDATE SET scan_id = excluded.scan_id, updated_at = excluded.updated_at`,
        [key, scanId, now.toISOString()]
      );
      return read();
    },
    async clearBaseline(key) {
      const database = await pool();
      await database.query("DELETE FROM scan_baselines WHERE repository_key = $1", [key]);
      return read();
    },
    async suppressFinding(input) {
      const database = await pool();
      await database.query(
        `INSERT INTO scan_suppressions (repository_key, fingerprint, reason, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(repository_key, fingerprint) DO UPDATE SET reason = excluded.reason`,
        [input.repositoryKey, input.fingerprint, input.reason ?? null, (input.now ?? new Date()).toISOString()]
      );
      return read();
    },
    async unsuppressFinding(key, fingerprint) {
      const database = await pool();
      await database.query("DELETE FROM scan_suppressions WHERE repository_key = $1 AND fingerprint = $2", [
        key,
        fingerprint
      ]);
      return read();
    },
    async setRuleEnabled(ruleId, enabled, now = new Date()) {
      const database = await pool();
      await database.query(
        `INSERT INTO scan_rule_settings (rule_id, enabled, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT(rule_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
        [ruleId, enabled, now.toISOString()]
      );
      return read();
    },
    async upsertSchedule(input, now = new Date()) {
      const database = await pool();
      const timestamp = now.toISOString();
      await database.query(
        `INSERT INTO scan_schedules (
           repository_key, repository_url, installation_id, enabled, interval_days, next_run_at,
           last_run_at, last_scan_id, notify_on_new_findings, notify_on_resolved_findings,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT(repository_key) DO UPDATE SET
           repository_url = excluded.repository_url,
           installation_id = excluded.installation_id,
           enabled = excluded.enabled,
           interval_days = excluded.interval_days,
           next_run_at = excluded.next_run_at,
           last_run_at = excluded.last_run_at,
           last_scan_id = excluded.last_scan_id,
           notify_on_new_findings = excluded.notify_on_new_findings,
           notify_on_resolved_findings = excluded.notify_on_resolved_findings,
           updated_at = excluded.updated_at`,
        [
          input.repositoryKey,
          input.repositoryUrl,
          input.installationId ?? null,
          input.enabled,
          input.intervalDays,
          input.nextRunAt,
          input.lastRunAt ?? null,
          input.lastScanId ?? null,
          input.notifyOnNewFindings,
          input.notifyOnResolvedFindings,
          timestamp,
          timestamp
        ]
      );
      return read();
    },
    async deleteSchedule(key) {
      const database = await pool();
      await database.query("DELETE FROM scan_schedules WHERE repository_key = $1", [key]);
      return read();
    },
    async markScheduleRun(key, input, now = new Date()) {
      const database = await pool();
      await database.query(
        `UPDATE scan_schedules
         SET last_run_at = $1, last_scan_id = $2, next_run_at = $3, updated_at = $4
         WHERE repository_key = $5`,
        [input.lastRunAt, input.lastScanId, input.nextRunAt, now.toISOString(), key]
      );
      return read();
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
        const schedules = database
          .prepare(
            `SELECT repository_key, repository_url, installation_id, enabled, interval_days, next_run_at,
                    last_run_at, last_scan_id, notify_on_new_findings, notify_on_resolved_findings,
                    created_at, updated_at
             FROM scan_schedules
             ORDER BY repository_key`
          )
          .all() as Array<{
            repository_key: string;
            repository_url: string;
            installation_id: number | null;
            enabled: number;
            interval_days: number;
            next_run_at: string;
            last_run_at: string | null;
            last_scan_id: string | null;
            notify_on_new_findings: number;
            notify_on_resolved_findings: number;
            created_at: string;
            updated_at: string;
          }>;

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
          })),
          schedules: schedules.map((row) => ({
            repositoryKey: row.repository_key,
            repositoryUrl: row.repository_url,
            ...(row.installation_id ? { installationId: row.installation_id } : {}),
            enabled: Boolean(row.enabled),
            intervalDays: row.interval_days,
            nextRunAt: row.next_run_at,
            ...(row.last_run_at ? { lastRunAt: row.last_run_at } : {}),
            ...(row.last_scan_id ? { lastScanId: row.last_scan_id } : {}),
            notifyOnNewFindings: Boolean(row.notify_on_new_findings),
            notifyOnResolvedFindings: Boolean(row.notify_on_resolved_findings),
            createdAt: row.created_at,
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
    },
    async upsertSchedule(input, now = new Date()) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      const timestamp = now.toISOString();
      try {
        database
          .prepare(
            `INSERT INTO scan_schedules (
               repository_key, repository_url, installation_id, enabled, interval_days, next_run_at,
               last_run_at, last_scan_id, notify_on_new_findings, notify_on_resolved_findings,
               created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(repository_key) DO UPDATE SET
               repository_url = excluded.repository_url,
               installation_id = excluded.installation_id,
               enabled = excluded.enabled,
               interval_days = excluded.interval_days,
               next_run_at = excluded.next_run_at,
               last_run_at = excluded.last_run_at,
               last_scan_id = excluded.last_scan_id,
               notify_on_new_findings = excluded.notify_on_new_findings,
               notify_on_resolved_findings = excluded.notify_on_resolved_findings,
               updated_at = excluded.updated_at`
          )
          .run(
            input.repositoryKey,
            input.repositoryUrl,
            input.installationId ?? null,
            input.enabled ? 1 : 0,
            input.intervalDays,
            input.nextRunAt,
            input.lastRunAt ?? null,
            input.lastScanId ?? null,
            input.notifyOnNewFindings ? 1 : 0,
            input.notifyOnResolvedFindings ? 1 : 0,
            timestamp,
            timestamp
          );
      } finally {
        database.close();
      }
      return this.read();
    },
    async deleteSchedule(key) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database.prepare("DELETE FROM scan_schedules WHERE repository_key = ?").run(key);
      } finally {
        database.close();
      }
      return this.read();
    },
    async markScheduleRun(key, input, now = new Date()) {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanSettingsDatabase(databaseFile);
      try {
        database
          .prepare(
            `UPDATE scan_schedules
             SET last_run_at = ?, last_scan_id = ?, next_run_at = ?, updated_at = ?
             WHERE repository_key = ?`
          )
          .run(input.lastRunAt, input.lastScanId, input.nextRunAt, now.toISOString(), key);
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

function upsertSchedule(
  schedules: ScanScheduleSetting[],
  input: Omit<ScanScheduleSetting, "createdAt" | "updatedAt" | "lastRunAt" | "lastScanId"> & {
    lastRunAt?: string;
    lastScanId?: string;
  },
  now: Date
): ScanScheduleSetting[] {
  const existing = schedules.find((schedule) => schedule.repositoryKey === input.repositoryKey);
  const timestamp = now.toISOString();
  return [
    {
      ...input,
      ...(input.installationId ? { installationId: input.installationId } : {}),
      ...(input.lastRunAt ? { lastRunAt: input.lastRunAt } : {}),
      ...(input.lastScanId ? { lastScanId: input.lastScanId } : {}),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    },
    ...schedules.filter((schedule) => schedule.repositoryKey !== input.repositoryKey)
  ].sort((left, right) => left.repositoryKey.localeCompare(right.repositoryKey));
}

function normalizeSettings(settings: Partial<ScanSettings>): ScanSettings {
  return {
    baselines: Array.isArray(settings.baselines) ? settings.baselines : [],
    suppressions: Array.isArray(settings.suppressions) ? settings.suppressions : [],
    rules: Array.isArray(settings.rules) ? settings.rules : [],
    schedules: Array.isArray(settings.schedules) ? settings.schedules : []
  };
}

function empty(): ScanSettings {
  return {
    baselines: [],
    suppressions: [],
    rules: [],
    schedules: []
  };
}

function getSettingsFile(): string {
  return process.env.SCAN_SETTINGS_FILE ?? defaultSettingsFile;
}

function getSqliteDatabaseFile(value = process.env.SCAN_HISTORY_DATABASE_URL): string | null {
  if (!value?.startsWith("sqlite:")) {
    return null;
  }
  const databaseFile = value.slice("sqlite:".length).trim();
  if (!databaseFile) {
    throw new Error("SCAN_HISTORY_DATABASE_URL must include a SQLite file path.");
  }
  return databaseFile;
}

function isPostgresUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith("postgres://") || value?.startsWith("postgresql://"));
}

async function createPostgresPool(connectionString: string): Promise<PostgresPoolLike> {
  const { Pool } = await import("pg");
  return new Pool({ connectionString }) as PostgresPoolLike;
}

async function ensurePostgresScanSettingsSchema(database: PostgresPoolLike): Promise<void> {
  await database.query(`
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
      enabled BOOLEAN NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_schedules (
      repository_key TEXT PRIMARY KEY,
      repository_url TEXT NOT NULL,
      installation_id INTEGER,
      enabled BOOLEAN NOT NULL,
      interval_days INTEGER NOT NULL,
      next_run_at TEXT NOT NULL,
      last_run_at TEXT,
      last_scan_id TEXT,
      notify_on_new_findings BOOLEAN NOT NULL,
      notify_on_resolved_findings BOOLEAN NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
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
    CREATE TABLE IF NOT EXISTS scan_schedules (
      repository_key TEXT PRIMARY KEY,
      repository_url TEXT NOT NULL,
      installation_id INTEGER,
      enabled INTEGER NOT NULL,
      interval_days INTEGER NOT NULL,
      next_run_at TEXT NOT NULL,
      last_run_at TEXT,
      last_scan_id TEXT,
      notify_on_new_findings INTEGER NOT NULL,
      notify_on_resolved_findings INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
