import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../api";
import { validateStep, type BookingErrors, type CustomerDetails } from "../booking-validation";
import { todayIn } from "../format";
import { useAsync } from "../hooks";
import { useTenant } from "../tenant-context";
import type { Availability, Confirmation, Professional, Service } from "../types";
import { BookingConfirmation } from "./booking/BookingConfirmation";
import { BookingSummary } from "./booking/BookingSummary";
import { DateTimeStep } from "./booking/DateTimeStep";
import { DetailsStep } from "./booking/DetailsStep";
import { ServiceStep } from "./booking/ServiceStep";
import { offeredTimes } from "./booking/availability-view";

const STEPS = ["Service", "Date and time", "Details and confirm"] as const;
const LAST_STEP = STEPS.length - 1;
const NO_TIMES: Availability = { date: "", times: [], barbers: [] };
const EMPTY_CUSTOMER: CustomerDetails = { name: "", email: "", phone: "" };

interface Props {
  services: Service[] | null;
  professionals: Professional[] | null;
  loadError: string | null;
  serviceId?: number;
  professionalId?: number;
  onServiceChange: (id: number) => void;
  onProfessionalChange: (id: number | undefined) => void;
}

/** The booking flow: service, then date and time, then the customer's details. */
export function BookingSection({
  services,
  professionals,
  loadError,
  serviceId,
  professionalId,
  onServiceChange,
  onProfessionalChange,
}: Props) {
  const { api, business } = useTenant();

  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | undefined>();
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // Every barber's times load together, so the customer can choose a barber after picking a time.
  const availability = useAsync<Availability>(
    (signal) => (serviceId && date ? api.availability(serviceId, date, undefined, signal) : Promise.resolve(NO_TIMES)),
    [api, serviceId, date],
  );
  const service = services?.find((item) => item.id === serviceId);
  const barber = professionals?.find((item) => item.id === professionalId);
  const today = todayIn(business.timeZone);

  // A chosen time that the chosen barber does not have free is cleared.
  useEffect(() => {
    if (time && professionalId !== undefined && !offeredTimes(availability.data, professionalId).includes(time)) {
      setTime(undefined);
    }
  }, [professionalId, availability.data]);

  function validate(current: number): BookingErrors {
    return validateStep(current, { serviceId, professionalId, date, time, ...customer }, today);
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

  function changeDate(value: string) {
    setDate(value);
    setTime(undefined);
  }

  function changeCustomer(field: keyof CustomerDetails, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter on an earlier step must not jump ahead; the last step checks every field before sending.
    if (step < LAST_STEP) {
      goNext();
      return;
    }

    const found = validate(LAST_STEP);
    setErrors(found);
    if (!serviceId || !professionalId || !date || !time || Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const booked = await api.book({
        serviceId,
        professionalId,
        date,
        time,
        customerName: customer.name.trim(),
        customerEmail: customer.email.trim(),
        customerPhone: customer.phone.trim(),
      });
      setConfirmation(booked);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The time went to someone else while the customer was deciding, so they pick again.
        setTime(undefined);
        setStep(1);
      }
      setSubmitError(refusalMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    setConfirmation(null);
    onProfessionalChange(undefined);
    setStep(0);
    setDate("");
    setTime(undefined);
    setCustomer(EMPTY_CUSTOMER);
    setErrors({});
    setSubmitError(null);
  }

  if (confirmation) {
    return (
      <BookingConfirmation
        confirmation={confirmation}
        service={service}
        professionals={professionals}
        onStartAgain={startAgain}
      />
    );
  }

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
                <ServiceStep
                  services={services}
                  loadError={loadError}
                  serviceId={serviceId}
                  error={errors.service}
                  onServiceChange={onServiceChange}
                />
              )}

              {step === 1 && (
                <DateTimeStep
                  date={date}
                  time={time}
                  today={today}
                  professionals={professionals ?? []}
                  professionalId={professionalId}
                  availability={availability}
                  errors={errors}
                  onDateChange={changeDate}
                  onTimeChange={setTime}
                  onProfessionalChange={onProfessionalChange}
                />
              )}

              {step === 2 && <DetailsStep customer={customer} errors={errors} onChange={changeCustomer} />}

              {submitError && (
                <p className="status status-error" role="alert">
                  {submitError}
                </p>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={goBack} disabled={step === 0 || submitting}>
                  Back
                </button>
                {step < LAST_STEP ? (
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

          <BookingSummary service={service} barber={barber} date={date} time={time} />
        </div>
      </div>
    </section>
  );
}

/** What the customer is told when the server refuses the booking. */
function refusalMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "That time was just taken. Please choose another time.";
  }
  // The server names what is wrong, or why booking is paused, which is more useful than a generic message.
  if (error instanceof ApiError && (error.status === 400 || error.status === 403)) {
    return error.message;
  }
  return "We could not confirm your booking. Please check your details and try again.";
}
