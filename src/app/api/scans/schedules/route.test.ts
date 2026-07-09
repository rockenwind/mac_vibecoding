import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  readScanSettings: vi.fn(),
  upsertScanSchedule: vi.fn(),
  deleteScanSchedule: vi.fn(),
  repositoryKey: vi.fn()
}));

vi.mock("@/lib/scanSettings/store", () => ({
  readScanSettings: mocks.readScanSettings,
  upsertScanSchedule: mocks.upsertScanSchedule,
  deleteScanSchedule: mocks.deleteScanSchedule,
  repositoryKey: mocks.repositoryKey
}));

describe("/api/scans/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCAN_ADMIN_TOKEN;
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
          nextRunAt: "2026-07-06T00:00:00.000Z",
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true,
          createdAt: "2026-07-05T00:00:00.000Z",
          updatedAt: "2026-07-05T00:00:00.000Z"
        }
      ]
    });
    mocks.upsertScanSchedule.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [],
      schedules: []
    });
    mocks.deleteScanSchedule.mockResolvedValue({
      baselines: [],
      suppressions: [],
      rules: [],
      schedules: []
    });
    mocks.repositoryKey.mockReturnValue("example/repo");
  });

  it("returns scheduled scans", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schedules).toHaveLength(1);
    expect(body.schedules[0].repositoryKey).toBe("example/repo");
  });

  it("upserts a scheduled scan", async () => {
    const response = await POST(
      new Request("http://localhost/api/scans/schedules", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          installationId: 123,
          enabled: true,
          intervalDays: 7,
          nextRunAt: "2026-07-06T00:00:00.000Z",
          notifyOnNewFindings: true,
          notifyOnResolvedFindings: true
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.upsertScanSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryKey: "example/repo",
        repositoryUrl: "https://github.com/example/repo",
        installationId: 123,
        intervalDays: 7
      })
    );
  });

  it("requires an admin bearer token before upserting a scheduled scan when configured", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await POST(
      new Request("http://localhost/api/scans/schedules", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          enabled: true,
          intervalDays: 7
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Admin token is required.");
    expect(mocks.upsertScanSchedule).not.toHaveBeenCalled();
  });

  it("accepts the configured admin bearer token when upserting a scheduled scan", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await POST(
      new Request("http://localhost/api/scans/schedules", {
        method: "POST",
        headers: { Authorization: "Bearer admin-token" },
        body: JSON.stringify({
          repositoryUrl: "https://github.com/example/repo",
          enabled: true,
          intervalDays: 7
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.upsertScanSchedule).toHaveBeenCalled();
  });

  it("deletes a scheduled scan by repository key", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/scans/schedules?repositoryKey=example%2Frepo")
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteScanSchedule).toHaveBeenCalledWith("example/repo");
  });

  it("requires an admin bearer token before deleting a scheduled scan when configured", async () => {
    process.env.SCAN_ADMIN_TOKEN = "admin-token";

    const response = await DELETE(
      new Request("http://localhost/api/scans/schedules?repositoryKey=example%2Frepo")
    );

    expect(response.status).toBe(401);
    expect(mocks.deleteScanSchedule).not.toHaveBeenCalled();
  });
});
