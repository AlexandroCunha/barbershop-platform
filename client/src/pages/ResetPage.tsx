import { useEffect, useState, type FormEvent } from "react";
import { Field, Notice, errorText } from "../admin/ui";
import { useTenant } from "../tenant-context";

const MIN_PASSWORD_LENGTH = 12;

/**
 * Where the link in a reset e-mail leads. The token is read once and then removed from the address bar.
 * The new password is set by the server; this page only collects it.
 */
export function ResetPage() {
  const { api, slug } = useTenant();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get("token") ?? "";
  const area = params.get("area") === "barber" ? "barber" : "owner";
  const signInPath = area === "barber" ? `/${slug}/barber` : `/${slug}/admin`;

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.passwordReset.confirm(token, password);
      setDone(true);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="owner owner-login">
        <div className="login-card">
          <h1>This link is not valid</h1>
          <p className="muted">Ask for a new link from the sign-in page.</p>
          <a href={signInPath}>Go to sign in</a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="owner owner-login">
        <div className="login-card" role="status">
          <h1>Password changed</h1>
          <p className="muted">Your new password is set. Sign in with it to continue.</p>
          <a href={signInPath}>Go to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="owner owner-login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">Choose a new password</p>
        <Field label="New password" htmlFor="reset-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Repeat the new password" htmlFor="reset-confirmation">
          <input
            id="reset-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className="btn btn-dark" disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
