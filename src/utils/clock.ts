/** Where the application reads the current time, so tests can fix it. */
export interface Clock {
  now(): Date;
  /** Today's date in the given time zone, as YYYY-MM-DD. */
  today(timeZone: string): string;
}

const dateFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** The real clock, used by the running server. */
export const systemClock: Clock = {
  now: () => new Date(),
  today: (timeZone) => dateFormat(timeZone).format(new Date()),
};

/** Minutes since midnight at `now`, in the given time zone. Used to tell whether a booking has started. */
export function minuteOfDayIn(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}
