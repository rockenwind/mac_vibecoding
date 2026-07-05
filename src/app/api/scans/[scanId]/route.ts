import type { ScanResult } from "@/lib/scanner/types";
import {
  compareScanResults,
  deleteScan,
  findScanById,
  readScanHistory
} from "@/lib/scanHistory/store";
import type { ScanHistoryEntry } from "@/lib/scanHistory/types";
import {
  baselineScanIdForRepository,
  readScanSettings,
  repositoryKey,
  suppressedFingerprintsForRepository
} from "@/lib/scanSettings/store";

type RouteContext = {
  params: Promise<{
    scanId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { scanId } = await context.params;
    const history = await readScanHistory();
    const settings = await readScanSettings();
    const selectedEntry = history.find((entry) => entry.scan.id === scanId);

    if (!selectedEntry) {
      return Response.json({ error: "Scan was not found." }, { status: 404 });
    }

    const key = repositoryKey(selectedEntry.scan.repository);
    const baselineScanId = baselineScanIdForRepository(settings, key);
    const baselineCandidate = findScanById(baselineScanId, history);
    const baselineEntry =
      baselineCandidate && repositoryKey(baselineCandidate.scan.repository) === key ? baselineCandidate : null;
    const previousEntry = baselineEntry ?? findPreviousSavedScan(selectedEntry, history);
    const comparison = compareScanResults(selectedEntry.scan, previousEntry, {
      baselineScanId,
      comparisonSource: baselineEntry ? "baseline" : previousEntry ? "previous" : "none",
      suppressedFingerprints: suppressedFingerprintsForRepository(settings, key)
    });

    return Response.json({
      scan: selectedEntry.scan,
      history: selectedEntry,
      comparison
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load saved scan.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { scanId } = await context.params;
    const deleted = await deleteScan(scanId);

    if (!deleted) {
      return Response.json({ error: "Scan was not found." }, { status: 404 });
    }

    return Response.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete saved scan.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function findPreviousSavedScan(
  selectedEntry: ScanHistoryEntry,
  history: ScanHistoryEntry[]
): ScanHistoryEntry | null {
  const selectedTime = Date.parse(selectedEntry.savedAt);

  return (
    history
      .filter((entry) => entry.scan.id !== selectedEntry.scan.id)
      .filter((entry) => Date.parse(entry.savedAt) < selectedTime)
      .filter((entry) => isSameRepository(entry.scan, selectedEntry.scan))
      .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))[0] ?? null
  );
}

function isSameRepository(left: ScanResult, right: ScanResult): boolean {
  return left.repository.owner === right.repository.owner && left.repository.name === right.repository.name;
}
