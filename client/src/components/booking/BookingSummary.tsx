import { formatDate, formatDuration, formatPrice } from "../../format";
import { useTenant } from "../../tenant-context";
import type { Professional, Service } from "../../types";

interface Props {
  service?: Service;
  barber?: Professional;
  date: string;
  time?: string;
}

/** The side panel that always shows what has been chosen so far. */
export function BookingSummary({ service, barber, date, time }: Props) {
  const { business } = useTenant();
  const priceLabel = service ? formatPrice(service.priceCents, business.currency) : "—";

  return (
    <aside className="summary" aria-label="Your booking" aria-live="polite">
      <h3>Your booking</h3>
      <dl>
        <div>
          <dt>Service</dt>
          <dd>{service?.name ?? "Not chosen"}</dd>
        </div>
        <div>
          <dt>Barber</dt>
          <dd>{barber?.name ?? "Not chosen"}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{date ? formatDate(date) : "Not chosen"}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{time ?? "Not chosen"}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{service ? formatDuration(service.durationMinutes) : "—"}</dd>
        </div>
      </dl>
      <p className="summary-total">
        <span>Total</span>
        <strong>{priceLabel}</strong>
      </p>
    </aside>
  );
}
