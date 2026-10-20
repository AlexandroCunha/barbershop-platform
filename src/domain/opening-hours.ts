import { timeToMinutes } from "../utils/time.js";
import { DAYS, type Business } from "./business.js";

export interface TimeWindow {
  openMinute: number;
  closeMinute: number;
}

/** The opening window for an ISO date (YYYY-MM-DD), or null when closed. */
export function openingHoursFor(hours: Business["hours"], isoDate: string): TimeWindow | null {
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  const day = DAYS[weekday];
  const dayHours = day ? hours[day] : null;
  if (!dayHours) {
    return null;
  }
  return { openMinute: timeToMinutes(dayHours.open), closeMinute: timeToMinutes(dayHours.close) };
}
