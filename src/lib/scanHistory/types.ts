import type { Finding, ScanResult } from "@/lib/scanner/types";

export type ScanHistoryEntry = {
  savedAt: string;
  scan: ScanResult;
};

export type ScanHistoryStore = {
  read(): Promise<ScanHistoryEntry[]>;
  record(scan: ScanResult, now?: Date): Promise<ScanHistoryEntry>;
};

export type ScanComparison = {
  previousScanId: string | null;
  newFindings: Finding[];
  resolvedFindings: Finding[];
  unchangedFindings: Finding[];
};

export type ScanHistoryResponse = {
  history: ScanHistoryEntry[];
};
