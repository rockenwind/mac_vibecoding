import type { Finding } from "@/lib/scanner/types";

export function findingFingerprint(finding: Finding): string {
  return [
    normalizeFingerprintPart(finding.ruleId),
    normalizeFingerprintPart(finding.filePath),
    normalizeFingerprintPart(finding.title),
    normalizeFingerprintPart(finding.evidence)
  ].join(":");
}

function normalizeFingerprintPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.\.\.redacted\.\.\./g, "redacted")
    .replace(/[^a-z0-9_.:/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
