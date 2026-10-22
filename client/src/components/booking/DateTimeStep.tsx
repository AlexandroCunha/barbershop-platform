import type { AsyncState } from "../../hooks";
import type { Availability, Professional } from "../../types";
import type { BookingErrors } from "../../booking-validation";
import { barbersFreeAt, offeredTimes } from "./availability-view";
import { FieldError } from "./FieldError";

interface Props {
  date: string;
  time?: string;
  today: string;
  professionals: Professional[];
  professionalId?: number;
  availability: AsyncState<Availability>;
  errors: BookingErrors;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onProfessionalChange: (id: number) => void;
}

/** Step two: the date, the time, and the barber if the customer has not chosen one yet. */
export function DateTimeStep({
  date,
  time,
  today,
  professionals,
  professionalId,
  availability,
  errors,
  onDateChange,
  onTimeChange,
  onProfessionalChange,
}: Props) {
  const barber = professionals.find((item) => item.id === professionalId);
  const times = offeredTimes(availability.data, professionalId);
  const freeBarbers = time ? barbersFreeAt(availability.data, professionals, time) : [];

  return (
    <div className="date-time">
      <p className="muted">{barber ? `With ${barber.name}` : "Pick a time, then choose your barber."}</p>

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

      {!barber && time && (
        <fieldset>
          <legend>Choose your barber for {time}</legend>
          <div className="option-list">
            {freeBarbers.map((person) => (
              <label key={person.id} className={`option${professionalId === person.id ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="barber-at-time"
                  value={person.id}
                  checked={professionalId === person.id}
                  onChange={() => onProfessionalChange(person.id)}
                />
                <span className="option-main">
                  <span className="option-title">{person.name}</span>
                  {person.specialties.length > 0 && <span className="muted">{person.specialties.join(" · ")}</span>}
                </span>
              </label>
            ))}
          </div>
          <FieldError id="err-barber" message={errors.barber} />
        </fieldset>
      )}
    </div>
  );
}
