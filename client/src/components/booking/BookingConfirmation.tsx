import { formatDate } from "../../format";
import type { Confirmation, Professional, Service } from "../../types";

interface Props {
  confirmation: Confirmation;
  service?: Service;
  professionals: Professional[] | null;
  onStartAgain: () => void;
}

/** Shown in place of the booking flow once the server has accepted the booking. */
export function BookingConfirmation({ confirmation, service, professionals, onStartAgain }: Props) {
  const barber = professionals?.find((item) => item.id === confirmation.professionalId);

  return (
    <section id="book" className="block" data-reveal aria-labelledby="book-title">
      <div className="container">
        <div className="confirmation" role="status">
          <p className="eyebrow">Booking confirmed</p>
          <h2 id="book-title">See you soon, {confirmation.customerName.split(" ")[0]}.</h2>
          <p className="confirmation-line">
            {service?.name} with {barber?.name ?? "one of our barbers"} on {formatDate(confirmation.date)} at{" "}
            {confirmation.startTime}.
          </p>
          <p className="muted">Reference {confirmation.id.slice(0, 8).toUpperCase()}</p>
          <button type="button" className="btn btn-ghost" onClick={onStartAgain}>
            Make another booking
          </button>
        </div>
      </div>
    </section>
  );
}
