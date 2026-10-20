import { useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import type { Service } from "../types";
import { Field, Notice, errorText } from "./ui";

/** Adds a service with its price and duration. */
export function NewServiceForm({ onCreated }: { onCreated: (created: Service) => void }) {
  const { api, business } = useTenant();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    const durationMinutes = Number(duration);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setResult({ kind: "error", text: "Enter a price, for example 28.00." });
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const created = await api.owner.createService({
        name: name.trim(),
        description: "",
        priceCents,
        durationMinutes,
      });
      onCreated(created);
      setName("");
      setPrice("");
      setResult({ kind: "ok", text: `Added ${created.name}.` });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="owner-card owner-form" onSubmit={handleSubmit} noValidate>
      <h2>Add a service</h2>
      <div className="field-row">
        <Field label="Service name" htmlFor="new-service-name">
          <input id="new-service-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={`Price (${business.currency})`} htmlFor="new-service-price">
          <input id="new-service-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
      </div>
      <Field label="Duration (minutes)" htmlFor="new-service-duration">
        <input id="new-service-duration" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} />
      </Field>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <button type="submit" className="btn btn-dark" disabled={busy || !name.trim()}>
          {busy ? "Adding…" : "Add service"}
        </button>
      </div>
    </form>
  );
}
