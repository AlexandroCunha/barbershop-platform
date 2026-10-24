import { formatDate, formatDuration, formatPrice } from "../../format";
import { useTenant } from "../../tenant-context";
import type { Confirmation, Professional, Service } from "../../types";

interface Props {
  confirmation: Confirmation;
  service?: Service;
  professionals: Professional[] | null;
  onStartAgain: () => void;
}

/** The summary shown straight after a booking is made: what was booked, where, and where the e-mail went. */
export function BookingConfirmation({ confirmation, service, professionals, onStartAgain }: Props) {
  const { business } = useTenant();
  const barber = professionals?.find((item) => item.id === confirmation.professionalId);
  const address = [business.address.street, business.address.city, business.address.postcode].filter(Boolean).join(", ");

  return (
    // Shown right after the booking is made, so it is visible at once. The reveal-on-scroll effect only
    // covers sections that exist when the page loads, so this one must not wait for it.
    <section id="book" className="block" aria-labelledby="book-title">
      <div className="container">
        <div className="confirmation" role="status">
          <p className="eyebrow">Booking confirmed</p>
          <h2 id="book-title">See you soon, {confirmation.customerName.split(" ")[0]}.</h2>

          <dl className="confirmation-summary">
            <div>
              <dt>Service</dt>
              <dd>{service?.name ?? "Your service"}</dd>
            </div>
            <div>
              <dt>Barber</dt>
              <dd>{barber?.name ?? "One of our barbers"}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatDate(confirmation.date)}, {confirmation.startTime} to {confirmation.endTime}
              </dd>
            </div>
            {service && (
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(service.durationMinutes)}</dd>
              </div>
            )}
            {service && (
              <div>
                <dt>Total</dt>
                <dd>{formatPrice(service.priceCents, business.currency)}</dd>
              </div>
            )}
            {address && (
              <div>
                <dt>Where</dt>
                <dd>{address}</dd>
              </div>
            )}
          </dl>

          {confirmation.confirmationEmail ? (
            <p className="confirmation-line">
              A confirmation with a link to change or cancel this booking has been sent to{" "}
              <strong>{confirmation.confirmationEmail}</strong>.
            </p>
          ) : null}

          <p className="muted">Reference {confirmation.id.slice(0, 8).toUpperCase()}</p>
          <button type="button" className="btn btn-ghost" onClick={onStartAgain}>
            Make another booking
          </button>
        </div>
      </div>
    </section>
  );
}
