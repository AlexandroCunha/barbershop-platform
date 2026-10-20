import type { TimeWindow } from "./opening-hours.js";

export interface BusyPeriod {
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityQuery {
  window: TimeWindow | null;
  durationMinutes: number;
  busy: readonly BusyPeriod[];
  stepMinutes?: number;
}

/**
 * Pure function: returns every start (in minutes since midnight) on the
 * grid where a service of `durationMinutes` fits inside the opening window
 * without overlapping an existing booking.
 */
export function availableStartMinutes({
  window,
  durationMinutes,
  busy,
  stepMinutes = 30,
}: AvailabilityQuery): number[] {
  if (!window) {
    return [];
  }

  const starts: number[] = [];

  for (let start = window.openMinute; start + durationMinutes <= window.closeMinute; start += stepMinutes) {
    const end = start + durationMinutes;
    const overlaps = busy.some((period) => start < period.endMinute && period.startMinute < end);

    if (!overlaps) {
      starts.push(start);
    }
  }

  return starts;
}
