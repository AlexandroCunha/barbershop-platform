import { useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import { Field, Notice, errorText } from "./ui";

/**
 * The shop's address. The owner may move it once in each period, and the old address keeps working.
 * After a change the owner is taken to the new address, where they sign in again.
 */
export function AddressCard() {
  const { api, slug } = useTenant();
  const [requested, setRequested] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const saved = await api.owner.changeAddress(requested.trim().toLowerCase());
      setResult({ kind: "ok", text: `Your address is now /${saved.slug}. Taking you there to sign in again…` });
      window.setTimeout(() => window.location.assign(`/${saved.slug}/admin`), 1500);
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
      setBusy(false);
    }
  }

  return (
    <section className="owner-card">
      <h2>Site address</h2>
      <p className="muted">
        Your site is at <code>/{slug}</code>. You can choose a new address once every 30 days. The old address keeps
        working and sends visitors to the new one.
      </p>
      <form className="owner-form" onSubmit={handleSubmit} noValidate>
        <Field label="New address" htmlFor="address-new" hint="2–40 letters, digits or dashes, for example my-barber.">
          <input
            id="address-new"
            value={requested}
            onChange={(event) => setRequested(event.target.value)}
            placeholder={slug}
            autoComplete="off"
          />
        </Field>
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
        <div className="owner-savebar">
          <button type="submit" className="btn btn-dark" disabled={busy || !requested.trim()}>
            {busy ? "Saving…" : "Change address"}
          </button>
        </div>
      </form>
    </section>
  );
}
