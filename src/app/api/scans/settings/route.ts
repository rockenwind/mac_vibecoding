import { requireAdminToken } from "@/lib/api/adminAuth";
import {
  readScanSettings,
  setRuleEnabled,
  suppressFinding,
  unsuppressFinding
} from "@/lib/scanSettings/store";
import { listAnalyzerRules } from "@/lib/scanner/analyzers";

type SettingsAction =
  | { action: "setRuleEnabled"; ruleId: unknown; enabled: unknown }
  | { action: "suppressFinding"; repositoryKey: unknown; fingerprint: unknown; reason?: unknown }
  | { action: "unsuppressFinding"; repositoryKey: unknown; fingerprint: unknown };

export async function GET(): Promise<Response> {
  try {
    const settings = await readScanSettings();
    return Response.json({ settings: publicScanSettings(settings), rules: listAnalyzerRules() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read scan settings.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const unauthorized = requireAdminToken(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as SettingsAction;
    const settings = await applyAction(body);
    return Response.json({ settings: publicScanSettings(settings), rules: listAnalyzerRules() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update scan settings.";
    return Response.json({ error: message }, { status: 400 });
  }
}

async function applyAction(body: SettingsAction) {
  switch (body.action) {
    case "setRuleEnabled":
      if (typeof body.enabled !== "boolean") {
        throw new Error("enabled must be a boolean.");
      }
      return setRuleEnabled(readString(body.ruleId, "ruleId"), body.enabled);
    case "suppressFinding":
      return suppressFinding({
        repositoryKey: readString(body.repositoryKey, "repositoryKey"),
        fingerprint: readString(body.fingerprint, "fingerprint"),
        ...(typeof body.reason === "string" && body.reason.trim() ? { reason: body.reason.trim() } : {})
      });
    case "unsuppressFinding":
      return unsuppressFinding(readString(body.repositoryKey, "repositoryKey"), readString(body.fingerprint, "fingerprint"));
    default:
      throw new Error("Unknown settings action.");
  }
}

function publicScanSettings<T extends { baselines?: unknown }>(settings: T): Omit<T, "baselines"> {
  const { baselines: _baselines, ...publicSettings } = settings;
  return publicSettings;
}

function readString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}
