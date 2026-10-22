import type { ReactNode } from "react";
import type { BookingErrors, CustomerDetails } from "../../booking-validation";
import { FieldError } from "./FieldError";

interface Props {
  customer: CustomerDetails;
  errors: BookingErrors;
  onChange: (field: keyof CustomerDetails, value: string) => void;
}

/** Step three: the customer's name and how to reach them about the appointment. */
export function DetailsStep({ customer, errors, onChange }: Props) {
  return (
    <div className="details">
      <CustomerField
        id="customer-name"
        label="Full name"
        name="customerName"
        autoComplete="name"
        value={customer.name}
        error={errors.name}
        onChange={(value) => onChange("name", value)}
      />
      <CustomerField
        id="customer-email"
        label="Email"
        name="customerEmail"
        type="email"
        autoComplete="email"
        value={customer.email}
        error={errors.email}
        onChange={(value) => onChange("email", value)}
      />
      <CustomerField
        id="customer-phone"
        label="Mobile phone"
        name="customerPhone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={25}
        value={customer.phone}
        error={errors.phone}
        onChange={(value) => onChange("phone", value)}
      >
        <p className="muted note">We use your email and phone only about this appointment.</p>
      </CustomerField>
    </div>
  );
}

interface CustomerFieldProps {
  id: string;
  label: string;
  name: string;
  type?: string;
  inputMode?: "tel";
  autoComplete: string;
  maxLength?: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}

function CustomerField({ id, label, error, children, onChange, maxLength = 100, ...input }: CustomerFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `err-${id}` : undefined}
        onChange={(event) => onChange(event.target.value)}
        {...input}
      />
      <FieldError id={`err-${id}`} message={error} />
      {children}
    </div>
  );
}
