import { useEffect, useState } from "react";
import { RescheduleForm } from "../components/booking/RescheduleForm";
import { Notice, errorText } from "../admin/ui";
import { formatDate } from "../format";
import { useTenant } from "../tenant-context";
import type { BookingView } from "../types";

/**
 * A customer's own booking, opened from the link in their e-mail. The link's token is read once and then
 * removed from the address bar, so it is not left in the history or copied with the page.
 */
export function ManagePage() {
  const { api, slug } = useTenant();
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (!token) {
      setError("This link is not valid. Find your booking again from the shop's website.");
      return;
    }
    api.manage
      .view(token)
      .then(setBooking)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [api, token]);

  async function cancel() {
    if (!window.confirm("Cancel this appointment? This cannot be undone.")) return;
    setCancelling(true);
    setError(null);
    try {
      setBooking(await api.manage.cancel(token));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="owner">
      <main className="container owner-main">
        <p className="eyebrow">Your booking</p>
        {error && !booking && <Notice kind="error">{error}</Notice>}
        {!booking && !error && <p className="status">Loading your booking…</p>}

        {booking && (
          <section className="owner-card">
            <h1>
              {booking.serviceName} with {booking.barberName}
            </h1>
            <p className="muted">
              {formatDate(booking.date)}, {booking.startTime} to {booking.endTime}
            </p>

            {booking.status === "cancelled" && <Notice kind="error">This appointment was cancelled.</Notice>}
            {booking.status === "started" && <p className="muted">This appointment has already started.</p>}

            {booking.status === "upcoming" && (
              <>
                {error && <Notice kind="error">{error}</Notice>}
                <h2>Move to another time</h2>
                <RescheduleForm
                  currentDate={booking.date}
                  loadTimes={(date) => api.manage.availability(token, date).then((result) => result.times)}
                  onMove={async (date, time) => setBooking(await api.manage.move(token, date, time))}
                />
                <div className="owner-savebar">
                  <button type="button" className="btn btn-ghost" onClick={cancel} disabled={cancelling}>
                    {cancelling ? "Cancelling…" : "Cancel appointment"}
                  </button>
                </div>
              </>
            )}

            <p className="muted">
              <a href={`/${slug}`}>Book another appointment</a>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
