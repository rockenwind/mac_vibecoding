import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  return createJsonScanHistoryStore(getHistoryFile());
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

function isSameRepository(left: ScanResult, right: ScanResult): boolean {
  return left.repository.owner === right.repository.owner && left.repository.name === right.repository.name;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
