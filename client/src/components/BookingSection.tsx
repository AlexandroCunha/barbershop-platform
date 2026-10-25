import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../api";
import { validateStep, type BookingErrors, type CustomerDetails } from "../booking-validation";
import { todayIn } from "../format";
import { useAsync } from "../hooks";
import { useTenant } from "../tenant-context";
import type { Availability, Confirmation, Professional, Service } from "../types";
import { BarberStep } from "./booking/BarberStep";
import { BookingConfirmation } from "./booking/BookingConfirmation";
import { BookingSummary } from "./booking/BookingSummary";
import { DateTimeStep } from "./booking/DateTimeStep";
import { DetailsStep } from "./booking/DetailsStep";
import { ServiceStep } from "./booking/ServiceStep";
import { STEP_BARBER, STEP_DETAILS, STEP_LABELS, STEP_SERVICE, STEP_TIME } from "./booking/steps";

const NO_TIMES: Availability = { date: "", times: [], barbers: [] };
const EMPTY_CUSTOMER: CustomerDetails = { name: "", email: "", phone: "" };

interface Props {
  services: Service[] | null;
  professionals: Professional[] | null;
  loadError: string | null;
  /** Which step is showing. The page holds it, so a barber picked above can start the flow at the service. */
  step: number;
  serviceId?: number;
  professionalId?: number;
  onStepChange: (step: number) => void;
  onServiceChange: (id: number) => void;
  onProfessionalChange: (id: number | undefined) => void;
}

/**
 * The booking flow: barber, then service, then date and time, then the customer's details. Each choice
 * moves the customer on to the next step by itself.
 */
export function BookingSection({
  services,
  professionals,
  loadError,
  step,
  serviceId,
  professionalId,
  onStepChange,
  onServiceChange,
  onProfessionalChange,
}: Props) {
  const { api, business } = useTenant();

  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | undefined>();
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // Every barber's times load together; the chosen barber's own times are picked out below.
  const availability = useAsync<Availability>(
    (signal) => (serviceId && date ? api.availability(serviceId, date, undefined, signal) : Promise.resolve(NO_TIMES)),
    [api, serviceId, date],
  );
  const service = services?.find((item) => item.id === serviceId);
  const barber = professionals?.find((item) => item.id === professionalId);
  const today = todayIn(business.timeZone);

  // A time belongs to one barber and one service, so choosing either again means picking the time again.
  useEffect(() => {
    setTime(undefined);
  }, [serviceId, professionalId]);

  function validate(current: number): BookingErrors {
    return validateStep(current, { serviceId, professionalId, date, time, ...customer }, today);
  }

  function goBack() {
    setErrors({});
    onStepChange(Math.max(STEP_BARBER, step - 1));
  }

  function chooseBarber(id: number) {
    setErrors({});
    onProfessionalChange(id);
    onStepChange(STEP_SERVICE);
  }

  function chooseService(id: number) {
    setErrors({});
    onServiceChange(id);
    onStepChange(STEP_TIME);
  }

  function chooseTime(slot: string) {
    setErrors({});
    setTime(slot);
    onStepChange(STEP_DETAILS);
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
    // Enter on an earlier step must not send the booking; only the details step does.
    if (step !== STEP_DETAILS) return;

    const found = validate(STEP_DETAILS);
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
        onStepChange(STEP_TIME);
      }
      setSubmitError(refusalMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    setConfirmation(null);
    onProfessionalChange(undefined);
    onStepChange(STEP_BARBER);
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
              {STEP_LABELS.map((label, index) => (
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
              {step === STEP_BARBER && (
                <BarberStep
                  professionals={professionals}
                  loadError={loadError}
                  professionalId={professionalId}
                  error={errors.barber}
                  onBarberChange={chooseBarber}
                />
              )}

              {step === STEP_SERVICE && (
                <ServiceStep
                  services={services}
                  loadError={loadError}
                  serviceId={serviceId}
                  error={errors.service}
                  onServiceChange={chooseService}
                />
              )}

              {step === STEP_TIME && (
                <DateTimeStep
                  date={date}
                  time={time}
                  today={today}
                  barber={barber}
                  availability={availability}
                  errors={errors}
                  onDateChange={changeDate}
                  onTimeChange={chooseTime}
                />
              )}

              {step === STEP_DETAILS && <DetailsStep customer={customer} errors={errors} onChange={changeCustomer} />}

              {submitError && (
                <p className="status status-error" role="alert">
                  {submitError}
                </p>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={goBack} disabled={step === STEP_BARBER || submitting}>
                  Back
                </button>
                {step === STEP_DETAILS && (
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
