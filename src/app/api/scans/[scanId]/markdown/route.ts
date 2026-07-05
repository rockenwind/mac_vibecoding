import { buildScanMarkdown } from "@/lib/reports/markdown";
import { findingFingerprint, readScanHistory } from "@/lib/scanHistory/store";
import {
  readScanSettings,
  repositoryKey,
  suppressedFingerprintsForRepository
} from "@/lib/scanSettings/store";
import type { Finding, ScanSummary } from "@/lib/scanner/types";

type RouteContext = {
  params: Promise<{ scanId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { scanId } = await context.params;
    const history = await readScanHistory();
    const entry = history.find((candidate) => candidate.scan.id === scanId);

    if (!entry) {
      return Response.json({ error: "Scan not found." }, { status: 404 });
    }

    const settings = await readScanSettings();
    const suppressed = new Set(
      suppressedFingerprintsForRepository(settings, repositoryKey(entry.scan.repository))
    );
    const findings = entry.scan.findings.filter((finding) => !suppressed.has(findingFingerprint(finding)));
    const reportScan = {
      ...entry.scan,
      findings,
      summary: summarizeFindings(findings)
    };

    return new Response(buildScanMarkdown(reportScan), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entry.scan.id}.md"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export scan report.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function summarizeFindings(findings: Finding[]): ScanSummary {
  return findings.reduce<ScanSummary>(
    (summary, finding) => ({
      ...summary,
      [finding.severity]: summary[finding.severity] + 1
    }),
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );
}
