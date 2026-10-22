import { AppError } from "../utils/app-error.js";
import { minutesToTime, timeToMinutes } from "../utils/time.js";
import { DAYS, type Business, type Day, type DayHours } from "./business.js";
import { openingHoursFor, type TimeWindow } from "./opening-hours.js";

/** A barber's working hours for each day. null means a day off. */
export type BarberWeek = Record<Day, TimeWindow | null>;

/** Bookings start on a half-hour grid, so working hours that start or end between slots are refused. */
const SLOT_MINUTES = 30;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The window a barber can take bookings in on a date. A barber without hours of their own follows the
 * shop's opening hours; a day off gives null.
 */
export function barberWindow(shopHours: Business["hours"], barber: BarberWeek | null, isoDate: string): TimeWindow | null {
  if (!barber) {
    return openingHoursFor(shopHours, isoDate);
  }
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return barber[DAYS[weekday]!];
}

/**
 * Checks the hours a barber (or the owner, for them) sends. Each day is null or a window that starts and
 * ends on the half hour, sits inside the shop's opening hours that day, and closes after it opens.
 */
export function parseBarberWeek(input: unknown, shopHours: Business["hours"]): BarberWeek {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    fail("Send the hours as an object with a value for each day of the week");
  }
  const days = input as Record<string, unknown>;
  const week = {} as BarberWeek;
  for (const day of DAYS) {
    if (!(day in days)) {
      fail(`Send the hours for ${label(day)}, or null for a day off`);
    }
    week[day] = parseDay(days[day], day, shopHours[day]);
  }
  return week;
}

/** The hours in the API's shape, with the shop's hours standing in when the barber has none. */
export function barberWeekToApi(
  barber: BarberWeek | null,
  shopHours: Business["hours"],
): Record<Day, DayHours | null> {
  const result = {} as Record<Day, DayHours | null>;
  for (const day of DAYS) {
    const window = barber ? barber[day] : shopHoursWindow(shopHours[day]);
    result[day] = window ? { open: minutesToTime(window.openMinute), close: minutesToTime(window.closeMinute) } : null;
  }
  return result;
}

function parseDay(value: unknown, day: Day, shop: DayHours | null): TimeWindow | null {
  if (value === null) return null;
  if (!shop) {
    fail(`The shop is closed on ${label(day)}, so the barber cannot work that day`);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    fail(`${label(day)} must be a day off or a start and end time`);
  }
  const { open, close } = value as { open?: unknown; close?: unknown };
  if (typeof open !== "string" || !TIME_PATTERN.test(open) || typeof close !== "string" || !TIME_PATTERN.test(close)) {
    fail(`${label(day)}: use times like 09:00`);
  }

  const openMinute = timeToMinutes(open);
  const closeMinute = timeToMinutes(close);
  if (openMinute % SLOT_MINUTES !== 0 || closeMinute % SLOT_MINUTES !== 0) {
    fail(`${label(day)}: start and end on the half hour`);
  }
  if (closeMinute <= openMinute) {
    fail(`${label(day)}: the end must be after the start`);
  }

  const shopOpen = timeToMinutes(shop!.open);
  const shopClose = timeToMinutes(shop!.close);
  if (openMinute < shopOpen || closeMinute > shopClose) {
    fail(`${label(day)}: keep the hours inside the shop's opening hours (${shop!.open}–${shop!.close})`);
  }
  return { openMinute, closeMinute };
}

function shopHoursWindow(shop: DayHours | null): TimeWindow | null {
  return shop ? { openMinute: timeToMinutes(shop.open), closeMinute: timeToMinutes(shop.close) } : null;
}

const label = (day: Day): string => day.charAt(0).toUpperCase() + day.slice(1);

function fail(message: string): never {
  throw new AppError(400, message);
}
