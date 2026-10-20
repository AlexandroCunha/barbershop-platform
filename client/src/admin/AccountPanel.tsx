import { useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import { Field, Notice, errorText } from "./ui";

/** Lets the signed-in owner change their password. Other sessions are signed out. */
export function AccountPanel() {
  const { api } = useTenant();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (next.length < 12) {
      setResult({ kind: "error", text: "The new password must be at least 12 characters." });
      return;
    }
    if (next !== confirm) {
      setResult({ kind: "error", text: "The new passwords do not match." });
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      await api.owner.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setResult({ kind: "ok", text: "Password changed. Other devices have been signed out." });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="owner-card">
      <h2>Change password</h2>
      <form className="owner-form" onSubmit={handleSubmit} noValidate>
        <Field label="Current password" htmlFor="acc-current">
          <input
            id="acc-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>
        <div className="field-row">
          <Field label="New password" htmlFor="acc-next" hint="At least 12 characters.">
            <input
              id="acc-next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </Field>
          <Field label="Repeat new password" htmlFor="acc-confirm">
            <input
              id="acc-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
        </div>
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
        <div className="owner-savebar">
          <button type="submit" className="btn btn-dark" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}
