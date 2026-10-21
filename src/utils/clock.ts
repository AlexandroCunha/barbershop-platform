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
