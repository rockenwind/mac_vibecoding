import { parseGitHubRepositoryUrl } from "@/lib/github/url";
import {
  deleteScanSchedule,
  readScanSettings,
  repositoryKey,
  upsertScanSchedule
} from "@/lib/scanSettings/store";

export async function GET(): Promise<Response> {
  try {
    const settings = await readScanSettings();
    return Response.json({ schedules: settings.schedules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read scheduled scans.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const repositoryUrl = readString(body.repositoryUrl, "repositoryUrl");
    const repository = parseGitHubRepositoryUrl(repositoryUrl);
    const intervalDays = readPositiveInteger(body.intervalDays, "intervalDays");
    const nextRunAt = readOptionalString(body.nextRunAt) ?? new Date().toISOString();
    const installationId = readOptionalPositiveInteger(body.installationId, "installationId");
    const settings = await upsertScanSchedule({
      repositoryKey: repositoryKey(repository),
      repositoryUrl,
      ...(installationId ? { installationId } : {}),
      enabled: readBoolean(body.enabled, true),
      intervalDays,
      nextRunAt,
      notifyOnNewFindings: readBoolean(body.notifyOnNewFindings, true),
      notifyOnResolvedFindings: readBoolean(body.notifyOnResolvedFindings, true)
    });

    return Response.json({ schedules: settings.schedules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled scan could not be saved.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const repositoryKeyParam = new URL(request.url).searchParams.get("repositoryKey");
    if (!repositoryKeyParam) {
      return Response.json({ error: "repositoryKey is required." }, { status: 400 });
    }
    const settings = await deleteScanSchedule(repositoryKeyParam);
    return Response.json({ schedules: settings.schedules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled scan could not be deleted.";
    return Response.json({ error: message }, { status: 400 });
  }
}

function readString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

function readOptionalPositiveInteger(value: unknown, name: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return readPositiveInteger(value, name);
}
