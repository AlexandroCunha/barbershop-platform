import { useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import type { Professional } from "../types";
import { Field, Notice, errorText } from "./ui";

/**
 * The owner gives a barber their own sign-in for the barber area. Saving replaces any earlier login,
 * and ends the barber's open sessions, so an old password stops working at once.
 */
export function BarberLoginCard({ person }: { person: Professional }) {
  const { api, slug } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const saved = await api.owner.setBarberLogin(person.id, email.trim().toLowerCase(), password);
      setPassword("");
      setResult({ kind: "ok", text: `Login saved for ${person.name}. Sign-in email: ${saved.email}.` });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm(`Remove ${person.name}'s login? They will no longer be able to sign in.`)) return;
    setBusy(true);
    setResult(null);
    try {
      await api.owner.removeBarberLogin(person.id);
      setResult({ kind: "ok", text: "Login removed." });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="owner-card owner-form" onSubmit={handleSave} noValidate>
      <p className="eyebrow">Barber login · {person.name}</p>
      <p className="muted">
        Sign-in for the barber area at <code>/{slug}/barber</code>. {person.name.split(" ")[0]} sees only their own
        upcoming bookings.
      </p>
      <div className="field-row">
        <Field label="Email" htmlFor={`barber-login-email-${person.id}`}>
          <input
            id={`barber-login-email-${person.id}`}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor={`barber-login-password-${person.id}`} hint="At least 12 characters.">
          <input
            id={`barber-login-password-${person.id}`}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <button type="button" className="btn btn-ghost" onClick={handleRemove} disabled={busy}>
          Remove login
        </button>
        <button type="submit" className="btn btn-dark" disabled={busy || !email.trim() || !password}>
          {busy ? "Saving…" : "Save login"}
        </button>
      </div>
    </form>
  );
}
