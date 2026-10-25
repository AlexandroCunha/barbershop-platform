import { useEffect, useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import type { Professional } from "../types";
import { Field, Notice, errorText } from "./ui";

/**
 * Where a barber hears about each new booking, with the customer's summary. It is kept apart from the
 * barber's sign-in, and it is never shown on the public site.
 */
export function BarberContactCard({ person }: { person: Professional }) {
  const { api } = useTenant();
  const [email, setEmail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api.owner
      .barberContact(person.id)
      .then((loaded) => setEmail(loaded.email))
      .catch((caught: unknown) => setLoadError(errorText(caught)));
  }, [api, person.id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email === null) return;
    setBusy(true);
    setResult(null);
    try {
      const saved = await api.owner.saveBarberContact(person.id, email.trim());
      setEmail(saved.email);
      setResult({
        kind: "ok",
        text: saved.email ? `New bookings for ${person.name} will be e-mailed to ${saved.email}.` : "Saved. No booking e-mail is set.",
      });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="owner-card owner-form" onSubmit={handleSave} noValidate>
      <p className="eyebrow">Booking e-mail · {person.name}</p>
      <p className="muted">
        Each new booking is e-mailed here with the customer's summary and contact details. Leave it empty to use the
        barber's sign-in e-mail instead, if they have one.
      </p>
      {loadError && <Notice kind="error">{loadError}</Notice>}
      {email !== null && (
        <Field label="Email" htmlFor={`barber-contact-email-${person.id}`}>
          <input
            id={`barber-contact-email-${person.id}`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
      )}
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <button type="submit" className="btn btn-dark" disabled={busy || email === null}>
          {busy ? "Saving…" : "Save booking e-mail"}
        </button>
      </div>
    </form>
  );
}
