import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  readScanSettings: vi.fn(),
  runRepositoryScan: vi.fn(),
  markScanScheduleRun: vi.fn()
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  markScanScheduleRun: mocks.markScanScheduleRun
}));

vi.mock("@/lib/scans/runRepositoryScan", () => ({
  runRepositoryScan: mocks.runRepositoryScan,
  scanErrorResponse: (message: string) => ({ status: message.includes("permission") ? 403 : 400 })
}));

describe("POST /api/scans/schedules/run-due", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCHEDULE_RUN_TOKEN;
    mocks.markScanScheduleRun.mockResolvedValue({ baselines: [], suppressions: [], rules: [], schedules: [] });
    mocks.runRepositoryScan.mockResolvedValue({
      scan: {
        id: "scan_test",
        repository: {
          owner: "example",
          name: "repo",
          url: "https://github.com/example/repo",
          defaultBranch: "main"
        },
        summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
        warnings: [],
        findings: []
      },
      history: { savedAt: "2026-07-05T00:00:00.000Z", scan: { id: "scan_test" } },
      comparison: {
        previousScanId: "scan_previous",
        comparisonSource: "previous",
        newFindings: [],
        resolvedFindings: [],
        unchangedFindings: [],
        suppressedFindings: []
      }
    });
  });

  it("requires a bearer token when SCHEDULE_RUN_TOKEN is configured", async () => {
    process.env.SCHEDULE_RUN_TOKEN = "secret-cron-token";

    const response = await POST(
      new Request("http://localhost/api/scans/schedules/run-due", {
        method: "POST",
        body: JSON.stringify({ now: "2026-07-05T00:00:00.000Z" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Scheduled scan token is required.");
    expect(mocks.readScanSettings).not.toHaveBeenCalled();
  });

  it("accepts the configured bearer token", async () => {
    process.env.SCHEDULE_RUN_TOKEN = "secret-cron-token";
    mocks.readScanSettings.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [],
      schedules: []
    });

    const response = await POST(
      new Request("http://localhost/api/scans/schedules/run-due", {
        method: "POST",
        headers: { Authorization: "Bearer secret-cron-token" },
        body: JSON.stringify({ now: "2026-07-05T00:00:00.000Z" })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.readScanSettings).toHaveBeenCalled();
  });

  it("returns no results when no schedules are due", async () => {
    mocks.readScanSettings.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [],
      schedules: [
        {
          repositoryKey: "example/future",
          repositoryUrl: "https://github.com/example/future",
          enabled: true,
          intervalDays: 7,
          nextRunAt: "2026-07-06T00:00:00.000Z",
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true,
          createdAt: "2026-07-05T00:00:00.000Z",
          updatedAt: "2026-07-05T00:00:00.000Z"
        }
      ]
    });

    const response = await POST(
      new Request("http://localhost/api/scans/schedules/run-due", {
        method: "POST",
        body: JSON.stringify({ now: "2026-07-05T00:00:00.000Z" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([]);
  });

  it("runs due schedules and updates their next run time", async () => {
    mocks.readScanSettings.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [],
      schedules: [
        {
          repositoryKey: "example/repo",
          repositoryUrl: "https://github.com/example/repo",
          installationId: 123,
          enabled: true,
          intervalDays: 7,
          nextRunAt: "2026-07-04T00:00:00.000Z",
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z"
        }
      ]
    });

    const response = await POST(
      new Request("http://localhost/api/scans/schedules/run-due", {
        method: "POST",
        body: JSON.stringify({ now: "2026-07-05T00:00:00.000Z" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.runRepositoryScan).toHaveBeenCalledWith({
      repositoryUrl: "https://github.com/example/repo",
      installationId: 123
    });
    expect(mocks.markScanScheduleRun).toHaveBeenCalledWith(
      "example/repo",
      {
        lastRunAt: "2026-07-05T00:00:00.000Z",
        lastScanId: "scan_test",
        nextRunAt: "2026-07-12T00:00:00.000Z"
      },
      new Date("2026-07-05T00:00:00.000Z")
    );
    expect(body.results[0]).toMatchObject({ repositoryKey: "example/repo", status: "success" });
  });

  it("returns failed results without stopping other schedules", async () => {
    mocks.readScanSettings.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [],
      schedules: [
        {
          repositoryKey: "example/repo",
          repositoryUrl: "https://github.com/example/repo",
          enabled: true,
          intervalDays: 7,
          nextRunAt: "2026-07-04T00:00:00.000Z",
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z"
        }
      ]
    });
    mocks.runRepositoryScan.mockRejectedValueOnce(new Error("GitHub App permission was denied."));

    const response = await POST(
      new Request("http://localhost/api/scans/schedules/run-due", {
        method: "POST",
        body: JSON.stringify({ now: "2026-07-05T00:00:00.000Z" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({
      repositoryKey: "example/repo",
      status: "failed",
      error: "GitHub App permission was denied."
    });
  });
});
