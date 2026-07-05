import type { ScanScheduleSetting } from "@/lib/scanSettings/types";

export function findDueSchedules(
  schedules: ScanScheduleSetting[],
  now = new Date()
): ScanScheduleSetting[] {
  const timestamp = now.getTime();
  return schedules
    .filter((schedule) => schedule.enabled)
    .filter((schedule) => Date.parse(schedule.nextRunAt) <= timestamp)
    .sort((left, right) => Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt));
}

export function nextRunAtFor(schedule: Pick<ScanScheduleSetting, "intervalDays">, from = new Date()): string {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + schedule.intervalDays);
  return next.toISOString();
}
