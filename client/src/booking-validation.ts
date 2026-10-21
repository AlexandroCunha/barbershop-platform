/** The fields of the booking form that a step can report on. */
export type BookingField = "service" | "date" | "time" | "name" | "email" | "phone";

export type BookingErrors = Partial<Record<BookingField, string>>;

/** Everything the customer has entered so far, before it is sent to the server. */
export interface BookingDraft {
  serviceId?: number;
  date: string;
  time?: string;
  name: string;
  email: string;
  phone: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** A mobile number has 7 to 15 digits and only digits, spaces, brackets, dashes and a leading +. */
export function isMobileNumber(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return /^\+?[0-9()\s-]+$/.test(trimmed) && digits.length >= 7 && digits.length <= 15;
}

/**
 * The problems with one step of the booking form. Step 0 is the service, step 1 the
 * date and time, and step 2 the customer's details. `today` is the shop's local date.
 */
export function validateStep(step: number, draft: BookingDraft, today: string): BookingErrors {
  const found: BookingErrors = {};

  if (step === 0 && !draft.serviceId) {
    found.service = "Choose a service to continue.";
  }

  if (step === 1) {
    if (!draft.date) found.date = "Choose a date.";
    else if (draft.date < today) found.date = "Choose today or a later date.";
    if (!draft.time) found.time = "Choose an available time.";
  }

  if (step === 2) {
    if (!draft.name.trim()) found.name = "Enter your name.";
    if (!isEmail(draft.email)) found.email = "Enter a valid email address.";
    if (!isMobileNumber(draft.phone)) found.phone = "Enter a mobile number, e.g. +353 85 123 4567.";
  }

  return found;
}
