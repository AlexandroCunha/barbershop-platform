import { useCallback, useEffect, useState } from "react";
import { RescheduleForm } from "../components/booking/RescheduleForm";
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
  const [moving, setMoving] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api.owner
        .bookings()
        .then(setBookings)
        .catch((caught: unknown) => setError(errorText(caught))),
    [api],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(booking: OwnerBooking) {
    if (!window.confirm(`Cancel ${booking.customerName}'s booking? The customer is e-mailed.`)) return;
    try {
      await api.owner.cancelBooking(booking.id);
      await load();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

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
                    <span className="owner-booking-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setMoving(moving === booking.id ? null : booking.id)}
                      >
                        {moving === booking.id ? "Close" : "Move"}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => void cancel(booking)}>
                        Cancel
                      </button>
                    </span>
                    {moving === booking.id && (
                      <div className="owner-booking-move">
                        <RescheduleForm
                          currentDate={booking.date}
                          loadTimes={(date) =>
                            api.availability(booking.serviceId, date, booking.professionalId).then((result) => result.barbers[0]?.times ?? [])
                          }
                          onMove={async (date, time) => {
                            await api.owner.moveBooking(booking.id, date, time);
                          }}
                          onMoved={() => {
                            setMoving(null);
                            void load();
                          }}
                        />
                      </div>
                    )}
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

