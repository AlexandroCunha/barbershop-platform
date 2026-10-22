/**
 * A booking is upcoming while it has not started yet. `today` and `minuteNow` are read in the
 * shop's own time zone, so a barber sees the same day the customers do.
 */
export function isUpcoming(booking: { date: string; startMinute: number }, today: string, minuteNow: number): boolean {
  if (booking.date !== today) {
    return booking.date > today;
  }
  return booking.startMinute > minuteNow;
}
