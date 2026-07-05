import { describe, expect, it } from "vitest";
import type { ScanScheduleSetting } from "@/lib/scanSettings/types";
import { findDueSchedules, nextRunAtFor } from "./due";

const baseSchedule: ScanScheduleSetting = {
  repositoryKey: "example/repo",
  repositoryUrl: "https://github.com/example/repo",
  enabled: true,
  intervalDays: 7,
  nextRunAt: "2026-07-05T00:00:00.000Z",
  notifyOnNewFindings: true,
  notifyOnResolvedFindings: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
};

describe("scheduled scan due calculation", () => {
  it("returns only enabled schedules whose next run time has passed", () => {
    const due = findDueSchedules(
      [
        baseSchedule,
        { ...baseSchedule, repositoryKey: "example/future", nextRunAt: "2026-07-06T00:00:00.000Z" },
        { ...baseSchedule, repositoryKey: "example/disabled", enabled: false }
      ],
      new Date("2026-07-05T01:00:00Z")
    );

    expect(due.map((schedule) => schedule.repositoryKey)).toEqual(["example/repo"]);
  });

  it("calculates the next run time from a completed run", () => {
    expect(nextRunAtFor(baseSchedule, new Date("2026-07-05T03:00:00Z"))).toBe(
      "2026-07-12T03:00:00.000Z"
    );
  });
});
