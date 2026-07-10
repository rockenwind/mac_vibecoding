import { findDueSchedules, nextRunAtFor } from "@/lib/scanSchedules/due";
import { buildScheduleNotifications } from "@/lib/scanSchedules/notifications";
import { readScanSettings, markScanScheduleRun } from "@/lib/scanSettings/store";
import { runRepositoryScan, scanErrorResponse } from "@/lib/scans/runRepositoryScan";

type ScheduleRunResult = {
  repositoryKey: string;
  status: "success" | "failed";
  scanId?: string;
  savedAt?: string;
  nextRunAt?: string;
  comparison?: unknown;
  notifications?: unknown[];
  error?: string;
  action?: string;
};

export async function POST(request: Request): Promise<Response> {
  const authError = authorizeScheduledRun(request);
  if (authError) {
    return authError;
  }

  const body = await readOptionalJson(request);
  const now = readNow(body.now);

  try {
    const settings = await readScanSettings();
    const dueSchedules = findDueSchedules(settings.schedules, now);
    const results: ScheduleRunResult[] = [];

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

    return Response.json({
      ranAt: now.toISOString(),
      summary: summarizeScheduleResults(results),
      results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled scans could not run.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function summarizeScheduleResults(
  results: Array<{ status: "success" | "failed"; notifications?: unknown[] }>
): { due: number; success: number; failed: number; notifications: number } {
  return results.reduce(
    (summary, result) => ({
      due: summary.due + 1,
      success: summary.success + (result.status === "success" ? 1 : 0),
      failed: summary.failed + (result.status === "failed" ? 1 : 0),
      notifications: summary.notifications + (result.notifications?.length ?? 0)
    }),
    { due: 0, success: 0, failed: 0, notifications: 0 }
  );
}

function authorizeScheduledRun(request: Request): Response | null {
  const configuredToken = process.env.SCHEDULE_RUN_TOKEN?.trim();
  if (!configuredToken) {
    return null;
  }

  const header = request.headers.get("Authorization") ?? "";
  const expected = `Bearer ${configuredToken}`;
  if (header !== expected) {
    return Response.json({ error: "Scheduled scan token is required." }, { status: 401 });
  }

  return null;
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
