import { DAYS, type Business, type Day, type DayHours } from "./types";

const priceFormatters = new Map<string, Intl.NumberFormat>();

/** Formats cents in the business currency, e.g. 2800 EUR -> "€28". */
export function formatPrice(cents: number, currency: string): string {
  let formatter = priceFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
    priceFormatters.set(currency, formatter);
  }
  return formatter.format(cents / 100);
}

export const formatDuration = (minutes: number): string => `${minutes} min`;

/** "2030-01-07" -> "Monday, 7 January" */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Today's date in a time zone, as YYYY-MM-DD (for the date picker's minimum). */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/** Current weekday key and clock time in the shop's time zone. */
function localNow(timeZone: string): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase() ?? "monday";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { day: weekday as Day, minutes: hour * 60 + minute };
}

const toMinutes = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export interface OpenStatus {
  open: boolean;
  label: string;
  hours: DayHours | null;
}

/** "Open now until 19:00", "Opens at 09:00", or "Closed today". */
export function openStatus(business: Business): OpenStatus {
  const now = localNow(business.timeZone);
  const hours = business.hours[now.day];

  if (!hours) {
    return { open: false, label: "Closed today", hours };
  }
  const opens = toMinutes(hours.open);
  const closes = toMinutes(hours.close);

  if (now.minutes >= opens && now.minutes < closes) {
    return { open: true, label: `Open now · until ${hours.close}`, hours };
  }
  if (now.minutes < opens) {
    return { open: false, label: `Opens today at ${hours.open}`, hours };
  }
  return { open: false, label: "Closed for today", hours };
}

export const DAY_LABELS: Record<Day, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export const WEEK_ORDER: Day[] = [...DAYS.slice(1), DAYS[0]];

/** The weekday key for a browser date, using the business time zone. */
export function currentDay(timeZone: string): Day {
  return localNow(timeZone).day;
}
