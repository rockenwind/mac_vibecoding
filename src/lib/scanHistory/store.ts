import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { ScanResult } from "@/lib/scanner/types";
import type { ScanComparison, ScanHistoryEntry, ScanHistoryStore } from "./types";

const defaultHistoryFile = join(process.cwd(), ".data", "scans.json");

export async function readScanHistory(): Promise<ScanHistoryEntry[]> {
  return createDefaultScanHistoryStore().read();
}

export async function recordScan(scan: ScanResult, now = new Date()): Promise<ScanHistoryEntry> {
  return createDefaultScanHistoryStore().record(scan, now);
}

export function createJsonScanHistoryStore(historyFile: string): ScanHistoryStore {
  return {
    async read(): Promise<ScanHistoryEntry[]> {
      try {
        const raw = await readFile(historyFile, "utf8");
        if (!raw.trim()) {
          return [];
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("Scan history file must contain an array.");
        }

        return parsed as ScanHistoryEntry[];
      } catch (error) {
        if (isNotFoundError(error)) {
          return [];
        }
        if (error instanceof SyntaxError) {
          throw new Error("Scan history file is not valid JSON.");
        }
        throw error;
      }
    },

    async record(scan: ScanResult, now = new Date()): Promise<ScanHistoryEntry> {
      const history = await this.read();
      const entry: ScanHistoryEntry = {
        savedAt: now.toISOString(),
        scan
      };

      const nextHistory = [entry, ...history].sort(
        (left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt)
      );

      await mkdir(dirname(historyFile), { recursive: true });
      await writeFile(historyFile, `${JSON.stringify(nextHistory, null, 2)}\n`, "utf8");

      return entry;
    }
  };
}

export function createDefaultScanHistoryStore(): ScanHistoryStore {
  const databaseFile = getSqliteDatabaseFile();
  if (databaseFile) {
    return createSqliteScanHistoryStore(databaseFile);
  }

  return createJsonScanHistoryStore(getHistoryFile());
}

export function createSqliteScanHistoryStore(databaseFile: string): ScanHistoryStore {
  return {
    async read(): Promise<ScanHistoryEntry[]> {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanHistoryDatabase(databaseFile);

      try {
        const rows = database
          .prepare("SELECT saved_at, scan_json FROM scan_history ORDER BY saved_at DESC")
          .all() as Array<{ saved_at: string; scan_json: string }>;

        return rows.map((row) => ({
          savedAt: row.saved_at,
          scan: JSON.parse(row.scan_json) as ScanResult
        }));
      } finally {
        database.close();
      }
    },

    async record(scan: ScanResult, now = new Date()): Promise<ScanHistoryEntry> {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanHistoryDatabase(databaseFile);
      const entry: ScanHistoryEntry = {
        savedAt: now.toISOString(),
        scan
      };

      try {
        database
          .prepare(
            `INSERT INTO scan_history (id, saved_at, scan_json)
             VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET saved_at = excluded.saved_at, scan_json = excluded.scan_json`
          )
          .run(scan.id, entry.savedAt, JSON.stringify(scan));
      } finally {
        database.close();
      }

      return entry;
    }
  };
}

export function findPreviousScan(
  currentScan: ScanResult,
  history: ScanHistoryEntry[]
): ScanHistoryEntry | null {
  return (
    history
      .filter((entry) => entry.scan.id !== currentScan.id)
      .find((entry) => isSameRepository(entry.scan, currentScan)) ?? null
  );
}

export function compareScanResults(
  currentScan: ScanResult,
  previousEntry: ScanHistoryEntry | null
): ScanComparison {
  if (!previousEntry) {
    return {
      previousScanId: null,
      newFindings: currentScan.findings,
      resolvedFindings: [],
      unchangedFindings: []
    };
  }

  const previousById = new Map(previousEntry.scan.findings.map((finding) => [finding.id, finding]));
  const currentById = new Map(currentScan.findings.map((finding) => [finding.id, finding]));

  return {
    previousScanId: previousEntry.scan.id,
    newFindings: currentScan.findings.filter((finding) => !previousById.has(finding.id)),
    resolvedFindings: previousEntry.scan.findings.filter((finding) => !currentById.has(finding.id)),
    unchangedFindings: currentScan.findings.filter((finding) => previousById.has(finding.id))
  };
}

function getHistoryFile(): string {
  return process.env.SCAN_HISTORY_FILE ?? defaultHistoryFile;
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

async function openScanHistoryDatabase(databaseFile: string): Promise<DatabaseSync> {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id TEXT PRIMARY KEY,
      saved_at TEXT NOT NULL,
      scan_json TEXT NOT NULL
    )
  `);
  return database;
}

function isSameRepository(left: ScanResult, right: ScanResult): boolean {
  return left.repository.owner === right.repository.owner && left.repository.name === right.repository.name;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
