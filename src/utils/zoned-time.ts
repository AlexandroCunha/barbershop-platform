/**
 * The real instant at which a shop's wall-clock time happens, in that shop's time zone. Daylight saving
 * changes the offset, so the offset is read at the instant itself, not once for the whole day.
 */
export function instantOf(isoDate: string, minuteOfDay: number, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const wallClock = Date.UTC(year, month - 1, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);

  // Two passes: the first finds the offset near the wall-clock time, the second corrects it across a change.
  const first = wallClock - offsetAt(new Date(wallClock), timeZone);
  return new Date(wallClock - offsetAt(new Date(first), timeZone));
}

/** How far ahead of UTC the zone is at this instant, in milliseconds. */
function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const field = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(field("year"), field("month") - 1, field("day"), field("hour"), field("minute"), field("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
