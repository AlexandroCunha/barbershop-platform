import type { AsyncState } from "../../hooks";
import type { Availability, Professional } from "../../types";
import type { BookingErrors } from "../../booking-validation";
import { offeredTimes } from "./availability-view";
import { FieldError } from "./FieldError";

interface Props {
  date: string;
  time?: string;
  today: string;
  barber?: Professional;
  availability: AsyncState<Availability>;
  errors: BookingErrors;
  onDateChange: (date: string) => void;
  /** Choosing a time moves the customer on to their details. */
  onTimeChange: (time: string) => void;
}

/** Step three: the date, then the time the chosen barber has free. */
export function DateTimeStep({ date, time, today, barber, availability, errors, onDateChange, onTimeChange }: Props) {
  const times = offeredTimes(availability.data, barber?.id);

  return (
    <div className="date-time">
      {barber && <p className="muted">With {barber.name}</p>}

      <div className="field">
        <label htmlFor="booking-date">Date</label>
        <input
          id="booking-date"
          type="date"
          min={today}
          value={date}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? "err-date" : undefined}
          onChange={(event) => onDateChange(event.target.value)}
        />
        <FieldError id="err-date" message={errors.date} />
      </div>

      <div className="field">
        <span className="field-label" id="times-label">
          Available times
        </span>
        {!date && <p className="muted">Choose a date to see available times.</p>}
        {date && availability.loading && (
          <p className="status" role="status">
            Checking availability…
          </p>
        )}
        {date && availability.error && (
          <p className="status status-error" role="alert">
            {availability.error}
          </p>
        )}
        {date && availability.data && times.length === 0 && !availability.loading && (
          <p className="muted">No times left on this day. Try another date.</p>
        )}
        {times.length > 0 && (
          <div className="times" role="group" aria-labelledby="times-label">
            {times.map((slot) => (
              <button
                key={slot}
                type="button"
                className="time"
                aria-pressed={time === slot}
                onClick={() => onTimeChange(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
        <FieldError id="err-time" message={errors.time} />
      </div>
    </div>
  );
}
