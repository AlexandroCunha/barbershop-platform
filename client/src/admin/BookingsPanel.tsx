import { useEffect, useState } from "react";
import { formatDate } from "../format";
import { useTenant } from "../tenant-context";
import type { OwnerBooking } from "../types";
import { Notice, errorText } from "./ui";

/** The server returns at most this many; a full list means there may be more. */
const LIST_LIMIT = 200;

/** Upcoming bookings across every barber, grouped by day, with the customer's contact details. */
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

  const days = groupByDate(bookings);

  return (
    <div className="owner-stack">
      {days.map(([date, items]) => (
        <section className="owner-card" key={date}>
          <h2>{formatDate(date)}</h2>
          <ul className="owner-bookings">
            {items.map((booking) => (
              <li key={booking.id} className="owner-booking">
                <span className="owner-booking-time">
                  {booking.startTime}–{booking.endTime}
                </span>
                <span className="owner-booking-main">
                  <strong>{booking.customerName}</strong> · {booking.serviceName} with {booking.professionalName}
                </span>
                <span className="owner-booking-contact">
                  <a href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a>
                  <a href={`tel:${booking.customerPhone.replace(/\s/g, "")}`}>{booking.customerPhone}</a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {bookings.length === LIST_LIMIT && (
        <p className="muted">Showing the next {LIST_LIMIT} bookings.</p>
      )}
    </div>
  );
}

/** Keeps the server's order and groups the bookings under their date. */
function groupByDate(bookings: OwnerBooking[]): [string, OwnerBooking[]][] {
  const groups = new Map<string, OwnerBooking[]>();
  for (const booking of bookings) {
    const day = groups.get(booking.date) ?? [];
    day.push(booking);
    groups.set(booking.date, day);
  }
  return [...groups];
}
