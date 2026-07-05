import type { Finding, ScanResult } from "@/lib/scanner/types";

export type ScanHistoryEntry = {
  savedAt: string;
  scan: ScanResult;
};

export type ScanHistoryStore = {
  read(): Promise<ScanHistoryEntry[]>;
  record(scan: ScanResult, now?: Date): Promise<ScanHistoryEntry>;
  delete(scanId: string): Promise<boolean>;
};

export type ScanComparison = {
  previousScanId: string | null;
  baselineScanId?: string | null;
  comparisonSource?: "previous" | "baseline" | "none";
  newFindings: Finding[];
  resolvedFindings: Finding[];
  unchangedFindings: Finding[];
  suppressedFindings: Finding[];
};

export type ScanHistoryResponse = {
  history: ScanHistoryEntry[];
};
