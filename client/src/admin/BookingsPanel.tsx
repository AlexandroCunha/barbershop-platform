import { useEffect, useState } from "react";
import { formatDate } from "../format";
import { useTenant } from "../tenant-context";
import type { OwnerBooking } from "../types";
import { Notice, errorText } from "./ui";

/** The server returns at most this many; a full list means there may be more. */
const LIST_LIMIT = 200;

/** One barber's upcoming bookings, grouped by day. */
interface BarberGroup {
  id: number;
  name: string;
  days: [string, OwnerBooking[]][];
}

/** Upcoming bookings split by barber, then grouped by day, with the customer's contact details. */
export function BookingsPanel() {
  const { api } = useTenant();
  const [bookings, setBookings] = useState<OwnerBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.owner
      .bookings()
      .then(setBookings)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [api]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!bookings) return <p className="status">Loading bookings…</p>;
  if (bookings.length === 0) return <p className="muted">No upcoming bookings.</p>;

  const barbers = groupByBarber(bookings);

  return (
    <div className="owner-stack">
      {barbers.map((barber) => (
        <section className="owner-card" key={barber.id}>
          <h2>{barber.name}</h2>
          {barber.days.map(([date, items]) => (
            <div className="owner-day" key={date}>
              <h3>{formatDate(date)}</h3>
              <ul className="owner-bookings">
                {items.map((booking) => (
                  <li key={booking.id} className="owner-booking">
                    <span className="owner-booking-time">
                      {booking.startTime}–{booking.endTime}
                    </span>
                    <span className="owner-booking-main">
                      <strong>{booking.customerName}</strong> · {booking.serviceName}
                    </span>
                    <span className="owner-booking-contact">
                      <a href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a>
                      <a href={`tel:${booking.customerPhone.replace(/\s/g, "")}`}>{booking.customerPhone}</a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {bookings.length === LIST_LIMIT && <p className="muted">Showing the next {LIST_LIMIT} bookings.</p>}
    </div>
  );
}

/** Splits the bookings by barber, A to Z, and keeps each barber's bookings in the server's order by day. */
function groupByBarber(bookings: OwnerBooking[]): BarberGroup[] {
  const byBarber = groupBy(bookings, (booking) => booking.professionalId);
  return [...byBarber]
    .map(([id, items]) => ({
      id,
      name: items[0]!.professionalName,
      days: [...groupBy(items, (booking) => booking.date)],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
