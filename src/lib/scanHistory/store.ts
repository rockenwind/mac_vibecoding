import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Finding, ScanResult } from "@/lib/scanner/types";
import type { ScanComparison, ScanHistoryEntry, ScanHistoryStore } from "./types";
export { findingFingerprint } from "./fingerprint";
import { findingFingerprint } from "./fingerprint";

const defaultHistoryFile = join(process.cwd(), ".data", "scans.json");

export async function readScanHistory(): Promise<ScanHistoryEntry[]> {
  return createDefaultScanHistoryStore().read();
}

export async function recordScan(scan: ScanResult, now = new Date()): Promise<ScanHistoryEntry> {
  return createDefaultScanHistoryStore().record(scan, now);
}

export async function deleteScan(scanId: string): Promise<boolean> {
  return createDefaultScanHistoryStore().delete(scanId);
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
    },

    async delete(scanId: string): Promise<boolean> {
      const history = await this.read();
      const nextHistory = history.filter((entry) => entry.scan.id !== scanId);

      if (nextHistory.length === history.length) {
        return false;
      }

      await mkdir(dirname(historyFile), { recursive: true });
      await writeFile(historyFile, `${JSON.stringify(nextHistory, null, 2)}\n`, "utf8");

      return true;
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
    },

    async delete(scanId: string): Promise<boolean> {
      await mkdir(dirname(databaseFile), { recursive: true });
      const database = await openScanHistoryDatabase(databaseFile);

      try {
        const result = database.prepare("DELETE FROM scan_history WHERE id = ?").run(scanId) as {
          changes?: number;
        };
        return Number(result.changes ?? 0) > 0;
      } finally {
        database.close();
      }
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
  previousEntry: ScanHistoryEntry | null,
  options: {
    baselineScanId?: string | null;
    comparisonSource?: "previous" | "baseline" | "none";
    suppressedFingerprints?: string[];
  } = {}
): ScanComparison {
  const suppressed = new Set(options.suppressedFingerprints ?? []);
  const currentUnsuppressed = currentScan.findings.filter((finding) => !suppressed.has(findingFingerprint(finding)));
  const suppressedFindings = currentScan.findings.filter((finding) => suppressed.has(findingFingerprint(finding)));

  if (!previousEntry) {
    return {
      previousScanId: null,
      baselineScanId: options.baselineScanId ?? null,
      comparisonSource: options.comparisonSource ?? "none",
      newFindings: currentUnsuppressed,
      resolvedFindings: [],
      unchangedFindings: [],
      suppressedFindings
    };
  }

  const previousByFingerprint = groupFindingsByFingerprint(previousEntry.scan.findings);
  const currentByFingerprint = groupFindingsByFingerprint(currentUnsuppressed);
  const { matchedCurrent, unmatchedCurrent, unmatchedPrevious } = matchFindingGroups(
    currentByFingerprint,
    previousByFingerprint,
    suppressed
  );

  return {
    previousScanId: previousEntry.scan.id,
    baselineScanId: options.baselineScanId ?? null,
    comparisonSource: options.comparisonSource ?? "previous",
    newFindings: unmatchedCurrent,
    resolvedFindings: unmatchedPrevious,
    unchangedFindings: matchedCurrent,
    suppressedFindings
  };
}

function groupFindingsByFingerprint(findings: Finding[]): Map<string, Finding[]> {
  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const fingerprint = findingFingerprint(finding);
    grouped.set(fingerprint, [...(grouped.get(fingerprint) ?? []), finding]);
  }
  return grouped;
}

function matchFindingGroups(
  currentByFingerprint: Map<string, Finding[]>,
  previousByFingerprint: Map<string, Finding[]>,
  suppressed: Set<string>
): { matchedCurrent: Finding[]; unmatchedCurrent: Finding[]; unmatchedPrevious: Finding[] } {
  const matchedCurrent: Finding[] = [];
  const unmatchedCurrent: Finding[] = [];
  const unmatchedPrevious: Finding[] = [];
  const fingerprints = new Set([...currentByFingerprint.keys(), ...previousByFingerprint.keys()]);

  for (const fingerprint of fingerprints) {
    const currentFindings = currentByFingerprint.get(fingerprint) ?? [];
    const previousFindings = previousByFingerprint.get(fingerprint) ?? [];
    const matchedCount = Math.min(currentFindings.length, previousFindings.length);

    matchedCurrent.push(...currentFindings.slice(0, matchedCount));
    unmatchedCurrent.push(...currentFindings.slice(matchedCount));

    if (!suppressed.has(fingerprint)) {
      unmatchedPrevious.push(...previousFindings.slice(matchedCount));
    }
  }

  return { matchedCurrent, unmatchedCurrent, unmatchedPrevious };
}

export function findScanById(scanId: string | null | undefined, history: ScanHistoryEntry[]): ScanHistoryEntry | null {
  if (!scanId) {
    return null;
  }

  return history.find((entry) => entry.scan.id === scanId) ?? null;
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
