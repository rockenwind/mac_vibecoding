import { findDueSchedules, nextRunAtFor } from "@/lib/scanSchedules/due";
import { buildScheduleNotifications } from "@/lib/scanSchedules/notifications";
import { readScanSettings, markScanScheduleRun } from "@/lib/scanSettings/store";
import { runRepositoryScan, scanErrorResponse } from "@/lib/scans/runRepositoryScan";

export async function POST(request: Request): Promise<Response> {
  const body = await readOptionalJson(request);
  const now = readNow(body.now);

  try {
    const settings = await readScanSettings();
    const dueSchedules = findDueSchedules(settings.schedules, now);
    const results = [];

    for (const schedule of dueSchedules) {
      try {
        const result = await runRepositoryScan({
          repositoryUrl: schedule.repositoryUrl,
          installationId: schedule.installationId
        });
        const nextRunAt = nextRunAtFor(schedule, now);
        await markScanScheduleRun(
          schedule.repositoryKey,
          {
            lastRunAt: now.toISOString(),
            lastScanId: result.scan.id,
            nextRunAt
          },
          now
        );
        results.push({
          repositoryKey: schedule.repositoryKey,
          status: "success",
          scanId: result.scan.id,
          savedAt: result.history.savedAt,
          nextRunAt,
          comparison: result.comparison,
          notifications: buildScheduleNotifications(schedule, result.scan, result.comparison)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scheduled scan failed.";
        const { action } = scanErrorResponse(message);
        results.push({
          repositoryKey: schedule.repositoryKey,
          status: "failed",
          error: message,
          ...(action ? { action } : {})
        });
      }
    }

    return Response.json({ ranAt: now.toISOString(), results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled scans could not run.";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function readOptionalJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readNow(value: unknown): Date {
  if (typeof value !== "string" || !value.trim()) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("now must be an ISO date string.");
  }
  return parsed;
}
