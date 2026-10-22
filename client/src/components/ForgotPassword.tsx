import { useState, type FormEvent } from "react";
import { Field, Notice, errorText } from "../admin/ui";
import { useTenant } from "../tenant-context";

/**
 * "Forgot your password?" for the owner or a barber. The reply is the same whether or not the e-mail has an
 * account, so the form never reveals who has one.
 */
export function ForgotPassword({ area }: { area: "owner" | "barber" }) {
  const { api } = useTenant();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <p className="forgot-toggle">
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Forgot your password?
        </button>
      </p>
    );
  }

  if (sent) {
    return (
      <p className="muted" role="status">
        If an account uses this e-mail, a link to choose a new password is on its way. The link works once, for one hour.
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.passwordReset.request(area, email.trim().toLowerCase());
      setSent(true);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="forgot" onSubmit={handleSubmit} noValidate>
      <Field label="Email" htmlFor={`forgot-${area}-email`}>
        <input
          id={`forgot-${area}-email`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <button type="submit" className="btn btn-ghost" disabled={busy || !email.trim()}>
        {busy ? "Sending…" : "Send me a link"}
      </button>
    </form>
  );
}
