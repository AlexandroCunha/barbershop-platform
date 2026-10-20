import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../api";
import { formatDate, formatDuration, formatPrice, todayIn } from "../format";
import { useAsync } from "../hooks";
import { useTenant } from "../tenant-context";
import type { Availability, Confirmation, Professional, Service } from "../types";

const STEPS = ["Service", "Date and time", "Details and confirm"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_TIMES: Availability = { date: "", times: [] };

interface Props {
  services: Service[] | null;
  professionals: Professional[] | null;
  loadError: string | null;
  serviceId?: number;
  professionalId?: number;
  onServiceChange: (id: number) => void;
}

type Errors = Partial<Record<"service" | "date" | "time" | "name" | "email" | "phone", string>>;

/** A mobile number has 7 to 15 digits and only digits, spaces, brackets, dashes and a leading +. */
function isMobileNumber(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return /^\+?[0-9()\s-]+$/.test(trimmed) && digits.length >= 7 && digits.length <= 15;
}

export function BookingSection({
  services,
  professionals,
  loadError,
  serviceId,
  professionalId,
  onServiceChange,
}: Props) {
  const { api, business } = useTenant();

  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const availability = useAsync<Availability>(
    (signal) =>
      serviceId && date ? api.availability(serviceId, date, professionalId, signal) : Promise.resolve(NO_TIMES),
    [api, serviceId, date, professionalId],
  );
  const service = services?.find((item) => item.id === serviceId);
  const barber = professionals?.find((item) => item.id === professionalId);
  const today = todayIn(business.timeZone);

  // Times depend on the barber, so a previously chosen time no longer applies.
  useEffect(() => {
    setTime(undefined);
  }, [professionalId]);

  function validate(current: number): Errors {
    const found: Errors = {};
    if (current === 0 && !serviceId) found.service = "Choose a service to continue.";
    if (current === 1) {
      if (!date) found.date = "Choose a date.";
      else if (date < today) found.date = "Choose today or a later date.";
      if (!time) found.time = "Choose an available time.";
    }
    if (current === 2) {
      if (!name.trim()) found.name = "Enter your name.";
      if (!EMAIL_PATTERN.test(email.trim())) found.email = "Enter a valid email address.";
      if (!isMobileNumber(phone)) found.phone = "Enter a mobile number, e.g. +353 85 123 4567.";
    }
    return found;
  }

  function goNext() {
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setStep((value) => value + 1);
    }
  }

  function goBack() {
    setErrors({});
    setStep((value) => Math.max(0, value - 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter inside an earlier step must not jump ahead, and every field is checked before sending.
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }

    const found = validate(2);
    setErrors(found);
    if (!serviceId || !date || !time || Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const booked = await api.book({
        serviceId,
        professionalId,
        date,
        time,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
      });
      setConfirmation(booked);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSubmitError("That time was just taken. Please choose another time.");
        setTime(undefined);
        setStep(1);
      } else if (error instanceof ApiError && (error.status === 400 || error.status === 403)) {
        // The server names what is wrong, or why booking is paused, which is more useful than a generic message.
        setSubmitError(error.message);
      } else {
        setSubmitError("We could not confirm your booking. Please check your details and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    setConfirmation(null);
    setStep(0);
    setDate("");
    setTime(undefined);
    setName("");
    setEmail("");
    setPhone("");
    setErrors({});
    setSubmitError(null);
  }

  if (confirmation) {
    const assigned = professionals?.find((item) => item.id === confirmation.professionalId);
    return (
      <section id="book" className="block" data-reveal aria-labelledby="book-title">
        <div className="container">
          <div className="confirmation" role="status">
            <p className="eyebrow">Booking confirmed</p>
            <h2 id="book-title">See you soon, {confirmation.customerName.split(" ")[0]}.</h2>
            <p className="confirmation-line">
              {service?.name} with {assigned?.name ?? "one of our barbers"} on {formatDate(confirmation.date)} at{" "}
              {confirmation.startTime}.
            </p>
            <p className="muted">Reference {confirmation.id.slice(0, 8).toUpperCase()}</p>
            <button type="button" className="btn btn-ghost" onClick={startAgain}>
              Make another booking
            </button>
          </div>
        </div>
      </section>
    );
  }

  const priceLabel = service ? formatPrice(service.priceCents, business.currency) : "—";

  return (
    <section id="book" className="block" data-reveal aria-labelledby="book-title">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Booking</p>
          <h2 id="book-title">Book your appointment</h2>
        </header>

        {loadError && (
          <p className="status status-error" role="alert">
            {loadError}
          </p>
        )}

        <div className="booking-layout">
          <div className="booking-main">
            <ol className="stepper" aria-label="Booking progress">
              {STEPS.map((label, index) => (
                <li
                  key={label}
                  aria-current={index === step ? "step" : undefined}
                  className={index < step ? "done" : index === step ? "current" : undefined}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>

            <form className="booking-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              {step === 0 && (
                <fieldset>
                  <legend>Choose a service</legend>
                  {!services && !loadError && <p className="status">Loading services…</p>}
                  <div className="option-list">
                    {services?.map((item) => (
                      <label key={item.id} className={`option${serviceId === item.id ? " is-selected" : ""}`}>
                        <input
                          type="radio"
                          name="service"
                          value={item.id}
                          checked={serviceId === item.id}
                          onChange={() => onServiceChange(item.id)}
                        />
                        <span className="option-main">
                          <span className="option-title">{item.name}</span>
                          {item.description && <span className="muted">{item.description}</span>}
                        </span>
                        <span className="option-side">
                          <span className="option-price">{formatPrice(item.priceCents, business.currency)}</span>
                          <span className="muted">{formatDuration(item.durationMinutes)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <FieldError id="err-service" message={errors.service} />
                </fieldset>
              )}

              {step === 1 && (
                <div className="date-time">
                  <p className="muted">{barber ? `With ${barber.name}` : "With the first available barber"}</p>

                  <div className="field">
                    <label htmlFor="booking-date">Date</label>
                    <input
                      id="booking-date"
                      type="date"
                      min={today}
                      value={date}
                      aria-invalid={Boolean(errors.date)}
                      aria-describedby={errors.date ? "err-date" : undefined}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setTime(undefined);
                      }}
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
                    {date && availability.data && availability.data.times.length === 0 && !availability.loading && (
                      <p className="muted">No times left on this day. Try another date.</p>
                    )}
                    {availability.data && availability.data.times.length > 0 && (
                      <div className="times" role="group" aria-labelledby="times-label">
                        {availability.data.times.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className="time"
                            aria-pressed={time === slot}
                            onClick={() => setTime(slot)}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                    <FieldError id="err-time" message={errors.time} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="details">
                  <div className="field">
                    <label htmlFor="customer-name">Full name</label>
                    <input
                      id="customer-name"
                      name="customerName"
                      autoComplete="name"
                      maxLength={100}
                      value={name}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "err-name" : undefined}
                      onChange={(event) => setName(event.target.value)}
                    />
                    <FieldError id="err-name" message={errors.name} />
                  </div>
                  <div className="field">
                    <label htmlFor="customer-email">Email</label>
                    <input
                      id="customer-email"
                      name="customerEmail"
                      type="email"
                      autoComplete="email"
                      maxLength={100}
                      value={email}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "err-email" : undefined}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <FieldError id="err-email" message={errors.email} />
                  </div>
                  <div className="field">
                    <label htmlFor="customer-phone">Mobile phone</label>
                    <input
                      id="customer-phone"
                      name="customerPhone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={25}
                      value={phone}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? "err-phone" : undefined}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                    <FieldError id="err-phone" message={errors.phone} />
                    <p className="muted note">We use your email and phone only about this appointment.</p>
                  </div>
                </div>
              )}

              {submitError && (
                <p className="status status-error" role="alert">
                  {submitError}
                </p>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={goBack} disabled={step === 0 || submitting}>
                  Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button type="button" className="btn btn-dark" onClick={goNext}>
                    Continue
                  </button>
                ) : (
                  <button type="submit" className="btn btn-dark" disabled={submitting}>
                    {submitting ? "Confirming…" : "Confirm booking"}
                  </button>
                )}
              </div>
            </form>
          </div>

          <aside className="summary" aria-label="Your booking" aria-live="polite">
            <h3>Your booking</h3>
            <dl>
              <div>
                <dt>Service</dt>
                <dd>{service?.name ?? "Not chosen"}</dd>
              </div>
              <div>
                <dt>Barber</dt>
                <dd>{barber?.name ?? "First available"}</dd>
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
        </div>
      </div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}
